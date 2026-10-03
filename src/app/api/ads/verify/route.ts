import { Prisma } from "@prisma/client";
import { UserRole, CampaignStatus, AdSessionStatus } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { verifyClaimToken } from "@/lib/claim-token";
import { getClientIp, hashSignal, verifyCaptcha } from "@/lib/fraud-checks";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, releaseAdLock } from "@/lib/rate-limit";

const schema = z.object({ token: z.string().min(20), captchaToken: z.string().min(1) });

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (session.user.role !== UserRole.EARNER) return Response.json({ error: "Earner access required." }, { status: 403 });

  try {
    if (!(await enforceRateLimit(`ad-claim:${userId}`, 8))) {
      return Response.json({ error: "Too many claim attempts. Try again later." }, { status: 429 });
    }

    const body = schema.safeParse(await request.json());
    if (!body.success) return Response.json({ error: "A valid timer token and CAPTCHA response are required." }, { status: 400 });

    const claim = await verifyClaimToken(body.data.token);
    if (claim.userId !== userId || claim.sub !== userId) {
      return Response.json({ error: "This claim belongs to a different account." }, { status: 403 });
    }
    const elapsedSeconds = (Date.now() - claim.startTime) / 1000;
    if (elapsedSeconds < claim.durationSeconds) {
      return Response.json({ error: "The required viewing time has not elapsed." }, { status: 400 });
    }

    const ip = getClientIp(request);
    if (!(await verifyCaptcha(body.data.captchaToken, ip))) {
      return Response.json({ error: "CAPTCHA verification failed." }, { status: 400 });
    }

    const ipHash = hashSignal(ip);
    const claimDate = new Date();
    claimDate.setUTCHours(0, 0, 0, 0);
    const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const reward = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { isBanned: true } });
      if (!user || user.isBanned) throw new Error("ACCOUNT_BLOCKED");

      const adSession = await tx.adSession.findUnique({ where: { id: claim.jti } });
      if (
        !adSession ||
        adSession.userId !== userId ||
        adSession.campaignId !== claim.campaignId ||
        adSession.status !== AdSessionStatus.OPEN ||
        adSession.expiresAt.getTime() < Date.now()
      ) {
        throw new Error("CLAIM_SESSION_INVALID");
      }

      const priorClaim = await tx.adViewHistory.findFirst({
        where: { userId, campaignId: claim.campaignId, OR: [{ claimDate }, { verifiedAt: { gte: recentCutoff } }] },
        select: { id: true },
      });
      if (priorClaim) throw new Error("CLAIM_ALREADY_EARNED");

      const campaign = await tx.campaign.findUnique({ where: { id: claim.campaignId } });
      if (!campaign || campaign.status !== CampaignStatus.ACTIVE || campaign.durationSeconds !== claim.durationSeconds) {
        throw new Error("CAMPAIGN_UNAVAILABLE");
      }

      const updated = await tx.campaign.updateMany({
        where: { id: campaign.id, status: CampaignStatus.ACTIVE, remainingBudget: { gte: campaign.costPerView } },
        data: { remainingBudget: { decrement: campaign.costPerView }, servedViews: { increment: 1 } },
      });
      if (updated.count !== 1) throw new Error("CAMPAIGN_BUDGET_EXHAUSTED");

      await tx.user.update({ where: { id: userId }, data: { balance: { increment: campaign.rewardPerView } } });
      await tx.adViewHistory.create({
        data: {
          userId,
          campaignId: campaign.id,
          rewardAmount: campaign.rewardPerView,
          ipAddress: ipHash,
          deviceFingerprint: adSession.deviceFingerprint,
          claimDate,
        },
      });
      await tx.transaction.create({
        data: { userId, amount: campaign.rewardPerView, type: "EARNING", status: "APPROVED" },
      });
      await tx.transaction.create({
        data: {
          userId: campaign.advertiserId,
          amount: campaign.costPerView.negated(),
          type: "CAMPAIGN_SPEND",
          status: "APPROVED",
        },
      });
      await tx.adSession.update({ where: { id: claim.jti }, data: { status: AdSessionStatus.CLAIMED } });

      const remainingAfterClaim = campaign.remainingBudget.minus(campaign.costPerView);
      if (remainingAfterClaim.lessThanOrEqualTo(0)) {
        await tx.campaign.update({ where: { id: campaign.id }, data: { status: CampaignStatus.COMPLETED } });
      }
      return campaign.rewardPerView.toString();
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await releaseAdLock(userId, claim.jti).catch(() => undefined);
    return Response.json({ claimed: true, reward });
  } catch (error) {
    if (error instanceof Error && error.message === "CLAIM_ALREADY_EARNED") {
      await prisma.fraudAlert.create({ data: { userId, reason: "Repeated campaign claim attempt" } }).catch(() => undefined);
      return Response.json({ error: "You have already viewed this campaign recently." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "CAMPAIGN_BUDGET_EXHAUSTED") {
      return Response.json({ error: "This campaign has run out of budget." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "CLAIM_SESSION_INVALID") {
      return Response.json({ error: "This viewing session is invalid or expired." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "CAMPAIGN_UNAVAILABLE") {
      return Response.json({ error: "This campaign is no longer active." }, { status: 409 });
    }
    return Response.json({ error: "Claim verification is temporarily unavailable." }, { status: 503 });
  }
}