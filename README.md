# The Daily Web | מערכת חדשות

A Hebrew, RTL news application for the Internet Applications course. Node.js + Express, EJS, MongoDB/Mongoose, semantic HTML5, plain CSS/Flexbox and Vanilla JavaScript. No frontend framework. Analytics uses the browser's canvas API.

## Quick start

Prerequisites: Node.js **22 or newer**, npm, and a running MongoDB instance (local MongoDB Community Server or your own Atlas database). Internet access is needed for weather. The news application remains usable if weather is unavailable.

```sh
git clone https://github.com/NirShechter99/PAI-Group-Project.git
cd PAI-Group-Project
npm ci
```

Copy `.env.example` to `.env` (PowerShell: `Copy-Item .env.example .env`; macOS/Linux: `cp .env.example .env`). Generate your own signing secret:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Paste that value into `JWT_SECRET` in `.env`. Set `MONGO_URI` to your own database URI and `DEMO_PASSWORD` to a password of at least 10 characters (maximum 72 UTF-8 bytes). Never commit `.env`, real credentials, cookies or tokens. Node loads `.env` directly; dotenv is not required.

```sh
npm run seed
npm start
```

Open **http://localhost:3000**. Log in at `/login` using `MainEditor` or `Reporter1` through `Reporter5`, with **your locally configured `DEMO_PASSWORD`**. User passwords are bcrypt hashes in MongoDB; the application does not display them.

- `npm run dev`: restart the server on source changes.
- `npm run seed`: populate an empty database with 500 articles, six staff accounts, comments, 48 hours of view counts, and multiple publication events per published article.
- `npm run seed -- --reset`: **deletes existing project data** before seeding. Use only on a disposable demo database, with the team's agreement.
- `npm run check`: JavaScript syntax check.
- `npm test`: integration tests against an isolated temporary MongoDB and mocked weather tests. No team database is contacted. The test helper may download a MongoDB binary on first run; it is a development-only dependency. For browser tests run `npx playwright install chromium` once, then `npm run test:browser`.

For deployment, set `NODE_ENV=production` and use HTTPS; authentication and CSRF cookies then use `Secure`. Keep `JWT_SECRET` unchanged across server restarts so existing sessions remain valid. Never reuse credentials previously committed in this repository: removing them from the current files does not remove them from Git history. Owners must rotate the old database password, JWT secret and OpenWeather API key. This branch does not rewrite team history.

## Screens and features

| Area | Implementation |
| --- | --- |
| Public feed `/` | 20 articles per batch; infinite scroll and a manual load button; Ajax title search, category/read-status filters and date/popularity sorting. Only approved snapshots are returned. |
| Article `/api/articles/view/:id` | Full article text rendered in initial HTML for SEO; author, category, date and image; each visit increments hourly analytics and records read status for the browser. |
| Comments | Ajax creation without reloading the list; paged existing comments; server-enforced rolling limit of three submissions per browser per minute, plus client feedback. |
| Reporter `/reporter/articles` | Own articles only; creation, draft editing, autosave, submission, editorial notes and published-update workflow. |
| Editor `/editor/articles` | All articles with status filters and pagination; side-by-side approved and working versions; edit pending submissions, approve, return with notes, delete and inspect analytics. |
| Analytics | Hourly views on a numeric time axis; every publication has an exact timestamp marker; accessible source table and publication timeline. |
| Authentication | bcrypt passwords, HTTP-only JWT cookie, current roles loaded from MongoDB, CSRF protection, login throttling and logout revocation. A normal restart does not invalidate sessions. |
| Weather | Open-Meteo current conditions for Tel Aviv; server-side caching, concurrent-request sharing, timeout, retry cooldown, source attribution and client expiry. |
| Responsive design | Shared EJS partials; semantic layout, keyboard focus, labeled inputs, Hebrew RTL, mobile/tablet/desktop CSS. Wide management tables scroll inside their container. |

## Project structure

```text
app.js                       Express setup, route mounting, errors and startup
config/index.js              Environment validation
controllers/                 Request handlers, including reporter/editor workflows
models/                      User, Article, Comment, Analytics + supporting models
routes/                      Public and protected endpoints
middleware/                  Authentication, role checks, CSRF and browser identity
services/articles.js         Public queries, publication snapshots and view recording
services/weather.js          Weather cache and provider handling
services/rateLimit.js        Atomic rolling rate limits in MongoDB
views/partials/              Shared header/footer, weather and article cards
views/reporter/              Reporter dashboard and writing screen
views/editor/                Editor dashboard, review and analytics
public/css/site.css          Shared responsive design
public/js/                   Vanilla JS for feed, forms, autosave, weather and chart
scripts/seed.js              Reproducible demo data; explicit reset safeguard
test/                        Integration and weather tests
docs/                        Contribution workflow, defense guide and verification
```

