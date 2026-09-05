import { mkdir, readFile, readdir, writeFile, copyFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

// A fixed allowlist keeps the local server, credentials and artifacts out of hosting.
const out = '.artifacts/site';
const origin = 'https://jarvis-workbench.vercel.app';
await mkdir(out, { recursive:true });
// Remove the obsolete generated sample; the local app keeps its own example.
for (const file of ['demo.html','reference.svg','workbench.png','revision.png']) await unlink(join(out,file)).catch(error=>{if(error.code!=='ENOENT') throw error;});
const allowed = new Set(['index.html','site.css','site.js','vercel.json','mark.svg','streaming.png','og.png','robots.txt','sitemap.xml','llms.txt','.vercel','.env.local','.gitignore']);
for (const name of await readdir(out)) if (!allowed.has(name)) throw new Error(`Unexpected deployment file: ${name}. Review it before building.`);
for (const file of ['index.html','site.css','site.js','vercel.json']) await copyFile(join('site',file),join(out,file));
for (const [source,target] of [['public/mark.svg','mark.svg'],['docs/images/streaming.png','streaming.png'],['docs/images/social.png','og.png']]) await copyFile(source,join(out,target));
await writeFile(join(out,'robots.txt'),`User-agent: *\nAllow: /\nDisallow: /demo.html\nDisallow: /api/\nDisallow: /dashboard/\nDisallow: /thanks/\nSitemap: ${origin}/sitemap.xml\n`);
await writeFile(join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>\n`);
await writeFile(join(out,'llms.txt'),`# Jarvis\n\n> Share your screen. Build as you draw. An experimental local workbench for building web prototypes with Astra or Fable.\n\n- [Prepared walkthrough](${origin}/): The current four-step guide: share a window, choose a model and effort, watch Fable drafts, then refine and export. The captured draft is explicitly labeled as a replay. No live generation or provider login on this website.\n- [Source and setup](https://github.com/ucsandman/jarvis): Windows executable bundles Node.js and the official Codex CLI; no terminal setup required. Choose Astra through Codex/ChatGPT or Fable 5.1 through Claude Code/Claude, with low through max effort. Setup downloads verified Claude Code directly from Anthropic when needed. Fable can consume paid usage credits. Model access and usage limits apply. Fable supports incremental HTML drafts; Astra currently returns completed messages. Draft scripts stay disabled until completion. MIT-licensed Jarvis source. No metered model API.\n\nScreen sharing is the primary input. Separately approved Live build sends changed screen snapshots after three quiet seconds, at least 30 seconds apart by default, with ten builds per start. Pause and Stop sharing remain available. Camera frames are shared explicitly in the local workbench. Other inputs include JPEG/PNG/WebP upload, camera, typed directions and local Windows dictation. Optional spoken replies use local voices. Desktop, mobile and expanded previews, source inspection, single-HTML export, retry preview and up to 12 browser-local versions are available. A built-in sample requires no login. New project clears local history after confirmation; resetting the local allowance does not renew provider limits. Jarvis does not control the desktop, deploy services or create real backends. The public walkthrough does not request camera, microphone, or subscription credentials.\n`);
const html = await readFile(join(out,'index.html'),'utf8');
if (!html.includes(origin) || html.includes('<iframe')) throw new Error('Missing canonical URL or unexpected embedded sample.');
console.log('PASS: built 10 allowlisted public files; no local server or account data included.');
