import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Authentication required." }, { status: 401 });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const [user, earned, views] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        role: true,
        balance: true,
        advertiserBalance: true,
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { id: true, amount: true, type: true, status: true, createdAt: true },
        },
      },
    }),
    prisma.transaction.aggregate({ where: { userId: session.user.id, type: "EARNING", status: "APPROVED", createdAt: { gte: today } }, _sum: { amount: true } }),
    prisma.adViewHistory.count({ where: { userId: session.user.id, verifiedAt: { gte: today } } }),
  ]);
  if (!user) return Response.json({ error: "Account not found." }, { status: 404 });

  return Response.json({
    role: user.role,
    balance: user.balance.toString(),
    advertiserBalance: user.advertiserBalance.toString(),
    earnedToday: earned._sum.amount?.toString() ?? "0",
    viewsToday: views,
    transactions: user.transactions.map((entry) => ({ ...entry, amount: entry.amount.toString() })),
  });
}