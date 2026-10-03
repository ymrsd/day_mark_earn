import { randomUUID } from "node:crypto";
import { UserRole, CampaignStatus } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createClaimToken } from "@/lib/claim-token";
import { getClientIp, hashSignal, isProxy } from "@/lib/fraud-checks";
import { getAdSetupIssues } from "@/lib/ad-availability";
import { prisma } from "@/lib/prisma";
import { acquireAdLock, enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({ campaignId: z.string().min(1), deviceFingerprint: z.string().min(10).max(128) });

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (session.user.role !== UserRole.EARNER) return Response.json({ error: "Earner access required." }, { status: 403 });

  const setupIssues = getAdSetupIssues();
  if (setupIssues.length) {
    return Response.json({ error: "Ad viewing is paused until the required security services are configured.", setupIssues }, { status: 503 });
  }

  try {
    if (!(await enforceRateLimit(`ad-start:${userId}`, 10))) {
      return Response.json({ error: "Too many ad starts. Try again later." }, { status: 429 });
    }

    const body = schema.safeParse(await request.json());
    if (!body.success) return Response.json({ error: "A valid campaign is required." }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isBanned: true } });
    if (!user || user.isBanned) return Response.json({ error: "This account cannot view ads." }, { status: 403 });

    const ip = getClientIp(request);
    if (await isProxy(ip)) {
      await prisma.fraudAlert.create({ data: { userId, reason: "Proxy or VPN detected", ipAddress: hashSignal(ip) } });
      return Response.json({ error: "Ad viewing is unavailable from a VPN or proxy connection." }, { status: 403 });
    }

    const now = new Date();
    const claimDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const recentCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: body.data.campaignId,
        status: CampaignStatus.ACTIVE,
        remainingBudget: { gt: 0 },
        adViews: {
          none: {
            userId,
            OR: [{ claimDate }, { verifiedAt: { gte: recentCutoff } }],
          },
        },
      },
      select: { id: true, targetUrl: true, durationSeconds: true, costPerView: true, remainingBudget: true },
    });
    if (!campaign) return Response.json({ error: "This campaign is no longer available to you." }, { status: 404 });
    if (campaign.remainingBudget.lessThan(campaign.costPerView)) {
      return Response.json({ error: "This campaign has run out of budget." }, { status: 404 });
    }

    const jti = randomUUID();
    const expiresAt = new Date(now.getTime() + (campaign.durationSeconds + 300) * 1000);
    if (!(await acquireAdLock(userId, jti, campaign.durationSeconds + 300))) {
      return Response.json({ error: "Another ad viewing session is already active." }, { status: 409 });
    }
    const token = await createClaimToken({
      userId,
      campaignId: campaign.id,
      startTime: now.getTime(),
      durationSeconds: campaign.durationSeconds,
      jti,
    });
    const deviceFingerprint = hashSignal(body.data.deviceFingerprint);
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { deviceFingerprint } }),
      prisma.adSession.create({ data: { id: jti, userId, campaignId: campaign.id, deviceFingerprint, startTime: now, expiresAt } }),
    ]);

    return Response.json({ token, durationSeconds: campaign.durationSeconds, targetUrl: campaign.targetUrl });
  } catch {
    return Response.json({ error: "Security checks are unavailable. Ad viewing is temporarily paused." }, { status: 503 });
  }
}