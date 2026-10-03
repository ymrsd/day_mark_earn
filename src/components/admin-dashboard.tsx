"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, ArrowDownToLine, ArrowUpRight, Check, CircleDollarSign, Megaphone, Users, X } from "lucide-react";

type Overview = {
  users: number;
  activeCampaigns: number;
  totalPayouts: string;
  totalRevenue: string;
  pendingTransactions: { id: string; userId: string; amount: string; type: string; paymentMethod: string | null; referenceId: string | null; walletAddress: string | null; bankDetails: { accountHolder: string; bankName: string; branch: string; accountNumber: string } | null; createdAt: string; user: { email: string } }[];
  pendingCampaigns: { id: string; title: string; targetUrl: string; requestedViews: number; totalBudget: string; createdAt: string; advertiser: { email: string } }[];
  fraudAlerts: { id: string; userId: string | null; reason: string; ipAddress: string | null; details: unknown; createdAt: string }[];
  sharedIpSignals: { ipAddress: string; userCount: number; viewCount: number }[];
  pendingOffers: { id: string; title: string; category: string; description: string; instructions: string; destinationUrl: string; rewardAmount: string; totalBudget: string; requestedCompletions: number; createdAt: string; advertiser: { email: string } }[];
  pendingOfferCompletions: { id: string; rewardAmount: string; evidenceUrl: string | null; proofNote: string | null; submittedAt: string | null; user: { email: string }; offer: { title: string; category: string; advertiser: { email: string } } }[];
};

