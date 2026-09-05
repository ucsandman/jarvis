# Public-site runbook

Production: https://jarvis-workbench.vercel.app/
Repository: https://github.com/ucsandman/jarvis

The public site is a static walkthrough and Windows download page. It does not run inference, accept subscription login, capture a camera/screen, or host the local API. Real builds happen in the downloadable workbench.

## Release procedure

1. Verify tests, browser behavior, and the final Windows executable. Publish the versioned GitHub release and checksum.
2. Update the pinned download and release links in the README and site. Keep model, streaming, credit, and signing disclosures accurate.
3. Run `node scripts/build-site.mjs` and `node scripts/verify-site.mjs`.
4. Inspect `vercel deploy --dry --json --cwd .artifacts/site --scope ucsandmans-projects`. It must contain exactly the 10 allowlisted public files and exclude environment/configuration data.
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

The site suite checks all four current walkthrough steps on desktop and mobile, arrow/Home/End navigation, the draft replay disclosure, six public assets, seven removed/private routes, download link, overflow and page errors. Public release evidence is appended below. Detailed historical investigations remain in [PLAYBOOK.md](../PLAYBOOK.md).

### 0.6.0 publication

Published source 45e139d and GitHub release v0.6.0. CI run 33980839433 passed on Windows and Linux. Vercel deployment dpl_9DBCD1x4HN27ZX2TbyNRu8Sv47Tk is ready on the production alias; all 24 public browser checks passed. The anonymous Windows download matched its published SHA-256 and 171,309,056-byte size. GitHub reports MIT and the correct homepage. The local desktop launcher was restarted and serves the new draft UI.

### Marketing refresh after 0.6.0

The hero now shows the current Fable draft interface and leads with screen sharing and the Windows download. Model/effort choice, bounded Live build, incremental drafts, and version controls are visible before the earlier prepared walkthrough. Metadata and the social preview use the current product. The walkthrough keeps its historical captures and is labeled accordingly. The deployment allowlist now includes streaming.png, for 13 public files.

### Complete capability and walkthrough alignment

The walkthrough now covers window sharing, model and effort selection, single or automatic builds, Fable drafts, and refinement/export. Removed Daylight images are no longer deployed. The FAQ covers voice and all image inputs, preview sizes, source/download, saved versions and runtime reset, sample/setup recovery, allowance versus subscription limits, and frontend-only boundaries. The public site remains an instructional guide, not a hosted generator.

Capability audit against public/index.html, public/app.js and the shipped model/launch implementation: | Product surface | Marketing location |
| --- | --- |
| Screen/window capture, explicit selected frame, exact sent-frame evidence | Hero, feature rows, walkthrough Share, privacy FAQ |
| Camera selection, JPEG/PNG/WebP upload, text-only input | Share panel and input FAQ |
| Local Windows dictation, local spoken replies | Choose panel and input FAQ |
| Astra/Fable, five effort levels, low-effort shortcut | Feature rows, Choose panel, download steps, speed FAQ |
| CLI install, sign-in, recheck/cancel, no-login local sample | Download steps and setup/sample FAQ |
| Live build quiet time, interval choices, ten-build cap | Share/Refine panels and download steps |
| Pause/cancel, stop capture, no restart on reload | Refine panel and privacy FAQ |
| Animated status, elapsed time, Fable draft/code, last working version | Watch panel |
| Astra completed-message limitation and draft script restriction | Features, Watch panel, speed FAQ |
| Desktop/mobile/expanded preview, source, HTML export | Refine panel and output FAQ |
| Twelve local versions, restore, reference images, confirmed reset | Refine panel and output FAQ |
| Runtime-data reset, same-origin browser storage, retry preview | Output FAQ |
| Local counter versus provider allowance, credits, no fallback | Setup/sample FAQ, download and privacy |
| Frontend-only output, no desktop control/backend/deployment | Scope FAQ |
| Windows launcher, shortcuts, tray quit, unsigned download, MIT | Download section and footer |

Verification: rendered all four current panels at desktop and mobile widths, exercised keyboard navigation, and confirmed all seven obsolete/private routes return 404. The marketing deployment contains ten allowlisted files. Existing application tests and CI remain the product behavior checks.

## 0.7 Computer mode surface audit

The hero now shows an actual Fable proposal from the native Windows verification app. The Computer mode guide covers local permission, selected-window inspection, fresh-text sharing, model/effort, review, single-use approvals, expiry and global Stop. The four-step prototype walkthrough remains distinct and functional. Both modes appear in features, FAQ, README, privacy/security docs and GitHub About. Download links point to 0.7.0.

The static deployment contains 11 allowlisted files, including computer.png. Native code, local routes, logs, controller state and account data are excluded. The guide explicitly limits accessible-control automation and does not claim unrestricted desktop, canvas or shell access. The updated verifier covers both guides at desktop/mobile widths, 7 public assets and 7 forbidden/removed routes.

### Published 0.7.0 verification

Released v0.7.0 from code commit 25e1105. Windows and Linux CI run 33984559654 passed. Vercel production deployment dpl_2kkFMN7pPsEwwUHXGbL5Dfoi2kns is READY at the canonical website. The production browser check passed both guides, mobile layout, public assets, blocked routes and the pinned download. GitHub About, homepage and desktop topics were verified after updating. Existing search-verification tags, sitemap and Vercel analytics were preserved.

The anonymous executable download was 171,325,440 bytes and matched SHA-256 bef0b66ee2b0f7d272191fc40dbe9995620ebb2fb48ac1451e8872ad5e3d0404. The final archive has 46 entries; all 23 first-party payload files match the shipped source, and 33 text files were scanned. Verification passed: 40 unit tests, 19 compiled filter cases, 14 native cases, 11 Computer UI checks, 20 packaged checks, 6 launcher lifecycle cases, plus user-app survival after Quit. Real Fable/browser/native execution completed three model steps and two reviewed actions; the final repeat took about 33 seconds.

The installed app was not reopened after release: automatic approval review rejected that separate local launch with only a blocked-by-policy reason. Public download and production site verification completed successfully.
