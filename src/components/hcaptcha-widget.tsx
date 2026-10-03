"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    hcaptcha?: {
      render: (container: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void }) => string;
      remove: (widgetId: string) => void;
    };
  }
}

type HCaptchaWidgetProps = {
  siteKey?: string;
  onVerify: (token: string) => void;
};

export function HCaptchaWidget({ siteKey, onVerify }: HCaptchaWidgetProps) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  const render = () => {
    if (!siteKey || !container.current || !window.hcaptcha || widgetId.current) return;
    widgetId.current = window.hcaptcha.render(container.current, {
      sitekey: siteKey,
      callback: onVerify,
      "expired-callback": () => onVerify(""),
    });
  };

  useEffect(() => () => {
    if (widgetId.current && window.hcaptcha) window.hcaptcha.remove(widgetId.current);
  }, []);

  if (!siteKey) return <p className="text-sm text-amber-200">CAPTCHA is not configured for this environment.</p>;

  return (
    <>
      <Script src="https://js.hcaptcha.com/1/api.js?render=explicit" strategy="afterInteractive" onLoad={render} />
      <div ref={container} />
    </>
  );
}