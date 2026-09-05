import { mkdir, readFile, readdir, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';

// A fixed allowlist keeps the local server, credentials and artifacts out of hosting.
const out = '.artifacts/site';
const origin = 'https://jarvis-workbench.vercel.app';
await mkdir(out, { recursive:true });
const allowed = new Set(['index.html','site.css','site.js','vercel.json','demo.html','mark.svg','reference.svg','workbench.png','revision.png','og.png','robots.txt','sitemap.xml','llms.txt','.vercel','.env.local','.gitignore']);
for (const name of await readdir(out)) if (!allowed.has(name)) throw new Error(`Unexpected deployment file: ${name}. Review it before building.`);
for (const file of ['index.html','site.css','site.js','vercel.json']) await copyFile(join('site',file),join(out,file));
for (const [source,target] of [['public/demo.html','demo.html'],['public/mark.svg','mark.svg'],['public/reference.svg','reference.svg'],['docs/images/workbench.png','workbench.png'],['docs/images/revision.png','revision.png'],['docs/images/onboarding.png','og.png']]) await copyFile(source,join(out,target));
await writeFile(join(out,'robots.txt'),`User-agent: *\nAllow: /\nDisallow: /demo.html\nDisallow: /api/\nDisallow: /dashboard/\nDisallow: /thanks/\nSitemap: ${origin}/sitemap.xml\n`);
await writeFile(join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>\n`);
await writeFile(join(out,'llms.txt'),`# Jarvis\n\n> An experimental local workbench for turning references and prompts into web prototypes.\n\n- [Prepared walkthrough](${origin}/): An honest reference, prompt, captured result, and captured revision example. No live generation or ChatGPT login on this website.\n- [Source and setup](https://github.com/ucsandman/jarvis): Windows executable bundles Node.js and the official Codex CLI; no terminal setup required. Real generation uses the official Codex CLI with the user's eligible ChatGPT subscription. Model access and usage limits apply. No metered model API.\n\nCamera frames are shared explicitly in the local workbench. The public walkthrough does not request camera, microphone, or subscription credentials.\n`);
const html = await readFile(join(out,'index.html'),'utf8');
if (!html.includes(origin) || !html.includes('sandbox="allow-scripts allow-forms"')) throw new Error('Missing canonical URL or sandbox.');
console.log('PASS: built 13 allowlisted public files; no local server or account data included.');
