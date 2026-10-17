# Verification record

Verified on 16 October 2026 against a disposable MongoDB database seeded with 500 articles. No team database was used and no existing team data was deleted.

## Automated results

- `npm run check`: all application, browser and test JavaScript passes syntax checks.
- `npm test`: **8 tests passed**. Covers 500-article seed and EJS rendering, public snapshots, search/category/read filters and popularity sorting, authorization and CSRF, malformed input, reporter submission/editor return/repeated publication, parallel comment-rate enforcement, logout revocation and a real Node child-process restart using the same MongoDB and signing secret.
- Weather unit tests: 50 simultaneous cache misses share one provider request; cached values expire by data timestamp; stale data, malformed payloads and provider errors are rejected; cooldown prevents retry storms.
- A separate live Open-Meteo request succeeded and returned timestamped current conditions. Browser screenshots use a controlled weather fixture for repeatability; they are not evidence of upstream availability.
- `npm run test:browser`: Chromium walkthrough passed for public reading, search, category filtering, empty search, comment insertion, reporter login, new draft, autosave and reload, submit, logout, editor login, approval and analytics. No uncaught page exceptions.
- All eight page types checked for page overflow: feed, article, login, reporter list, writing form, editor dashboard, review and analytics. Viewports: 1440px desktop, 768px tablet and 390px mobile. Wide tables scroll inside their own container.

The browser test exposed an already-saved draft submission stall caused by resubmitting during the original submit event. The implementation now allows the original submission when saved, and defers resubmission after a pending save. The full workflow passes with that fix.

## Environment notes

Tests use `mongodb-memory-server` only as a development helper, with TCP rather than Unix sockets. The temporary database is separate from MONGO_URI. Browser QA used Chromium 153 via an explicitly selected executable because the default Playwright browser download was unavailable in the execution environment. Normal local setup is `npx playwright install chromium`, then `npm run test:browser`. You may optionally set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a compatible local Chromium executable.

Screenshots are generated to `docs/screenshots/` and ignored by Git. They can be regenerated with the browser test.

## Limits and required local checks

- This is functional verification, not a thousands-of-users production load test. Cache coalescing and indexed hourly counters reduce work but do not establish a production capacity guarantee.
- Weather is model-derived. The app checks its data timestamp, never displays expired data as current and cannot guarantee the provider's uptime.
- Device identity is a signed browser cookie; clearing cookies creates a new browser identity. It is not hardware fingerprinting.
- Work acknowledged by the server survives browser and server restarts. Offline-only changes remain on the original device until synchronization succeeds.
- Repeat the walkthrough on each student's computer against the final submission commit, using the local .env settings. Browser inspection covered Chromium; test other browsers you plan to demonstrate.
- Rotate credentials previously exposed in Git. Current source uses environment settings; shared Git history has deliberately not been rewritten.

## Git delivery

The branch is based on the actual merged editor work in main at `ff35eda2c242f1358d9307965b4a049eeca2c35e`. Direct publishing to the group repository returned HTTP 403. After the user created the fork `yuvalg2001/PAI-Group-Project`, feature-branch creation succeeded there. Finishing commits are published on `feature/ui-weather-docs` in that fork for review and integration into the group repository. The group main remains unchanged until the pull request is merged.