export function AdminDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    try {
      const response = await fetch("/api/admin/overview", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load admin data.");
      setOverview(data as Overview);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load admin data.");
    }
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/overview", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load admin data.");
        if (active) setOverview(data as Overview);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load admin data.");
      });
    return () => { active = false; };
  }, []);

  async function reviewTransaction(id: string, status: "APPROVED" | "REJECTED") {
    setBusyId(id);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/transactions/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to review transaction.");
      setNotice(`Request ${status.toLowerCase()}.`);
      await refresh();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Unable to review transaction.");
    } finally {
      setBusyId("");
    }
  }

  async function reviewCampaign(id: string, status: "ACTIVE" | "REJECTED") {
    setBusyId(id);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/campaigns/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to review campaign.");
      setNotice(`Campaign ${status === "ACTIVE" ? "approved" : "rejected"}.`);
      await refresh();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Unable to review campaign.");
    } finally {
      setBusyId("");
    }
  }

  async function reviewOffer(id: string, status: "ACTIVE" | "REJECTED") {
    setBusyId(id);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/offers/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to review offer.");
      setNotice(`Offer ${status === "ACTIVE" ? "approved" : "rejected and refunded"}.`);
      await refresh();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Unable to review offer.");
    } finally {
      setBusyId("");
    }
  }

  async function reviewOfferCompletion(id: string, status: "APPROVED" | "REJECTED") {
    setBusyId(id);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/offers/completions/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to review proof.");
      setNotice(status === "APPROVED" ? "Proof approved; reward credited." : "Proof rejected.");
      await refresh();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Unable to review proof.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ccf35a]">Operations</p><h1 className="mt-2 text-3xl font-medium">Platform overview<span className="text-[#ccf35a]">.</span></h1><p className="mt-2 text-sm text-white/45">Review the queue, protect account integrity, monitor cashflow.</p></div><button onClick={() => void refresh()} aria-label="Refresh overview" title="Refresh overview" className="grid size-10 place-items-center rounded-lg border border-white/10 text-white/55 hover:bg-white/[.06] hover:text-white"><Activity size={17} /></button></div>
      {error && <div role="alert" className="mb-5 flex items-center gap-2 rounded-lg border border-rose-300/20 bg-rose-300/[.06] p-3 text-sm text-rose-200"><AlertTriangle size={16} />{error}</div>}
      {notice && <p role="status" className="mb-5 text-sm text-[#ccf35a]">{notice}</p>}
      <section className="grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Users} label="Total users" value={overview ? overview.users.toLocaleString() : "--"} />
        <Metric icon={Megaphone} label="Active campaigns" value={overview ? String(overview.activeCampaigns) : "--"} />
        <Metric icon={ArrowDownToLine} label="Approved payouts" value={overview ? `$${Number(overview.totalPayouts).toFixed(2)}` : "--"} />
        <Metric icon={CircleDollarSign} label="Campaign revenue" value={overview ? `$${Number(overview.totalRevenue).toFixed(2)}` : "--"} accent />
      </section>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,.8fr)]">
        <section id="requests" className="min-w-0 scroll-mt-24">
          <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-white/40">Manual review</p><h2 className="mt-1 text-xl font-medium">Payment requests</h2></div><span className="rounded-full border border-amber-200/20 px-2.5 py-1 text-[10px] text-amber-100">{overview?.pendingTransactions.length ?? 0} pending</span></div>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[760px] border-collapse text-left"><thead className="bg-white/[.04] text-[10px] uppercase tracking-[.12em] text-white/40"><tr><th className="px-4 py-3 font-medium">Account</th><th className="px-4 py-3 font-medium">Request</th><th className="px-4 py-3 font-medium">Destination / reference</th><th className="px-4 py-3 font-medium">Decision</th></tr></thead><tbody>
              {overview?.pendingTransactions.map((item) => <tr key={item.id} className="border-t border-white/[.08] text-sm"><td className="px-4 py-4"><span className="block max-w-[180px] truncate font-medium">{item.user.email}</span><span className="mt-1 block text-[10px] uppercase text-white/35">{item.type.toLowerCase()}</span></td><td className="px-4 py-4"><span className="font-mono">${Math.abs(Number(item.amount)).toFixed(2)}</span><span className="mt-1 block text-xs text-white/35">{item.paymentMethod?.replaceAll("_", " ")}</span></td><td className="max-w-[240px] px-4 py-4 text-xs text-white/45">{item.paymentMethod === "MANUAL_BANK" ? <div className="space-y-1"><p>Holder: {item.bankDetails?.accountHolder ?? "Unavailable"}</p><p>Bank: {item.bankDetails?.bankName ?? "Unavailable"}</p><p>Branch: {item.bankDetails?.branch ?? "Unavailable"}</p><p className="select-all break-all font-mono text-white/70">Account: {item.bankDetails?.accountNumber ?? "Unavailable"}</p></div> : <span className="block break-all">{item.walletAddress ?? item.referenceId ?? "No reference"}</span>}<span className="mt-1 block">{new Date(item.createdAt).toLocaleDateString()}</span></td><td className="px-4 py-4"><div className="flex gap-2"><button disabled={busyId === item.id} onClick={() => void reviewTransaction(item.id, "APPROVED")} aria-label="Approve request" title="Approve request" className="grid size-8 place-items-center rounded-md bg-[#ccf35a]/10 text-[#ccf35a] hover:bg-[#ccf35a]/20 disabled:opacity-40"><Check size={15} /></button><button disabled={busyId === item.id} onClick={() => void reviewTransaction(item.id, "REJECTED")} aria-label="Reject request" title="Reject request" className="grid size-8 place-items-center rounded-md bg-rose-300/[.08] text-rose-200 hover:bg-rose-300/[.15] disabled:opacity-40"><X size={15} /></button></div></td></tr>)}
              {!overview?.pendingTransactions.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-white/40">No payment requests need review.</td></tr>}
            </tbody></table>
          </div>
        </section>

        <section id="campaign-approvals" className="min-w-0 scroll-mt-24">
          <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[.14em] text-white/40">Ad quality</p><h2 className="mt-1 text-xl font-medium">Campaign approvals</h2></div>
          <div className="space-y-3">{overview?.pendingCampaigns.map((campaign) => <article key={campaign.id} className="rounded-xl border border-white/10 bg-[#181c17] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-medium">{campaign.title}</h3><p className="mt-1 truncate text-xs text-white/40">{campaign.advertiser.email}</p></div><a href={campaign.targetUrl} target="_blank" rel="noopener noreferrer" aria-label="Open campaign destination" title="Open campaign destination" className="grid size-8 shrink-0 place-items-center rounded-md border border-white/10 text-white/55 hover:text-white"><ArrowUpRight size={15} /></a></div><div className="mt-4 flex items-center justify-between text-xs text-white/45"><span>{campaign.requestedViews.toLocaleString()} views requested</span><span className="font-mono text-white">${Number(campaign.totalBudget).toFixed(2)}</span></div><div className="mt-4 flex gap-2"><button disabled={busyId === campaign.id} onClick={() => void reviewCampaign(campaign.id, "ACTIVE")} className="h-9 flex-1 rounded-lg bg-[#ccf35a] text-xs font-semibold text-[#171a15] hover:bg-[#ddf987] disabled:opacity-40">Approve campaign</button><button disabled={busyId === campaign.id} onClick={() => void reviewCampaign(campaign.id, "REJECTED")} className="h-9 rounded-lg border border-white/10 px-3 text-xs text-white/65 hover:bg-white/[.05] disabled:opacity-40">Reject</button></div></article>)}{!overview?.pendingCampaigns.length && <div className="rounded-xl border border-white/10 bg-[#181c17] p-5 text-sm text-white/40">No campaigns awaiting approval.</div>}</div>
        </section>
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        <section id="offer-approvals" className="min-w-0 scroll-mt-24">
          <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-white/40">Advertiser offers</p><h2 className="mt-1 text-xl font-medium">Game and app approval</h2></div><span className="rounded-full border border-amber-200/20 px-2.5 py-1 text-[10px] text-amber-100">{overview?.pendingOffers.length ?? 0} pending</span></div>
          <div className="space-y-3">{overview?.pendingOffers.map((offer) => <article key={offer.id} className="rounded-xl border border-white/10 bg-[#181c17] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] uppercase tracking-wider text-white/40">{offer.category.toLowerCase()} · {offer.advertiser.email}</p><h3 className="mt-1 font-medium">{offer.title}</h3><p className="mt-2 text-xs leading-5 text-white/50">{offer.description}</p></div><a href={offer.destinationUrl} target="_blank" rel="noopener noreferrer" aria-label="Open offer destination" title="Open offer destination" className="grid size-8 shrink-0 place-items-center rounded-md border border-white/10 text-white/55 hover:text-white"><ArrowUpRight size={15} /></a></div><details className="mt-3 border-t border-white/[.08] pt-3"><summary className="cursor-pointer text-xs text-white/55">Review instructions</summary><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-white/45">{offer.instructions}</p></details><div className="mt-4 flex items-center justify-between text-xs text-white/45"><span>{offer.requestedCompletions} completions · ${offer.rewardAmount} each</span><span className="font-mono text-white">${offer.totalBudget} reserved</span></div><div className="mt-4 flex gap-2"><button disabled={busyId === offer.id} onClick={() => void reviewOffer(offer.id, "ACTIVE")} className="h-9 flex-1 rounded-lg bg-[#ccf35a] text-xs font-semibold text-[#171a15] hover:bg-[#ddf987] disabled:opacity-40">Approve offer</button><button disabled={busyId === offer.id} onClick={() => void reviewOffer(offer.id, "REJECTED")} className="h-9 rounded-lg border border-white/10 px-3 text-xs text-white/65 hover:bg-white/[.05] disabled:opacity-40">Reject</button></div></article>)}{!overview?.pendingOffers.length && <div className="rounded-xl border border-white/10 bg-[#181c17] p-5 text-sm text-white/40">No funded offers awaiting review.</div>}</div>
        </section>

        <section id="offer-proofs" className="min-w-0 scroll-mt-24">
          <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-white/40">Completion evidence</p><h2 className="mt-1 text-xl font-medium">Offer proof review</h2></div><span className="rounded-full border border-amber-200/20 px-2.5 py-1 text-[10px] text-amber-100">{overview?.pendingOfferCompletions.length ?? 0} pending</span></div>
          <div className="space-y-3">{overview?.pendingOfferCompletions.map((completion) => <article key={completion.id} className="rounded-xl border border-white/10 bg-[#181c17] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-wider text-white/40">{completion.offer.category.toLowerCase()} offer</p><h3 className="mt-1 font-medium">{completion.offer.title}</h3><p className="mt-1 text-xs text-white/45">{completion.user.email}</p></div><span className="font-mono text-sm text-[#ccf35a]">${completion.rewardAmount}</span></div><p className="mt-3 whitespace-pre-wrap border-t border-white/[.08] pt-3 text-xs leading-5 text-white/55">{completion.proofNote || "No completion note provided."}</p><div className="mt-3 flex items-center justify-between gap-3"><span className="truncate text-[10px] text-white/35">Sponsor: {completion.offer.advertiser.email}</span>{completion.evidenceUrl && <a href={completion.evidenceUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs text-[#ccf35a] hover:text-white">Open evidence <ArrowUpRight size={12} className="inline" /></a>}</div><div className="mt-4 flex gap-2"><button disabled={busyId === completion.id} onClick={() => void reviewOfferCompletion(completion.id, "APPROVED")} className="h-9 flex-1 rounded-lg bg-[#ccf35a] text-xs font-semibold text-[#171a15] hover:bg-[#ddf987] disabled:opacity-40">Approve and credit</button><button disabled={busyId === completion.id} onClick={() => void reviewOfferCompletion(completion.id, "REJECTED")} className="h-9 rounded-lg border border-white/10 px-3 text-xs text-white/65 hover:bg-white/[.05] disabled:opacity-40">Reject proof</button></div></article>)}{!overview?.pendingOfferCompletions.length && <div className="rounded-xl border border-white/10 bg-[#181c17] p-5 text-sm text-white/40">No offer proof awaiting review.</div>}</div>
        </section>
      </div>

      <section id="risk" className="mt-8 scroll-mt-24">
        <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-white/40">Integrity</p><h2 className="mt-1 text-xl font-medium">Open fraud signals</h2></div><AlertTriangle size={18} className="text-amber-200" /></div>
        <div className="overflow-x-auto rounded-xl border border-white/10"><table className="w-full min-w-[560px] border-collapse text-left"><thead className="bg-white/[.04] text-[10px] uppercase tracking-[.12em] text-white/40"><tr><th className="px-4 py-3 font-medium">Signal</th><th className="px-4 py-3 font-medium">Account ID</th><th className="px-4 py-3 font-medium">IP digest</th><th className="px-4 py-3 font-medium">Detected</th></tr></thead><tbody>{overview?.fraudAlerts.map((alert) => <tr key={alert.id} className="border-t border-white/[.08] text-sm"><td className="px-4 py-3 text-amber-100">{alert.reason}</td><td className="px-4 py-3 font-mono text-xs text-white/50">{alert.userId ?? "-"}</td><td className="px-4 py-3 font-mono text-xs text-white/40">{alert.ipAddress?.slice(0, 12) ?? "-"}</td><td className="px-4 py-3 text-xs text-white/45">{new Date(alert.createdAt).toLocaleString()}</td></tr>)}{!overview?.fraudAlerts.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-white/40">No unresolved alerts.</td></tr>}</tbody></table></div>
        <div className="mt-5 overflow-x-auto rounded-xl border border-white/10"><table className="w-full min-w-[560px] border-collapse text-left"><thead className="bg-white/[.04] text-[10px] uppercase tracking-[.12em] text-white/40"><tr><th className="px-4 py-3 font-medium">Shared IP digest</th><th className="px-4 py-3 font-medium">Distinct accounts</th><th className="px-4 py-3 font-medium">Verified views</th><th className="px-4 py-3 font-medium">Window</th></tr></thead><tbody>{overview?.sharedIpSignals.map((signal) => <tr key={signal.ipAddress} className="border-t border-white/[.08] text-sm"><td className="px-4 py-3 font-mono text-xs text-white/55">{signal.ipAddress.slice(0, 20)}</td><td className="px-4 py-3 text-amber-100">{signal.userCount}</td><td className="px-4 py-3 text-white/55">{signal.viewCount}</td><td className="px-4 py-3 text-xs text-white/40">Last 30 days</td></tr>)}{!overview?.sharedIpSignals.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-white/40">No shared-IP patterns detected.</td></tr>}</tbody></table></div>
      </section>
    </>
  );
}

function Metric({ icon: Icon, label, value, accent = false }: { icon: typeof Users; label: string; value: string; accent?: boolean }) {
  return <div className="bg-[#181c17] p-4 sm:p-5"><div className="flex items-center justify-between"><span className="text-xs text-white/45">{label}</span><Icon size={17} className={accent ? "text-[#ccf35a]" : "text-white/35"} /></div><p className={`metric-value mt-4 text-2xl font-medium ${accent ? "text-[#ccf35a]" : "text-white"}`}>{value}</p></div>;
}