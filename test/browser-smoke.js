// Run with npm run test:browser after npx playwright install chromium.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const { chromium } = require("playwright");
process.env.JWT_SECRET = randomBytes(48).toString("hex");
const { app } = require("../app");
const { seedDatabase } = require("../scripts/seed");
const Article = require("../models/Article");
let db, server, browser;
(async () => {
  db = await MongoMemoryServer.create({
    instance: { args: process.platform === "win32" ? [] : ["--nounixsocket"] },
  });
  await mongoose.connect(db.getUri());
  const password = randomBytes(16).toString("hex");
  await seedDatabase(password);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  // Stable weather data for visual QA; live provider is checked separately.
  await context.route("**/api/weather/current", (route) =>
    route.fulfill({
      json: {
        data: {
          city: "תל אביב",
          temperature: 25,
          code: 1,
          isDay: true,
          observedAt: new Date().toISOString(),
          validUntil: new Date(Date.now() + 600000).toISOString(),
        },
      },
    }),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(15000);
  page.on("response", (r) => {
    if (r.request().method() === "POST")
      console.log("POST", r.status(), new URL(r.url()).pathname);
  });
  const errors = [];
  page.on(
    "pageerror",
    (e) => (errors.push(e.message), console.error("Browser error:", e.message)),
  );
  const out = path.join(__dirname, "../docs/screenshots");
  fs.mkdirSync(out, { recursive: true });
  async function screenshot(name) {
    await page.screenshot({
      path: path.join(out, name + ".png"),
      fullPage: false,
    });
    console.log("Captured:", name);
  }
  async function noOverflow(label) {
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      label + " horizontal overflow",
    );
  }
  await page.goto(base);
  await page.locator(".temperature").waitFor();
  assert.equal(await page.locator(".news-card").count(), 20);
  await screenshot("home-desktop");
  await noOverflow("desktop");
  await page.locator("#feed-end").scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () => document.querySelectorAll(".news-card").length >= 40,
  );
  await page.goto(base);
  let weatherCalls = 0;
  await page.route("**/api/weather/current", (route) => {
    weatherCalls++;
    return weatherCalls === 1
      ? route.fulfill({
          json: {
            data: {
              city: "תל אביב",
              temperature: 25,
              code: 0,
              isDay: true,
              observedAt: new Date().toISOString(),
              validUntil: new Date(Date.now() + 1000).toISOString(),
            },
          },
        })
      : route.fulfill({ status: 503, json: { message: "Unavailable" } });
  });
  await page.reload();
  await page.locator(".temperature").waitFor();
  await page.locator("#weather-retry").waitFor({ state: "visible" });
  assert.equal(
    await page.locator(".temperature").count(),
    0,
    "expired temperatures are cleared during provider failure",
  );
  await page.unroute("**/api/weather/current");
  await page.locator("#weather-retry").click();
  await page.locator(".temperature").waitFor();
  await page.locator("#search").fill("הטכנולוגיה");
  await page.waitForResponse(
    (r) => r.url().includes("/api/articles/public?") && r.status() === 200,
  );
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".news-card h2")].every((el) =>
      el.textContent.includes("הטכנולוגיה"),
    ),
  );
  await page.locator("#category").selectOption("Technology");
  await page.waitForResponse(
    (r) => r.url().includes("category=Technology") && r.status() === 200,
  );
  await page.locator("#search").fill("אין-כותרת-כזאת");
  await page.waitForFunction(
    () => document.querySelectorAll(".news-card").length === 0,
  );
  await page.goto(base);
  await page.locator(".news-card h2 a").first().click();
  await page.locator("#comment-content").fill("בדיקת ממשק: תגובה ללא רענון");
  await page.locator("#comment-form button").click();
  await page.getByText("התגובה פורסמה", { exact: true }).waitFor();
  assert.ok(
    await page
      .locator(".comment")
      .first()
      .innerText()
      .then((t) => t.includes("בדיקת ממשק")),
  );
  await screenshot("article-desktop");
  await page.goto(base + "/login");
  await screenshot("login-desktop");
  await page.locator("#username").fill("Reporter1");
  await page.locator("#password").fill(password);
  await page.locator("#loginForm button").click();
  await page.waitForURL("**/reporter/articles");
  await screenshot("reporter-desktop");
  await page.getByRole("button", { name: "+ כתבה חדשה" }).click();
  await page.waitForURL("**/edit");
  await page.locator("#title").fill("סיפור מהדפדפן");
  await page.locator("#category").selectOption("Technology");
  await page.locator("#mainImage").fill("/images/news.svg");
  await page.locator("#content").fill("תוכן שנשמר אוטומטית מתוך הדפדפן");
  await page.waitForFunction(() =>
    document.getElementById("save-status").textContent.startsWith("נשמר ב־"),
  );
  await page.reload();
  assert.equal(await page.locator("#title").inputValue(), "סיפור מהדפדפן");
  // Recreate the previous data-loss window: an older write succeeds but its response
  // is delayed while the author types newer text and immediately refreshes.
  let signalWritten, releaseResponse;
  const written = new Promise((r) => (signalWritten = r)),
    gate = new Promise((r) => (releaseResponse = r));
  let delayed = false;
  await page.route("**/autosave", async (route) => {
    if (delayed) return route.continue();
    delayed = true;
    const response = await route.fetch();
    signalWritten();
    await gate;
    await route.fulfill({ response }).catch(() => {});
  });
  await page.locator("#content").fill("Older in-flight snapshot");
  await written;
  await page
    .locator("#content")
    .fill("Latest keystrokes preserved after refresh");
  await page.reload();
  releaseResponse();
  await page.waitForFunction(
    () =>
      document.querySelector("#content").value ===
      "Latest keystrokes preserved after refresh",
  );
  await page.unroute("**/autosave");
  await page.waitForFunction(() =>
    document.getElementById("save-status").textContent.startsWith("נשמר ב־"),
  );
  const separate = await browser.newContext();
  const other = await separate.newPage();
  await other.goto(base + "/login");
  await other.locator("#username").fill("Reporter1");
  await other.locator("#password").fill(password);
  await other.locator("#loginForm button").click();
  await other.waitForURL("**/reporter/articles");
  await other.goto(page.url());
  assert.equal(
    await other.locator("#content").inputValue(),
    "Latest keystrokes preserved after refresh",
  );
  await separate.close();
  await screenshot("writing-desktop");
  const writingUrl = page.url();
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow("writing " + width);
    if (width === 390) await screenshot("writing-mobile");
    await page.goto(base + "/reporter/articles");
    await noOverflow("reporter " + width);
    if (width === 390) await screenshot("reporter-mobile");
    await page.goto(writingUrl);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  console.log("Submitting draft");
  await page.getByRole("button", { name: "שליחה לאישור עורך" }).click();
  await page.waitForURL("**/reporter/articles");
  console.log("Logging out at", page.url());
  await page.locator("#logout").click();
  await page.waitForURL(base + "/");
  await page.goto(base + "/login");
  await page.locator("#username").fill("MainEditor");
  await page.locator("#password").fill(password);
  await page.locator("#loginForm button").click();
  await page.waitForURL("**/editor/articles");
  await screenshot("editor-desktop");
  const draft = await Article.findOne({ title: "סיפור מהדפדפן" });
  await page.goto(base + `/editor/articles/${draft._id}/review`);
  await screenshot("review-desktop");
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "אישור ופרסום" }).click();
  await page.waitForURL("**/editor/articles");
  const published = await Article.findOne({
    status: "Published",
    "publicationHistory.2": { $exists: true },
  });
  await page.goto(base + `/editor/articles/${published._id}/analytics`);
  await page.waitForFunction(
    () => document.getElementById("impactChart").width > 300,
  );
  await screenshot("analytics-desktop");
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, url] of [
      ["home", "/"],
      ["article", `/api/articles/view/${published._id}`],
      ["login", "/login"],
      ["editor", "/editor/articles"],
      ["review", `/editor/articles/${published._id}/review`],
      ["analytics", `/editor/articles/${published._id}/analytics`],
    ]) {
      await page.goto(base + url);
      await noOverflow(name + " " + width);
      if (width === 390) await screenshot(name + "-mobile");
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: browser login, search, filtering, comments, autosave, publication; screenshots and overflow checks at 1440/768/390px. No uncaught browser exceptions.",
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    if (server) await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    if (db) await db.stop();
  });
