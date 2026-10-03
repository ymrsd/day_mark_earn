import { createHmac } from "node:crypto";

export function getClientIp(request: Request) {
  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!ip && process.env.NODE_ENV === "development") return "127.0.0.1";
  if (!ip) throw new Error("Client IP is unavailable.");
  return ip;
}

export function hashSignal(value: string) {
  const secret = process.env.AUDIT_HASH_SECRET ??
    (process.env.NODE_ENV === "development" ? "daymark-local-development-only-audit-hash-key" : undefined);
  if (!secret || new TextEncoder().encode(secret).length < 32) {
    throw new Error("AUDIT_HASH_SECRET must contain at least 32 bytes.");
  }
  return createHmac("sha256", secret).update(value).digest("hex");
}

export async function isProxy(ip: string) {
  const key = process.env.PROXYCHECK_API_KEY;
  if (!key) throw new Error("Proxy screening is not configured.");

  const url = new URL(`https://proxycheck.io/v2/${encodeURIComponent(ip)}`);
  url.searchParams.set("key", key);
  url.searchParams.set("vpn", "1");
  url.searchParams.set("risk", "1");
  const response = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
  if (!response.ok) throw new Error("Proxy screening is unavailable.");

  const result = (await response.json()) as Record<string, unknown>;
  if (result.status !== "ok") throw new Error("Proxy screening returned an invalid response.");
  const record = result[ip] as { proxy?: string } | undefined;
  if (!record || (record.proxy !== "yes" && record.proxy !== "no")) {
    throw new Error("Proxy screening returned an invalid result.");
  }
  return record.proxy === "yes";
}

export async function verifyCaptcha(token: string, remoteIp: string) {
  const secret = process.env.HCAPTCHA_SECRET;
  if (!secret || !token) return false;

  const body = new URLSearchParams({ secret, response: token, remoteip: remoteIp });
  const response = await fetch("https://api.hcaptcha.com/siteverify", {
    method: "POST",
    body,
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });
  if (!response.ok) return false;
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}