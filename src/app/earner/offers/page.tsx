import { redirect } from "next/navigation";
import { Gamepad2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { OfferBoard } from "@/components/offer-board";
import { auth } from "@/lib/auth";

export default async function EarnerOffersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "EARNER") redirect(session.user.role === "ADMIN" ? "/admin" : "/advertiser");

  return <DashboardShell role="EARNER" email={session.user.email ?? "Earner"}>
    <div className="mb-8"><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#ccf35a]">Offer marketplace</p><h1 className="mt-2 flex items-center gap-3 text-3xl font-medium"><Gamepad2 className="text-[#ccf35a]" />Games, apps and tasks</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">Complete funded advertiser offers and submit evidence. Rewards are credited only after review.</p></div>
    <OfferBoard />
  </DashboardShell>;
}