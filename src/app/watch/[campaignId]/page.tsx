"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { load } from "@fingerprintjs/fingerprintjs";
import { ArrowLeft, ArrowUpRight, Check, ShieldCheck, Timer, TriangleAlert } from "lucide-react";
import { HCaptchaWidget } from "@/components/hcaptcha-widget";
import { useAdTimer } from "@/hooks/useAdTimer";

type SessionData = { token: string; durationSeconds: number; targetUrl: string };

export default function WatchPage({ params }: PageProps<"/watch/[campaignId]">) {
  const [campaignId, setCampaignId] = useState("");
  const [session, setSession] = useState<SessionData | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const [error, setError] = useState("");
  const [claimed, setClaimed] = useState("");
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    void params.then(({ campaignId: id }) => setCampaignId(id));
  }, [params]);

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    void (async () => {
      try {
        const agent = await load();
        const { visitorId } = await agent.get();
        const response = await fetch("/api/ads/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ campaignId, deviceFingerprint: visitorId }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to start this ad.");
        if (!cancelled) setSession(data as SessionData);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to start this ad.");
      }
    })();
    return () => { cancelled = true; };
  }, [campaignId]);

  const timer = useAdTimer(session?.durationSeconds ?? 0);

  async function claimReward() {
    if (!session || !captchaToken || claiming) return;
    setClaiming(true);
    setError("");
    try {
      const response = await fetch("/api/ads/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: session.token, captchaToken }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Claim verification failed.");
      setClaimed(data.reward as string);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Claim verification failed.");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#101310] text-[#f1f2e8]">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#101310]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center gap-5 px-4 py-3 sm:px-8">
          <Link href="/" aria-label="Back to dashboard" className="grid size-10 shrink-0 place-items-center rounded-lg border border-white/10 text-white/70 hover:text-white"><ArrowLeft size={18} /></Link>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs">
              <span className="font-medium uppercase tracking-[0.13em] text-white/50">Sponsored session</span>
              <span className="tabular-nums text-[#ccf35a]">{session ? `${timer.remainingSeconds}s` : "--"}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[#ccf35a] transition-[width] duration-200" style={{ width: `${timer.progress * 100}%` }} /></div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-white/55 sm:flex"><ShieldCheck size={15} className="text-[#ccf35a]" /> Secure view</div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-6 px-4 py-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:py-8">
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ccf35a]">Destination</p>
              <h1 className="mt-1 text-lg font-semibold">Sponsored website</h1>
            </div>
            {session && <a className="inline-flex items-center gap-2 text-sm text-white/65 hover:text-white" href={session.targetUrl} target="_blank" rel="noopener noreferrer">Open in new tab <ArrowUpRight size={15} /></a>}
          </div>
          <div className="relative min-h-[55vh] overflow-hidden rounded-xl border border-white/10 bg-[#1a1e19] lg:min-h-[72vh]">
            {session ? <iframe title="Sponsored website" src={session.targetUrl} className="absolute inset-0 size-full bg-white" sandbox="allow-scripts allow-forms" referrerPolicy="no-referrer" /> : (
              <div className="absolute inset-0 grid place-items-center p-8 text-center">
                {error ? <div className="max-w-md"><TriangleAlert className="mx-auto mb-4 text-amber-300" /><p className="font-medium">Ad session unavailable</p><p className="mt-2 text-sm text-white/50">{error}</p></div> : <div className="animate-pulse text-sm text-white/45">Checking eligibility…</div>}
              </div>
            )}
          </div>
        </section>

        <aside className="h-fit rounded-xl border border-white/10 bg-[#181c17] p-5 lg:sticky lg:top-24">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Viewing progress</h2>
            <Timer size={18} className="text-[#ccf35a]" />
          </div>
          <p className="mt-2 text-sm leading-6 text-white/50">Keep this tab open and in focus until the timer completes.</p>
          {timer.isPaused && <div role="status" className="mt-4 flex gap-2 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100"><TriangleAlert size={17} className="mt-0.5 shrink-0" />Ad viewing paused. Keep this tab active.</div>}
          <div className="my-5 border-t border-white/10" />
          {claimed ? (
            <div role="status" className="rounded-lg border border-[#ccf35a]/20 bg-[#ccf35a]/10 p-4"><Check className="mb-2 text-[#ccf35a]" /><p className="font-semibold">Reward credited</p><p className="mt-1 text-sm text-white/60">${claimed} has been added to your balance.</p></div>
          ) : timer.isComplete && session ? (
            <div className="space-y-4"><div><p className="font-medium">One last check</p><p className="mt-1 text-sm text-white/50">Complete the CAPTCHA to verify this view.</p></div><HCaptchaWidget siteKey={process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY} onVerify={setCaptchaToken} /><button onClick={claimReward} disabled={!captchaToken || claiming} className="w-full rounded-lg bg-[#ccf35a] px-4 py-3 text-sm font-semibold text-[#171b12] transition hover:bg-[#def98a] disabled:cursor-not-allowed disabled:opacity-40">{claiming ? "Verifying…" : "Claim reward"}</button></div>
          ) : (
            <div className="flex items-center justify-between rounded-lg bg-white/[0.04] p-4"><span className="text-sm text-white/55">Time remaining</span><span className="font-mono text-2xl tabular-nums">{session ? `${timer.remainingSeconds}s` : "--"}</span></div>
          )}
          {error && session && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
          <p className="mt-5 text-xs leading-5 text-white/35">Leaving this tab pauses the on-screen timer. Claims are verified against the server-issued session.</p>
        </aside>
      </div>
    </main>
  );
}