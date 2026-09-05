import { mkdir, readFile, readdir, writeFile, copyFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

// A fixed allowlist keeps the local server, credentials and artifacts out of hosting.
const out = '.artifacts/site';
const origin = 'https://jarvis-workbench.vercel.app';
await mkdir(out, { recursive:true });
// Remove the obsolete generated sample; the local app keeps its own example.
await unlink(join(out,'demo.html')).catch(error=>{if(error.code!=='ENOENT') throw error;});
const allowed = new Set(['index.html','site.css','site.js','vercel.json','mark.svg','reference.svg','workbench.png','revision.png','og.png','robots.txt','sitemap.xml','llms.txt','.vercel','.env.local','.gitignore']);
for (const name of await readdir(out)) if (!allowed.has(name)) throw new Error(`Unexpected deployment file: ${name}. Review it before building.`);
for (const file of ['index.html','site.css','site.js','vercel.json']) await copyFile(join('site',file),join(out,file));
for (const [source,target] of [['public/mark.svg','mark.svg'],['public/reference.svg','reference.svg'],['docs/images/workbench.png','workbench.png'],['docs/images/revision.png','revision.png'],['docs/images/onboarding.png','og.png']]) await copyFile(source,join(out,target));
await writeFile(join(out,'robots.txt'),`User-agent: *\nAllow: /\nDisallow: /demo.html\nDisallow: /api/\nDisallow: /dashboard/\nDisallow: /thanks/\nSitemap: ${origin}/sitemap.xml\n`);
await writeFile(join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>\n`);
await writeFile(join(out,'llms.txt'),`# Jarvis\n\n> An experimental local workbench for turning references and prompts into web prototypes.\n\n- [Prepared walkthrough](${origin}/): An honest reference, prompt, captured result, and captured revision example. No live generation or provider login on this website.\n- [Source and setup](https://github.com/ucsandman/jarvis): Windows executable bundles Node.js and the official Codex CLI; no terminal setup required. Choose Astra through Codex/ChatGPT or Fable 5.1 through Claude Code/Claude, with low through max effort. Setup downloads verified Claude Code directly from Anthropic when needed. Fable can consume paid usage credits. Model access and usage limits apply. No metered model API.\n\nScreen sharing is the primary input. Separately approved Live build sends changed screen snapshots after three quiet seconds, at least 30 seconds apart by default, with ten builds per start. Pause and Stop sharing remain available. Camera frames are shared explicitly in the local workbench. The public walkthrough does not request camera, microphone, or subscription credentials.\n`);
const html = await readFile(join(out,'index.html'),'utf8');
if (!html.includes(origin) || html.includes('<iframe')) throw new Error('Missing canonical URL or unexpected embedded sample.');
console.log('PASS: built 12 allowlisted public files; no local server or account data included.');
