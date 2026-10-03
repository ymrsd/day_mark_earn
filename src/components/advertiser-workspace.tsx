"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpRight, CirclePlus, LoaderCircle, Wallet } from "lucide-react";

type Campaign = { id: string; title: string; status: string; requestedViews: number; servedViews: number; totalBudget: string; remainingBudget: string; durationSeconds: number; createdAt: string };

export function AdvertiserWorkspace({ campaigns: initialCampaigns }: { campaigns: Campaign[] }) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  return (
    <div className="mt-8 grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section id="campaigns" className="min-w-0 scroll-mt-24">
        <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Delivery</p><h2 className="mt-1 text-xl font-medium">Your campaigns</h2></div><span className="text-xs text-white/40">Latest 20</span></div>
        {campaigns.length ? <div className="overflow-x-auto rounded-xl border border-white/10"><table className="w-full min-w-[640px] border-collapse text-left"><thead className="bg-white/[.04] text-[10px] uppercase tracking-[.12em] text-white/40"><tr><th className="px-4 py-3 font-medium">Campaign</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Views</th><th className="px-4 py-3 font-medium">Remaining</th></tr></thead><tbody>{campaigns.map((campaign) => <tr key={campaign.id} className="border-t border-white/[.08] text-sm"><td className="px-4 py-4"><span className="block font-medium">{campaign.title}</span><span className="mt-1 block text-xs text-white/35">{campaign.durationSeconds}s · ${campaign.totalBudget} budget</span></td><td className="px-4 py-4"><StatusBadge status={campaign.status} /></td><td className="px-4 py-4 tabular-nums text-white/65">{campaign.servedViews.toLocaleString()} / {campaign.requestedViews.toLocaleString()}</td><td className="px-4 py-4 font-mono text-white/65">${campaign.remainingBudget}</td></tr>)}</tbody></table></div> : <div className="rounded-xl border border-white/10 bg-[#181c17] p-6"><p className="font-medium">No campaigns yet</p><p className="mt-1 text-sm text-white/45">Create a campaign to begin building your delivery history.</p></div>}
        <CampaignForm onCreated={(campaign) => setCampaigns((items) => [campaign, ...items])} />
      </section>

      <aside id="funding" className="scroll-mt-24 rounded-xl border border-white/10 bg-[#181c17] p-5">
        <div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[.13em] text-white/40">Funding</p><h2 className="mt-1 font-semibold">Add advertiser funds</h2></div><Wallet size={18} className="text-[#ccf35a]" /></div>
        <p className="mt-3 text-sm leading-6 text-white/45">Submit payment proof for manual review. Funds unlock once an administrator approves the deposit.</p>
        <DepositForm />
        <p className="mt-4 border-t border-white/[.08] pt-4 text-xs leading-5 text-white/35">Campaign submissions are held for review before they appear in the earner queue.</p>
      </aside>
    </div>
  );
}

function CampaignForm({ onCreated }: { onCreated: (campaign: Campaign) => void }) {
  const [title, setTitle] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(15);
  const [requestedViews, setRequestedViews] = useState(1000);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const total = (requestedViews * 0.003).toFixed(2);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/advertiser/campaigns", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, targetUrl, durationSeconds, requestedViews }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to create campaign.");
      onCreated({ ...data, servedViews: 0, remainingBudget: data.totalBudget, durationSeconds, createdAt: new Date().toISOString() });
      setMessage("Campaign submitted for review.");
      setTitle("");
      setTargetUrl("");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Unable to create campaign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form id="create" onSubmit={submit} className="mt-5 rounded-xl border border-white/10 bg-[#181c17] p-5">
      <div className="mb-4 flex items-center gap-2"><CirclePlus size={17} className="text-[#ccf35a]" /><h3 className="font-semibold">Create campaign</h3></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs text-white/50 sm:col-span-2">Ad title<input required minLength={4} maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#ccf35a]/50" placeholder="A concise campaign title" /></label>
        <label className="block text-xs text-white/50 sm:col-span-2">Destination URL<input required type="url" value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#ccf35a]/50" placeholder="https://example.com" /></label>
        <fieldset><legend className="mb-1.5 text-xs text-white/50">View duration</legend><div className="grid grid-cols-3 gap-1 rounded-lg border border-white/10 bg-black/20 p-1">{[15, 30, 60].map((seconds) => <button key={seconds} type="button" onClick={() => setDurationSeconds(seconds)} className={`h-8 rounded-md text-xs ${durationSeconds === seconds ? "bg-[#ccf35a] font-semibold text-[#171a15]" : "text-white/55 hover:bg-white/[.06]"}`}>{seconds}s</button>)}</div></fieldset>
        <label className="block text-xs text-white/50">Requested views<input required type="number" min={100} max={50000} step={100} value={requestedViews} onChange={(event) => setRequestedViews(Number(event.target.value))} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#ccf35a]/50" /></label>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[.08] pt-4"><span className="text-sm text-white/50">Estimated budget <strong className="ml-2 font-mono text-white">${total}</strong></span><button disabled={busy || requestedViews < 100} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#ccf35a] px-4 text-sm font-semibold text-[#171a15] hover:bg-[#ddf987] disabled:opacity-50">{busy && <LoaderCircle size={15} className="animate-spin" />}{busy ? "Submitting..." : "Submit for review"}</button></div>
      {message && <p role="status" className="mt-3 text-xs text-white/55">{message}</p>}
    </form>
  );
}

function DepositForm() {
  const [amount, setAmount] = useState("25");
  const [paymentMethod, setPaymentMethod] = useState("CRYPTO_FAUCETPAY");
  const [referenceId, setReferenceId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/wallet/deposit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount: Number(amount), paymentMethod, referenceId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to submit deposit.");
      setMessage("Deposit proof submitted for review.");
      setReferenceId("");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Unable to submit deposit.");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="mt-5 space-y-3">
    <label className="block text-xs text-white/50">Amount (USD)<input required type="number" min="5" max="10000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#ccf35a]/50" /></label>
    <label className="block text-xs text-white/50">Payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-[#101310] px-3 text-sm text-white outline-none focus:border-[#ccf35a]/50"><option value="CRYPTO_FAUCETPAY">FaucetPay</option><option value="PAYEER">Payeer</option><option value="MANUAL_BANK">Manual bank transfer</option></select></label>
    <label className="block text-xs text-white/50">Payment reference<input required minLength={4} maxLength={120} value={referenceId} onChange={(event) => setReferenceId(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#ccf35a]/50" placeholder="Transaction ID or proof reference" /></label>
    <button disabled={busy} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/15 text-sm font-medium text-white hover:bg-white/[.05] disabled:opacity-50">{busy ? <LoaderCircle size={15} className="animate-spin" /> : <ArrowUpRight size={15} />}{busy ? "Submitting..." : "Submit deposit proof"}</button>
    {message && <p role="status" className="text-xs leading-5 text-white/55">{message}</p>}
  </form>;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = { ACTIVE: "border-[#ccf35a]/25 bg-[#ccf35a]/10 text-[#ccf35a]", PENDING: "border-amber-200/20 bg-amber-200/[.07] text-amber-100", PAUSED: "border-white/15 bg-white/[.05] text-white/60", COMPLETED: "border-sky-200/20 bg-sky-200/[.07] text-sky-100" };
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-wider ${styles[status] ?? "border-white/15 text-white/50"}`}>{status.toLowerCase()}</span>;
}