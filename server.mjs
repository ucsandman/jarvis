import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { AppError, Vision } from './lib/vision.mjs';
import { runProcess } from './lib/subscription.mjs';

export const PREVIEW_CSP = "sandbox allow-scripts allow-forms; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";
const APP_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
const assets = new Map([
  ['/', ['index.html','text/html']], ['/style.css',['style.css','text/css']],
  ['/app.js',['app.js','text/javascript']], ['/storage.js',['storage.js','text/javascript']],
  ['/mark.svg',['mark.svg','image/svg+xml']], ['/reference.svg',['reference.svg','image/svg+xml']]
]);

async function readJson(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new AppError('Send JSON.',415);
  if (Number(req.headers['content-length']) > 5_000_000) throw new AppError('This request is too large.',413);
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 5_000_000) throw new AppError('This request is too large.',413);
    chunks.push(chunk);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString());
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error();
    return data;
  } catch { throw new AppError('The request is not valid JSON.'); }
}

export function createApp({ vision = new Vision(), maxCalls = 60 } = {}) {
  const token = randomBytes(32).toString('hex');
  const previews = new Map();
  let busy = false; let calls = 0; let dictating = false;
  const server = http.createServer(async (req,res) => {
    const port = server.address().port;
    const hosts = [`127.0.0.1:${port}`,`localhost:${port}`];
    const host = req.headers.host;
    const origin = req.headers.origin;
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy',APP_CSP);
    res.setHeader('Permissions-Policy','camera=(self), microphone=(self), geolocation=()');
    const send = (status,value) => {
      if (res.destroyed) return;
      res.writeHead(status, {'Content-Type':'application/json; charset=utf-8'});
      res.end(JSON.stringify(value));
    };
    try {
      if (!hosts.includes(host) || (origin && !hosts.some(h => origin === `http://${h}`))
        || req.headers['sec-fetch-site'] === 'cross-site') throw new AppError('Only the local Jarvis page can use this service.',403);
      const url = new URL(req.url,`http://${host}`);
      if (req.method === 'GET' && url.pathname === '/api/session') {
        const status = await vision.status(AbortSignal.timeout(15000));
        return send(200,{ token, ...status, remaining: maxCalls-calls });
      }
      if (req.method === 'GET' && url.pathname.startsWith('/preview/')) {
        const html = previews.get(url.pathname.slice('/preview/'.length));
        if (!html) throw new AppError('This preview expired. Select its version again.',404);
        res.setHeader('Content-Security-Policy',PREVIEW_CSP);
        res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), display-capture=()');
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
        return res.end(html);
      }
      if (req.method === 'GET' && assets.has(url.pathname)) {
        const [name,type] = assets.get(url.pathname);
        const data = await readFile(new URL(`./public/${name}`,import.meta.url));
        res.writeHead(200,{'Content-Type':`${type}; charset=utf-8`}); return res.end(data);
      }
      if (req.method !== 'POST' || !['/api/observe','/api/build','/api/preview','/api/dictate'].includes(url.pathname)) throw new AppError('Not found.',404);
      if (req.headers['x-jarvis-session'] !== token) throw new AppError('Reload Jarvis to reconnect your local session.',403);
      const data = await readJson(req);
      if (url.pathname === '/api/dictate') {
        if (data.consent !== true) throw new AppError('Allow local microphone use before dictating.',403);
        if (process.platform !== 'win32') throw new AppError('Local Windows dictation is unavailable on this platform. Type your direction.',503);
        if (dictating) throw new AppError('Another dictation session is active.',409);
        dictating = true;
        const controller = new AbortController();
        const abort = () => controller.abort(); res.once('close',abort);
        try {
          const result = await runProcess('powershell.exe',['-NoProfile','-File',fileURLToPath(new URL('./scripts/dictate.ps1',import.meta.url))],{ signal:AbortSignal.any([controller.signal,AbortSignal.timeout(30000)]) });
          if (result.code !== 0) throw new AppError('Windows local dictation could not start. Check your default microphone and installed English speech recognition.',503);
          return send(200,JSON.parse(result.stdout));
        } finally { dictating=false; res.removeListener('close',abort); }
      }
      if (url.pathname === '/api/preview') {
        if (typeof data.html !== 'string' || data.html.length > 120000 || !data.html.trim()) throw new AppError('Invalid preview.');
        const id = randomBytes(20).toString('hex');
        previews.set(id,data.html);
        while (previews.size > 24) previews.delete(previews.keys().next().value);
        return send(200,{ url: `/preview/${id}` });
      }
      if (data.consent !== true) throw new AppError('Allow sharing through your OpenAI subscription before building.',403);
      if (busy) throw new AppError('Another request is still finishing. Try again in a moment.',409);
      if (calls >= maxCalls) throw new AppError('The session request limit is reached. Restart Jarvis to begin another session.',429);
      busy = true;
      const controller = new AbortController();
      const abort = () => controller.abort();
      res.once('close',abort);
      const signal = AbortSignal.any([controller.signal,AbortSignal.timeout(url.pathname === '/api/build' ? 300000 : 120000)]);
      try {
        calls++;
        const value = url.pathname === '/api/observe' ? await vision.observe(data,signal) : await vision.build(data,signal);
        if (!signal.aborted) send(200,{ ...value,remaining:maxCalls-calls });
      } finally { busy = false; res.removeListener('close',abort); }
    } catch (error) {
      const interrupted = ['AbortError','TimeoutError'].includes(error.name);
      send(error.status || (interrupted ? 504 : 500),{ error:error instanceof AppError ? error.message : interrupted ? 'The request timed out or was canceled. Your current version is safe.' : 'Jarvis could not complete that request. Try again.' });
    }
  });
  server.requestTimeout = 320000;
  server.headersTimeout = 10000;
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const app = createApp();
  app.listen(4317,'127.0.0.1',() => console.log('Jarvis is ready at http://127.0.0.1:4317'));
  app.on('error',error => { console.error(error.code === 'EADDRINUSE' ? 'Port 4317 is in use. Jarvis may already be running.' : 'Could not start Jarvis.'); process.exitCode = 1; });
}
