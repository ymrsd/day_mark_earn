"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { Activity, ArrowRight, Eye, EyeOff } from "lucide-react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"EARNER" | "ADVERTISER">("EARNER");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (isRegister) {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password, role }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to create account.");
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (!result?.ok) {
        const message = result?.code === "service_unavailable"
          ? "PostgreSQL is unavailable. Start the database and check DATABASE_URL."
          : "Email or password is incorrect.";
        throw new Error(message);
      }
      window.location.assign(role === "ADVERTISER" ? "/advertiser" : "/earner");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to continue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-[#171a15] text-[#f2f1e9] lg:grid-cols-[minmax(0,1.1fr)_minmax(380px,.9fr)]">
      <section className="relative hidden overflow-hidden border-r border-white/10 p-12 lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "linear-gradient(135deg, transparent 0 49.8%, rgba(204,243,90,.3) 50%, transparent 50.2%), linear-gradient(45deg, transparent 0 49.8%, rgba(204,243,90,.16) 50%, transparent 50.2%)", backgroundSize: "76px 76px" }} />
        <Link href="/login" className="relative flex items-center gap-3"><span className="grid size-10 place-items-center rounded-lg bg-[#ccf35a] text-[#171a15]"><Activity size={21} /></span><span className="text-sm font-bold">daymark</span></Link>
        <div className="relative max-w-xl pb-10">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#ccf35a]">A fair exchange of attention</p>
          <h1 className="text-5xl font-medium leading-[1.05] tracking-normal xl:text-6xl">Your time has<br />a clear value.</h1>
          <p className="mt-6 max-w-md text-base leading-7 text-white/55">Watch sponsored content, earn a transparent reward, and keep control of your balance.</p>
          <div className="mt-11 flex items-end gap-8 border-t border-white/15 pt-5"><div><span className="block text-2xl font-medium">15-60s</span><span className="mt-1 block text-[10px] uppercase tracking-[0.14em] text-white/40">verified views</span></div><div className="h-9 border-l border-white/15" /><div><span className="block text-2xl font-medium">$1</span><span className="mt-1 block text-[10px] uppercase tracking-[0.14em] text-white/40">minimum payout</span></div></div>
        </div>
        <p className="relative text-[11px] text-white/30">Secure accounts | Transparent campaign review | Manual payout approval</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[390px]">
          <div className="mb-10 flex items-center gap-3 lg:hidden"><span className="grid size-9 place-items-center rounded-lg bg-[#ccf35a] text-[#171a15]"><Activity size={19} /></span><span className="text-sm font-bold">daymark</span></div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ccf35a]">{isRegister ? "Get started" : "Welcome back"}</p>
          <h2 className="mt-2 text-3xl font-medium">{isRegister ? "Create your account" : "Sign in to Daymark"}</h2>
          <p className="mt-2 text-sm text-white/45">{isRegister ? "Choose how you want to use the platform." : "Your workspace is ready when you are."}</p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            {isRegister && <fieldset><legend className="mb-2 text-xs font-medium text-white/60">Account type</legend><div className="grid grid-cols-2 gap-2">{(["EARNER", "ADVERTISER"] as const).map((item) => <button key={item} type="button" onClick={() => setRole(item)} className={`rounded-lg border px-3 py-3 text-sm transition ${role === item ? "border-[#ccf35a]/70 bg-[#ccf35a]/10 text-[#ccf35a]" : "border-white/10 text-white/55 hover:border-white/25"}`}>{item === "EARNER" ? "Earn rewards" : "Advertise"}</button>)}</div></fieldset>}
            <label className="block"><span className="mb-2 block text-xs font-medium text-white/60">Email address</span><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 w-full rounded-lg border border-white/15 bg-white/[.045] px-3 text-sm outline-none transition placeholder:text-white/25 focus:border-[#ccf35a]/70" placeholder="you@example.com" /></label>
            <label className="block"><span className="mb-2 block text-xs font-medium text-white/60">Password</span><span className="relative block"><input required minLength={isRegister ? 10 : 8} type={showPassword ? "text" : "password"} autoComplete={isRegister ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-lg border border-white/15 bg-white/[.045] px-3 pr-11 text-sm outline-none transition placeholder:text-white/25 focus:border-[#ccf35a]/70" placeholder={isRegister ? "At least 10 characters" : "Your password"} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
            {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
            <button disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#ccf35a] text-sm font-semibold text-[#171a15] transition hover:bg-[#dcf98a] disabled:opacity-60">{busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}<ArrowRight size={16} /></button>
          </form>
          <p className="mt-7 text-center text-sm text-white/45">{isRegister ? "Already have an account?" : "New to Daymark?"} <Link className="ml-1 text-[#ccf35a] hover:underline" href={isRegister ? "/login" : "/register"}>{isRegister ? "Sign in" : "Create account"}</Link></p>
          <p className="mt-9 text-center text-[11px] leading-5 text-white/25">By continuing, you agree to use the platform fairly and submit accurate account and payout information.</p>
        </div>
      </section>
    </main>
  );
}