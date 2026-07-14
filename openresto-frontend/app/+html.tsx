/* istanbul ignore file */
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0a7ea4" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
  try {
    var s = localStorage.getItem('openresto-theme');
    var d = (s === 'light' || s === 'dark')
      ? s
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
    document.documentElement.classList.add(d);
    document.documentElement.style.backgroundColor = d === 'dark' ? '#111214' : '#f2f3f5';
  } catch(e) {}
})();`,
          }}
        />
        <ScrollViewStyleReset />
        {/* ScrollViewStyleReset sizes #root from body's height (`html,body,#root{height:100%}`),
            so any padding a third-party layer adds to body — e.g. a reverse-proxy demo banner
            reserving space with `body{padding-bottom}` — leaks into the sticky-footer flex chain
            and leaves a blank gap below the footer (issue #226). Size #root against the viewport
            instead so the layout is independent of body's box. No-op for normal deploys where
            body has no extra padding (100dvh == 100%); `vh` is the fallback for browsers without
            `dvh`. The dvh line is intentionally last so it wins the cascade over the reset above. */}
        <style
          id="root-viewport-height"
          dangerouslySetInnerHTML={{
            __html: `#root { height: 100vh; height: 100dvh; }`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
