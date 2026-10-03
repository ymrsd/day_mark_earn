import { Prisma, UserRole, CampaignStatus } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  title: z.string().trim().min(4).max(80),
  targetUrl: z.string().url().max(2048),
  durationSeconds: z.union([z.literal(15), z.literal(30), z.literal(60)]),
  requestedViews: z.number().int().min(100).max(50000),
});

const costPerView = new Prisma.Decimal("0.003");
const rewardPerView = new Prisma.Decimal("0.001");

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (session.user.role !== UserRole.ADVERTISER) return Response.json({ error: "Advertiser access required." }, { status: 403 });

  const body = schema.safeParse(await request.json());
  if (!body.success) return Response.json({ error: "Review the campaign details and try again." }, { status: 400 });
  const url = new URL(body.data.targetUrl);
  if (url.protocol !== "https:" || url.username || url.password || ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    return Response.json({ error: "Campaign destinations must be public HTTPS URLs." }, { status: 400 });
  }

  const totalBudget = costPerView.mul(body.data.requestedViews);
  try {
    const campaign = await prisma.$transaction(async (tx) => {
      const debited = await tx.user.updateMany({
        where: { id: userId, role: UserRole.ADVERTISER, advertiserBalance: { gte: totalBudget } },
        data: { advertiserBalance: { decrement: totalBudget } },
      });
      if (debited.count !== 1) throw new Error("INSUFFICIENT_ADVERTISER_FUNDS");

      const created = await tx.campaign.create({
        data: {
          advertiserId: userId,
          title: body.data.title,
          targetUrl: url.toString(),
          durationSeconds: body.data.durationSeconds,
          requestedViews: body.data.requestedViews,
          rewardPerView,
          costPerView,
          totalBudget,
          remainingBudget: totalBudget,
          status: CampaignStatus.PENDING,
        },
        select: { id: true, title: true, status: true, requestedViews: true, totalBudget: true },
      });
      return created;
    });
    return Response.json({ ...campaign, totalBudget: campaign.totalBudget.toString() }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_ADVERTISER_FUNDS") {
      return Response.json({ error: "Add funds before submitting this campaign." }, { status: 402 });
    }
    return Response.json({ error: "Campaign creation is temporarily unavailable." }, { status: 503 });
  }
}