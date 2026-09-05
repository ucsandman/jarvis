# Public-site runbook

Production: https://jarvis-workbench.vercel.app/
Repository: https://github.com/ucsandman/jarvis

The public site is a static walkthrough and Windows download page. It does not run inference, accept subscription login, capture a camera/screen, or host the local API. Real builds happen in the downloadable workbench.

## Release procedure

1. Verify tests, browser behavior, and the final Windows executable. Publish the versioned GitHub release and checksum.
2. Update the pinned download and release links in the README and site. Keep model, streaming, credit, and signing disclosures accurate.
3. Run `node scripts/build-site.mjs` and `node scripts/verify-site.mjs`.
4. Inspect `vercel deploy --dry --json --cwd .artifacts/site --scope ucsandmans-projects`. It must contain exactly the 13 allowlisted public files and exclude environment/configuration data.
5. Deploy the approved release with `vercel deploy --prod --yes --cwd .artifacts/site --scope ucsandmans-projects`.
6. Run `node scripts/verify-site.mjs https://jarvis-workbench.vercel.app`. Confirm the anonymous executable download hash, metadata, website link, and GitHub About text.

Never deploy the repository root. The build output is `.artifacts/site`; generated environment files are excluded and must never be read, staged, or uploaded. Roll back with Vercel's deployment promotion controls. Public-site rollback does not alter local applications.

## Public surface

- One indexable page, with title, description, canonical URL, Open Graph image, robots.txt, sitemap.xml and llms.txt.
- Preserve Google and Bing ownership tags. Ownership and sitemap submission were completed at initial launch. Indexing is controlled by the search providers; manual Google indexing was previously quota-limited.
- Standard Vercel Web Analytics uses the existing hosting plan. No Plus add-on or new billing configuration is required for ordinary releases.
- No hosted task-board sample. Its former route returns 404; the website explains the actual reference, prompt, result and revision workflow.
- No DNS changes, social posts or outreach are part of a code release.

## Current product copy

Screen/window sharing is the primary input; camera and upload remain available. Live build sends consented snapshots after a pause, with minimum intervals and a ten-request cap. Fable can show incremental HTML drafts and may consume paid Claude usage credits. Astra's isolated Codex exec path releases completed messages. Draft scripts are disabled until final validation. Source is MIT licensed; upstream runtimes retain their own terms. The outer Windows executable is unsigned.

## Verification

The site suite performs 24 browser checks across the walkthrough, keyboard navigation, removed/private routes, download link, eight public assets, mobile fit and page errors. Public release evidence is appended below. Detailed historical investigations remain in [PLAYBOOK.md](../PLAYBOOK.md).

### 0.6.0 publication

Published source 45e139d and GitHub release v0.6.0. CI run 33980839433 passed on Windows and Linux. Vercel deployment dpl_9DBCD1x4HN27ZX2TbyNRu8Sv47Tk is ready on the production alias; all 24 public browser checks passed. The anonymous Windows download matched its published SHA-256 and 171,309,056-byte size. GitHub reports MIT and the correct homepage. The local desktop launcher was restarted and serves the new draft UI.

### Marketing refresh after 0.6.0

The hero now shows the current Fable draft interface and leads with screen sharing and the Windows download. Model/effort choice, bounded Live build, incremental drafts, and version controls are visible before the earlier prepared walkthrough. Metadata and the social preview use the current product. The walkthrough keeps its historical captures and is labeled accordingly. The deployment allowlist now includes streaming.png, for 13 public files.
