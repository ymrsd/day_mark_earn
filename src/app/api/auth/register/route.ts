import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashSignal } from "@/lib/fraud-checks";

const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(10).max(72),
  role: z.enum(["EARNER", "ADVERTISER"]).default("EARNER"),
});

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return Response.json({ error: "PostgreSQL is not configured. Set DATABASE_URL and start the database." }, { status: 503 });
  }

  try {
    const ip = getClientIp(request);
    if (!(await enforceRateLimit(`register:${hashSignal(ip)}`, 4))) {
      return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const body = schema.safeParse(await request.json());
    if (!body.success) return Response.json({ error: "Enter a valid email and a password of at least 10 characters." }, { status: 400 });

    const email = body.data.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      return Response.json({ error: "Unable to create account with those details." }, { status: 409 });
    }

    await prisma.user.create({
      data: {
        email,
        passwordHash: await hash(body.data.password, 12),
        role: body.data.role,
        ipAddress: hashSignal(ip),
      },
    });
    return Response.json({ created: true }, { status: 201 });
  } catch {
    return Response.json({ error: "Account storage is unavailable. Check that PostgreSQL is running and DATABASE_URL is correct." }, { status: 503 });
  }
}