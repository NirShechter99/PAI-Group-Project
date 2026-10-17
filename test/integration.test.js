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
  mongo = await MongoMemoryServer.create({ instance: { args: process.platform === 'win32' ? [] : ['--nounixsocket'] } });
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

test('a real Node process restart preserves authentication against the same database', async () => {
  const { fork } = require('node:child_process');
  const path = require('node:path');
  const previousBase = base;
  let child;
  async function launch() {
    child = fork(path.join(__dirname, 'server-child.js'), [], {
      env: { ...process.env, MONGO_URI: mongo.getUri(), JWT_SECRET: process.env.JWT_SECRET },
      stdio: ['ignore', 'ignore', 'pipe', 'ipc']
    });
    const port = await new Promise((resolve,reject) => {
      child.once('message', value => resolve(value.port));
      child.once('exit', code => reject(new Error(`Child exited ${code}`)));
    });
    base = `http://127.0.0.1:${port}`;
  }
  async function stop() { const stopped=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await stopped; }
  try {
    await launch();
    const client=await new Client().login('Reporter1');
    await stop();await launch();
    assert.equal((await client.request('/reporter/articles')).status,200);
  } finally { if(child?.exitCode===null)await stop();base=previousBase; }
});
