# Team Git workflow

1. Fetch the latest repository and create a task branch from the agreed integration base.
2. Keep commits focused: describe the behavior changed, the reason, and affected screens.
3. Run `npm run check` and `npm test`; inspect affected screens on desktop and mobile.
4. Open a PR with screenshots, tests, configuration changes and remaining limitations.
5. Review overlapping files with their owner before merging. Shared partials, app.js, models and CSS need particular care.
6. Resolve conflicts by preserving both intended behaviors, then repeat the relevant checks. Never force-push a shared branch or rewrite another student's history without team agreement.
7. Merge after review and record the final submission commit. Each student should fetch and run that exact commit on their own computer before the defense.

Use your own Git account and configured identity. Keep genuine commits and PRs; do not fabricate contribution history. AI-assisted code must be read and understood by the student submitting it.

## Integration in this branch

- `main` already includes the reporter work and the frontend branch's existing commits.
- The editor branch (`feature/editor-area`, PR #3) was reviewed and is now merged into main. Its commits remain ancestors of this branch.
- The finishing work adds shared UI and weather integration and fixes startup/permission/workflow gaps found while checking the combined application.
- The new finishing PR can be reviewed as the complete integration. Check PR #3's status after merging it to avoid attempting to reapply its changes.

## Secrets

`.env` is ignored; `.env.example` contains placeholders only. Never include database passwords, JWT keys, weather keys, cookies or authentication tokens in commits, screenshots or logs. Removing an exposed secret from a later commit is insufficient: its owner must revoke/rotate it. Do not rewrite shared Git history as part of a routine merge.

## Final submission

Record the final commit, run the system on each student's computer, and create the submission ZIP from that source. Exclude `.env`, `.git`, `node_modules`, local logs and test output. Include README and `.env.example`. Supply the viewable repository link as required by the PDF. Confirm your actual defense deadline with the course; this repository does not assume one.
