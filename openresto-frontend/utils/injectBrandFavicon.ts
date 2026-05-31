import { buildFaviconDataUri } from "@/constants/faviconIcons";
import { Brand } from "@/types";

export function injectBrandFavicon(brand: Brand): void {
  if (typeof document === "undefined") return;

  const { faviconIcon, primaryColor, appName } = brand;

  if (!faviconIcon) return;

  const coloredSvg = buildFaviconDataUri(faviconIcon, primaryColor);
  if (!coloredSvg) return;

  // Remove all existing favicon links so Chrome picks up the new one.
  // Updating href in-place is not enough — Chrome only re-reads the favicon
  // when a link element is newly added to the DOM.
  document
    .querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]')
    .forEach((el) => el.remove());
  const iconLink = document.createElement("link");
  iconLink.rel = "icon";
  iconLink.type = "image/svg+xml";
  iconLink.href = coloredSvg;
  document.head.appendChild(iconLink);

  // Browser chrome colour on mobile
  let themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!themeMeta) {
    themeMeta = document.createElement("meta");
    themeMeta.name = "theme-color";
    document.head.appendChild(themeMeta);
  }
  themeMeta.content = primaryColor;

  // Tell the service worker to patch /manifest.json so the PWA install prompt uses
  // the backend SVG endpoint (/api/brand/pwa-icon.svg) as the icon — a real HTTP URL
  // that Chrome can fetch, unlike blob: or data: URIs.
  navigator.serviceWorker?.controller?.postMessage({
    type: "BRAND_UPDATE",
    brand: { name: appName, themeColor: primaryColor, hasIcon: true },
  });
}
