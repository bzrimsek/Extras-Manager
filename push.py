#!/usr/bin/env python3
"""
Send a finished Extras Manager build to GitHub, gated.

    python push.py "short subject"   check here, commit, send to `build`,
                                     follow the cloud gate until it is live
    python push.py --dry-run         say what would go; send and write nothing
    python push.py --no-wait "..."   send, and do not follow the gate

Steps, each printed as it lands (rule 25c):
  1. the checks, here - lint.js and walk.js. Red stops everything.
  2. nothing else gating - refuses while an earlier gate run on `build` is
     queued or running, because this build would be made on a main that run
     is about to move.
  3. the shared rule book - "Apps I've Built\\DEV-RULES.md" is copied in as
     DEV-RULES.md so the repo carries the rules it was built under. One rule
     book for every app (BZ, 2026-10-03); this copy is never edited here.
  4. send - every changed file as ONE commit, pushed to `build`. Refuses a
     file that must never be public, and refuses if main has moved on GitHub
     since this folder last saw it.
  5. the cloud gate (.github/workflows/gate.yml) runs the checks again and
     only a green gate moves `main`, which is what the site serves.

Run it with the Python install's own python.exe, not the WindowsApps alias:
the alias cannot see the test browser the walk needs.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = 'bzrimsek/Extras-Manager'
BRANCH = 'build'
LIVE = 'https://bzrimsek.github.io/Extras-Manager/'
RULES_SRC = os.path.join(os.path.dirname(HERE), 'DEV-RULES.md')
RULES_DST = os.path.join(HERE, 'DEV-RULES.md')
WATCH_LIMIT = 15 * 60
TRANSIENT = re.compile(r'HTTP 5\d\d|timed out|timeout|connection|EOF|reset', re.I)

# Never public. The repo is public and Pages serves every file in it.
FORBIDDEN = re.compile(r'(\.csv|\.key|\.pem|\.env|\.p12)$|service.?account|firebase-admin'
                       r'|^extras-manager-v.*\.html$|^_superseded/', re.I)

GH = None


def say(msg):
    print(msg, flush=True)


def gh_path():
    found = shutil.which('gh')
    if found:
        return found
    default = r'C:\Program Files\GitHub CLI\gh.exe'
    if os.path.exists(default):
        return default
    sys.exit('The gh command is not installed. See CLAUDE.md, "Building".')


def gh(path, method='GET', retry=False, quiet404=False):
    """One GitHub API call through gh's own sign-in. With retry, GitHub's own
    5xx or a dropped connection is asked again, four tries over about a
    minute, so one 502 mid-watch does not abandon a running gate. With
    quiet404, a 404 answers None instead of stopping."""
    cmd = [GH, 'api', '-X', method, path]
    waits = [5, 15, 40] if retry else []
    tries = 0
    while True:
        tries += 1
        r = subprocess.run(cmd, capture_output=True)
        if not r.returncode:
            break
        err = (r.stderr or r.stdout).decode(errors='replace').strip()
        if quiet404 and 'HTTP 404' in err:
            return None
        if retry and TRANSIENT.search(err) and waits:
            wait = waits.pop(0)
            say('  (GitHub did not answer: %s - asking again in %ds)'
                % ((err.splitlines() or ['?'])[0][:120], wait))
            time.sleep(wait)
            continue
        sys.exit('GitHub refused %s %s after %d tries: %s\n'
                 'This script has stopped; nothing on GitHub has. Follow the '
                 'run at https://github.com/%s/actions' % (method, path, tries, err[:300], REPO))
    out = r.stdout.decode()
    return json.loads(out) if out.strip() else {}


def git(*args, check=True):
    r = subprocess.run(['git'] + list(args), cwd=HERE, capture_output=True,
                       text=True, encoding='utf-8', errors='replace')
    if check and r.returncode:
        sys.exit('git %s failed: %s' % (' '.join(args), (r.stderr or r.stdout).strip()))
    return r.stdout.strip()


def version():
    with open(os.path.join(HERE, 'index.html'), encoding='utf-8') as fh:
        m = re.search(r"const APP_VERSION\s*=\s*'([\d.]+)'", fh.read())
    if not m:
        sys.exit('No APP_VERSION in index.html')
    return m.group(1)


def run_check(script):
    """Run one check and judge by what it SAYS as well as its exit code:
    a check can print its failures and still exit 0."""
    t0 = time.time()
    r = subprocess.run(['node', script], cwd=HERE, capture_output=True,
                       text=True, encoding='utf-8', errors='replace')
    out = (r.stdout + r.stderr).rstrip()
    ok = r.returncode == 0 and '\u2716' not in out and '\u2717' not in out
    say(out)
    say('   %s  %s  (%.1fs)' % ('passed' if ok else 'FAILED', script, time.time() - t0))
    return ok


def gate_busy():
    """The gate run on `build` that has not finished, or None. Queued,
    waiting and in progress all mean main may yet move."""
    # 404 until the first push puts gate.yml on GitHub: no gate, no runs.
    runs = gh('repos/%s/actions/workflows/gate.yml/runs?branch=%s&per_page=20'
              % (REPO, BRANCH), retry=True, quiet404=True) or {}
    for run in runs.get('workflow_runs', []):
        if run.get('status') != 'completed':
            return run
    return None


def copy_rules(dry):
    if not os.path.exists(RULES_SRC):
        sys.exit('The shared rule book is missing: %s' % RULES_SRC)
    with open(RULES_SRC, 'rb') as fh:
        src = fh.read()
    cur = open(RULES_DST, 'rb').read() if os.path.exists(RULES_DST) else None
    if cur == src:
        say('   DEV-RULES.md already matches the shared rule book')
    elif dry:
        say('   DEV-RULES.md WOULD be refreshed from the shared rule book (dry run, left alone)')
    else:
        with open(RULES_DST, 'wb') as fh:
            fh.write(src)
        say('   DEV-RULES.md refreshed from the shared rule book')


def send(v, subject, dry):
    """Commit every change as one commit and push it to `build`. Returns the
    commit sha, or None when there is nothing to send or this is a dry run."""
    git('fetch', '--quiet', 'origin')
    main = git('rev-parse', 'origin/main')
    if subprocess.run(['git', 'merge-base', '--is-ancestor', main, 'HEAD'],
                      cwd=HERE).returncode:
        sys.exit('REFUSED. main on GitHub (%s) has a change this folder does not. '
                 'Somebody changed it by hand; sending now would undo that. '
                 'Run `git pull` here, read what came in, then push again. '
                 'Nothing pushed.' % main[:7])

    changed = [l[3:].strip('"') for l in git('status', '--porcelain', '-uall').splitlines()]
    bad = [f for f in changed if FORBIDDEN.search(f.replace('\\', '/'))]
    if bad:
        sys.exit('REFUSED. These must never go to the public repo:\n  '
                 + '\n  '.join(bad) + '\nNothing pushed.')

    ahead = git('rev-list', '--count', main + '..HEAD')
    if not changed and ahead == '0':
        say('   Nothing differs from what main already has. Nothing to push.')
        return None
    say('   going, as one commit:' if changed else '   no new changes; sending the %s commit(s) not yet live' % ahead)
    for f in changed:
        say('     ' + f)
    if dry:
        say('   dry run: nothing committed, nothing pushed')
        return None
    if not subject:
        sys.exit('A short subject is required: python push.py "what this build does"')
    if changed:
        git('add', '-A')
        git('commit', '--quiet', '-m', 'v%s %s' % (v, subject))
    sha = git('rev-parse', 'HEAD')
    # `build` is a staging branch made from main every time; forcing it is
    # what makes each push one build rather than a pile.
    git('push', '--quiet', '--force', 'origin', 'HEAD:refs/heads/' + BRANCH)
    say('   sent %s to %s' % (sha[:7], BRANCH))
    return sha


def watch(sha, v):
    """Follow the cloud gate for this commit, a line per finished step, for
    WATCH_LIMIT at most. Stopping here stops nothing on GitHub."""
    deadline = time.time() + WATCH_LIMIT
    say('\nWaiting for GitHub to start the gate...')
    run = None
    for _ in range(40):
        runs = gh('repos/%s/actions/runs?head_sha=%s&per_page=5' % (REPO, sha), retry=True)
        if runs.get('workflow_runs'):
            run = runs['workflow_runs'][0]
            break
        time.sleep(3)
    if not run:
        sys.exit('GitHub did not start a gate run for %s within two minutes. '
                 'Check https://github.com/%s/actions' % (sha[:7], REPO))
    say('Gate started: %s' % run['html_url'])
    t0 = time.time()
    shown = set()
    while True:
        if time.time() > deadline:
            say('\nStopped watching after %d minutes with the gate still %s. '
                'The run carries on and only a green one moves main: %s'
                % (WATCH_LIMIT // 60, run.get('status', 'running').replace('_', ' '), run['html_url']))
            return 1
        jobs = gh('repos/%s/actions/runs/%d/jobs' % (REPO, run['id']), retry=True)
        for job in jobs.get('jobs', []):
            for step in job.get('steps', []):
                key = (job['id'], step['number'])
                if step['status'] == 'completed' and key not in shown:
                    shown.add(key)
                    mark = {'success': 'ok  ', 'skipped': 'skip'}.get(step['conclusion'], 'FAIL')
                    say('  %s  %4.0fs  %s' % (mark, time.time() - t0, step['name']))
        run = gh('repos/%s/actions/runs/%d' % (REPO, run['id']), retry=True)
        if run['status'] == 'completed':
            break
        time.sleep(8)
    if run['conclusion'] == 'success':
        say('\nLIVE: v%s at %s  (%.0fs from push to live)' % (v, LIVE, time.time() - t0))
        return 0
    say('\nThe gate did NOT pass (%s). The live site is unchanged.' % run['conclusion'])
    r = subprocess.run([GH, 'run', 'view', str(run['id']), '--repo', REPO, '--log-failed'],
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
    say('\n'.join([l for l in r.stdout.splitlines() if l.strip()][-40:]))
    say('\nFull log: %s' % run['html_url'])
    return 1


def main():
    global GH
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    dry = '--dry-run' in sys.argv
    subject = ' '.join(a for a in sys.argv[1:] if not a.startswith('--')).strip()
    GH = gh_path()
    v = version()
    say('Extras Manager v%s\n' % v)

    say('1. the checks, here')
    for script in ('lint.js', 'walk.js'):
        if not run_check(script):
            sys.exit('A check failed. Nothing pushed.')

    say('2. nothing else gating')
    busy = gate_busy()
    if busy:
        why = ('A gate run on %s is still %s: %s. Wait for it to finish, then push again.'
               % (BRANCH, busy['status'].replace('_', ' '), busy['html_url']))
        if not dry:
            sys.exit('REFUSED. ' + why + ' Nothing pushed.')
        say('   a real push would be REFUSED now. ' + why)
    else:
        say('   no gate run on %s is queued or running' % BRANCH)

    say('3. the shared rule book')
    copy_rules(dry)

    say('4. send')
    sha = send(v, subject, dry)
    if not sha:
        return 0
    if '--no-wait' in sys.argv:
        say('Not waiting. Follow it at https://github.com/%s/actions' % REPO)
        return 0

    say('5. the cloud gate, then live')
    return watch(sha, v)


if __name__ == '__main__':
    sys.exit(main())
