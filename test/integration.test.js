const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
process.env.JWT_SECRET = randomBytes(48).toString("hex");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { app } = require("../app");
const { seedDatabase } = require("../scripts/seed");
const Article = require("../models/Article");
const User = require("../models/User");
const Analytics = require("../models/Analytics");
const RateLimit = require("../models/RateLimit");
let mongo,
  server,
  base,
  password = randomBytes(16).toString("hex");
class Client {
  constructor() {
    this.cookies = {};
    this.csrf = "";
  }
  async request(path, method = "GET", body) {
    const headers = {
      Cookie: Object.entries(this.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
    };
    if (method !== "GET") {
      headers["Content-Type"] = "application/json";
      headers["X-CSRF-Token"] = this.csrf;
    }
    const response = await fetch(base + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [key, ...value] = cookie.split(";")[0].split("=");
      this.cookies[key] = value.join("=");
    }
    const text = await response.text();
    const token = text.match(/name="csrf-token" content="([^"]+)"/);
    if (token) this.csrf = token[1];
    let data;
    try {
      data = JSON.parse(text);
    } catch {}
    return { status: response.status, text, data, headers: response.headers };
  }
  async login(name) {
    await this.request("/login");
    const result = await this.request("/api/auth/login", "POST", {
      username: name,
      password,
    });
    assert.equal(result.status, 200);
    return this;
  }
}
before(async () => {
  mongo = await MongoMemoryServer.create({
    instance: { args: process.platform === "win32" ? [] : ["--nounixsocket"] },
  });
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    Article.init(),
    User.init(),
    Analytics.init(),
    RateLimit.init(),
    require("../models/ReadingHistory").init(),
  ]);
  await seedDatabase(password, { count: 500 });
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((r) => server.close(r));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
test("500-article seed, all EJS screens, login and public HTML", async () => {
  assert.equal(await Article.countDocuments(), 500);
  const guest = new Client();
  let home = await guest.request("/");
  assert.equal(home.status, 200);
  assert.match(home.text, /הסיפורים של היום/);
  const feed = await guest.request("/api/articles/public");
  assert.equal(feed.data.articles.length, 20);
  assert.equal(feed.status, 200);
  const item = feed.data.articles[0];
  const article = await guest.request(`/api/articles/view/${item._id}`);
  assert.equal(article.status, 200);
  assert.ok(article.text.includes(item.content.split("\n")[0]));
  const read = await guest.request("/api/articles/public?viewed=read");
  assert.ok(read.data.articles.some((a) => a._id === item._id));
  const search = await guest.request(
    "/api/articles/public?category=Technology&q=" +
      encodeURIComponent("הטכנולוגיה"),
  );
  assert.ok(search.data.articles.length);
  assert.ok(
    search.data.articles.every(
      (a) => a.category === "Technology" && a.title.includes("הטכנולוגיה"),
    ),
  );
  const popular = await guest.request("/api/articles/public?sort=popular");
  assert.ok(
    popular.data.articles.every(
      (a, i, all) => !i || all[i - 1].totalViews >= a.totalViews,
    ),
  );
  const editor = await new Client().login("MainEditor");
  const reporter = await new Client().login("Reporter1");
  for (const path of [
    "/editor/articles",
    "/editor/articles?status=Draft",
    `/editor/articles/${item._id}/review`,
    `/editor/articles/${item._id}/analytics`,
  ])
    assert.equal((await editor.request(path)).status, 200, path);
  assert.equal((await reporter.request("/reporter/articles")).status, 200);
  const own = await Article.findOne({
    reporter: (await User.findOne({ username: "Reporter1" }))._id,
  });
  assert.equal(
    (await reporter.request(`/reporter/articles/${own._id}/edit`)).status,
    200,
  );
});
test("server authorization, CSRF, safe user creation and malformed input", async () => {
  const guest = new Client();
  await guest.request("/login");
  assert.equal(
    (
      await guest.request("/api/users/create", "POST", {
        username: "Injected",
        password,
        role: "Editor",
      })
    ).status,
    401,
  );
  const reporter = await new Client().login("Reporter1");
  assert.equal((await reporter.request("/editor/articles")).status, 403);
  const foreign = await Article.findOne({
    reporter: (await User.findOne({ username: "Reporter2" }))._id,
  });
  assert.equal(
    (
      await reporter.request(`/api/articles/update/${foreign._id}`, "PUT", {
        title: "Forbidden",
        status: "Published",
      })
    ).status,
    404,
  );
  assert.equal(
    (await reporter.request(`/api/articles/publish/${foreign._id}`, "PUT", {}))
      .status,
    403,
  );
  const raw = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "MainEditor", password }),
  });
  assert.equal(raw.status, 403);
  const editor = await new Client().login("MainEditor");
  assert.equal(
    (await editor.request("/api/articles/update/not-an-id", "PUT", {})).status,
    400,
  );
  assert.equal(
    (await guest.request("/api/articles/public?q=%5B")).status,
    200,
    "regex characters escaped",
  );
  const invalid = await guest.request("/api/auth/login", "POST", {
    username: { $ne: null },
    password,
  });
  assert.equal(invalid.status, 400);
});
test("reporter draft, autosave, editor return and repeated publication preserve public snapshot", async () => {
  const reporter = await new Client().login("Reporter1"),
    editor = await new Client().login("MainEditor");
  const created = await reporter.request("/reporter/articles/new", "POST", {});
  assert.equal(created.status, 302);
  const id = created.headers.get("location").split("/")[3];
  const draft = {
    title: "כתבת בדיקה",
    content: "תוכן ראשון",
    category: "Technology",
    mainImage: "/images/news.svg",
  };
  assert.equal(
    (await reporter.request(`/reporter/articles/${id}/autosave`, "POST", draft))
      .status,
    200,
  );
  assert.equal(
    (await reporter.request(`/reporter/articles/${id}/submit`, "POST", draft))
      .status,
    302,
  );
  assert.equal(
    (
      await reporter.request(`/reporter/articles/${id}/autosave`, "POST", {
        content: "Blocked",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await editor.request(`/editor/articles/${id}/return`, "POST", {
        editorNote: "נא להרחיב",
      })
    ).status,
    302,
  );
  assert.equal(
    (await reporter.request(`/reporter/articles/${id}/submit`, "POST", draft))
      .status,
    302,
  );
  assert.equal(
    (await editor.request(`/editor/articles/${id}/approve`, "POST", {})).status,
    302,
  );
  assert.equal(
    (await editor.request(`/editor/articles/${id}/approve`, "POST", {})).status,
    409,
  );
  assert.equal(
    (
      await reporter.request(`/reporter/articles/${id}/autosave`, "POST", {
        ...draft,
        content: "תוכן שני",
      })
    ).status,
    200,
  );
  let stored = await Article.findById(id);
  assert.equal(stored.publishedVersion.content, "תוכן ראשון");
  assert.equal(stored.status, "Draft");
  await reporter.request(`/reporter/articles/${id}/submit`, "POST", {
    ...draft,
    content: "תוכן שני",
  });
  await editor.request(`/editor/articles/${id}/approve`, "POST", {});
  stored = await Article.findById(id);
  assert.equal(stored.publishedVersion.content, "תוכן שני");
  assert.equal(stored.publicationHistory.length, 2);
});
test("guest comments enforce rolling device limit even for simultaneous requests", async () => {
  const guest = new Client();
  await guest.request("/");
  const article = await Article.findOne({
    "publishedVersion.publishedAt": { $exists: true },
  });
  const result = await Promise.all(
    Array.from({ length: 6 }, () =>
      guest.request("/api/comments/create", "POST", {
        article: article._id,
        content: "בדיקה מקבילה",
        authorName: "אורח",
      }),
    ),
  );
  assert.equal(result.filter((r) => r.status === 201).length, 3);
  assert.equal(result.filter((r) => r.status === 429).length, 3);
  const list = await guest.request(`/api/comments/article/${article._id}`);
  assert.ok(list.data.comments.every((c) => !("ipAddress" in c)));
});
test("sessions survive app listener restart and are revoked on logout", async () => {
  const editor = await new Client().login("MainEditor");
  await new Promise((r) => server.close(r));
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await editor.request("/editor/articles")).status, 200);
  const copied = { ...editor.cookies };
  assert.equal(
    (await editor.request("/api/auth/logout", "POST", {})).status,
    200,
  );
  editor.cookies = copied;
  assert.equal((await editor.request("/api/users")).status, 401);
});

