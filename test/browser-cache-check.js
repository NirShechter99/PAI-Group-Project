const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { locations } = require("../services/weather");

// Use real Chromium HTTP caching: Playwright route interception disables its cache.
module.exports = async function checkCachedUpgrade(browser, app) {
  const css = fs.readFileSync(path.join(__dirname, "../public/css/site.css"), "utf8")
    .replace(".site-nav a.active", ".site-nav .nav-home");
  const legacy = {
    "/css/site.css": ["text/css", css],
    "/js/feed.js": ["text/javascript", "window.legacyFeedLoaded = true;"],
    "/js/weather.js": ["text/javascript", 'window.legacyWeatherLoaded = true; document.getElementById("weather").innerHTML="<strong>תל אביב</strong>";'],
  };
  const hits = {};
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/__previous-release") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      return res.end('<!doctype html><link rel="stylesheet" href="/css/site.css"><div id="weather"></div><script src="/js/feed.js" defer></script><script src="/js/weather.js" defer></script>');
    }
    if (legacy[req.url]) {
      hits[req.url] = (hits[req.url] || 0) + 1;
      const [type, content] = legacy[req.url];
      res.writeHead(200, { "Content-Type": `${type}; charset=utf-8`, "Cache-Control": "public, max-age=3600" });
      return res.end(content);
    }
    if (url.pathname === "/api/weather/current") {
      const locationId = url.searchParams.get("location") || "tel-aviv";
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      return res.end(JSON.stringify({ data: { city: locations[locationId].city, locationId, temperature: locationId === "jerusalem" ? 18 : 25, code: 0, isDay: true, observedAt: new Date().toISOString(), validUntil: new Date(Date.now() + 600000).toISOString() } }));
    }
    app(req, res);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const context = await browser.newContext(); // Do not add any route mocks here.
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    await page.goto(base + "/__previous-release");
    assert.equal(await page.evaluate(() => window.legacyFeedLoaded), true);
    await page.goto(base + "/__previous-release?again");
    for (const url of Object.keys(legacy)) assert.equal(hits[url], 1, `Legacy ${url} must actually be cached`);
    await page.goto(base);
    assert.ok(!await page.evaluate(() => window.legacyFeedLoaded || window.legacyWeatherLoaded), "Old cached scripts must not execute after upgrading");
    await page.locator('.site-nav a[data-category="Technology"]').click();
    await page.waitForFunction(() => document.querySelector('.site-nav a.active')?.dataset.category === "Technology");
    const colors = await page.evaluate(() => ({ active: getComputedStyle(document.querySelector('.site-nav a.active')).color, home: getComputedStyle(document.querySelector('.nav-home')).color }));
    assert.notEqual(colors.active, colors.home, "Selected category must have its own red highlight");
    await page.locator("#weather-location").selectOption("jerusalem");
    await page.waitForFunction(() => document.querySelector("#weather > strong")?.textContent === "ירושלים");
    assert.equal(await page.locator(".temperature").textContent(), "18°");
    await page.reload();
    assert.equal(await page.locator("#weather-location").inputValue(), "jerusalem");
    await page.waitForFunction(() => document.querySelector("#weather > strong")?.textContent === "ירושלים");
    console.log("PASS: cached upgrade uses fresh CSS/JS; category highlight and weather city switching work.");
  } finally {
    await context.close();
    await new Promise(resolve => server.close(resolve));
  }
};
