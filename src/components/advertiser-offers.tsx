"use client";

import { useState, type FormEvent } from "react";
import { CirclePlus, Gamepad2, LoaderCircle } from "lucide-react";

type Offer = {
  id: string;
  title: string;
  category: string;
  status: string;
  rewardAmount: string;
  totalBudget: string;
  remainingBudget: string;
  requestedCompletions: number;
  completedCount: number;
  createdAt: string;
};

export function AdvertiserOffers({ initialOffers }: { initialOffers: Offer[] }) {
  const [offers, setOffers] = useState(initialOffers);
  const [category, setCategory] = useState("GAME");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [rewardAmount, setRewardAmount] = useState("0.10");
  const [requestedCompletions, setRequestedCompletions] = useState("100");
  const [evidenceRequired, setEvidenceRequired] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const budget = (Number(rewardAmount || 0) * Number(requestedCompletions || 0)).toFixed(2);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/advertiser/offers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category, title, description, instructions, destinationUrl, rewardAmount: Number(rewardAmount), requestedCompletions: Number(requestedCompletions), evidenceRequired }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Offer could not be submitted.");
      setOffers((items) => [{ ...data, remainingBudget: data.totalBudget, completedCount: 0, createdAt: new Date().toISOString() }, ...items]);
      setTitle("");
      setDescription("");
      setInstructions("");
      setDestinationUrl("");
      setMessage("Budget reserved. The offer is waiting for admin approval.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Offer could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="offers" className="mt-9 scroll-mt-24">
      <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[.14em] text-white/40">Games and apps</p><h2 className="mt-1 text-xl font-medium">Rewarded offers</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Fund each completion upfront. Earners submit evidence; rewards are charged only after an admin approves the proof.</p></div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,.8fr)]">
        <form onSubmit={submit} className="rounded-xl border border-white/10 bg-[#181c17] p-5">
          <div className="mb-4 flex items-center gap-2"><CirclePlus size={17} className="text-[#ccf35a]" /><h3 className="font-semibold">Create a rewarded offer</h3></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs text-white/50">Offer type<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-[#101310] px-3 text-sm text-white outline-none focus:border-[#ccf35a]/50"><option value="GAME">Play a game</option><option value="APP">Install and use an app</option><option value="SURVEY">Complete a survey</option><option value="TASK">Other task</option></select></label>
            <label className="block text-xs text-white/50">Reward per approved completion<input required type="number" min="0.01" max="100" step="0.01" value={rewardAmount} onChange={(event) => setRewardAmount(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#ccf35a]/50" /></label>
            <label className="block text-xs text-white/50 sm:col-span-2">Offer title<input required minLength={4} maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#ccf35a]/50" placeholder="Example: Reach level 5 in the game" /></label>
            <label className="block text-xs text-white/50 sm:col-span-2">Short description<input required minLength={10} maxLength={300} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#ccf35a]/50" placeholder="Tell earners what the offer is about" /></label>
            <label className="block text-xs text-white/50 sm:col-span-2">Completion instructions<textarea required minLength={10} maxLength={2000} rows={4} value={instructions} onChange={(event) => setInstructions(event.target.value)} className="mt-1.5 w-full resize-y rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-[#ccf35a]/50" placeholder="Steps and exact completion conditions" /></label>
            <label className="block text-xs text-white/50 sm:col-span-2">Destination URL<input required type="url" value={destinationUrl} onChange={(event) => setDestinationUrl(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#ccf35a]/50" placeholder="https://..." /></label>
            <label className="block text-xs text-white/50">Available completions<input required type="number" min="1" max="10000" step="1" value={requestedCompletions} onChange={(event) => setRequestedCompletions(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#ccf35a]/50" /></label>
            <label className="flex items-center gap-2 self-end pb-2 text-xs text-white/55"><input type="checkbox" checked={evidenceRequired} onChange={(event) => setEvidenceRequired(event.target.checked)} className="size-4 accent-[#ccf35a]" />Require evidence link</label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[.08] pt-4"><span className="text-sm text-white/50">Budget reserved <strong className="ml-2 font-mono text-white">${budget}</strong></span><button disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#ccf35a] px-4 text-sm font-semibold text-[#171a15] hover:bg-[#ddf987] disabled:opacity-50">{busy && <LoaderCircle size={15} className="animate-spin" />}{busy ? "Submitting..." : "Submit for approval"}</button></div>
          {message && <p role="status" className="mt-3 text-xs leading-5 text-white/60">{message}</p>}
        </form>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium"><Gamepad2 size={17} className="text-[#ccf35a]" />Your offers</div>
          {offers.length ? offers.map((offer) => <article key={offer.id} className="rounded-xl border border-white/10 bg-[#181c17] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-medium">{offer.title}</h3><p className="mt-1 text-[10px] uppercase tracking-wider text-white/35">{offer.category.toLowerCase()} · ${offer.rewardAmount} each</p></div><StatusBadge status={offer.status} /></div><div className="mt-4 flex justify-between border-t border-white/[.08] pt-3 text-xs text-white/45"><span>{offer.completedCount} / {offer.requestedCompletions} completed</span><span className="font-mono text-white/65">${offer.remainingBudget} left</span></div></article>) : <p className="rounded-xl border border-white/10 bg-[#181c17] p-5 text-sm text-white/40">No game or app offers submitted.</p>}
        </div>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = { ACTIVE: "border-[#ccf35a]/25 bg-[#ccf35a]/10 text-[#ccf35a]", PENDING: "border-amber-200/20 bg-amber-200/[.07] text-amber-100", PAUSED: "border-white/15 bg-white/[.05] text-white/60", COMPLETED: "border-sky-200/20 bg-sky-200/[.07] text-sky-100", REJECTED: "border-rose-200/20 bg-rose-200/[.07] text-rose-100" };
  return <span className={`inline-flex shrink-0 rounded-full border px-2 py-1 text-[9px] uppercase tracking-wider ${styles[status] ?? "border-white/15 text-white/50"}`}>{status.toLowerCase()}</span>;
}