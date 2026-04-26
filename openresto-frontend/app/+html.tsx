import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <meta name="theme-color" content="#0a7ea4" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="icon" type="image/png" href="/icon-192.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />

        {/* Blocking theme script — sets the correct theme class on <html>
            BEFORE the browser paints, preventing any flash. */}
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
      </head>
      <body>{children}</body>
    </html>
  );
}