## Data and workflow

`User`, `Article`, `Comment` and `Analytics` are the four core models. `ReadingHistory` stores browser-specific read status; `RateLimit` stores expiring request windows. Indexes support publication-date/category queries, reporter lookup, reading history and unique hourly view buckets.

The article's working fields are separate from `publishedVersion`. Only an editor can copy a **Pending** submission into the public snapshot. Every approval appends to `publicationHistory`; subsequent edits never overwrite that history. The flow is `Draft → Pending → Published`, or `Pending → Returned → Pending`. Editing a published article begins a new draft while the approved version remains public. Server checks enforce ownership, roles and valid transitions.

Autosave uses a serialized request, a revision counter, local backup and a final beacon. Successfully acknowledged saves are available from another computer. Unsynced work during an outage remains on the original browser and cannot appear on a different computer until the connection recovers. The UI reports that state rather than claiming the server saved it.

## API and permissions

Every state-changing HTTP request requires the CSRF value from the page's `meta[name="csrf-token"]` as `X-CSRF-Token` (JSON) or `_csrf` (form). Use the browser UI or keep both cookies and CSRF token in an API client.

| Model | Create | Read/search | Update | Delete |
| --- | --- | --- | --- | --- |
| Users (Editor) | `POST /api/users/create` | `GET /api/users?q=name` | `PUT /api/users/:id` | `DELETE /api/users/:id` |
| Articles (staff; ownership enforced) | `POST /api/articles/create` | `GET /api/articles/all`; public approved search at `/api/articles/public` | `PUT /api/articles/update/:id` | `DELETE /api/articles/delete/:id` (Editor) |
| Comments | `POST /api/comments/create` (public) | `GET /api/comments/article/:articleId?page=1` | `PUT /api/comments/update/:id` (Editor) | `DELETE /api/comments/delete/:id` (Editor) |
| Analytics (Editor) | `POST /api/analytics/record/:articleId` | `GET /api/analytics/article/:articleId` | `PUT /api/analytics/update/:id` (`views`) | `DELETE /api/analytics/delete/:id` |

Public article visits record views automatically on the server. Client code does not send a second view call. Account creation is Editor-only to prevent a visitor assigning themselves an Editor role. Account deletion is blocked for the current editor or an author who still owns articles.

## Weather design and limitations

The public endpoint remains `GET /api/weather/current`. Open-Meteo's noncommercial free API requires no key or credit card; attribution appears in the widget. See [Open-Meteo](https://open-meteo.com/) and its [terms](https://open-meteo.com/en/terms).

One successful provider response is shared by all visitors to a Node process for at most ten minutes, and never beyond **15 minutes after the provider's data timestamp**. The widget clears expired values even if the page stays open. Overlapping cache misses share one promise; upstream requests time out after five seconds. Failed requests have a 30-second cooldown. Stale or malformed data produces an unavailable state, never a misleading old temperature. Conditions are model-derived, not a guarantee of a live station observation.

The cache is per server process. Multiple replicas need a shared cache to avoid one upstream request per replica; the current setup is a single Node server. At steady state this reduces thousands of visitor requests to a small number of provider calls. This is an architectural reduction, not a claim that a production load test has been performed.

## Troubleshooting

- **JWT_SECRET error:** generate a random value and put it in `.env`; no default secret is embedded.
- **Database startup error:** confirm MongoDB is running and `MONGO_URI` is correct. With Atlas, check your account's network access settings and rotate any previously exposed credentials.
- **No articles:** run the seed command on your own empty demo database.
- **Weather unavailable:** verify outbound HTTPS to `api.open-meteo.com`; wait for the cooldown. News, editing and login still work.
- **403 after reopening an old form:** refresh the page to obtain a current CSRF token.
- **Tests cannot start MongoDB:** ensure binaries can download and execute on your machine. The tests disable Unix sockets on Unix platforms and connect over TCP, which also works in containers that restrict socket files. On PowerShell, set environment variables with `$env:NAME='value'` before running tests.

## Team and defense

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branch/PR workflow and [docs/DEFENSE.md](docs/DEFENSE.md) for your explanation and demonstration checklist. All students must understand the complete implementation, including AI-assisted changes, as required by the course. Commit history records the original teammates' work; final integration includes the editor branch and documents corrective changes.
