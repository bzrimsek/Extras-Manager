# Extras Manager

Golf league manager PWA: players, evenings, games, RSVP, GHIN handicaps,
season standings, team generation. Multi-league (Wed / Thu / Other).
Live at https://bzrimsek.github.io/Extras-Manager/, repo
`bzrimsek/Extras-Manager`. No build step - what is in `index.html` is what
runs.

---

## The rules

**Read `..\DEV-RULES.md` first. All of it.** One rule book for every app
(BZ, 2026-10-03); it lives in `Apps I've Built\`, beside this folder.
`push.py` copies it into the repo as `DEV-RULES.md` so each build carries
the rules it was made under. **Never edit the copy here, and never write an
Extras-only rule set** - an Extras fact goes in this file; a rule goes in
the shared book.

---

## Building

On BZ's PC, with the Python install's own `python.exe`
(`%LOCALAPPDATA%\Python\pythoncore-3.14-64\python.exe`), not the
WindowsApps `python` alias, which cannot see the test browser:

```
python bump.py "what changed, in full sentences"
python push.py "short subject for the commit"
```

`bump.py` is the **only** way to set a version (rule 9). It writes five
places - the header comment, a CHANGELOG line, `APP_VERSION`,
`BUILD_TIMESTAMP`, `sw.js` `CACHE_NAME` - and cuts the lock copy
`extras-manager-vX.YY.html`. It never deletes an old lock copy.

**Versions are two-part, X.YY, stepping 0.01.** `checkForUpdate` compares
`parseFloat(APP_VERSION)` with `latestVersion` in Firebase config, so a
three-part version would compare wrong. That is why this app does not use
Bottlefolio's x.y.z.

`push.py` prints each step as it lands (rule 25c): the checks here; refuses
while an earlier gate run is going; copies the shared rule book; commits
every change as ONE commit to the `build` branch; then follows the gate.
The gate (`.github/workflows/gate.yml`) runs the checks again on GitHub and
only a green gate fast-forwards `main`, which Pages serves (Settings → Pages
→ Deploy from branch `main`, root). It ends by asking the live site for its
version until it answers this build's. A red gate leaves the site untouched.
`python push.py --dry-run` says what would go and writes nothing.

push.py refuses CSVs, keys, service-account files, lock copies and
`_superseded/`: the repo is public and Pages serves every file in it.
Commits are authored as `bzrimsek` with the GitHub noreply address (repo
git config), so BZ's email is not in the public history.

## The checks

```
node lint.js    # nothing undefined, duplicated or unreachable - both pages
node walk.js    # every tab, as player and as admin, in Chromium (~6s)
```

`npm install` once for the tools (eslint 8.57.1, Playwright 1.63.0, pinned
to Bottlefolio's).

- **lint.js** - eslint with only fault rules, over `index.html` and
  `rsvp.html`. A syntax error stops it too, so it is also the parse check.
- **walk.js** - serves this folder on 127.0.0.1 and **aborts every request
  to anywhere else**, so Firebase is unreachable and nothing can be written
  (fbWrite will not write without a writeKey, which only comes FROM
  Firebase). Presses every tab twice, marking it dirty before the second
  visit so it really redraws, and fails on any error or any element count
  that grew. Then drives `rsvp.html` end to end against a **stand-in
  Firebase**: the app's node answers with a made-up two-player league,
  every other Firebase path answers Permission denied (as the live rules
  answer `/state.json`), and a PUT is recorded, never sent. It picks a
  player, presses In, saves, and fails unless the save landed on the app's
  node with the answer in it, the writeKey kept and the roster unchanged.
- **Population (rule 13d): the walk runs on an EMPTY league** - no players,
  no evenings. It proves every screen draws without throwing; it does not
  yet prove a full roster draws right.

Both were broken on purpose before being trusted (2026-10-03): lint caught
a bare undefined name, a function-local const used outside its function,
and one in rsvp.html; the walk caught a planted append on History - and
only after the dirty-mark was added, because without it a second visit
redraws nothing. The rsvp step fails against v1.3 of rsvp.html, which
shows "Unavailable", and passes against the fix.

`walk.js` `KNOWN` lists faults already live, by name, so the gate can run
without being switched off (rule 28a). An entry that stops happening fails
the walk until it is removed. It is empty.

---

## Facts, checked against v9.40 on 2026-10-03, updated for v9.41

- **Firebase project is `bzs-golf-apps`** (since v9.10). The app reads and
  writes `/bz-apps/extras-manager.json` (since v9.30) - keys `leagues`,
  `config`, `activeLeague`, `settings`, `seasons`. The update check reads
  `/bz-apps/extras-manager/config.json`.
- **`rsvp.html` reads and writes the same node through its own `FB_URL`**,
  which must match `FB_URL` in index.html. Until v1.4 it used
  `${FB_BASE}/state.json`, which answers `Permission denied` on
  `bzs-golf-apps`, so from the June database move every RSVP link showed
  "Unavailable". The walk's rsvp step is what keeps the two in step.
- localStorage: state `gl_v4`, version `gl_version`, per-device prefs
  `gl_user_prefs` (`isAdmin()` reads `adminMode` there, not `S.config`).
- Writes wait for `S.config.writeKey`, which only ever arrives from
  Firebase; `rsvp.html` sends a read-modify-write PUT so the key rides in
  the payload (its own comment: partial PATCHes fail the rules).
- `rsvp.html` has its own `RSVP_VERSION` (X.Y), `RSVP_BUILD` and
  changelog. `bump.py` steps all three, with the same entry, only when
  rsvp.html differs from the last commit.
- **`ghin-worker.js` is a Cloudflare Worker**, deployed by hand in
  Cloudflare, not by the gate. `GHIN_USERNAME` / `GHIN_PASSWORD` are worker
  secrets and never in the file; the token in it is GHIN's public app token.
- **Team generation - do not change without BZ's approval.** `makeTeams` →
  `buildTierCohorts` + `buildDealRounds` + a scorer.
- `loadAppLog()` draws the Debug log and returns nothing - it is not a
  promise. Until v9.41 `go('debug')` chained `.then()` on it and threw, so
  the 10s auto-refresh never started.

`HANDOFF.md` (v5.0, 2026-05-23) is superseded by this file: it predates the
database move, says rsvp.html does zero reads (it reads and PUTs), and
names `fbPatch`, which no longer exists. Take nothing from it unchecked.

---

## Files

| | |
|---|---|
| `index.html` | the app |
| `rsvp.html` | the players' RSVP page, linked from the app |
| `sw.js` | service worker; `CACHE_NAME` moves with the version |
| `manifest.json`, `favicon.png`, `logo-*.png` | PWA shell |
| `ghin-worker.js` | the GHIN proxy, Cloudflare |
| `bump.py` `push.py` | version, then ship |
| `lint.js` `walk.js` | the checks |
| `.github/workflows/gate.yml` | the cloud gate |
| `extras-manager-v*.html` | lock copies, on BZ's PC only (gitignored) |
