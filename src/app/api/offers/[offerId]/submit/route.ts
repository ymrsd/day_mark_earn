import { OfferCompletionStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getClientIp, verifyCaptcha } from "@/lib/fraud-checks";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  proofNote: z.string().trim().min(10).max(2000),
  evidenceUrl: z.string().url().max(2048).optional().or(z.literal("")),
  captchaToken: z.string().min(1),
});

export async function POST(request: Request, context: RouteContext<"/api/offers/[offerId]/submit">) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (session.user.role !== UserRole.EARNER) return Response.json({ error: "Earner access required." }, { status: 403 });
  if (!process.env.HCAPTCHA_SECRET || !process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY) {
    return Response.json({ error: "CAPTCHA is not configured. Proof submissions are paused.", setupIssues: ["HCAPTCHA_SECRET", "NEXT_PUBLIC_HCAPTCHA_SITE_KEY"] }, { status: 503 });
  }

  try {
    if (!(await enforceRateLimit(`offer-submit:${userId}`, 8))) {
      return Response.json({ error: "Too many submissions. Try again later." }, { status: 429 });
    }
    const body = schema.safeParse(await request.json());
    if (!body.success) return Response.json({ error: "Add a short completion note and valid CAPTCHA." }, { status: 400 });
    if (body.data.evidenceUrl) {
      const evidenceUrl = new URL(body.data.evidenceUrl);
      if (evidenceUrl.protocol !== "https:" || evidenceUrl.username || evidenceUrl.password) {
        return Response.json({ error: "Evidence links must use public HTTPS URLs." }, { status: 400 });
      }
    }
    if (!(await verifyCaptcha(body.data.captchaToken, getClientIp(request)))) {
      return Response.json({ error: "CAPTCHA verification failed." }, { status: 400 });
    }

    const { offerId } = await context.params;
    const completion = await prisma.offerCompletion.findFirst({
      where: { userId, offerId, status: OfferCompletionStatus.STARTED },
      include: { offer: { select: { evidenceRequired: true } } },
    });
    if (!completion) return Response.json({ error: "Start this offer before submitting proof." }, { status: 409 });
    if (completion.offer.evidenceRequired && !body.data.evidenceUrl) {
      return Response.json({ error: "This offer requires an HTTPS evidence link." }, { status: 400 });
    }

    await prisma.offerCompletion.update({
      where: { id: completion.id },
      data: {
        status: OfferCompletionStatus.PENDING,
        proofNote: body.data.proofNote,
        evidenceUrl: body.data.evidenceUrl || null,
        submittedAt: new Date(),
      },
    });
    return Response.json({ submitted: true, status: OfferCompletionStatus.PENDING });
  } catch {
    return Response.json({ error: "Proof could not be submitted right now." }, { status: 503 });
  }
}