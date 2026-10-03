"use client";

import { useEffect, useState, type FormEvent } from "react";
import { load } from "@fingerprintjs/fingerprintjs";
import { ArrowUpRight, CheckCircle2, Clock3, Download, Gamepad2, LoaderCircle, Search, ShieldCheck, Smartphone, TriangleAlert } from "lucide-react";
import { HCaptchaWidget } from "@/components/hcaptcha-widget";

type OfferCategory = "GAME" | "APP" | "SURVEY" | "TASK";
type Completion = { id: string; status: "STARTED" | "PENDING" | "APPROVED" | "REJECTED"; evidenceUrl?: string | null; proofNote?: string | null; reviewNote?: string | null };
type Offer = {
  id: string;
  category: OfferCategory;
  title: string;
  description: string;
  instructions: string;
  rewardAmount: string;
  requestedCompletions: number;
  completedCount: number;
  evidenceRequired: boolean;
  providerName: string;
  completion: Completion | null;
};

const categoryOptions: { value: "ALL" | OfferCategory; label: string }[] = [
  { value: "ALL", label: "All offers" },
  { value: "GAME", label: "Games" },
  { value: "APP", label: "Apps" },
  { value: "SURVEY", label: "Surveys" },
  { value: "TASK", label: "Tasks" },
];

export function OfferBoard() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [category, setCategory] = useState<"ALL" | OfferCategory>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/offers", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Offer catalog is unavailable.");
        if (active) setOffers(data.offers as Offer[]);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Offer catalog is unavailable.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function updateOffer(offerId: string, completion: Completion) {
    setOffers((items) => items.map((offer) => offer.id === offerId ? { ...offer, completion } : offer));
  }

  const visibleOffers = category === "ALL" ? offers : offers.filter((offer) => offer.category === category);

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Offer category">
        {categoryOptions.map((option) => <button key={option.value} role="tab" aria-selected={category === option.value} onClick={() => setCategory(option.value)} className={`h-9 rounded-lg border px-3 text-xs transition ${category === option.value ? "border-[#ccf35a]/35 bg-[#ccf35a]/10 text-[#ccf35a]" : "border-white/10 text-white/50 hover:bg-white/[.04] hover:text-white"}`}>{option.label}</button>)}
      </div>

      {loading && <div className="grid min-h-48 place-items-center rounded-xl border border-white/10 bg-[#181c17] text-sm text-white/45"><span className="flex items-center gap-2"><LoaderCircle size={16} className="animate-spin" />Loading offers</span></div>}
      {!loading && error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-200/15 bg-amber-200/[.04] p-5 text-sm text-amber-100/80"><TriangleAlert size={18} className="mt-0.5 shrink-0" /><p>{error}</p></div>}
      {!loading && !error && visibleOffers.length > 0 && <div className="grid gap-3 lg:grid-cols-2">{visibleOffers.map((offer) => <OfferCard key={offer.id} offer={offer} onUpdate={updateOffer} />)}</div>}
      {!loading && !error && visibleOffers.length === 0 && <div className="rounded-xl border border-white/10 bg-[#181c17] p-7"><div className="grid size-11 place-items-center rounded-lg bg-[#ccf35a]/10 text-[#ccf35a]"><Search size={20} /></div><h2 className="mt-4 font-medium">No funded {category === "ALL" ? "offers" : category.toLowerCase() + " offers"} yet.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-white/45">Offers appear here after an advertiser reserves the reward budget and an admin approves the instructions. Your balance is credited only after completion proof is reviewed.</p></div>}
    </div>
  );
}

