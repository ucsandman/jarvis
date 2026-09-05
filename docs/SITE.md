# Public demo

Live: https://jarvis-workbench.vercel.app/

The maintainer approved a public static demo with local generation on 2026-09-05, then explicitly selected the existing Vercel Pro team. Visitors can inspect the reference-to-prototype walkthrough without an account. Actual generation runs through the user's own local Codex CLI and eligible ChatGPT subscription. This does not introduce hosted inference, a token proxy, or metered model APIs.

## Build and deploy

The existing local app remains in `public/`. The public landing page lives in `site/` because it serves a different audience and has no local APIs. `scripts/build-site.mjs` copies a fixed allowlist of public files into `.artifacts/site`, including the existing example and synthetic-reference screenshots. Never deploy the repository root or the local server.

```powershell
npm run build:site
npm run verify:site
vercel link --yes --project jarvis-workbench --scope ucsandmans-projects --cwd .artifacts/site
vercel deploy --dry --json --cwd .artifacts/site --scope ucsandmans-projects
vercel deploy --prod --yes --cwd .artifacts/site --scope ucsandmans-projects
node scripts/verify-site.mjs https://jarvis-workbench.vercel.app
```

Review the dry-run manifest before uploading. Vercel link may create `.env.local` inside the output folder; it must remain excluded, and must never be read, copied or published. There are no required application environment variables. The deployment uses the Other preset, no install step, no build step on Vercel, and no functions. It is deployed explicitly rather than automatically deploying the repository root on Git pushes.

The download is pinned to the v0.3.0 GitHub release asset, `Jarvis-0.3.0-Windows-x64.exe`. It downloads directly without requiring a GitHub page visit. Node and official Codex are included. The outer executable is unsigned, disclosed beside the download. Publish and verify the EXE and SHA256SUMS.txt assets before deploying a page pointing at them. Keep the asset URL, filename, version and size aligned. See [Windows packaging](WINDOWS.md).

## Boundaries

- Public pages cannot request camera, microphone or geolocation.
- The iframe permits scripts and local form events, but lacks same-origin access. Its CSP prevents network connections and form navigation.
- Only the home page is indexable. The demo is noindex; robots, sitemap and llms files describe the actual product boundary.
- Standard Vercel Web Analytics is enabled, with a same-origin script loaded on Vercel hostnames. No task text is collected by the parent page. Hosting and analytics are subject to the existing Pro plan's usage charges.
- Google ownership uses a public HTML meta tag. Preserve it when editing the page.
- No social announcements, email, custom domain purchase or DNS changes are part of this deployment.

Rollback uses Vercel's deployment promotion/rollback controls for this project. The local application is unaffected by public-site rollback.

## Verification and lessons

The original iframe omitted `allow-forms`, which prevented the board's JavaScript submit handler from running. The new UI check failed on task creation; matching the existing local sandbox fixed it. Preserve this form permission alongside CSP `form-action 'none'`.

The CLI adapter generator could not compile Vercel's help output. The official authenticated CLI provided the project, deployment and exact upload manifest instead. Offlocal had no registered projects in this environment.

The new browser runner exposed an iframe focus/scroll problem when clicking a later FAQ. Direct live-browser verification confirmed the FAQ opens correctly. Keep a focused regression check for both iframe interactions and the page controls that follow them.

### Launch evidence, 2026-09-05

- Production deployment `dpl_HoSr6B64s2FkGU8YLf9fVgrVwZBA` is READY and serves the public alias without login.
- Live browser: added a task, moved it to Done, filtered it, reset the example, and opened the installation FAQ. All five interactions worked. Mobile width 390 px has no horizontal overflow.
- At initial launch, 21 unit tests passed and lint/build checked 18 JavaScript files. The maintainer subsequently authorized correcting the FAQ test. Explicit scrolling and keyboard activation resolved the iframe-to-parent focus issue; the original 16 site checks then passed locally and live.
- Public home, robots, sitemap, llms, favicon and analytics script return HTTP 200. `/api/session` returns 404.
- Pinned ZIP download returns HTTP 200 (692,854 bytes). Archive inventory: 48 entries, one Windows launcher, one server, zero `.env` or `.secrets.env` files.
- Google: HTML-tag ownership verified; sitemap submitted but initial fetch reports "Couldn't fetch". An independent request including a Googlebot user agent returned HTTP 200 and valid sitemap XML. Homepage inspection completed; manual indexing request was rejected because the account's daily quota was exceeded.
- Bing: HTML-tag ownership verified; one sitemap submitted and Processing, zero errors or warnings at submission.
- Standard Web Analytics enabled in the existing Pro plan. The production script endpoint returns 200. No Plus add-on enabled.
- Keyword-volume lookup: Treg's free Google Ads endpoint requires an unconnected Google Ads credential. No paid lookup or new account connection was made; the title describes the product and is not claimed to be keyword-volume optimized.

Retro: the static deployment and live-browser checks worked without exposing the local account. The headless runner's iframe focus handling needed correction, and a generated Vercel credential appeared during linking. Keep the explicit upload-manifest check, refuse unexpected output files, and verify iframe-to-parent interactions independently before accepting a browser-runner result.

## 0.3.0 product correction

Follow-up: the maintainer requested removing the optional sample entirely. The site no longer includes the sample section, reset handler or hosted demo HTML. The deployment contains 12 public files and disallows frames. The local Windows application's example is unchanged. Browser QA checks the section is absent and the former `/demo.html` route returns 404.

The task board demonstrated an output, but visitors reasonably read its input as a prompt to Jarvis. The main demo now explains the actual reference, prompt, result, and revision journey. The board is an optional collapsed sample, and the site labels all prepared material. Keep captured results visible when describing a change, rather than relying on text that claims something was added. Real generation remains in the downloadable workbench.

Release evidence: v0.3.0 points to `ea4048925bae34f91bc89224b25b28b0e2deaad3`. GitHub CI run `33975720229` passed on both Windows and Linux. The anonymous executable download returned HTTP 200 and 171,293,696 bytes; its SHA-256 matched the published checksum. The payload scan checked 34 files, including 24 text files, with zero credential filenames or secret/private-path hits and four current-source matches.

Production deployment `dpl_Dk8zgMJQYqs6qzb6cEXhuBKXXtup` is READY. Its dry-run/upload contains 13 public files and excludes generated environment data. All 25 public-site browser checks pass against the live alias, including captured before/after images, sample controls, pinned executable link, public assets, private-route rejection and mobile layout. The download and public walkthrough are shipped; search indexing remains subject to the previously recorded provider limits.
