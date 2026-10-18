# Verification record

Latest update: 18 October 2026, based on group main `1112d2030be79d68c0d1a86175e98e7c4dc5a11f` (PR #8).

- `npm run check` passed.
- **24 automated tests passed**, including four feed sort orders with filtered pagination, independent city caches/cooldowns, and the PDF guest/reporter/editor permission matrix.
- Chromium workflows passed at 1440/768/390px with no document overflow or uncaught page errors. Checks include all category navigation links and dropdown highlights, both new sort choices and reload persistence, weather city selection and persistence, expiry/outage/recovery, comments, login, image upload/removal, autosave/reload and editorial approval.
- Authentication coverage includes bcrypt storage, malformed/tampered JWTs, immediate DB role/deletion checks, cross-reporter denial, editor-only publication/administration, CSRF, logout revocation and a real Node process restart.

See [SECURITY_REVIEW.md](SECURITY_REVIEW.md) for the requested security review and [SUBMISSION_AUDIT.md](SUBMISSION_AUDIT.md) for the full assignment matrix and administrative checks. PR #8 already includes the earlier category allowlist correction; this branch adds the requested location, navigation and sorting features.

Tests use disposable databases and never contact the team's own demo database. Browser weather checks use controlled fixtures; upstream live service availability must be checked on the actual presentation computer with `npm run preflight`. Previous live requests from the development environment timed out, while unavailable/expiry/recovery behavior passed.

Screenshots are generated to docs/screenshots and ignored by Git. Browser tests accept PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH for environments where the default browser download is unavailable. Verification used Chromium 153.
