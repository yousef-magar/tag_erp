import { useEffect, useRef } from "react";
import { useAppStore } from "@/hooks/use-app-store";

const DEFAULT_FAVICON = "/favicon.svg";

export function DynamicMeta() {
  const companyName = useAppStore(s => s.companyName);
  const companyLogo = useAppStore(s => s.companyLogo);
  const language = useAppStore(s => s.language);
  const lastLogoRef = useRef("");

  const DEFAULT_TITLE = language === "ar" ? "تاج" : "Tag";

  useEffect(() => {
    const title = companyName || DEFAULT_TITLE;
    const desc = language === "ar" ? `${title} - نظام إدارة متكامل` : `${title} - Integrated Management System`;
    document.title = title;
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute("content", title);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute("content", title);
    document.querySelector('meta[name="description"]')?.setAttribute("content", desc);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", desc);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute("content", desc);
  }, [companyName, language]);

  useEffect(() => {
    const src = companyLogo || DEFAULT_FAVICON;
    if (src === lastLogoRef.current) return;
    lastLogoRef.current = src;

    if (src.startsWith("data:image/")) {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, 32, 32);
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 32, 32);
        setFaviconHref(canvas.toDataURL("image/png"));
      };
      img.onerror = () => setFaviconHref(src);
      img.src = src;
    } else {
      setFaviconHref(src);
    }
  }, [companyLogo]);

  return null;
}

function setFaviconHref(href: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = href;

  let apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if (!apple) {
    apple = document.createElement("link");
    apple.rel = "apple-touch-icon";
    document.head.appendChild(apple);
  }
  apple.href = href;
}
