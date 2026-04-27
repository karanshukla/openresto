const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on("console", async (msg) => {
    const values = [];
    for (const arg of msg.args()) {
      values.push(await arg.jsonValue().catch(() => arg.toString()));
    }
    console.log("BROWSER CONSOLE:", msg.type().toUpperCase(), values.join(" "));
  });
  page.on("pageerror", (err) => {
    console.log("BROWSER ERROR:", err.message);
    console.log(err.stack);
  });

  await page.goto("http://localhost:8081");
  await page.waitForTimeout(5000);

  await browser.close();
})();
