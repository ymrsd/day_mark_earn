import { UserRole, CampaignStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { getClientIp, hashSignal, isProxy } from "@/lib/fraud-checks";
import { getAdSetupIssues, getExternalNetworks } from "@/lib/ad-availability";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (session.user.role !== UserRole.EARNER) return Response.json({ error: "Earner access required." }, { status: 403 });

  const setupIssues = getAdSetupIssues();
  if (setupIssues.length) {
    return Response.json({
      error: "Ad earning is paused until the required security services are configured.",
      setupIssues,
    }, { status: 503 });
  }

  try {
    if (!(await enforceRateLimit(`ad-feed:${userId}`, 20))) {
      return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }
    const ip = getClientIp(request);
    if (await isProxy(ip)) {
      await prisma.fraudAlert.create({ data: { userId, reason: "Proxy or VPN detected", ipAddress: hashSignal(ip) } });
      return Response.json({ error: "Ad viewing is unavailable from a VPN or proxy connection." }, { status: 403 });
    }

    const now = new Date();
    const claimDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const recentCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const campaigns = await prisma.campaign.findMany({
      where: {
        status: CampaignStatus.ACTIVE,
        remainingBudget: { gt: 0 },
        adViews: { none: { userId, OR: [{ claimDate }, { verifiedAt: { gte: recentCutoff } }] } },
      },
      orderBy: [{ durationSeconds: "asc" }, { createdAt: "asc" }],
      take: 40,
      select: { id: true, title: true, durationSeconds: true, rewardPerView: true },
    });

    const externalNetworks = campaigns.length === 0 ? getExternalNetworks() : [];
    return Response.json({ campaigns: campaigns.map((campaign) => ({ ...campaign, rewardPerView: campaign.rewardPerView.toString() })), externalNetworks });
  } catch {
    return Response.json({
      error: "Security checks could not complete. Ad viewing is paused to protect your balance.",
      setupIssues: [{ code: "PROXYCHECK", label: "Proxy and VPN screening is unavailable", envKeys: ["PROXYCHECK_API_KEY"] }],
    }, { status: 503 });
  }
}