import { Prisma, UserRole } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { encryptBankDetails, isBankDetailsEncryptionConfigured } from "@/lib/bank-details";
import { prisma } from "@/lib/prisma";

const configuredMinimum = Number(process.env.MIN_WITHDRAWAL_USD ?? "1.00");
const minimumWithdrawal = Number.isFinite(configuredMinimum) && configuredMinimum >= 0.01 ? configuredMinimum : 1;

const schema = z.object({
  amount: z.number().min(minimumWithdrawal).max(10000),
  paymentMethod: z.enum(["CRYPTO_FAUCETPAY", "PAYEER", "MANUAL_BANK"]),
  walletAddress: z.string().trim().max(180).optional(),
  bankAccountHolder: z.string().trim().max(120).optional(),
  bankName: z.string().trim().max(120).optional(),
  bankBranch: z.string().trim().max(120).optional(),
  bankAccountNumber: z.string().trim().max(40).optional(),
}).superRefine((data, context) => {
  if (data.paymentMethod === "MANUAL_BANK") {
    const bankFields = [
      ["bankAccountHolder", data.bankAccountHolder],
      ["bankName", data.bankName],
      ["bankBranch", data.bankBranch],
      ["bankAccountNumber", data.bankAccountNumber],
    ] as const;
    for (const [field, value] of bankFields) {
      if (!value || value.length < 2) context.addIssue({ code: "custom", path: [field], message: "This bank detail is required." });
    }
    if (data.bankAccountNumber && !/^[a-zA-Z0-9 -]{4,40}$/.test(data.bankAccountNumber)) {
      context.addIssue({ code: "custom", path: ["bankAccountNumber"], message: "Enter a valid account number." });
    }
  } else if (!data.walletAddress || data.walletAddress.length < 5) {
    context.addIssue({ code: "custom", path: ["walletAddress"], message: "A wallet or payout address is required." });
  }
});

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (session.user.role !== UserRole.EARNER) return Response.json({ error: "Earner access required." }, { status: 403 });
  const body = schema.safeParse(await request.json());
  if (!body.success) return Response.json({ error: `Withdrawals start at $${minimumWithdrawal.toFixed(2)}. Check the payout details.` }, { status: 400 });
  if (body.data.paymentMethod === "MANUAL_BANK" && !isBankDetailsEncryptionConfigured()) {
    return Response.json({ error: "Manual bank payouts are not configured. Set BANK_DETAILS_ENCRYPTION_SECRET first." }, { status: 503 });
  }

  const amount = new Prisma.Decimal(body.data.amount);
  try {
    const bankDetailsEncrypted = body.data.paymentMethod === "MANUAL_BANK"
      ? encryptBankDetails({
          accountHolder: body.data.bankAccountHolder!,
          bankName: body.data.bankName!,
          branch: body.data.bankBranch!,
          accountNumber: body.data.bankAccountNumber!,
        })
      : null;
    const transaction = await prisma.$transaction(async (tx) => {
      const debited = await tx.user.updateMany({ where: { id: userId, balance: { gte: amount } }, data: { balance: { decrement: amount } } });
      if (debited.count !== 1) throw new Error("INSUFFICIENT_BALANCE");
      return tx.transaction.create({
        data: {
          userId,
          amount: amount.negated(),
          type: "WITHDRAWAL",
          paymentMethod: body.data.paymentMethod,
          walletAddress: body.data.paymentMethod === "MANUAL_BANK" ? null : body.data.walletAddress,
          bankDetailsEncrypted,
          status: "PENDING",
        },
        select: { id: true, status: true },
      });
    });
    return Response.json(transaction, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      return Response.json({ error: "Your available balance is too low." }, { status: 402 });
    }
    return Response.json({ error: "Withdrawal request is temporarily unavailable." }, { status: 503 });
  }
}