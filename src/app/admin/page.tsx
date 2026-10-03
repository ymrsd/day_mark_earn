import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { DashboardShell } from "@/components/dashboard-shell";
import { auth } from "@/lib/auth";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect(session.user.role === "ADVERTISER" ? "/advertiser" : "/earner");

  return <DashboardShell role="ADMIN" email={session.user.email ?? "Administrator"}><AdminDashboard /></DashboardShell>;
}