import { UserRole, TransactionStatus, TransactionType, CampaignStatus } from "@prisma/client";
import { OfferCompletionStatus, OfferStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { decryptBankDetails, isBankDetailsEncryptionConfigured } from "@/lib/bank-details";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (session.user.role !== UserRole.ADMIN) return Response.json({ error: "Admin access required." }, { status: 403 });

  const [users, activeCampaigns, pendingTransactions, openAlerts, payouts, revenue, pendingCampaigns, sharedIps, pendingOffers, pendingOfferCompletions] = await Promise.all([
    prisma.user.count(),
    prisma.campaign.count({ where: { status: CampaignStatus.ACTIVE } }),
    prisma.transaction.findMany({
      where: { status: TransactionStatus.PENDING, type: { in: [TransactionType.DEPOSIT, TransactionType.WITHDRAWAL] } },
      orderBy: { createdAt: "asc" },
      take: 30,
      select: { id: true, userId: true, amount: true, type: true, paymentMethod: true, referenceId: true, walletAddress: true, bankDetailsEncrypted: true, bankAccountHolder: true, bankName: true, bankBranch: true, bankAccountNumber: true, createdAt: true, user: { select: { email: true } } },
    }),
    prisma.fraudAlert.findMany({ where: { resolvedAt: null }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.transaction.aggregate({ where: { type: TransactionType.WITHDRAWAL, status: TransactionStatus.APPROVED }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: TransactionType.CAMPAIGN_SPEND, status: TransactionStatus.APPROVED }, _sum: { amount: true } }),
    prisma.campaign.findMany({ where: { status: CampaignStatus.PENDING }, orderBy: { createdAt: "asc" }, take: 20, select: { id: true, title: true, targetUrl: true, requestedViews: true, totalBudget: true, createdAt: true, advertiser: { select: { email: true } } } }),
    prisma.$queryRaw<{ ipAddress: string; userCount: bigint; viewCount: bigint }[]>`
      SELECT "ipAddress", COUNT(DISTINCT "userId") AS "userCount", COUNT(*) AS "viewCount"
      FROM "AdViewHistory"
      WHERE "verifiedAt" >= NOW() - INTERVAL '30 days'
      GROUP BY "ipAddress"
      HAVING COUNT(DISTINCT "userId") > 1
      ORDER BY COUNT(DISTINCT "userId") DESC
      LIMIT 20
    `,
    prisma.rewardOffer.findMany({ where: { status: OfferStatus.PENDING }, orderBy: { createdAt: "asc" }, take: 20, select: { id: true, title: true, category: true, description: true, instructions: true, destinationUrl: true, rewardAmount: true, totalBudget: true, requestedCompletions: true, createdAt: true, advertiser: { select: { email: true } } } }),
    prisma.offerCompletion.findMany({ where: { status: OfferCompletionStatus.PENDING }, orderBy: { submittedAt: "asc" }, take: 30, select: { id: true, userId: true, offerId: true, rewardAmount: true, evidenceUrl: true, proofNote: true, submittedAt: true, ipAddress: true, user: { select: { email: true } }, offer: { select: { title: true, category: true, advertiser: { select: { email: true } } } } } }),
  ]);

  return Response.json({
    users,
    activeCampaigns,
    totalPayouts: payouts._sum.amount?.abs().toString() ?? "0",
    totalRevenue: revenue._sum.amount?.abs().toString() ?? "0",
    pendingTransactions: pendingTransactions.map(({ bankDetailsEncrypted, bankAccountHolder, bankName, bankBranch, bankAccountNumber, ...item }) => ({
      ...item,
      amount: item.amount.toString(),
      bankDetails: bankDetailsEncrypted && isBankDetailsEncryptionConfigured()
        ? decryptBankDetails(bankDetailsEncrypted)
        : bankAccountHolder && bankName && bankBranch && bankAccountNumber
          ? { accountHolder: bankAccountHolder, bankName, branch: bankBranch, accountNumber: bankAccountNumber }
          : null,
    })),
    pendingCampaigns: pendingCampaigns.map((item) => ({ ...item, totalBudget: item.totalBudget.toString() })),
    fraudAlerts: openAlerts,
    sharedIpSignals: sharedIps.map((item) => ({ ...item, userCount: Number(item.userCount), viewCount: Number(item.viewCount) })),
    pendingOffers: pendingOffers.map((item) => ({ ...item, rewardAmount: item.rewardAmount.toString(), totalBudget: item.totalBudget.toString() })),
    pendingOfferCompletions: pendingOfferCompletions.map((item) => ({ ...item, rewardAmount: item.rewardAmount.toString() })),
  });
}