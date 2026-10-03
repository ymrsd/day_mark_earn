import { OfferStatus, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ status: z.enum(["ACTIVE", "REJECTED"]) });

export async function PATCH(request: Request, context: RouteContext<"/api/admin/offers/[offerId]">) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (session.user.role !== UserRole.ADMIN) return Response.json({ error: "Admin access required." }, { status: 403 });
  const body = schema.safeParse(await request.json());
  if (!body.success) return Response.json({ error: "Choose an offer decision." }, { status: 400 });
  const { offerId } = await context.params;

  try {
    const changed = await prisma.$transaction(async (tx) => {
      const offer = await tx.rewardOffer.findUnique({ where: { id: offerId } });
      if (!offer || offer.status !== OfferStatus.PENDING) return 0;
      const result = await tx.rewardOffer.updateMany({ where: { id: offerId, status: OfferStatus.PENDING }, data: { status: body.data.status } });
      if (result.count === 1 && body.data.status === OfferStatus.REJECTED) {
        await tx.user.update({ where: { id: offer.advertiserId }, data: { advertiserBalance: { increment: offer.totalBudget } } });
      }
      return result.count;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (changed !== 1) return Response.json({ error: "Offer is no longer awaiting approval." }, { status: 409 });
    return Response.json({ reviewed: true });
  } catch {
    return Response.json({ error: "Offer review is temporarily unavailable." }, { status: 503 });
  }
}