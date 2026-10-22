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
const KNOWN = [];

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

  /* rsvp.html end to end, against a STAND-IN Firebase: the app's node
     answers with a made-up two-player league, every other Firebase path
     answers Permission denied as the live rules do for /state.json, and a
     PUT is recorded here, never sent. A player picks a name, presses In,
     saves - and the save must land on the app's node with the answer in
     it and the writeKey kept, or the rules would refuse it. */
  async function walkRsvp(off) {
    const APP_NODE = '/bz-apps/extras-manager.json';
    const league = {
      config: Object.assign({ writeKey: 'walk-stand-in-key' }, off || {}),
      leagues: { wed: { players: [
        { id: 'pA', name: 'Walk Alpha', hcp: 10.2, ghin: '' },
        { id: 'pB', name: 'Walk Beta', hcp: 4.1, ghin: '' }
      ], rsvp: { date: '2099-01-07', players: {}, sendTo: {} } } }
    };
    const puts = [];
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 },
                                          serviceWorkers: 'block' });
    await ctx.route('**/*', route => {
      const req = route.request();
      const url = req.url();
      if (url.startsWith(base)) return route.continue();
      if (/firebaseio\.com/.test(url)) {
        const p = new URL(url).pathname;
        if (p !== APP_NODE) {
          return route.fulfill({ status: 401, contentType: 'application/json',
                                 body: '{"error":"Permission denied"}' });
        }
        if (req.method() === 'PUT') {
          puts.push(JSON.parse(req.postData() || 'null'));
          return route.fulfill({ status: 200, contentType: 'application/json',
                                 body: req.postData() });
        }
        return route.fulfill({ status: 200, contentType: 'application/json',
                               body: JSON.stringify(league) });
      }
      blocked++;
      return route.abort();
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    // A date far ahead so the 6pm expiry never closes the link mid-test.
    await page.goto(base + 'rsvp.html?l=wed&d=2099-01-07&v=walk');
    const fail = msg => failures.push('rsvp.html: ' + msg);
    if (off) {
      // Switched off in Settings: the page says so, offers no form, saves nothing.
      const said = await page.evaluate(() => new Promise(ok => setTimeout(() => ok({
        text: document.body.innerText, form: !!document.getElementById('player-select') }), 1500)));
      if (!/RSVP is turned off/i.test(said.text) || said.form) {
        fail('with ' + JSON.stringify(off) + ' the form was still offered');
      }
      if (puts.length) fail('with ' + JSON.stringify(off) + ' something was saved');
      errors.forEach(e => fail(e));
      const okOff = !failures.some(f => f.startsWith('rsvp.html'));
      console.log('  ' + (okOff ? '✓' : '✗') + ' rsvp.html with ' + JSON.stringify(off) + ': says RSVP is off, no form');
      await ctx.close();
      return;
    }
    try {
      // 'attached': an <option> in a closed dropdown never counts as visible.
      await page.waitForSelector('#player-select option[value="pA"]',
                                 { state: 'attached', timeout: 5000 });
      await page.selectOption('#player-select', 'pA');
      await page.click('#btn-in');
      await page.click('#btn-save');
      await page.waitForSelector('.success-msg', { timeout: 5000 });
      const saved = puts[puts.length - 1];
      if (puts.length !== 1) fail(puts.length + ' saves sent, expected 1');
      else if (!saved || !saved.leagues || !saved.leagues.wed) fail('save carried no wed league');
      else {
        if (saved.leagues.wed.rsvp.players.pA !== 'in') fail('save did not record Walk Alpha as in');
        if (!saved.config || saved.config.writeKey !== 'walk-stand-in-key') fail('save dropped the writeKey - the rules would refuse it');
        if ((saved.leagues.wed.players || []).length !== 2) fail('save changed the roster');
      }
    } catch (e) {
      const said = await page.evaluate(() => {
        const s = document.getElementById('status-msg');
        return (s && s.textContent.trim()) || document.body.innerText.slice(0, 160);
      }).catch(() => '');
      fail('form did not load and save against the app\'s node (' + e.message.split('\n')[0]
           + ') - page says: ' + said.replace(/\s+/g, ' '));
    }
    errors.forEach(e => fail(e));
    const ok = !failures.some(f => f.startsWith('rsvp.html'));
    console.log('  ' + (ok ? '✓' : '✗') + ' rsvp.html: loads the league, saves an In to the app\'s node with the writeKey');
    await ctx.close();
  }

  /* 2-man follows the count as players are tapped, a SEQUENCE (rule 30e).
     BZ's night: 23 on the roster, all in, one tapped out to 22. A tap
     updates the screen in place, and the 2-Man button kept the odd count
     it was drawn with - stuck off at 22. The other way, 2-Man picked at 22
     and one more tapped out let Generate put a player on two teams at 21. */
  async function walkTwoMan() {
    const { ctx, page, errors } = await open('index.html', null);
    const fail = msg => failures.push('2-man: ' + msg);
    const look = () => page.evaluate(() => {
      const g = L().activeEvening.games[activeGameIdx];
      const b = document.getElementById('ts-2');
      return { n: g.playerIds.length, picked: g.pendingSize,
               off: !b || b.disabled || b.style.pointerEvents === 'none' };
    });
    try {
      await page.evaluate(() => {
        L().players = Array.from({ length: 23 }, (_, i) =>
          ({ id: 'w' + i, name: 'Walk' + i + ', Test', hcp: 1 + i * 1.5, status: 'regular' }));
        confirmStartEvening();
        selectAllPlayers(false);
      });
      let s = await look();
      if (s.n !== 23 || !s.off) fail('23 in should draw 2-Man off; got ' + s.n + (s.off ? ' off' : ' on'));
      await page.click('#prow-w22');
      s = await look();
      if (s.n !== 22 || s.off) fail('one tapped out to 22 should turn 2-Man on; it stayed off');
      // force: a stuck button has pointer-events off, and a plain click
      // would wait 30s for it instead of reporting it.
      await page.click('#ts-2', { force: true });
      s = await look();
      if (s.picked !== 2) fail('2-Man could not be picked at 22');
      await page.click('#prow-w21');
      s = await look();
      if (!s.off || s.picked === 2) fail('at 21, 2-Man should be off and unpicked');
      await page.evaluate(() => generateGame());
      const made = await page.evaluate(() => {
        const g = L().activeEvening.games[activeGameIdx];
        const ids = (g.teams || []).flatMap(t => (t.players || t).filter(Boolean).map(x => x.id));
        return { places: ids.length, distinct: new Set(ids).size };
      });
      if (made.places !== made.distinct) fail('Generate at 21 put a player on two teams');
    } catch (e) {
      fail('could not drive setup: ' + e.message.split('\n')[0]);
    }
    errors.forEach(e => fail(e));
    const ok = !failures.some(f => f.startsWith('2-man'));
    console.log('  ' + (ok ? '✓' : '✗') + ' 2-man follows the count: 23 -> 22 turns it on, 22 -> 21 turns it off');
    await ctx.close();
  }

  /* The Settings switches, driven through the real switch buttons. BZ's
     setup: Thursday and Other off, Wednesday only - so no night picker
     anywhere and My League offers Wednesday alone. The last night on, and a
     night with an evening in progress, cannot go off. RSVP off hides its tab. */
  async function walkSwitches() {
    const { ctx, page, errors } = await open('index.html', null);
    const fail = msg => failures.push('switches: ' + msg);
    const flip = async key => {
      await page.click('.nbtn[data-s="settings"]');
      await page.click('[data-action^="switch-"][data-key="' + key + '"]');
    };
    const look = () => page.evaluate(() => {
      const row = document.getElementById('league-pill-row');
      const shown = ['wed', 'thu', 'other'].filter(k => {
        const b = document.getElementById('league-btn-' + k);
        return b && b.style.display !== 'none';
      });
      const sel = document.getElementById('pref-select-league');
      const tab = document.querySelector('.nbtn[data-s="rsvp"]');
      return { rowShown: !!row && row.style.display !== 'none', pills: shown.join(','),
               myLeague: sel ? [...sel.options].filter(o => !o.disabled).map(o => o.value).join(',') : '',
               league: S.activeLeague, rsvpTab: !!tab && tab.style.display !== 'none',
               on: nightsOn().join(',') };
    });
    try {
      let s = await look();
      if (s.on !== 'wed,thu,other' || !s.rowShown || !s.rsvpTab) fail('a fresh app should have every night and RSVP on');
      await flip('thu');
      await flip('other');
      s = await look();
      if (s.on !== 'wed') fail('Thu and Other off should leave wed; got ' + s.on);
      if (s.rowShown) fail('one night on should hide the night pills');
      if (s.myLeague !== 'wed') fail('My League should offer only wed; got ' + s.myLeague);
      if (s.league !== 'wed') fail('the app should be on wed; got ' + s.league);
      await flip('wed');
      s = await look();
      if (s.on !== 'wed') fail('the last night on was switched off');
      await page.evaluate(() => { go('play'); openEveningModal(); });
      const picker = await page.evaluate(() => document.getElementById('m-evening-season').textContent);
      if (/LEAGUE/.test(picker)) fail('Start Evening still offers a league with one night on');
      await page.evaluate(() => closeM('m-evening'));
      await flip('thu');
      s = await look();
      if (!s.rowShown || s.pills !== 'wed,thu') fail('Thu back on should show wed,thu pills; got ' + s.pills);
      // An evening in progress on Wednesday: Wednesday cannot go off.
      await page.evaluate(() => { S.activeLeague = 'wed'; confirmStartEvening(); });
      await flip('wed');
      s = await look();
      if (s.on.indexOf('wed') < 0) fail('a night with an evening in progress was switched off');
      // RSVP off, while standing on the RSVP tab.
      await page.click('.nbtn[data-s="rsvp"]');
      await flip('rsvp');
      s = await look();
      if (s.rsvpTab) fail('RSVP off should hide the RSVP tab');
      await flip('rsvp');
      s = await look();
      if (!s.rsvpTab) fail('RSVP back on should show the RSVP tab');
    } catch (e) {
      fail('could not drive Settings: ' + e.message.split('\n')[0]);
    }
    errors.forEach(e => fail(e));
    const ok = !failures.some(f => f.startsWith('switches'));
    console.log('  ' + (ok ? '✓' : '✗') + ' switches: one night hides every picker, last night and a running evening stay on, RSVP hides its tab');
    await ctx.close();
  }

  await walkSwitches();
  await walkTwoMan();
  await walkApp('player', null);
  await walkApp('admin', { adminMode: true });

  await walkRsvp();
  await walkRsvp({ rsvpOff: true });
  await walkRsvp({ nightsOff: { wed: true } });

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