function OfferCard({ offer, onUpdate }: { offer: Offer; onUpdate: (offerId: string, completion: Completion) => void }) {
  const [completion, setCompletion] = useState<Completion | null>(offer.completion);
  const [destinationUrl, setDestinationUrl] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const Icon = offer.category === "GAME" ? Gamepad2 : offer.category === "APP" ? Smartphone : offer.category === "SURVEY" ? CheckCircle2 : Download;

  async function startOffer() {
    setBusy(true);
    setMessage("");
    try {
      const agent = await load();
      const { visitorId } = await agent.get();
      const response = await fetch(`/api/offers/${offer.id}/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceFingerprint: visitorId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Offer could not be started.");
      setDestinationUrl(data.destinationUrl as string);
      setCompletion(data.completion as Completion);
      onUpdate(offer.id, data.completion as Completion);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Offer could not be started.");
    } finally {
      setBusy(false);
    }
  }

  async function submitProof(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!captchaToken || !completion) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/offers/${offer.id}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proofNote, evidenceUrl, captchaToken }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Proof could not be submitted.");
      const updated = { ...completion, status: "PENDING" as const, evidenceUrl, proofNote };
      setCompletion(updated);
      onUpdate(offer.id, updated);
      setMessage("Proof submitted for review.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Proof could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-xl border border-white/10 bg-[#181c17] p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#ccf35a]/10 text-[#ccf35a]"><Icon size={19} /></div>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] uppercase tracking-[.14em] text-white/40">{offer.category.toLowerCase()} · {offer.providerName}</span>{completion && <CompletionBadge status={completion.status} />}</div><h2 className="mt-1 font-semibold">{offer.title}</h2><p className="mt-2 text-sm leading-5 text-white/50">{offer.description}</p></div>
        <div className="shrink-0 text-right"><span className="block text-[10px] uppercase tracking-wider text-white/35">Reward</span><span className="mt-1 block font-mono text-sm text-[#ccf35a]">${offer.rewardAmount}</span></div>
      </div>

      <details className="mt-4 border-t border-white/[.08] pt-3"><summary className="cursor-pointer text-xs text-white/60">Offer instructions</summary><p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-white/50">{offer.instructions}</p><p className="mt-2 inline-flex items-center gap-1.5 text-[10px] text-white/35"><ShieldCheck size={12} />Proof reviewed before reward credit</p></details>

      {!completion && <button onClick={startOffer} disabled={busy} className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-[#ccf35a] px-3 text-xs font-semibold text-[#171a15] hover:bg-[#ddf987] disabled:opacity-50">{busy ? <LoaderCircle size={14} className="animate-spin" /> : null}{busy ? "Starting..." : "Start offer"}</button>}
      {completion?.status === "STARTED" && <div className="mt-4 space-y-4 border-t border-white/[.08] pt-4">
        {destinationUrl && <a href={destinationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-[#ccf35a] hover:bg-white/[.04]">Open offer destination <ArrowUpRight size={14} /></a>}
        <form onSubmit={submitProof} className="space-y-3">
          <p className="text-xs text-white/55">After completing the offer, submit a note{offer.evidenceRequired ? " and evidence link" : ""} for review.</p>
          <label className="block text-xs text-white/45">Completion details<textarea required minLength={10} maxLength={2000} rows={3} value={proofNote} onChange={(event) => setProofNote(event.target.value)} className="mt-1.5 w-full resize-y rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-[#ccf35a]/50" placeholder="Describe the completed requirement" /></label>
          <label className="block text-xs text-white/45">Evidence URL{offer.evidenceRequired ? " (required)" : " (optional)"}<input required={offer.evidenceRequired} type="url" value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#ccf35a]/50" placeholder="https://..." /></label>
          <HCaptchaWidget siteKey={process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY} onVerify={setCaptchaToken} />
          <button disabled={busy || !captchaToken} className="h-9 rounded-lg bg-white/[.08] px-3 text-xs font-medium text-white hover:bg-white/[.13] disabled:opacity-40">{busy ? "Submitting..." : "Submit proof"}</button>
        </form>
      </div>}
      {completion?.status === "PENDING" && <p className="mt-4 border-t border-white/[.08] pt-3 text-xs text-amber-100/75"><Clock3 size={13} className="mr-1.5 inline" />Submitted; waiting for advertiser/admin review.</p>}
      {completion?.status === "APPROVED" && <p className="mt-4 border-t border-white/[.08] pt-3 text-xs text-[#ccf35a]"><CheckCircle2 size={13} className="mr-1.5 inline" />Approved and credited: ${offer.rewardAmount}</p>}
      {completion?.status === "REJECTED" && <p className="mt-4 border-t border-white/[.08] pt-3 text-xs text-rose-200">Proof rejected{completion.reviewNote ? `: ${completion.reviewNote}` : "."}</p>}
      {message && <p role="status" className="mt-3 text-xs text-white/55">{message}</p>}
    </article>
  );
}

function CompletionBadge({ status }: { status: Completion["status"] }) {
  const styles = {
    STARTED: "border-sky-200/20 bg-sky-200/[.06] text-sky-100",
    PENDING: "border-amber-200/20 bg-amber-200/[.06] text-amber-100",
    APPROVED: "border-[#ccf35a]/20 bg-[#ccf35a]/[.06] text-[#ccf35a]",
    REJECTED: "border-rose-200/20 bg-rose-200/[.06] text-rose-100",
  };
  return <span className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wider ${styles[status]}`}>{status.toLowerCase()}</span>;
}