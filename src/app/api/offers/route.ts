import { OfferStatus, UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (session.user.role !== UserRole.EARNER) return Response.json({ error: "Earner access required." }, { status: 403 });

  try {
    if (!(await enforceRateLimit(`offers-feed:${userId}`, 30))) {
      return Response.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
    }

    const offers = await prisma.rewardOffer.findMany({
      where: { status: OfferStatus.ACTIVE, remainingBudget: { gt: 0 } },
      orderBy: [{ category: "asc" }, { rewardAmount: "desc" }],
      take: 100,
      select: {
        id: true,
        category: true,
        title: true,
        description: true,
        instructions: true,
        rewardAmount: true,
        requestedCompletions: true,
        completedCount: true,
        evidenceRequired: true,
        providerName: true,
        completions: {
          where: { userId },
          take: 1,
          select: { id: true, status: true, evidenceUrl: true, proofNote: true, reviewNote: true, startedAt: true },
        },
      },
    });

    return Response.json({ offers: offers.map((offer) => ({
      ...offer,
      rewardAmount: offer.rewardAmount.toString(),
      completion: offer.completions[0] ?? null,
      completions: undefined,
    })) });
  } catch {
    return Response.json({ error: "Offer catalog is temporarily unavailable." }, { status: 503 });
  }
}