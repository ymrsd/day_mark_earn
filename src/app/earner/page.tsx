import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { ArrowRight, BadgeDollarSign, CircleDollarSign, Clock3, Eye, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { EarnerWorkspace, WithdrawalForm } from "@/components/earner-workspace";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RecentEarning = { id: string; amount: Prisma.Decimal; createdAt: Date };

export default async function EarnerPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "EARNER") redirect(session.user.role === "ADMIN" ? "/admin" : "/advertiser");

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  let accountStats: { balance: string; earnedToday: string; viewsToday: number; recent: RecentEarning[] } | null = null;
  try {
    const [user, earned, views, recent] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.user.id }, select: { balance: true } }),
      prisma.transaction.aggregate({ where: { userId: session.user.id, type: "EARNING", status: "APPROVED", createdAt: { gte: today } }, _sum: { amount: true } }),
      prisma.adViewHistory.count({ where: { userId: session.user.id, verifiedAt: { gte: today } } }),
      prisma.transaction.findMany({ where: { userId: session.user.id, type: "EARNING" }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, amount: true, createdAt: true } }),
    ]);
    if (!user) throw new Error("ACCOUNT_NOT_FOUND");
    accountStats = {
      balance: user.balance.toFixed(4),
      earnedToday: earned._sum.amount?.toFixed(4) ?? "0.0000",
      viewsToday: views,
      recent,
    };
  } catch {
    accountStats = null;
  }

  return (
    <DashboardShell role="EARNER" email={session.user.email ?? "Earner"}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ccf35a]">Your earning desk</p><h1 className="mt-2 text-3xl font-medium">Good day<span className="text-[#ccf35a]">.</span></h1><p className="mt-2 text-sm text-white/45">Short views. Clear rewards. Your balance, always yours.</p></div>
        <Link href="#available" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#ccf35a] px-4 text-sm font-semibold text-[#171a15] hover:bg-[#ddf987]">Find an ad <ArrowRight size={16} /></Link>
      </div>

      {!accountStats && <div role="alert" className="mb-6 rounded-lg border border-amber-200/20 bg-amber-200/[.05] px-4 py-3 text-sm text-amber-100/80">Account data is temporarily unavailable. Check the PostgreSQL connection settings; balances and withdrawals are hidden until it reconnects.</div>}

      <section className="grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={CircleDollarSign} label="Available balance" value={accountStats ? `$${accountStats.balance}` : "Unavailable"} accent />
        <Metric icon={BadgeDollarSign} label="Earned today" value={accountStats ? `$${accountStats.earnedToday}` : "Unavailable"} />
        <Metric icon={Eye} label="Views completed" value={accountStats ? String(accountStats.viewsToday) : "Unavailable"} />
        <Metric icon={ShieldCheck} label="Account standing" value="In good standing" />
      </section>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section id="available" className="min-w-0 scroll-mt-24">
          <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Queue</p><h2 className="mt-1 text-xl font-medium">Available ads</h2></div><span className="text-xs text-white/40">One reward per campaign each day</span></div>
          <EarnerWorkspace />
        </section>

        <aside className="space-y-8">
          <section id="withdraw" className="scroll-mt-24 rounded-xl border border-white/10 bg-[#181c17] p-5">
            <div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.13em] text-white/40">Payout</p><h2 className="mt-1 font-semibold">Withdraw funds</h2></div><Clock3 size={18} className="text-[#ccf35a]" /></div>
            <p className="mt-3 text-sm leading-6 text-white/45">Available once your verified balance reaches $1.00. Requests are reviewed by an administrator.</p>
            {accountStats ? <WithdrawalForm /> : <p className="mt-4 text-xs text-amber-100/70">Withdrawal requests are paused until the database reconnects.</p>}
          </section>
          <section className="rounded-xl border border-white/10 p-5">
            <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Recent earnings</h2><BadgeDollarSign size={18} className="text-[#ccf35a]" /></div>
            {!accountStats ? <p className="border-t border-white/[.08] pt-3 text-sm text-white/40">Earning history is unavailable until the database reconnects.</p> : accountStats.recent.length ? <div className="space-y-3">{accountStats.recent.map((item) => <div key={item.id} className="flex items-center justify-between border-t border-white/[.08] pt-3 text-sm"><span><span className="block">View reward</span><span className="mt-1 block text-xs text-white/35">{item.createdAt.toLocaleDateString()}</span></span><span className="font-mono text-[#ccf35a]">+${item.amount.toFixed(4)}</span></div>)}</div> : <p className="border-t border-white/[.08] pt-3 text-sm text-white/40">Your first verified view will appear here.</p>}
          </section>
        </aside>
      </div>
    </DashboardShell>
  );
}

function Metric({ icon: Icon, label, value, accent = false }: { icon: typeof CircleDollarSign; label: string; value: string; accent?: boolean }) {
  return <div className="bg-[#181c17] p-4 sm:p-5"><div className="flex items-center justify-between"><span className="text-xs text-white/45">{label}</span><Icon size={17} className={accent ? "text-[#ccf35a]" : "text-white/35"} /></div><p className={`metric-value mt-4 text-2xl font-medium ${accent ? "text-[#ccf35a]" : "text-white"}`}>{value}</p></div>;
}