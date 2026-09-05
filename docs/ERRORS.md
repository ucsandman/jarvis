# Implementation lessons

## 2026-09-05: Computer mode verification

- A PowerShell-hosted UI fixture was correctly excluded by the terminal process filter. A standalone compiled fixture let the test exercise real UI without weakening the guard.
- Hidden process startup suppressed the fixture's window. Native UI tests now open only their owned fixture visibly and close it by its captured process handle.
- Requiring foreground focus for every UIA action rejected otherwise valid operations. Target-bound UIA patterns now act directly; only focus and keyboard operations require proven foreground focus.
- A review found that validating a fresh element but invoking a pattern from the old element defeated the re-resolution. Execution now obtains the pattern from the fresh, verified element and also binds parent context and accessible state.
- A regex review mistakenly double-escaped JSON-rendered source. Tests now load the compiled native regexes and check both blocked and ordinary strings.
- The ship audit must update both the existing prototype walkthrough and the new Computer guide. Keep capabilities and limitations adjacent to each mode, and verify both public surfaces in the same release.
- A lifecycle review found that apps launched by the native helper would inherit the server's kill-on-close Job Object. Packaged fixed app launches now originate from the desktop launcher, outside that job; runtime helpers remain contained. Verify user-app survival after Quit before publishing.

- Windows 11 had Paint installed as a Store app with no System32 mspaint.exe. Fixed app launches now use a fixed registered Windows app ID when the system executable is absent; no arbitrary launch target is accepted.
- The Stop button must remain usable in a new tab even when that tab has no owning-session token. A failed page-close request can leave an old lease active; Stop now stays available to revoke it immediately instead of waiting for expiry.
