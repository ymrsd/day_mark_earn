import { OfferCompletionStatus, OfferStatus, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ status: z.enum(["APPROVED", "REJECTED"]), reviewNote: z.string().trim().max(500).optional() });

export async function PATCH(request: Request, context: RouteContext<"/api/admin/offers/completions/[completionId]">) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (session.user.role !== UserRole.ADMIN) return Response.json({ error: "Admin access required." }, { status: 403 });
  const body = schema.safeParse(await request.json());
  if (!body.success) return Response.json({ error: "Choose an approval decision." }, { status: 400 });
  const { completionId } = await context.params;

  try {
    await prisma.$transaction(async (tx) => {
      const completion = await tx.offerCompletion.findUnique({ where: { id: completionId }, include: { offer: true } });
      if (!completion || completion.status !== OfferCompletionStatus.PENDING) throw new Error("OFFER_REVIEW_ALREADY_DONE");

      const changed = await tx.offerCompletion.updateMany({
        where: { id: completion.id, status: OfferCompletionStatus.PENDING },
        data: { status: body.data.status, reviewNote: body.data.reviewNote || null, reviewedAt: new Date() },
      });
      if (changed.count !== 1) throw new Error("OFFER_REVIEW_ALREADY_DONE");
      if (body.data.status === OfferCompletionStatus.REJECTED) return;

      const budget = await tx.rewardOffer.updateMany({
        where: { id: completion.offerId, remainingBudget: { gte: completion.rewardAmount }, status: { in: [OfferStatus.ACTIVE, OfferStatus.PAUSED] } },
        data: { remainingBudget: { decrement: completion.rewardAmount }, completedCount: { increment: 1 } },
      });
      if (budget.count !== 1) throw new Error("OFFER_BUDGET_EXHAUSTED");

      await tx.user.update({ where: { id: completion.userId }, data: { balance: { increment: completion.rewardAmount } } });
      await tx.transaction.create({ data: { userId: completion.userId, amount: completion.rewardAmount, type: "EARNING", status: "APPROVED" } });
      await tx.transaction.create({ data: { userId: completion.offer.advertiserId, amount: completion.rewardAmount.negated(), type: "CAMPAIGN_SPEND", status: "APPROVED" } });

      if (completion.offer.completedCount + 1 >= completion.offer.requestedCompletions) {
        await tx.rewardOffer.update({ where: { id: completion.offerId }, data: { status: OfferStatus.COMPLETED } });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return Response.json({ reviewed: true });
  } catch (error) {
    if (error instanceof Error && error.message === "OFFER_REVIEW_ALREADY_DONE") {
      return Response.json({ error: "This offer submission was already reviewed." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "OFFER_BUDGET_EXHAUSTED") {
      return Response.json({ error: "Offer budget is not sufficient for this reward." }, { status: 409 });
    }
    return Response.json({ error: "Offer review is temporarily unavailable." }, { status: 503 });
  }
}