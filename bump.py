#!/usr/bin/env python3
"""
Version bumper for Extras Manager.

The ONLY way versions change (rule 9). Reads the system clock -- never accepts
a timestamp argument, never asks anyone what time it is.

Writes five locations from one run:
  1. index.html header comment   <!-- Extras Manager — vX.YY | Build <stamp> -->
  2. index.html CHANGELOG block   // vX.YY  YYYY-MM-DD  entry   (newest first)
  3. index.html const APP_VERSION
  4. index.html const BUILD_TIMESTAMP
  5. sw.js      CACHE_NAME

Versions are TWO-part, X.YY, stepping by 0.01 (9.99 rolls to 10.00).
checkForUpdate compares versions with parseFloat, so a three-part 9.41.1
would read as 9.41 and a 9.5 would read as newer than 9.41 - the scheme is
what keeps that comparison true.

Then cuts the lock copy extras-manager-vX.YY.html from the file just written
(rule 23). Older lock copies are BZ's and are never deleted here.

Usage:
    python bump.py "what changed, in full sentences"
"""
import re
import shutil
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).parent
INDEX = HERE / 'index.html'
SW = HERE / 'sw.js'


def eastern_now():
    """Eastern Time without a tz-database dependency: EDT (UTC-4) from the
    second Sunday in March to the first Sunday in November, else EST."""
    utc = datetime.now(timezone.utc)

    def nth_sunday(year, month, n):
        d = datetime(year, month, 1, tzinfo=timezone.utc)
        d += timedelta(days=(6 - d.weekday()) % 7)      # first Sunday
        return d + timedelta(weeks=n - 1)

    y = utc.year
    dst_start = nth_sunday(y, 3, 2).replace(hour=7)     # 2am EST = 07:00 UTC
    dst_end = nth_sunday(y, 11, 1).replace(hour=6)      # 2am EDT = 06:00 UTC
    offset = -4 if dst_start <= utc < dst_end else -5
    return utc + timedelta(hours=offset)


def read_version(text):
    m = re.search(r"const APP_VERSION\s*=\s*'(\d+)\.(\d\d)'", text)
    if not m:
        sys.exit("APP_VERSION 'X.YY' not found in index.html - cannot bump.")
    return int(m.group(1)), int(m.group(2))


def sub_once(pattern, repl, text, what):
    """Replace exactly one match or stop before anything is written (16a)."""
    out, n = re.subn(pattern, repl, text, count=1)
    if n != 1:
        sys.exit('%s not found - nothing written.' % what)
    return out


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    entry = ' '.join(' '.join(sys.argv[1:]).split())
    if not entry:
        sys.exit('Refusing to bump: a changelog entry is required (rule 11).\n'
                 'Usage: python bump.py "what changed"')
    if '[describe changes here]' in entry:
        sys.exit('Refusing to bump: changelog placeholder not filled in.')

    # UTF-8 and LF, said outright: on Windows the defaults are the ANSI
    # codepage and CRLF.
    html = INDEX.read_text(encoding='utf-8')
    sw = SW.read_text(encoding='utf-8')

    major, minor = read_version(html)
    minor += 1
    if minor >= 100:
        major, minor = major + 1, 0
    ver = '%d.%02d' % (major, minor)
    now = eastern_now()
    stamp = now.strftime('%Y-%m-%d %I:%M %p ET')
    day = now.strftime('%Y-%m-%d')

    html = sub_once(r'(<!-- Extras Manager — v)[\d.]+( \| Build ).*?( -->)',
                    lambda m: m.group(1) + ver + m.group(2) + stamp + m.group(3),
                    html, 'Header "<!-- Extras Manager — vX | Build" line')
    html = sub_once(r'(\nCHANGELOG\n)',
                    lambda m: m.group(1) + '// v%s  %s  %s\n' % (ver, day, entry),
                    html, 'CHANGELOG block')
    html = sub_once(r"(const APP_VERSION\s*=\s*')[\d.]+(')",
                    lambda m: m.group(1) + ver + m.group(2), html, 'APP_VERSION')
    html = sub_once(r"(const BUILD_TIMESTAMP\s*=\s*')[^']*(')",
                    lambda m: m.group(1) + stamp + m.group(2), html, 'BUILD_TIMESTAMP')
    sw = sub_once(r"(const CACHE_NAME\s*=\s*'extras-manager-v)[\d.]+(')",
                  lambda m: m.group(1) + ver + m.group(2), sw, 'sw.js CACHE_NAME')

    INDEX.write_text(html, encoding='utf-8', newline='\n')
    SW.write_text(sw, encoding='utf-8', newline='\n')
    lock = HERE / ('extras-manager-v%s.html' % ver)
    shutil.copy(INDEX, lock)

    print('bumped to v%s  Build %s' % (ver, stamp))
    print('changelog: // v%s  %s  %s' % (ver, day, entry))
    print('lock:      %s' % lock.name)
    print('now run:   python push.py "short subject"')


if __name__ == '__main__':
    main()
