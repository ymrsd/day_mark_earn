import { UserRole } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  amount: z.number().min(5).max(10000),
  paymentMethod: z.enum(["CRYPTO_FAUCETPAY", "PAYEER", "MANUAL_BANK"]),
  referenceId: z.string().trim().min(4).max(120),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (session.user.role !== UserRole.ADVERTISER) return Response.json({ error: "Advertiser access required." }, { status: 403 });
  const body = schema.safeParse(await request.json());
  if (!body.success) return Response.json({ error: "Enter a valid deposit amount and payment reference." }, { status: 400 });

  const transaction = await prisma.transaction.create({
    data: {
      userId: session.user.id,
      amount: new Prisma.Decimal(body.data.amount),
      type: "DEPOSIT",
      paymentMethod: body.data.paymentMethod,
      referenceId: body.data.referenceId,
      status: "PENDING",
    },
    select: { id: true, status: true },
  });
  return Response.json(transaction, { status: 201 });
}