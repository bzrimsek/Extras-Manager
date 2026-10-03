App Development Rules — Last updated: 2026-10-03

ONE RULE BOOK FOR EVERY APP (BZ, 2026-10-03). This file lives in
`Apps I've Built\` and is the only copy anybody edits. Bottlefolio, MadGolf
and Extras Manager each read it from there; each app's push.py publishes a
copy into that app's repo, and that copy is never edited. What is true of
only one app (a guard's name, a helper's name, a path) belongs in that app's
CLAUDE.md, not here. Where a rule below names one app's code, it says which.

PHILOSOPHY
1  Good structure + comments. Quality over speed.
2  Reuse before inventing — read existing code first. Leverage working solutions in the same codebase before writing new ones.
2a WHEN I NAME AN EXISTING BEHAVIOR, OPEN THAT CODE AND CALL WHAT IT CALLS. "The same as the shopping search" means read renderShop, find the function, call it. Not something with the same shape, not the nearest similar thing elsewhere in the file. Building adjacent to a named behavior and calling it done is the most expensive failure available: it looks finished, it passes tests, and it is wrong in a way only I can see.
2b A PLACE, A ROUTE OR A SCOPE I NAME IS THE ACCEPTANCE TEST. 2a covers a named BEHAVIOR; this covers the other three ways I say what I want, and all three were ignored on 2026-09-09 while I was agreeing with you. "The bottom of the shelf page, under You Keep Buying" is a PLACE — it went into the Wanted view, behind a filter pill that hides itself when the list is empty, so the thing I asked to see on the shelf was in the one place it could not be seen. "See the whole shelf, click a book" are ROUTES — the fix was driven through the filter pills instead, so it held on the route you checked and failed on both routes I use, twice, over two days. "Is that camera fix for all instances" is a SCOPE — one of four callers had been fixed. So: before building, restate the place, the route or the scope in your own words, and say plainly if you think it is wrong — I do not mind debate on the idea, I mind being ignored, and a disagreement I can see costs one message while a substitution I cannot costs a round. After building, the check drives THAT: the named screen, the named route, every named caller, in the harness that fails the build. A feature verified by any route other than the one I named is unverified. And prove the check by breaking the thing on purpose and watching it go red — a guard that cannot fail is not a guard.
3  Occam's razor — simplest solution that works. If two approaches solve the problem, take the simpler one.
3a A fix that adds a moving part to something that already has several is usually the wrong fix. If each change makes the thing harder to describe, stop changing it and describe what it SHOULD be.
4  Security and performance by default. No shortcuts that create vulnerabilities or degrade UX.

SCOPE
5  Ask before assuming — never build unsolicited changes, never remove a feature, never change scope without being explicitly asked. Iterative dev is welcome; unasked changes are not.
5a Never fold an unrequested change into work I asked for, and never build one in the middle of a delivery gate.
6  Tidy up dead code after every change. Flag any dead code that can't be cleaned immediately. Never let it accumulate silently.
7  No regressions — if a feature worked before your change, confirm it still works after.
7a A shared helper has a blast radius. Before changing one, list every caller; after changing it, measure each one. A fix aimed at one caller silently changed four others and it was only luck that they survived.
8  Never add production code to fix a preview-only problem. Preview limitations are accepted constraints.

DOCUMENTATION
9z App use is updated with every build, alongside the changelog and the
   version bump. BZ: remember to update App Use with each build. A help
   page describing a screen that has been rebuilt is worse than one saying
   nothing, and consistency.js only checks the controls it has been told
   about — so a new named control goes in BOTH the App use entry and the
   CONTROLS list that guards it.

VERSIONING
9  bump.py is the only way to bump versions. It reads the system clock — never write timestamps manually, never ask the user for the time. Fix bump.py if it fails; don't work around it.
10 Version bump hits five locations automatically via bump.py: file header, APP_VERSION, BUILD_TIME, UI string, sw.js CACHE_NAME. Versions are three-part major.minor.patch (patch rolls to the next minor at 100). bump.py writes the changelog entry once, to the single canonical header block.
11 Changelog entry must be filled in before delivery — never leave [describe changes here]. Write it before bumping, not after. No blank entries anywhere in the file.

DIAGNOSIS BEFORE FIXING
12 Read the actual code before touching anything — no blind fixes. For any bug, identify the specific line causing it before writing a fix. When two apps diverge, read both side by side before touching either.
13 When a fix fails twice, stop. Write out: (a) what you read, (b) what you observe, (c) your diagnosis. Only then propose attempt three. No exceptions.
13a THE THIRD ATTEMPT MUST QUESTION THE DESIGN, NOT THE INSTANCE. Two failures in one area means the shape is wrong, not that the last patch missed. Ask what single structure would make all of these impossible.
13b AND ASK ME. After the second failure in the same area, say what you think is happening and ask what I am seeing. I am watching it fail on real data you cannot reach, and I have usually spotted the pattern before you have. Ten rounds of "found it, fixed it" is not persistence.
13c NEVER REASON ABOUT DATA YOU CANNOT SEE. My library, my deployed build, my log, my device. Every confident claim about any of those has been wrong. Instrument, ship, and read what comes back — a build that logs its decision per item settles in one round what inference does not settle in six.

13d A MEASUREMENT WITHOUT ITS POPULATION IS AN ANECDOTE. 13c says do not reason about data you cannot see. This is the other half: state which data you DID see, in the sentence, every time. Not "325 entries have a proof" but "325 entries on BZ's filled-in shelf, which is the end state of a shelf and not the one somebody imports tomorrow". Written that way the overreach is visible while you are writing it. Every time this was skipped the conclusion was wrong — an empty shelf said renders cost 8ms when they cost 112, a filled shelf said an enrichment feature had no users, and a stale catalog said three bottles were missing that were not.

13g STATE THE COST WITH THE MEASUREMENT. 13d is the population; this is the clock. A harness that already walks the whole library to grade something is one line from knowing what it cost, and that line was not written: L.brandOf scanned all 15,280 registry keys per name, stamping 714 entries took 13.8 SECONDS inside the housekeeping chain, and it shipped and sat for two builds until BZ asked for a scan. He was right to be bothered: "how can we build it better the first time?" Correctness got rigour all session because that is where he was pushing, and cost never entered the loop at all. So when a measurement loops over real data, it prints the elapsed time too - and cost.js makes it a red gate rather than something a person has to go looking for. Nine runs and a median, as 13e says.

13f ASK WHICH BUILD HE IS ON BEFORE DIAGNOSING ANYTHING HE REPORTS. Carried from HANDOFF.md, 2026-09-10, when it was retired: three times in one day I told BZ a bug was in his build rather than in the code, and twice I was right and once I had not checked. He installs on his own schedule and is often two or three versions behind the working copy. The version is on Home under the wordmark, and Settings prints it with the build time. It is one question and it settles which file to read.

13e ANYTHING THAT VARIES GETS NINE RUNS AND A MEDIAN. Three runs said boot was 358ms; nine said 254. Timings, and anything else with spread, are not facts until they are a median of nine. A number taken any other way does not go in a doc, a changelog or a sentence to me.
14 Layout bugs: after two failed CSS attempts, read the working equivalent element's CSS — the fix is almost always already there. Never guess a third time without reading the working equivalent first.
15 For any async-dependent feature: trace the execution order before writing. Ask "when is this value available relative to when it is used?" Answer it before writing code.
16 When a Python edit script hits an AssertionError on any step, the file is in a partial state. Stop, re-read the file, confirm what was and wasn't applied, then fix cleanly. Never assume subsequent steps ran.
16a An edit script that asserts on several patterns writes NOTHING if a later assert fails. After any failed edit, verify the change is actually in the file before reporting it. A change reported and not applied has cost a whole round more than once.

16aa A SCRIPT THAT BREAKS SOMETHING ON PURPOSE MUST PUT BACK THE LINE IT TOOK, NOT THE FIRST ONE THAT MATCHES. Proving a check can fail means swapping a line for a broken one and running the suite; restoring by replacing the first occurrence of the broken line puts it wherever that text happens to appear first. On 2026-09-24 `return false;` went back into `L.historyRows` eight hundred lines above the function it was taken from, and the rule under test kept the log filter's default. The suite caught it. Match on the surrounding lines, not the line alone, and re-run every check after restoring.

16b A BLANKET FIND-AND-REPLACE ACROSS THIS PROJECT WILL BREAK THE CHECKERS AND THE DATA. Carried from HANDOFF.md, 2026-09-10, when it was retired. A US-spelling pass Americanised consistency.js's OWN British word list, so the checker began hunting for `judgment` and flagged every correct word on screen; there is a check for that now. The same trap in the data: `colour` is a KEY inside the tasting note — 268 of the 325 catalogue entries shipped in `data.json` carry `tn.colour` — and renaming it orphans every one of them. A replacement runs per file, with the hits read before they are written.

LAYOUT & SCREEN PATTERNS
17 Before writing any new screen, modal, or layout element: read how the nearest equivalent working screen handles display/hide, flex, overflow, z-index, and height. Document what you find before writing.
18 Game tab show/hide: display:'flex' to show, display:'none' to hide — never display:''. Hide all siblings before showing target.
19 Z-index stack (low → high): content < modal-overlay 200 < nav 250 (always tappable) < confirmModal 300 < toast 400 < authScreen 500. Before any modal/overlay work, read all fixed-position z-index values and confirm the new element's layer against this stack.
19a A pseudo-element used for decoration paints OVER unpositioned content. Anything drawn with ::before or ::after needs a stacking context and a negative z-index, or it hides the thing it was meant to frame. A touch-target fix erased two icons this way and nothing caught it, because the button was still there and still tappable.
19b An id emitted by a function that draws more than once per page must be unique per call. Duplicate ids in one document are invalid and url(#id) resolves to whichever came first.

FIREBASE
20 Before any new Firebase operation, verify method, path, and writeKey payload align with existing security rules.
21 Never write to Firebase before the load completes. Each app names its guard in its CLAUDE.md: Bottlefolio's is `FB.loaded`, set true only when the first read has landed, and every push reads it — `if (!FB.user || !FB.loaded) return;`. MadGolf's is `_fbLoaded`.
21a Every uid-keyed node is writable only by its owner. When a feature needs one account to affect another, the owner records it and the other side applies it — never a cross-account write, however convenient.

STATE
22a Three lists must agree: the state defaults, what is written to this device, and what follows the account. A key in one and not the others silently does not survive a reload or does not follow the account. Anything declared mergeable must actually be synced.

22b THE GATE IS TEN STEPS AND A LINTER IS ONE OF THEM. (Nine when this was written; gscheck.js is the tenth, and gate.py's FAST and SLOW lists are the count.) Added 2026-09-10, after two ReferenceErrors reached real users in a build the eight-step gate had passed — `arr` orphaned by a removal, and a bare `user` that stopped a shelf loading for anybody who arrived by an invite link. Neither was visible to a text check, to node --check (both files parse), or to any harness that never executes that line. Run `node lint.js` — it is in ship.py. Its allowed list is EMPTY and nothing joins it silently. And the lesson underneath it: the FIRST version of that linter passed with both faults deliberately put back, because its own regex had declared every function-local variable a global. Break the thing on purpose before believing the guard.

DELIVERY
22 Run the pre-delivery audit script before every delivery. All checks must pass. No exceptions, no skipping.
23 Named output files always built from the working index.html — never from uploads or prior named files.
24 Compress chat before context bloat. Prepare handoff comments before they're needed.
25 Every delivery = index.html + sw.js + named lock file (e.g. friday-game-v13.34.html). All three. No exceptions.
25a MY WORK SHIPS THE MOMENT IT IS WRITTEN, not with the drop. Apps Script, Firebase rules, anything I paste into another tool — hand it over as its own file with its own walkthrough so I can do it while the gate runs. And say plainly when a piece of it depends on an app version I have not installed yet.
25b Write the walkthrough for somebody who has not opened that tool in a month. Real menu names, real button names, the actual block of code I will be looking at and what it should read afterward. "Add two lines to your existing doPost" is not an instruction.
25c Report the gate one check at a time, as each lands. Never run the loop silently and report at the end, and never say "running the gate" with no result attached. Read the whole output of each check, not the last line — a check once sat broken for several builds because the failure was thirty lines above a blank final line.

25f CALL THE APPS SCRIPT FILE Code.gs. It is delivered from the container as lookup.gs and it lives in my project as Code.gs, and two names for one file is how a paste lands in the wrong place. Say Code.gs when handing it over. label.gs and shelf.gs match on both sides and keep their names.

25e A PASTE IS NOT A DEPLOY, AND SAYING SO IS MY JOB EVERY TIME. Apps Script serves the DEPLOYED version, not the saved one, so a pasted file changes nothing until Deploy → Manage deployments → pencil on the existing deployment → New version. This has already cost a whole debugging round: BZ had pasted Code.gs, I confirmed the file contained the mash rule, and we both concluded the service was fine while the live web app ran months-old code. probeWiring cannot catch it either — it runs in the editor against saved code and will happily report every mode present while the deployment is stale. So whenever a delivery includes a .gs file, the handover says PASTE AND DEPLOY, names the menu path, and repeats it at the top of the next session until BZ confirms it. Do not assume a paste mentioned yesterday was deployed.

25d NEVER HAND ME A FILE THAT NEEDS EDITING AFTER I PASTE IT. Anything I have to hand-edit after a paste will eventually be edited wrong, and a dropped line usually fails SILENTLY — doPost lost a mode twice, and the app reports a missing mode as a broken feature rather than an absent one. Ship the whole file with every line already in it, and ship a probe I can run that says whether the wiring is right before I deploy. If a file genuinely cannot be shipped whole, say which line I must add and what the block must read afterward (25b), and give me the probe anyway.

LANGUAGE
25g SAY WHAT IS ABOUT TO HAPPEN BEFORE A SILENT STEP, NOT AFTER. BZ, 2026-10-02: "where is the push fixed - radio silence", after sixteen timestamped updates he never saw. Two separate faults, and both have a mechanical fix rather than a promise. FIRST: a slow command run in the FOREGROUND is a tool call nothing can be said during, so anything over about ten seconds goes in the BACKGROUND writing one line per step to a log, polled in twenty-second slices, with a timestamped line written after every poll — push.py, the gate, and the check suite all work this way now. SECOND: one long edit script is the same silence by another route, so a script carries ONE change, which 16a already demands for a different reason — ten changes batched into one script is a silence long enough to be noticed AND a half-applied mess when the ninth assert fails. Anything that will still be quiet for more than half a minute gets a line BEFORE it starts, naming what it is. His client folds text written in the same turn as a tool call into "Ran N commands", so these lines are read by expanding that; asked on 2026-10-02 whether to use notifications or shorter turns instead, he chose to keep them inline. Keep writing them.

26 Never use hedging language — "should", "likely", "probably", "might", "may". If unsure, say so directly or test it first. Be definitive. If it works, say it works. If it won't, say it won't.
26a NEVER SAY IT IS FIXED UNTIL IT IS VERIFIED, and say what was verified and against what. "Measured on your bottles: 200 to 190" is a claim. "This fixes it" is a hope with a full stop. A green gate is not evidence a feature does its job.

TESTING
26b A CLAIM IN A DOC THAT NOBODY CHECKED IS MARKED AS UNCHECKED. HANDOFF said a mash bill is printed on the back of most American whiskey. Six photographs disproved it in twenty minutes and the whole feature was built to the wrong brief until then. If a backlog entry rests on a fact nobody has verified, say so in the entry — an unmarked assumption becomes a requirement by the time somebody reads it back.

27 Every new scoring function, calculation, or game logic path gets test cases in the same session it is built — not after, not on request. If a function computes something, it has tests. No exceptions.
28 Pre-compute all expected values independently (in Node, not by trusting the app) before writing assertions. A test that derives its expected value from the same code it is testing is not a test.
28a A RULE WITH NO CHECK BEHIND IT IS A SUGGESTION. Rule 27 was broken three times in one day and nothing noticed until a review went looking. When a rule turns out to have been broken, add the check that would have caught it IN THE SAME SESSION, before moving on. And where the debt is older than today's work, make the check a RATCHET rather than a wall: allow the known offenders by name, fail anything new, and add a second check so the allowed list cannot rot. A check that stands between me and shipping gets switched off rather than satisfied.

29 Test harness is delivered alongside index.html and sw.js on any session that adds or modifies tests. Three files becomes four.
30 Render/screen functions do templating only — no scoring, calculation, or business logic inline. Logic a screen needs goes in a named helper it calls (Bottlefolio: `L.shelfIndex`, `L.buddyRows`, `L.bulkStatus`; MadGolf: `leagueSessionCtx`, `liveRoundRows`, `fsScorecardData`). The harness cannot call render functions, so logic buried in them ships untested. If you are computing inside a render template, stop and extract. (The three helpers this rule used to name are from another app and are in no file here; replaced with three of this app's on 2026-09-15.)

30f AND THE SCREENS ARE ON A SIZE RATCHET. Rule 30 was a suggestion until 2026-09-15, when the architecture review measured 19 top-level functions over 150 code lines, 16 of them screens, the largest a single 450-line card holding ten Firebase calls. `consistency.js` now measures every top-level function by code lines, allows today's 51 over-100 functions BY NAME at exactly today's size, and fails anything that grows, anything new over 100, a name that has left the file, and a listed function that shrank without its allowance following it down. `node consistency.js --sizes` prints the list ready to paste. A screen only gets smaller from here.
30a Cross-consistency — when one fact (a match status, a leaderboard row, a settlement) is rendered by more than one path (first paint, in-place updater, stored summary, live viewer), test that the paths agree from a shared game state, not each path's formatting in isolation. Two separately-green formatting tests can still disagree — that is exactly how the Nassau hole-completion popup drifted from the banner. Drive the real render through the recording-DOM harness and compare its output to the shared engine. (The three sections this rule used to point at are in another app's harness, which is in no file here; `render.js` is where this app makes screens and engine agree. Pointer dropped 2026-09-15.)
30b The suite tests behavior through the engine and cannot see the WIRING. An element id nobody declares, a literal escape in a string, a state key that does not persist, a helper defined and never called, two functions sharing a name — all invisible to it and all shipped. A text-level check of the source catches them in a second; keep adding to it whenever a bug turns out to have been visible in the file all along.
30c A check that asserts a label is testing the copy. Assert the behavior — that the control leads somewhere, that the number matches the engine — so a rewording does not break the gate and a real fault does.

30e THE GATE TESTS UNITS, FILES AND ONE PASS. IT DOES NOT TEST SEQUENCES OR SECOND RENDERS. BZ, after finding five bugs in a morning: we have a whole series of gates and tests, I periodically ask for code reviews, and yet. Right, and every one of those bugs was an interaction between two things that were each individually correct. The wishlist removal worked and the sync replaced it. The house merge was right and the publish undid it. The camera block drew perfectly the first time. The modal was correct and so was the nav. A unit test cannot see any of that, a text check reads one file, the walk takes ONE path through each screen, and a code review reads code rather than orderings. So: when a fix touches how two features meet, the test is a SEQUENCE — do it, sync it, reload it, do the other thing, look again — and any screen that appends anything gets rendered TWICE with the elements counted. And a check written for a bug must be run against that bug with the fix removed: my first two attempts at the second-render step passed with the stacking deliberately put back, once because it rendered the wrong branch and once because a headless browser has no camera so the branch never ran.

30d TWO FUNCTIONS MUST NOT ANSWER ONE QUESTION FROM DIFFERENT EVIDENCE. Before adding a helper, search for one that already answers what it answers. L.mashbill read a whisky's recipe off its NAME for months; L.mashShape was added to read the same recipe off its PERCENTAGES, and neither knew about the other. They agreed only while no bottle carried a mash bill, and would have begun disagreeing silently the day the fill landed — the taste profile and the bottle screen saying different things about the same whisky. 30a catches two paths RENDERING one fact; this is two paths DECIDING it. Nothing in the suite can see it, because both are correct in isolation. When it happens, one source wins and says so in a comment, and it answers in the vocabulary the existing callers already expect.

COMPLETION
31 No loose ends. Any item deferred during a task ("next bump", "follow-up", "queued") is tracked and closed before the feature that spawned it is called done. A feature with pending pieces is not finished. Never let deferred work carry silently across turns — surface it and finish it.
32 Sync the working copy from the delivered outputs at the start of every task, before editing. A stale APP_VERSION in the working file makes bump.py collide with an already-shipped version number.
33 A feature is not built until the thing it depends on exists. Shipping a call to a service mode nobody has implemented is half a feature, and making the error message honest is not the same as making it work.

## 35. THE GATE IS ANNOUNCED, TIMED, AND REPORTED STEP BY STEP

BZ, after a build that ran the slowest harness in silence: you did that build
with no process status? That needs to be part of the new process - predictable,
faster and more communicative.

The gate is ten harnesses and two of them take over a minute. Run as one
command it prints nothing anybody can look at until it finishes, and a wait
with no evidence in it is indistinguishable from a broken session. That
happened repeatedly on 2026-09-10, and my answers made it worse: I said the
walk takes 40 seconds when it takes 43, having run it dozens of times and
never once measured it.

So, every time:

1. **Say what is about to run and how long it takes**, from `gatetime.py`,
   which keeps the last thirty runs and expects the MEDIAN OF NINE (rule 13e).
   Under nine runs it says so - it never invents a number.
2. **Run it in groups that match the timing.** The eight fast steps belong in
   one call (the seven there were on 2026-09-10 took 24 seconds together;
   gscheck.js is the eighth). The walk (43s) and sync (77s) get a
   call each, because each is long enough that somebody would otherwise be
   sitting in silence wondering.
3. **Report the result the moment it lands**, with actual against expected.
4. **Never announce a step without running it in the same turn.** Writing
   "running the walk now" and not running it is worse than silence: it reads
   as progress and there is none.

Measured 2026-09-10: the whole gate is 143 seconds. sync 77, walk 43, and the
other seven 24 between them. The 4025-assertion suite is half a second - the
thing that sounds heavy is the cheapest thing in the gate, which is exactly
why guessing at these numbers was worthless.

## 36. REACH FOR THE CANON BEFORE INVENTING A VOCABULARY

BZ, 2026-09-27: "We should have reached for canon first."

This app built its own flavour vocabulary - 87 terms, 278 spellings, and a
middle layer of `orchard fruit` / `stone fruit` / `dried fruit` that no person
has ever tasted. It took four days and produced questions BZ could not answer
in his own words. The Pentlands wheel has existed since the 1970s, the SWRI
publishes it, and BZ had one hanging on his wall: ten groups, a middle ring,
and leaf words people actually say. Measured against it, the invented
vocabulary knew 48 of its 82 leaves.

An invented vocabulary is not merely extra work. It is wrong in ways that are
invisible from inside it: the middle ring became what the app SAID out loud,
so it asked him to choose between `orchard fruit` and `stone fruit`, and the
questions never mentioned peat.

So, for anything with an established public vocabulary or taxonomy - flavour,
regions, cask types, categories in law:

1. **Find the canonical one and read it before writing a table.** Name it in
   the comment, with its source, so the next person can check the app against
   it rather than against itself.
2. **Where the app must differ, say why in the comment.** A deliberate
   departure is fine; an accidental one is how a private language starts.
3. **A private middle layer may exist for the MATHS and must never be spoken.**
   Roll-ups are how a score stops punishing a precise note (L.tasteScore). They
   are not words, and no screen shows one.
4. **Measure coverage against the canon and keep the number.** "48 of 82" is
   the kind of fact that ends an argument; "it seems thorough" is not.
5. **Ask who publishes it, and for whom.** This rule was written on the
   Pentlands wheel and the wheel was replaced the same day, which is the
   cheapest possible demonstration of the point. Pentlands is a PRODUCTION
   wheel: the SWRI made it for people judging new-make spirit, so it has rings
   for Structure and Off-flavours and no group for peat, and the app had to
   invent `smoke` to say the most obvious thing a whisky can be. The Council of
   Whiskey Masters publishes vocabulary for people describing a poured dram,
   which is what this app does — so its words fit without departures. Prefer
   the canon written for your reader's task over the one written for a
   laboratory, and prefer a body that certifies practitioners.
6. **A canon may be more than one document.** The Council does not publish one
   wheel; it publishes one per style, because a bourbon and an Islay malt do
   not share a vocabulary. An app whose shelf holds both carries the union and
   records which wheel each group came from (`_lab/cwm.js`). Do not flatten two
   canons into one to make the code tidier — that is inventing again.
