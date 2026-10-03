#!/usr/bin/env node
/* The walk: both pages in a real browser, every tab pressed, no errors.

   lint.js reads the code; this RUNS it. A render that throws on a tab is
   invisible to a linter and to node --check, and is the first thing a
   player would see.

   NEVER TOUCHES LIVE DATA. Every request that is not to this machine is
   aborted before it leaves, so Firebase, GHIN and the fonts are all
   unreachable. fbWrite refuses to write without a writeKey, and the
   writeKey only ever arrives FROM Firebase, so with Firebase unreachable
   nothing can be written even by a bug. The service worker is blocked so
   every run loads the files on disk, not a cached copy.

   Walks twice: as a player and as an admin (gl_user_prefs.adminMode), so
   the admin-only controls and the Debug tab are drawn too. Each tab is
   opened, left, and opened again with its element count compared - a
   screen that appends instead of replacing doubles on the second visit
   (rule 30e). */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = __dirname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
                '.png': 'image/png', '.css': 'text/css' };
const TABS = ['play', 'rsvp', 'roster', 'history', 'settings'];

/* Faults already in the live app when the walk went in, allowed BY NAME so
   the walk can gate everything else without being switched off (rule 28a).
   Each must still happen: a fault that stops happening fails the walk until
   it is taken off this list, so the list cannot rot.
   'who / tab: message' */
const KNOWN = [
  // v9.40: go('debug') calls loadAppLog().then(), and loadAppLog returns
  // nothing - the log draws but the 10s auto-refresh never starts.
  "admin / debug: pageerror: Cannot read properties of undefined (reading 'then')",
  "admin / debug (second visit): pageerror: Cannot read properties of undefined (reading 'then')"
];

function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok(server)));
}

async function main() {
  const t0 = Date.now();
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const failures = [];
  let blocked = 0;

  async function open(url, prefs) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 },
                                          serviceWorkers: 'block' });
    await ctx.route('**/*', route => {
      if (route.request().url().startsWith(base)) return route.continue();
      blocked++;
      return route.abort();
    });
    if (prefs) {
      await ctx.addInitScript(p => {
        localStorage.setItem('gl_user_prefs', JSON.stringify(p));
      }, prefs);
    }
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => {
      // A blocked request logs "Failed to load resource" - that is the
      // block working, not the app failing.
      if (m.type() === 'error' && !/Failed to load resource|net::ERR_/.test(m.text())) {
        errors.push('console.error: ' + m.text());
      }
    });
    await page.goto(base + url);
    await page.waitForLoadState('load');
    await page.waitForTimeout(300);
    return { ctx, page, errors };
  }

  async function walkApp(who, prefs) {
    const { ctx, page, errors } = await open('index.html', prefs);
    const tabs = prefs && prefs.adminMode ? TABS.concat('debug') : TABS;
    const firstCount = {};
    for (const pass of [1, 2]) {
      for (const tab of tabs) {
        const before = errors.length;
        // A tab only redraws when marked dirty, so a bare second visit
        // redraws nothing and cannot see an append. Mark it the way a save
        // does, so the second visit is a real second render.
        if (pass === 2) await page.evaluate(t => markDirty(t), tab);
        await page.click('.nbtn[data-s="' + tab + '"]');
        await page.waitForTimeout(150);
        const state = await page.evaluate(t => {
          const s = document.getElementById('screen-' + t);
          return { active: !!s && s.classList.contains('active'),
                   els: s ? s.querySelectorAll('*').length : 0,
                   text: s ? s.innerText.trim().length : 0 };
        }, tab);
        const label = who + ' / ' + tab + (pass === 2 ? ' (second visit)' : '');
        if (!state.active) failures.push(label + ': screen did not open');
        if (pass === 1 && !state.text) failures.push(label + ': screen drew nothing');
        if (pass === 1) firstCount[tab] = state.els;
        // Debug re-reads a live log on a timer, so its count may move.
        if (pass === 2 && tab !== 'debug' && state.els !== firstCount[tab]) {
          failures.push(label + ': ' + firstCount[tab] + ' elements first time, '
                        + state.els + ' second - something appended instead of replacing');
        }
        const fresh = errors.slice(before).map(e => label + ': ' + e);
        fresh.forEach(f => failures.push(f));
        const unknown = fresh.filter(f => KNOWN.indexOf(f) < 0);
        if (pass === 1) console.log('  ' + (!state.active || unknown.length ? '✗'
                                            : fresh.length ? '~' : '✓')
                                    + ' ' + label + '  (' + state.els + ' elements)');
      }
    }
    await ctx.close();
  }

  await walkApp('player', null);
  await walkApp('admin', { adminMode: true });

  const r = await open('rsvp.html?l=wed&d=2026-10-07&v=walk');
  const rText = await r.page.evaluate(() => document.body.innerText.trim().length);
  if (!rText) failures.push('rsvp.html: page drew nothing');
  r.errors.forEach(e => failures.push('rsvp.html: ' + e));
  console.log('  ' + (r.errors.length || !rText ? '✗' : '✓') + ' rsvp.html');
  await r.ctx.close();

  await browser.close();
  server.close();
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  KNOWN.forEach(k => {
    const i = failures.indexOf(k);
    if (i >= 0) {
      failures.splice(i, 1);
      console.log('  ~ known, allowed by name: ' + k);
    } else {
      failures.push('KNOWN entry no longer happens - take it off the list: ' + k);
    }
  });
  if (failures.length) {
    failures.forEach(f => console.log('  ✗ ' + f));
    console.log('  ✖ walk: ' + failures.length + ' problem(s), ' + secs + 's');
    process.exit(1);
  }
  console.log('  ✓ walk: every tab, player and admin, plus rsvp.html - no errors ('
              + blocked + ' outside requests blocked, ' + secs + 's)');
}

main().catch(e => { console.log('  ✖ walk crashed: ' + e.message); process.exit(1); });
