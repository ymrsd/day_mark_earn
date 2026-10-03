import { Prisma, TransactionStatus, TransactionType, UserRole } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ status: z.enum(["APPROVED", "REJECTED"]) });

export async function PATCH(request: Request, context: RouteContext<"/api/admin/transactions/[transactionId]">) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (session.user.role !== UserRole.ADMIN) return Response.json({ error: "Admin access required." }, { status: 403 });
  const body = schema.safeParse(await request.json());
  if (!body.success) return Response.json({ error: "Choose an approval decision." }, { status: 400 });
  const { transactionId } = await context.params;

  try {
    await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({ where: { id: transactionId } });
      if (
        !transaction ||
        transaction.status !== TransactionStatus.PENDING ||
        (transaction.type !== TransactionType.DEPOSIT && transaction.type !== TransactionType.WITHDRAWAL)
      ) {
        throw new Error("TRANSACTION_NOT_PENDING");
      }

      const updated = await tx.transaction.updateMany({ where: { id: transaction.id, status: TransactionStatus.PENDING }, data: { status: body.data.status } });
      if (updated.count !== 1) throw new Error("TRANSACTION_NOT_PENDING");

      if (transaction.type === TransactionType.DEPOSIT && body.data.status === TransactionStatus.APPROVED) {
        const owner = await tx.user.findUnique({ where: { id: transaction.userId }, select: { role: true } });
        if (owner?.role !== UserRole.ADVERTISER) throw new Error("DEPOSIT_OWNER_INVALID");
        await tx.user.update({ where: { id: transaction.userId }, data: { advertiserBalance: { increment: transaction.amount } } });
      }
      if (transaction.type === TransactionType.WITHDRAWAL && body.data.status === TransactionStatus.REJECTED) {
        await tx.user.update({ where: { id: transaction.userId }, data: { balance: { increment: transaction.amount.abs() } } });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return Response.json({ updated: true });
  } catch (error) {
    if (error instanceof Error && error.message === "TRANSACTION_NOT_PENDING") {
      return Response.json({ error: "This request has already been reviewed." }, { status: 409 });
    }
    return Response.json({ error: "Transaction review is temporarily unavailable." }, { status: 503 });
  }
}