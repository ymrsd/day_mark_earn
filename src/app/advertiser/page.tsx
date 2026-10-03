import { redirect } from "next/navigation";
import { BadgeDollarSign, Eye, Megaphone, Wallet } from "lucide-react";
import { AdvertiserWorkspace } from "@/components/advertiser-workspace";
import { AdvertiserOffers } from "@/components/advertiser-offers";
import { DashboardShell } from "@/components/dashboard-shell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdvertiserPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADVERTISER") redirect(session.user.role === "ADMIN" ? "/admin" : "/earner");

  const [user, campaigns, totals, offers] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { advertiserBalance: true } }),
    prisma.campaign.findMany({ where: { advertiserId: session.user.id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, title: true, status: true, requestedViews: true, servedViews: true, totalBudget: true, remainingBudget: true, durationSeconds: true, createdAt: true } }),
    prisma.campaign.aggregate({ where: { advertiserId: session.user.id }, _sum: { servedViews: true, totalBudget: true } }),
    prisma.rewardOffer.findMany({ where: { advertiserId: session.user.id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, title: true, category: true, status: true, rewardAmount: true, totalBudget: true, remainingBudget: true, requestedCompletions: true, completedCount: true, createdAt: true } }),
  ]);

  const campaignData = campaigns.map((campaign) => ({ ...campaign, totalBudget: campaign.totalBudget.toString(), remainingBudget: campaign.remainingBudget.toString(), createdAt: campaign.createdAt.toISOString() }));
  const offerData = offers.map((offer) => ({ ...offer, rewardAmount: offer.rewardAmount.toString(), totalBudget: offer.totalBudget.toString(), remainingBudget: offer.remainingBudget.toString(), createdAt: offer.createdAt.toISOString() }));
  return (
    <DashboardShell role="ADVERTISER" email={session.user.email ?? "Advertiser"}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ccf35a]">Campaign studio</p><h1 className="mt-2 text-3xl font-medium">Reach real attention<span className="text-[#ccf35a]">.</span></h1><p className="mt-2 text-sm text-white/45">Fund a campaign, get it reviewed, and track verified views.</p></div>
        <a href="#create" className="rounded-lg bg-[#ccf35a] px-4 py-2.5 text-sm font-semibold text-[#171a15] hover:bg-[#ddf987]">Create campaign</a>
      </div>
      <section className="grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Wallet} label="Available funds" value={`$${user?.advertiserBalance.toFixed(2) ?? "0.00"}`} accent />
        <Metric icon={Megaphone} label="Campaigns" value={String(campaigns.length)} />
        <Metric icon={Eye} label="Verified views" value={String(totals._sum.servedViews ?? 0)} />
        <Metric icon={BadgeDollarSign} label="Campaign value" value={`$${totals._sum.totalBudget?.toFixed(2) ?? "0.00"}`} />
      </section>
      <AdvertiserWorkspace campaigns={campaignData} />
      <AdvertiserOffers initialOffers={offerData} />
    </DashboardShell>
  );
}

function Metric({ icon: Icon, label, value, accent = false }: { icon: typeof Wallet; label: string; value: string; accent?: boolean }) {
  return <div className="bg-[#181c17] p-4 sm:p-5"><div className="flex items-center justify-between"><span className="text-xs text-white/45">{label}</span><Icon size={17} className={accent ? "text-[#ccf35a]" : "text-white/35"} /></div><p className={`metric-value mt-4 text-2xl font-medium ${accent ? "text-[#ccf35a]" : "text-white"}`}>{value}</p></div>;
}