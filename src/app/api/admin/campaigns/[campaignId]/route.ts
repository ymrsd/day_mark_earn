import { CampaignStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ status: z.enum(["ACTIVE", "PAUSED", "REJECTED"]) });

export async function PATCH(request: Request, context: RouteContext<"/api/admin/campaigns/[campaignId]">) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (session.user.role !== UserRole.ADMIN) return Response.json({ error: "Admin access required." }, { status: 403 });
  const body = schema.safeParse(await request.json());
  if (!body.success) return Response.json({ error: "Choose a campaign status." }, { status: 400 });
  const { campaignId } = await context.params;

  const result = await prisma.$transaction(async (tx) => {
    const campaign = await tx.campaign.findUnique({ where: { id: campaignId }, select: { id: true, advertiserId: true, totalBudget: true, status: true } });
    if (!campaign) return 0;
    const canReject = campaign.status === CampaignStatus.PENDING;
    const canChangeStatus = canReject || campaign.status === CampaignStatus.ACTIVE || campaign.status === CampaignStatus.PAUSED;
    if (body.data.status === CampaignStatus.REJECTED ? !canReject : !canChangeStatus) return 0;
    const updated = await tx.campaign.updateMany({ where: { id: campaignId, status: campaign.status }, data: { status: body.data.status } });
    if (updated.count === 1 && body.data.status === CampaignStatus.REJECTED) {
      await tx.user.update({ where: { id: campaign.advertiserId }, data: { advertiserBalance: { increment: campaign.totalBudget } } });
    }
    return updated.count;
  });
  if (result !== 1) return Response.json({ error: "Campaign is not available for review." }, { status: 404 });
  return Response.json({ updated: true });
}