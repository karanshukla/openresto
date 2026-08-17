import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto("http://localhost:5062/locations");
await p.getByTestId("locations-filter-bar").waitFor();
await p.getByTestId("location-book-now-1").click();
await p.getByTestId("booking-drawer").waitFor();
const trigger = p.getByLabel(/^Time, /);
const list = p.getByTestId("select-list");
await trigger.click();
await list.waitFor();
const options = list.getByRole("option");
const n = await options.count();
const label = await options.nth(n - 1).getAttribute("aria-label");
await options.nth(n - 1).click();
await p.waitForTimeout(600);
await p.evaluate(() => { window.__s = 0; document.addEventListener("scroll", () => window.__s++, true); });
await trigger.click();
await list.waitFor();
for (const ms of [0, 100, 300, 600, 1200]) {
  await p.waitForTimeout(ms === 0 ? 0 : ms);
  const info = await p.evaluate((lbl) => {
    const opt = [...document.querySelectorAll('[role="option"]')].find(o => o.getAttribute("aria-label") === lbl);
    const panel = document.querySelector('[data-testid="select-list"]');
    const pr = panel.getBoundingClientRect(), or = opt.getBoundingClientRect();
    return { scrolls: window.__s, inside: or.top >= pr.top - 1 && or.bottom <= pr.bottom + 1, optTop: Math.round(or.top), panelTop: Math.round(pr.top), panelBottom: Math.round(pr.bottom) };
  }, label);
  console.log(ms, JSON.stringify(info));
}
await b.close();
