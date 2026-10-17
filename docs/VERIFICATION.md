# Verification record

The final requirement-by-requirement audit, latest results, corrections and submission checklist are in [SUBMISSION_AUDIT.md](SUBMISSION_AUDIT.md).

On 17 October 2026: 15 automated tests passed, full Chromium workflows passed at desktop/tablet/mobile sizes, and a real provider weather request was fresh. Tests use disposable databases and never contact the team's own demo database. Run `npm run preflight` on the actual presentation computer to inspect its data without changing it.

The code is based on group main after PR #5. PR #4 is a separate, unmerged screen rewrite; it is not part of the audited release. Freeze the final code and demonstrate exactly what you submit.

Browser screenshots use a controlled weather fixture. They are generated to docs/screenshots and ignored by Git. The browser test accepts PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH for environments where the default browser download is unavailable. The development check used Chromium 153.
