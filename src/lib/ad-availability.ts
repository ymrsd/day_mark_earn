export type AdSetupIssue = {
  code: "PROXYCHECK" | "HCAPTCHA" | "UPSTASH";
  label: string;
  envKeys: string[];
};

export type ExternalNetwork = {
  name: string;
  url: string;
};

export function getAdSetupIssues(): AdSetupIssue[] {
  const issues: AdSetupIssue[] = [];

  if (!process.env.PROXYCHECK_API_KEY) {
    issues.push({ code: "PROXYCHECK", label: "Proxy and VPN screening", envKeys: ["PROXYCHECK_API_KEY"] });
  }
  if (!process.env.HCAPTCHA_SECRET || !process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY) {
    issues.push({ code: "HCAPTCHA", label: "CAPTCHA claim verification", envKeys: ["HCAPTCHA_SECRET", "NEXT_PUBLIC_HCAPTCHA_SITE_KEY"] });
  }
  if (
    process.env.NODE_ENV !== "development" &&
    (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN)
  ) {
    issues.push({ code: "UPSTASH", label: "Distributed rate limits and session locks", envKeys: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"] });
  }

  return issues;
}

function safeHttpsUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function getExternalNetworks(): ExternalNetwork[] {
  const configured: [string, string | undefined][] = [
    ["Ad network partner", process.env.AD_NETWORK_FALLBACK_URL],
    ["Adsterra", process.env.AD_NETWORK_ADSTERRA_URL],
    ["Monetag", process.env.AD_NETWORK_MONETAG_URL],
    ["PropellerAds", process.env.AD_NETWORK_PROPELLERADS_URL],
  ];

  return configured.flatMap(([name, value]) => {
    const url = safeHttpsUrl(value);
    return url ? [{ name, url }] : [];
  });
}