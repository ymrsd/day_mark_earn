import { OfferCategory, OfferStatus, Prisma, UserRole } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  category: z.enum(["GAME", "APP", "SURVEY", "TASK"]),
  title: z.string().trim().min(4).max(100),
  description: z.string().trim().min(10).max(300),
  instructions: z.string().trim().min(10).max(2000),
  destinationUrl: z.string().url().max(2048),
  rewardAmount: z.number().min(0.01).max(100),
  requestedCompletions: z.number().int().min(1).max(10000),
  evidenceRequired: z.boolean().default(true),
});

export async function POST(request: Request) {
  const session = await auth();
  const advertiserId = session?.user?.id;
  if (!advertiserId) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (session.user.role !== UserRole.ADVERTISER) return Response.json({ error: "Advertiser access required." }, { status: 403 });

  try {
    const body = schema.safeParse(await request.json());
    if (!body.success) return Response.json({ error: "Review the offer details and try again." }, { status: 400 });
    const url = new URL(body.data.destinationUrl);
    if (url.protocol !== "https:" || url.username || url.password || ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
      return Response.json({ error: "Offer destinations must be public HTTPS URLs." }, { status: 400 });
    }

    const rewardAmount = new Prisma.Decimal(body.data.rewardAmount.toFixed(8));
    const totalBudget = rewardAmount.mul(body.data.requestedCompletions);
    const offer = await prisma.$transaction(async (tx) => {
      const debited = await tx.user.updateMany({
        where: { id: advertiserId, role: UserRole.ADVERTISER, advertiserBalance: { gte: totalBudget } },
        data: { advertiserBalance: { decrement: totalBudget } },
      });
      if (debited.count !== 1) throw new Error("INSUFFICIENT_ADVERTISER_FUNDS");

      return tx.rewardOffer.create({
        data: {
          advertiserId,
          providerName: "DIRECT",
          category: body.data.category as OfferCategory,
          title: body.data.title,
          description: body.data.description,
          instructions: body.data.instructions,
          destinationUrl: url.toString(),
          rewardAmount,
          totalBudget,
          remainingBudget: totalBudget,
          requestedCompletions: body.data.requestedCompletions,
          evidenceRequired: body.data.evidenceRequired,
          status: OfferStatus.PENDING,
        },
        select: { id: true, title: true, category: true, status: true, rewardAmount: true, totalBudget: true, requestedCompletions: true },
      });
    });

    return Response.json({ ...offer, rewardAmount: offer.rewardAmount.toString(), totalBudget: offer.totalBudget.toString() }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_ADVERTISER_FUNDS") {
      return Response.json({ error: "Add advertiser funds before submitting this offer." }, { status: 402 });
    }
    return Response.json({ error: "Offer submission is temporarily unavailable." }, { status: 503 });
  }
}