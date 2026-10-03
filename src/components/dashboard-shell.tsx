"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { motion } from "framer-motion";
import { Activity, ArrowDownToLine, ArrowLeftRight, Gamepad2, LayoutDashboard, LogOut, Megaphone, ShieldAlert, Wallet, Eye } from "lucide-react";
import type { ReactNode } from "react";

type Role = "EARNER" | "ADVERTISER" | "ADMIN";
const navByRole: Record<Role, { href: string; label: string; icon: typeof LayoutDashboard }[]> = {
  EARNER: [
    { href: "/earner", label: "Overview", icon: LayoutDashboard },
    { href: "/earner#available", label: "Watch ads", icon: Eye },
    { href: "/earner/offers", label: "Games & apps", icon: Gamepad2 },
    { href: "/earner#withdraw", label: "Withdraw", icon: ArrowDownToLine },
  ],
  ADVERTISER: [
    { href: "/advertiser", label: "Overview", icon: LayoutDashboard },
    { href: "/advertiser#campaigns", label: "Campaigns", icon: Megaphone },
    { href: "/advertiser#funding", label: "Add funds", icon: Wallet },
  ],
  ADMIN: [
    { href: "/admin", label: "Overview", icon: LayoutDashboard },
    { href: "/admin#requests", label: "Requests", icon: ArrowLeftRight },
    { href: "/admin#risk", label: "Risk signals", icon: ShieldAlert },
  ],
};

export function DashboardShell({ role, email, children }: { role: Role; email: string; children: ReactNode }) {
  const pathname = usePathname();
  const links = navByRole[role];
  const initial = email.slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen text-[#f1f2e8]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-white/10 bg-[#181c17] px-4 py-5 md:flex">
        <Link href="/" className="flex items-center gap-3 px-2">
          <span className="grid size-9 place-items-center rounded-lg bg-[#ccf35a] text-[#171a15]"><Activity size={19} /></span>
          <span><span className="block text-sm font-bold">daymark</span><span className="block text-[10px] uppercase tracking-[0.14em] text-white/40">attention, valued</span></span>
        </Link>
        <div className="mt-10 px-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/35">Workspace</div>
        <nav className="mt-3 space-y-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href.split("#")[0] === pathname;
            return <Link key={href} href={href} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${active ? "bg-white/[.08] text-white" : "text-white/55 hover:bg-white/[.045] hover:text-white"}`}><Icon size={17} strokeWidth={1.8} />{label}{active && <span className="ml-auto size-1.5 rounded-full bg-[#ccf35a]" />}</Link>;
          })}
        </nav>
        <div className="mt-auto rounded-xl bg-white/[.045] p-3">
          <div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-full bg-[#ccf35a] text-xs font-bold text-[#171a15]">{initial}</span><span className="min-w-0"><span className="block truncate text-xs font-semibold">{email}</span><span className="mt-0.5 block text-[10px] uppercase tracking-wider text-white/40">{role.toLowerCase()}</span></span></div>
          <button onClick={() => signOut({ redirectTo: "/login" })} className="mt-3 flex w-full items-center gap-2 border-t border-white/10 pt-3 text-xs text-white/50 hover:text-white"><LogOut size={14} /> Sign out</button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="sticky top-0 z-20 flex h-[58px] items-center justify-between border-b border-white/10 bg-[#101310]/95 px-4 backdrop-blur sm:px-8">
          <div className="flex items-center gap-2 text-xs text-white/40"><span>daymark</span><span>/</span><span className="font-medium capitalize text-white/75">{role.toLowerCase()} workspace</span></div>
          <div className="flex items-center gap-2 text-xs text-white/50"><span className="size-1.5 rounded-full bg-[#ccf35a]" /> Account active</div>
        </header>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: "easeOut" }} className="mx-auto max-w-[1440px] px-4 py-7 sm:px-8 sm:py-9">{children}</motion.div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-white/10 bg-[#101310]/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href.split("#")[0] === pathname;
          return <Link key={href} href={href} className={`flex min-h-[64px] flex-col items-center justify-center gap-1 text-[10px] ${active ? "text-[#ccf35a]" : "text-white/45"}`}><Icon size={19} />{label}</Link>;
        })}
      </nav>
    </div>
  );
}