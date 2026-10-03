"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, Clock3, Eye, LoaderCircle, TriangleAlert } from "lucide-react";

type Campaign = { id: string; title: string; durationSeconds: number; rewardPerView: string };
type SetupIssue = { code: string; label: string; envKeys: string[] };
type ExternalNetwork = { name: string; url: string };

export function EarnerWorkspace() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [externalNetworks, setExternalNetworks] = useState<ExternalNetwork[]>([]);
  const [setupIssues, setSetupIssues] = useState<SetupIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/ads", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setError(data.error ?? "The ad queue is unavailable.");
          setSetupIssues(Array.isArray(data.setupIssues) ? data.setupIssues as SetupIssue[] : []);
          return;
        }
        setCampaigns(data.campaigns as Campaign[]);
        setExternalNetworks(Array.isArray(data.externalNetworks) ? data.externalNetworks as ExternalNetwork[] : []);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "The ad queue is unavailable.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="grid min-h-40 place-items-center rounded-xl border border-white/10 bg-[#181c17] text-sm text-white/45"><span className="flex items-center gap-2"><LoaderCircle size={16} className="animate-spin" />Checking available campaigns</span></div>;
  if (error) return (
    <div className="rounded-xl border border-amber-200/15 bg-amber-200/[.04] p-5">
      <div className="flex items-start gap-3 text-sm text-amber-100/85"><TriangleAlert size={19} className="mt-0.5 shrink-0 text-amber-200" /><p>{error}</p></div>
      {setupIssues.length > 0 && <ul className="mt-4 space-y-2 border-t border-amber-100/10 pt-4">{setupIssues.map((issue) => <li key={issue.code} className="text-xs text-white/60"><span className="font-medium text-white/80">{issue.label}</span><span className="mt-1 block font-mono text-[10px] text-white/35">Set: {issue.envKeys.join(", ")}</span></li>)}</ul>}
      <button onClick={() => window.location.reload()} className="mt-4 h-9 rounded-lg border border-white/10 px-3 text-xs text-white/65 hover:bg-white/[.05]">Retry checks</button>
    </div>
  );

  return (
    <div className="space-y-3">
      {campaigns.map((campaign) => (
        <article key={campaign.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-[#181c17] p-4 sm:p-5">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#ccf35a]/10 text-[#ccf35a]"><Eye size={19} /></div>
          <div className="min-w-0 flex-1"><h3 className="truncate font-medium">{campaign.title}</h3><div className="mt-2 flex items-center gap-4 text-xs text-white/45"><span className="inline-flex items-center gap-1.5"><Clock3 size={13} />{campaign.durationSeconds}s</span><span>Verified view</span></div></div>
          <div className="ml-auto flex items-center gap-4"><div className="text-right"><span className="block text-[10px] uppercase tracking-wider text-white/35">Reward</span><span className="mt-1 block font-mono text-sm text-[#ccf35a]">${campaign.rewardPerView}</span></div><Link href={`/watch/${campaign.id}`} aria-label={`Watch ${campaign.title}`} className="grid size-10 place-items-center rounded-lg bg-white/[.07] text-white transition hover:bg-[#ccf35a] hover:text-[#171a15]"><ArrowUpRight size={18} /></Link></div>
        </article>
      ))}
      {campaigns.length === 0 && <div className="rounded-xl border border-white/10 bg-[#181c17] px-5 py-8"><p className="font-medium">No funded campaigns are available right now.</p><p className="mt-1 text-sm text-white/45">Advertisers need to submit funded campaigns and an admin must approve them before views can earn a Daymark balance.</p>{externalNetworks.length > 0 && <div className="mt-5 border-t border-white/[.08] pt-4"><p className="text-xs font-medium text-white/65">External partner networks</p><div className="mt-3 flex flex-wrap gap-2">{externalNetworks.map((network) => <a key={network.name} href={network.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-[#ccf35a] hover:bg-white/[.05]">{network.name}<ArrowUpRight size={13} /></a>)}</div><p className="mt-3 text-[11px] leading-5 text-white/35">External networks control eligibility and payment; these visits do not credit your Daymark balance.</p></div>}{externalNetworks.length === 0 && <p className="mt-4 border-t border-white/[.08] pt-4 text-xs text-white/35">No external network destinations are configured.</p>}</div>}
    </div>
  );
}

export function WithdrawalForm() {
  const [amount, setAmount] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState("CRYPTO_FAUCETPAY");
  const [walletAddress, setWalletAddress] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          paymentMethod,
          ...(paymentMethod === "MANUAL_BANK"
            ? { bankAccountHolder, bankName, bankBranch, bankAccountNumber }
            : { walletAddress }),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to submit withdrawal.");
      setStatus("Request submitted for admin review.");
      setWalletAddress("");
      setBankAccountHolder("");
      setBankName("");
      setBankBranch("");
      setBankAccountNumber("");
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : "Unable to submit withdrawal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3">
      <label className="block text-xs text-white/50">Amount<input required type="number" min="1" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#ccf35a]/50" /></label>
      <label className="block text-xs text-white/50">Payout method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-[#101310] px-3 text-sm text-white outline-none focus:border-[#ccf35a]/50"><option value="CRYPTO_FAUCETPAY">FaucetPay</option><option value="PAYEER">Payeer</option><option value="MANUAL_BANK">Manual bank transfer</option></select></label>
      {paymentMethod === "MANUAL_BANK" ? (
        <fieldset className="space-y-3 rounded-lg border border-white/10 p-3">
          <legend className="px-1 text-xs font-medium text-white/65">Bank account details</legend>
          <label className="block text-xs text-white/50">Account holder name<input required minLength={2} maxLength={120} autoComplete="name" value={bankAccountHolder} onChange={(event) => setBankAccountHolder(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#ccf35a]/50" placeholder="Name on bank account" /></label>
          <label className="block text-xs text-white/50">Bank name<input required minLength={2} maxLength={120} autoComplete="organization" value={bankName} onChange={(event) => setBankName(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#ccf35a]/50" placeholder="Bank" /></label>
          <label className="block text-xs text-white/50">Branch<input required minLength={2} maxLength={120} value={bankBranch} onChange={(event) => setBankBranch(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#ccf35a]/50" placeholder="Branch name" /></label>
          <label className="block text-xs text-white/50">Account number<input required minLength={4} maxLength={40} pattern="[A-Za-z0-9 -]{4,40}" autoComplete="off" value={bankAccountNumber} onChange={(event) => setBankAccountNumber(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 font-mono text-sm text-white outline-none focus:border-[#ccf35a]/50" placeholder="Bank account number" /></label>
          <p className="text-[10px] leading-4 text-white/35">These details are included in the payout request for admin review.</p>
        </fieldset>
      ) : (
        <label className="block text-xs text-white/50">Wallet or account address<input required minLength={5} maxLength={180} value={walletAddress} onChange={(event) => setWalletAddress(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#ccf35a]/50" placeholder="Payout destination" /></label>
      )}
      <button disabled={busy} className="h-10 w-full rounded-lg bg-[#ccf35a] text-sm font-semibold text-[#171a15] hover:bg-[#ddf987] disabled:opacity-50">{busy ? "Submitting..." : "Request withdrawal"}</button>
      {status && <p role="status" className="text-xs leading-5 text-white/55">{status}</p>}
    </form>
  );
}