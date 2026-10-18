# Final submission audit — updated 18 October 2026

## Verdict

The audited application passes the functional checks below after the fixes in this branch. Submission readiness still depends on the team completing the manual items at the end. No statement here certifies the team's actual laptop/database, credential rotation, course registration or Moodle submission.

Latest feature validation base: group `main` at `1112d2030be79d68c0d1a86175e98e7c4dc5a11f` (PR #8). This branch adds selectable weather locations, active category navigation, oldest/least-viewed sorting, and the requested [security review](SECURITY_REVIEW.md). All 24 automated tests and the expanded browser workflows pass. Merge this feature branch and submit/demonstrate that same final revision.

## Post-PR #4 integration repairs

- Fixed syntax errors in authentication middleware and the reporter controller, and restored environment configuration instead of embedded database/signing credentials or automatic weak-password accounts.
- Restored live DB role checks, CSRF, logout revocation, validated public search with 20-item pagination, atomic per-browser comment limiting and public-safe comment responses.
- Restored logical autosave revisions, all-state editor access, snapshot isolation, shared weather/sidebar/navigation and responsive templates. The conflicting standalone screen rewrite could not preserve these contracts and was replaced with the shared templates.
- Kept image upload/removal through a dedicated ownership-checked, CSRF-protected multipart endpoint. Images are limited to 3 MB PNG/JPEG/WebP signatures, stored with random filenames and carried through the usual autosave and editor approval flow. Old files are retained so replacing a draft image does not break the public snapshot; automatic orphan-file cleanup is not implemented.
- Kept SEO additions as escaped Open Graph/article metadata in the shared head. Removed a committed runtime upload, restored test dependencies and Node requirements, and corrected README clone instructions to the group repository.
- Added server and browser regressions for upload authorization, CSRF, malformed/oversized uploads, reload recovery, removal and published-image isolation.

## Corrections made in the audit

1. **Autosave ordering and recovery:** late autosaves could conflict with unload saves, and timestamp-based local recovery could miss newer keystrokes. Each draft now has a logical revision; the server accepts only newer revisions, and the browser recovers unsynced newer local revisions. A conflicting older local backup is offered explicitly instead of silently overwriting the server.
2. **Exact draft text:** autosave no longer trims the content's leading/trailing whitespace. A 50,000-character Unicode draft fits the server's request limit.
3. **Editor access:** the review screen now permits working-content edits in every state. Editing a published article starts a draft and preserves the approved public snapshot. Only pending submissions can be approved or returned.
4. **Invalid requests:** non-object request bodies are rejected with 400; missing API items return JSON; malformed signed identities are treated as unauthenticated. Shared error-page locals are available before account lookup.
5. **MVC:** public article and homepage request handling now lives in a controller rather than route bodies.
6. **Demo safety:** the seed refuses a database containing any core-model data unless explicitly reset. The new `npm run preflight` reads and checks the actual presentation database without changing it.

## Requirement-to-evidence matrix

| Requirement from PDF | Evidence / result |
| --- | --- |
| Node.js, Express, MVC, MongoDB/Mongoose | app.js, routes, controllers, services, models; public handlers moved to publicController.js |
| Vanilla JavaScript / Ajax, EJS, no forbidden frontend framework | public/js, views, plain CSS; production dependencies contain no React/Vue/Angular/UI framework |
| Semantic HTML5 and desktop/tablet/mobile layout | Shared header/nav/main/footer/aside/article; eight page types checked at 1440/768/390px |
| Approved-only public feed | PUBLIC_FILTER and toPublicArticle; unpublished working fields are never returned publicly |
| Infinite scroll, 20 more articles | listPublic fixed batch of 20; browser test scrolls and observes at least 40 cards |
| Search, category, read/unread, date/popularity | Integration queries cover these filters; regex characters are treated literally; browser tests exercise Ajax |
| Feed title, image, excerpt, category, reporter, publication date | Server card partial and equivalent DOM construction in feed.js |
| Full article in initial HTML for SEO | EJS full-article rendering; integration asserts actual text in response before client JavaScript |
| Article metadata and comments form/list | article.ejs; public read and Ajax comments exercised |
| New comment appears without reloading list | Browser test checks the newly prepended comment |
| Three guest comments per device/minute | Atomic rolling MongoDB limiter plus signed browser cookie; six simultaneous attempts produce three successes and three 429s |
| Every article visit counted | Public controller records hourly aggregate and total; 50 concurrent visits retain exactly 50 views |
| Staff login and role destination | Browser reporter/editor logins reach their own work areas |
| Passwords hashed, server authorization | bcrypt; JWT verification plus current DB roles; API role/ownership/CSRF negative tests |
| Reporter sees own articles and statuses | Reporter dashboard and ownership-filtered queries; cross-reporter updates denied |
| Create/edit/submit, editorial notes and resubmit | Reporter and editor workflow integration test includes return-with-note and resubmission |
| Only allowed publication transitions | Publishing requires Pending; repeat approval blocked; editing Published creates a working draft |
| Autosave and continuity | Browser tests server save, reload, immediate refresh during a delayed save, and a separate browser context loading the persisted draft |
| Approved version remains public during edits | Snapshot equality asserted during updates and after editor working-content edits |
| Editor sees all articles and filters status | Paginated dashboard and review; tested for Draft/Pending/Published/Returned |
| Editor edits, approves, returns with note, deletes | Server/UI handlers; CRUD and workflow tests; separate old/new content columns |
| Impact Analytics time/count axes and publication markers | Canvas uses numeric timestamps; publicationHistory appends every approval; accessible table and timeline |
| At least four models with full CRUD | User, Article, Comment, Analytics; authorized API test creates, reads, updates and deletes each |
| Restart retains login | Real child Node process stopped and restarted with the same DB and signing secret; authenticated request still succeeds |
| Invalid data and unauthorized requests do not crash | Negative tests and subsequent healthy requests; errors logged without secrets |
| Usable with thousands of articles | Local test: 3,002 articles, filtered pages without duplicate IDs, 50 parallel article visits with exact counts; not a production capacity guarantee |
| Free weather service, no card | Open-Meteo noncommercial endpoint, no key; attribution shown |
| Weather no older than 15 minutes | Provider timestamp and cache deadline checked server/client; outage and expiry tested, stale temperature removed from UI |
| Thousands of weather readers | Concurrent cache misses share one request (50 callers in test), timeout and cooldown; per-process cache documented |
| Seed at least 500 articles, users, comments, states, repeated updates, historical views | Deterministic seed and read-only preflight; tests inspect those examples |
| README installation, folders and feature description | README.md and .env.example; Hebrew defense guide available |
| Logs for errors and operational events | utils/logger.js, app error handler and publication logging |
| No sensitive current-source files | .env ignored; sample has placeholders; tracked source scanned for the previously exposed literals; owner must still rotate historical credentials |
| Collaborative Git, personal contribution, same lecturer, knowledge of all code | Manual team evidence needed; actual prior commits/PRs preserved; AI assistance documented |

## Final check results

- JavaScript syntax checks passed.
- **24/24 automated tests passed**, including complete CRUD, negative permissions, actual Node restart, stale autosaves and demo preflight.
- Chromium workflow and all eight page types passed at 1440px, 768px and 390px; no page overflow or uncaught page exceptions.
- An actual refresh during a delayed autosave recovered the newest keystrokes; a separate browser context loaded the same server-persisted draft.
- Infinite scroll loaded a second batch; the weather UI removed expired data during a simulated outage and recovered after retry.
- Local size test: **3,002 articles**, two filtered pages, **50 simultaneous article visits**, exact counts retained; observed around 0.3 seconds on this machine, not a capacity promise.
- An earlier live Open-Meteo response passed freshness checks. During the latest rerun, a live request timed out after five seconds; live provider availability must be checked on the presentation computer. Mocked expiry, cooldown and UI recovery tests passed. Production dependency audit reported **0 known advisories**.

## Rehearsal results and boundaries

Automated tests use a new temporary MongoDB each time, never the team's database. Browser QA uses a stable weather fixture and also tests expiry/unavailability/recovery; live weather is checked separately. `npm audit --omit=dev` returned zero known production advisories during this audit. This is not a guarantee against all security defects.

The browser checks cover Chromium, not every browser/device. The size/concurrency test is a small local measurement, not proof that one server can handle thousands of simultaneous real users. Drafts that have not reached the server during a complete network outage cannot be recovered on another computer until synchronization; a local backup and clear status remain available. Device cookies can be cleared, so this is browser identity rather than hardware fingerprinting.

## Team actions tonight — חובה לפני הגשה

1. **Check Moodle immediately.** The PDF mentions both submission up to 24 hours before the defense and closure at 23:59 on the preceding day. Confirm the actual course deadline and submit tonight as applicable; do not assume you can submit tomorrow.
2. **Merge the requested weather/navigation/sorting feature branch and freeze the final revision.** PR #7 and PR #8 already include the earlier integration and category-validation repairs. Generate the submission ZIP from the final merged source and demonstrate that same code.
3. **Run on the presentation computer:** `npm ci`, copy .env.example to .env, configure your own MONGO_URI/JWT_SECRET/DEMO_PASSWORD, start MongoDB, seed an empty demo DB, then `npm run preflight`, `npm run check`, `npm test`, `npm start`. Never run `seed -- --reset` on data you intend to keep.
4. **Confirm the output of preflight on your real database.** This audit cannot inspect your local or Atlas demonstration data. Prepare MainEditor and Reporter1 accounts, a draft, a pending article, a returned article and a published article with several updates.
5. **Rotate historical credentials.** Current files are clean, but earlier Git commits exposed a MongoDB password, JWT key and weather key. Their owners must revoke/replace them. Git history was not rewritten and credential rotation cannot be verified here.
6. **Verify administrative requirements:** group of 4–5, same lecturer, personal Git accounts and genuine contribution evidence; each person can explain all code, including AI-assisted changes and any dependencies approved in class.
7. **Rehearse the exact defense sequence** in docs/DEFENSE.md, including restart, cross-user denial, comment blocking, published-update isolation, autosave and weather failure. Ensure a stable internet connection and a known local startup procedure.
8. **Moodle submission:** upload the clean source ZIP and provide the viewable HTTPS Git repository link / final commit. Keep `.env`, node_modules, logs, local database data and Git metadata out of the ZIP. Configuration instructions and .env.example must be included.
