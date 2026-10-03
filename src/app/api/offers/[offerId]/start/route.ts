import { randomUUID } from "node:crypto";
import { OfferStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getClientCountry } from "@/lib/ad-availability";
import { getClientIp, hashSignal, isProxy } from "@/lib/fraud-checks";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({ deviceFingerprint: z.string().min(10).max(128) });

export async function POST(request: Request, context: RouteContext<"/api/offers/[offerId]/start">) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (session.user.role !== UserRole.EARNER) return Response.json({ error: "Earner access required." }, { status: 403 });
  if (!process.env.PROXYCHECK_API_KEY) {
    return Response.json({ error: "Proxy screening is not configured. Offer starts are paused.", setupIssues: ["PROXYCHECK_API_KEY"] }, { status: 503 });
  }

  try {
    if (!(await enforceRateLimit(`offer-start:${userId}`, 10))) {
      return Response.json({ error: "Too many offer starts. Try again later." }, { status: 429 });
    }
    const body = schema.safeParse(await request.json());
    if (!body.success) return Response.json({ error: "A valid device check is required." }, { status: 400 });
    const ip = getClientIp(request);
    if (await isProxy(ip)) {
      await prisma.fraudAlert.create({ data: { userId, reason: "Proxy or VPN detected on offer start", ipAddress: hashSignal(ip) } });
      return Response.json({ error: "Offer starts are unavailable from a VPN or proxy connection." }, { status: 403 });
    }

    const { offerId } = await context.params;
    const country = getClientCountry(request);
    const targetCountryFilters = [{ targetCountries: { isEmpty: true } }, ...(country ? [{ targetCountries: { has: country } }] : [])];
    const offer = await prisma.rewardOffer.findFirst({
      where: { id: offerId, status: OfferStatus.ACTIVE, remainingBudget: { gte: 0.01 }, OR: targetCountryFilters },
      select: { id: true, destinationUrl: true, rewardAmount: true },
    });
    if (!offer) return Response.json({ error: "This offer is no longer available." }, { status: 404 });

    const externalClickId = randomUUID();
    const completion = await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { deviceFingerprint: hashSignal(body.data.deviceFingerprint) } });
      return tx.offerCompletion.create({
        data: {
          userId,
          offerId: offer.id,
          externalClickId,
          rewardAmount: offer.rewardAmount,
          ipAddress: hashSignal(ip),
          deviceFingerprint: hashSignal(body.data.deviceFingerprint),
        },
        select: { id: true, status: true },
      });
    });

    const destination = new URL(offer.destinationUrl);
    destination.searchParams.set("subid", externalClickId);
    return Response.json({ started: true, completion, destinationUrl: destination.toString() }, { status: 201 });
  } catch {
    return Response.json({ error: "Offer could not be started. It may already be in your progress list." }, { status: 409 });
  }
}