test("a real Node process restart preserves authentication against the same database", async () => {
  const { fork } = require("node:child_process");
  const path = require("node:path");
  const previousBase = base;
  let child;
  async function launch() {
    child = fork(path.join(__dirname, "server-child.js"), [], {
      env: {
        ...process.env,
        MONGO_URI: mongo.getUri(),
        JWT_SECRET: process.env.JWT_SECRET,
      },
      stdio: ["ignore", "ignore", "pipe", "ipc"],
    });
    const port = await new Promise((resolve, reject) => {
      child.once("message", (value) => resolve(value.port));
      child.once("exit", (code) => reject(new Error(`Child exited ${code}`)));
    });
    base = `http://127.0.0.1:${port}`;
  }
  async function stop() {
    const stopped = new Promise((r) => child.once("exit", r));
    child.kill("SIGTERM");
    await stopped;
  }
  try {
    await launch();
    const client = await new Client().login("Reporter1");
    await stop();
    await launch();
    assert.equal((await client.request("/reporter/articles")).status, 200);
  } finally {
    if (child?.exitCode === null) await stop();
    base = previousBase;
  }
});

test("all four core models support authorized CRUD and never expose password hashes", async () => {
  const editor = await new Client().login("MainEditor");
  const created = await editor.request("/api/users/create", "POST", {
    username: "AuditReporter",
    password,
    role: "Reporter",
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.user.password, undefined);
  const uid = created.data.user._id;
  assert.ok(
    (await editor.request("/api/users?q=AuditReporter")).data.users.some(
      (u) => u._id === uid,
    ),
  );
  assert.equal(
    (
      await editor.request(`/api/users/${uid}`, "PUT", {
        username: "AuditRenamed",
      })
    ).status,
    200,
  );
  const user = await User.findById(uid);
  assert.notEqual(user.password, password);
  assert.ok(user.password.startsWith("$2"));
  const made = await editor.request("/api/articles/create", "POST", {
    reporter: uid,
    title: "CRUD audit",
    category: "Technology",
    content: "Original",
    mainImage: "/images/news.svg",
  });
  assert.equal(made.status, 201);
  const id = made.data.article._id;
  assert.equal(
    (
      await editor.request(`/api/articles/update/${id}`, "PUT", {
        title: "CRUD changed",
      })
    ).status,
    200,
  );
  assert.ok(
    (await editor.request("/api/articles/all")).data.articles.some(
      (a) => a._id === id,
    ),
  );
  // The reporter submits; editors cannot bypass the pending-only publication rule.
  await Article.updateOne({ _id: id }, { $set: { status: "Pending" } });
  assert.equal(
    (await editor.request(`/api/articles/publish/${id}`, "PUT", {})).status,
    200,
  );
  const guest = new Client();
  await guest.request("/");
  const comment = await guest.request("/api/comments/create", "POST", {
    article: id,
    content: "CRUD comment",
  });
  assert.equal(comment.status, 201);
  const cid = comment.data.comment._id;
  assert.ok(
    (await guest.request(`/api/comments/article/${id}`)).data.comments.some(
      (c) => c._id === cid,
    ),
  );
  assert.equal(
    (
      await editor.request(`/api/comments/update/${cid}`, "PUT", {
        content: "Edited comment",
      })
    ).status,
    200,
  );
  assert.equal(
    (await editor.request(`/api/comments/delete/${cid}`, "DELETE", {})).status,
    200,
  );
  assert.equal(
    (await editor.request(`/api/analytics/record/${id}`, "POST", {})).status,
    200,
  );
  const report = await editor.request(`/api/analytics/article/${id}`);
  const aid = report.data.data[0]._id;
  assert.equal(
    (await editor.request(`/api/analytics/update/${aid}`, "PUT", { views: 12 }))
      .status,
    200,
  );
  assert.equal((await Article.findById(id)).totalViews, 12);
  assert.equal(
    (await editor.request(`/api/analytics/update/${aid}`, "PUT", { views: -1 }))
      .status,
    400,
  );
  assert.equal(
    (await editor.request(`/api/analytics/delete/${aid}`, "DELETE", {})).status,
    200,
  );
  assert.equal(
    (await editor.request(`/api/articles/delete/${id}`, "DELETE", {})).status,
    200,
  );
  assert.equal(
    (await editor.request(`/api/users/${uid}`, "DELETE", {})).status,
    200,
  );
});

test("autosave ignores out-of-order drafts and preserves whitespace and maximum Unicode content", async () => {
  const reporter = await new Client().login("Reporter1");
  const created = await reporter.request("/reporter/articles/new", "POST", {});
  const id = created.headers.get("location").split("/")[3];
  const content = "  \n" + "字".repeat(49990) + "\n  ";
  assert.equal(
    (
      await reporter.request(`/reporter/articles/${id}/autosave`, "POST", {
        content,
        draftClock: 2,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await reporter.request(`/reporter/articles/${id}/autosave`, "POST", {
        content: "Older request",
        draftClock: 1,
      })
    ).status,
    409,
  );
  assert.equal((await Article.findById(id)).content, content);
  const page = await reporter.request(`/reporter/articles/${id}/edit`);
  assert.equal(page.status, 200);
  assert.ok(page.text.includes('data-draft-clock="2"'));
});

test("editors can edit all article states while public snapshots remain unchanged", async () => {
  const editor = await new Client().login("MainEditor");
  for (const state of ["Draft", "Returned", "Pending", "Published"]) {
    const article = await Article.findOne({ status: state });
    const original = article.publishedVersion?.content;
    const page = await editor.request(`/editor/articles/${article._id}/review`);
    assert.equal(page.status, 200);
    assert.ok(page.text.includes("שמירת תיקוני העורך"));
    const result = await editor.request(
      `/editor/articles/${article._id}/save`,
      "POST",
      { content: "Editor changed the working content" },
    );
    assert.equal(result.status, 302);
    const updated = await Article.findById(article._id);
    assert.equal(updated.content, "Editor changed the working content");
    assert.equal(updated.publishedVersion?.content, original);
    assert.equal(updated.status, state === "Published" ? "Draft" : state);
  }
});

test("literal search characters and invalid payloads do not crash the server", async () => {
  const guest = new Client();
  await guest.request("/");
  for (const q of [
    "[",
    "]",
    "(",
    ")",
    "*",
    "+",
    "?",
    "\\",
    "^",
    "$",
    "{",
    "}",
    "|",
  ]) {
    const r = await guest.request(
      "/api/articles/public?q=" + encodeURIComponent(q),
    );
    assert.equal(r.status, 200, `query ${q}`);
  }
  const malformed = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: {
      Cookie: Object.entries(guest.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
      "X-CSRF-Token": guest.csrf,
      "Content-Type": "application/json",
    },
    body: "[1,2]",
  });
  assert.equal(malformed.status, 400);
  assert.equal((await guest.request("/")).status, 200);
});

test("thousands of articles remain pageable and concurrent visits retain exact view counts", async () => {
  const reporter = await User.findOne({ role: "Reporter" }),
    ids = [];
  const docs = Array.from({ length: 2500 }, (_, i) => {
    const _id = new mongoose.Types.ObjectId();
    ids.push(_id);
    return {
      _id,
      reporter: reporter._id,
      title: `Scale ${i}`,
      category: "Technology",
      mainImage: "/images/news.svg",
      content: "Scale data",
      status: "Published",
      publishedVersion: {
        title: `Scale ${i}`,
        category: "Technology",
        mainImage: "/images/news.svg",
        content: "Scale data",
        publishedAt: new Date(Date.now() - i * 1000),
      },
      totalViews: 0,
    };
  });
  await Article.insertMany(docs);
  const guest = new Client();
  await guest.request("/");
  const start = performance.now();
  const first = await guest.request("/api/articles/public?q=Scale&page=1"),
    second = await guest.request("/api/articles/public?q=Scale&page=2");
  assert.equal(first.data.total, 2500);
  assert.equal(first.data.articles.length, 20);
  assert.equal(second.data.articles.length, 20);
  assert.ok(
    !second.data.articles.some((b) =>
      first.data.articles.some((a) => a._id === b._id),
    ),
  );
  const id = ids[0];
  const visits = await Promise.all(
    Array.from({ length: 50 }, () => guest.request(`/api/articles/view/${id}`)),
  );
  assert.ok(visits.every((r) => r.status === 200));
  assert.equal((await Article.findById(id)).totalViews, 50);
  assert.equal((await Analytics.findOne({ article: id })).views, 50);
  console.log(
    `Scale check: ${await Article.countDocuments()} articles, two filtered pages and 50 concurrent visits: ${Math.round(performance.now() - start)}ms (local test, not a production capacity guarantee)`,
  );
  await Article.deleteMany({ _id: { $in: ids } });
  await Analytics.deleteMany({ article: { $in: ids } });
  await require("../models/ReadingHistory").deleteMany({
    article: { $in: ids },
  });
});

test("read-only preflight confirms the seeded defense examples", async () => {
  const check = await require("../scripts/preflight").checkDatabase();
  assert.equal(check.ok, true, JSON.stringify(check));
});

test("a signed but malformed identity is treated as unauthenticated", async () => {
  const client = new Client();
  await client.request("/login");
  client.cookies.token = require("jsonwebtoken").sign(
    { userId: "not-an-id", version: 0 },
    process.env.JWT_SECRET,
  );
  assert.equal((await client.request("/api/users")).status, 401);
});


test("image uploads enforce ownership, CSRF, type and size; published snapshots remain isolated", async () => {
  const reporter = await new Client().login("Reporter1");
  const other = await new Client().login("Reporter2");
  const owner = await User.findOne({ username: "Reporter1" });
  const article = await Article.create({ reporter: owner._id, status: "Draft" });
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=", "base64");
  async function upload(client, bytes, csrf = true) {
    const form = new FormData();
    form.append("image", new Blob([bytes], { type: "image/png" }), "sample.png");
    const headers = { Cookie: Object.entries(client.cookies).map(([k,v]) => `${k}=${v}`).join("; ") };
    if(csrf) headers["X-CSRF-Token"] = client.csrf;
    return fetch(`${base}/reporter/articles/${article._id}/image`, { method: "POST", headers, body: form });
  }
  assert.equal((await upload(other, png)).status, 404);
  assert.equal((await upload(reporter, png, false)).status, 403);
  assert.equal((await upload(reporter, Buffer.from("<svg onload=alert(1)>"))).status, 400);
  assert.equal((await upload(reporter, Buffer.alloc(3 * 1024 * 1024 + 1))).status, 413);
  const response = await upload(reporter, png);
  assert.equal(response.status, 201);
  const { url } = await response.json();
  assert.match(url, /^\/uploads\/[a-f0-9]{32}\.png$/);
  try {
    const image = await fetch(base + url);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("content-type"), "image/png");
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
    const service = require("../services/articles");
    service.applyValues(article, { title: "Upload example", category: "Technology", content: "Original", mainImage: url });
    article.status = "Pending";
    await service.publish(article);
    const guest = new Client();
    const html = await guest.request(`/api/articles/view/${article._id}`);
    assert.equal(html.status, 200);
    assert.ok(html.text.includes(`src="${url}"`));
    assert.ok(html.text.includes('property="og:title"'));
    const second = await upload(reporter, png);
    assert.equal(second.status, 201); // Published articles may start an update.
    const secondUrl = (await second.json()).url;
    await require("node:fs/promises").unlink(require("node:path").join(__dirname, "..", "public", secondUrl));
    article.status = "Draft";
    service.applyValues(article, { mainImage: "" });
    await article.save();
    assert.equal((await Article.findById(article._id)).publishedVersion.mainImage, url);
    article.status = "Pending";
    article.mainImage = url;
    await article.save();
    assert.equal((await upload(reporter, png)).status, 409);
  } finally {
    await require("node:fs/promises").unlink(require("node:path").join(__dirname, "..", "public", url));
    await require("../services/articles").remove(article._id);
  }
});

test("category validation rejects inherited object keys without saving an invalid draft", async () => {
  await RateLimit.deleteMany({ _id: /^login:/ });
  const reporter = await new Client().login("Reporter1");
  const beforeCount = await Article.countDocuments();
  for (const category of ["constructor", "toString", "__proto__", "not-a-category"]) {
    const result = await reporter.request("/api/articles/create", "POST", { title: "Invalid category", category });
    assert.equal(result.status, 400, `Category ${category} must be rejected`);
  }
  assert.equal(await Article.countDocuments(), beforeCount);
});

test("tampered JWTs cannot grant editor access and DB role/deletion changes apply immediately", async () => {
  await RateLimit.deleteMany({ _id: /^login:/ });
  const reporter = await new Client().login("Reporter1");
  const original = reporter.cookies.token;
  const parts = original.split(".");
  const claims = JSON.parse(Buffer.from(parts[1], "base64url"));
  parts[1] = Buffer.from(JSON.stringify({ ...claims, role: "Editor" })).toString("base64url");
  reporter.cookies.token = parts.join(".");
  assert.equal((await reporter.request("/api/users")).status, 401);
  reporter.cookies.token = original;
  assert.equal((await reporter.request("/api/users")).status, 403);
  const username = "RoleProbe" + randomBytes(4).toString("hex");
  const user = await User.create({ username, role: "Reporter", password: await require("bcrypt").hash(password, 10) });
  try {
    const client = await new Client().login(username);
    assert.equal((await client.request("/api/articles/all")).status, 200);
    await User.updateOne({ _id: user._id }, { role: "Guest" });
    assert.equal((await client.request("/api/articles/all")).status, 403);
    await User.deleteOne({ _id: user._id });
    assert.equal((await client.request("/api/articles/all")).status, 401);
  } finally { await User.deleteOne({ _id: user._id }); }
});

test("public article HTML and SEO metadata escape stored markup", async () => {
  const owner = await User.findOne({ username: "Reporter1" });
  const payload = '</title><script>window.injected=true</script><img src=x onerror="alert(1)">';
  const article = await Article.create({ reporter: owner._id, status: "Published", title: payload, content: payload, category: "Technology", mainImage: "/images/news.svg", publishedVersion: { title: payload, content: payload, category: "Technology", mainImage: "/images/news.svg", publishedAt: new Date() } });
  try {
    const guest = new Client();
    const response = await guest.request(`/api/articles/view/${article._id}`);
    assert.equal(response.status, 200);
    assert.ok(!response.text.includes(payload));
    assert.ok(!response.text.includes("<script>window.injected=true</script>"));
    assert.ok(response.text.includes("&lt;script&gt;window.injected=true&lt;/script&gt;"));
    assert.ok(response.text.includes('property="og:title"'));
  } finally { await require("../services/articles").remove(article._id); }
});

test("comment limits separate browsers and expire after the rolling window", async () => {
  const article = await Article.findOne({ status: "Published" });
  const first = new Client(), second = new Client();
  await first.request("/"); await second.request("/");
  const body = { article: String(article._id), content: "Rate limit probe" };
  for(let i=0;i<3;i++) assert.equal((await first.request("/api/comments/create", "POST", body)).status, 201);
  assert.equal((await first.request("/api/comments/create", "POST", body)).status, 429);
  assert.equal((await second.request("/api/comments/create", "POST", body)).status, 201);
  const encoded = decodeURIComponent(first.cookies.deviceId);
  const deviceId = encoded.slice(2, encoded.lastIndexOf("."));
  const old = new Date(Date.now() - 61000);
  await RateLimit.updateOne({ _id: `comments:${deviceId}` }, { $set: { hits: [old,old,old] } });
  assert.equal((await first.request("/api/comments/create", "POST", body)).status, 201);
});

test("all four feed sort orders match approved snapshots, including filtered pagination", async () => {
  const guest = new Client(); await guest.request("/");
  for (const [sort, order] of [
    ["latest", { "publishedVersion.publishedAt": -1, _id: -1 }],
    ["oldest", { "publishedVersion.publishedAt": 1, _id: 1 }],
    ["popular", { totalViews: -1, _id: -1 }],
    ["leastViewed", { totalViews: 1, _id: 1 }],
  ]) {
    const filter = { ...require("../utils/publicArticle").PUBLIC_FILTER, "publishedVersion.category": "Technology" };
    const expected = await Article.find(filter).sort(order).limit(40);
    const first = await guest.request(`/api/articles/public?category=Technology&sort=${sort}`);
    const second = await guest.request(`/api/articles/public?category=Technology&sort=${sort}&page=2`);
    assert.equal(first.status, 200);
    assert.deepEqual([...first.data.articles, ...second.data.articles].map(a=>a._id), expected.map(a=>String(a._id)), sort);
    const html = await guest.request(`/?category=Technology&sort=${sort}`);
    assert.equal(html.status, 200);
    assert.match(html.text, new RegExp(`value="${sort}" selected`));
    assert.match(html.text, /data-category="Technology" class="active" aria-current="page"/);
    assert.ok(!html.text.includes('class="nav-home active"'));
  }
  for (const query of ["location=constructor", "location=unsupported", "location=haifa&location=jerusalem"])
    assert.equal((await guest.request(`/api/weather/current?${query}`)).status, 400);
});

test("security requirements: guest boundaries, reporter ownership and editor-only actions", async () => {
  await RateLimit.deleteMany({ _id: /^login:/ });
  const guest = new Client(); await guest.request("/login");
  for (const path of ["/api/users", "/api/articles/all", "/api/analytics/article/000000000000000000000001"])
    assert.equal((await guest.request(path)).status, 401, path);
  for (const path of ["/reporter/articles", "/editor/articles"])
    assert.equal((await guest.request(path)).headers.get("location"), "/login");
  const reporter = await new Client().login("Reporter1");
  const other = await User.findOne({username: "Reporter2"});
  const foreign = await Article.findOne({reporter: other._id});
  const created = await reporter.request("/api/articles/create", "POST", { reporter: other._id, status: "Published", title: "Ownership probe", category: "Technology", mainImage: "/images/news.svg", content: "Test", publishedVersion: {title: "Injected"} });
  assert.equal(created.status, 201);
  const id = created.data.article._id;
  try {
    const stored = await Article.findById(id);
    assert.equal(String(stored.reporter), (await User.findOne({username: "Reporter1"})).id);
    assert.equal(stored.status, "Draft");
    assert.ok(!stored.publishedVersion?.publishedAt);
    for (const [path, method] of [
      [`/api/articles/publish/${id}`, "PUT"], [`/api/articles/delete/${id}`, "DELETE"],
      [`/editor/articles/${id}/approve`, "POST"], [`/editor/articles/${id}/return`, "POST"],
      [`/editor/articles/${id}/save`, "POST"], [`/editor/articles/${id}/delete`, "POST"],
      ["/api/users/create", "POST"], [`/api/analytics/article/${id}`, "GET"],
    ]) assert.equal((await reporter.request(path, method, method === "GET" ? undefined : {})).status, 403, path);
    for (const action of ["save", "autosave", "submit"])
      assert.equal((await reporter.request(`/reporter/articles/${foreign._id}/${action}`, "POST", {title:"Denied"})).status, 404);
    assert.equal((await guest.request(`/api/articles/view/${id}`)).status, 404);
  } finally { await require("../services/articles").remove(id); }
});
