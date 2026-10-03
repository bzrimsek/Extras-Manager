#!/usr/bin/env node
/* Nothing undefined, duplicated or unreachable, in both pages.

   node --check cannot do this: a file with a bare undefined name parses
   perfectly and only throws when that line runs. It takes a linter that
   builds scopes. Adapted from Bottlefolio's lint.js, where two such
   ReferenceErrors reached real users through an eight-step gate.

   Each page's inline scripts are cut out and linted with the page's own
   top-level names declared, because they share one scope at runtime and
   eslint cannot know that from a fragment. TOP LEVEL ONLY - no leading
   whitespace - or every function-local const becomes a "global" and the
   check passes with the faults it exists to catch.

   Rules that catch a fault rather than a style. Not formatting. */
const fs = require('fs');
const path = require('path');
const { Linter } = require('eslint');

const PAGES = ['index.html', 'rsvp.html'];

const BROWSER = [
  'window', 'document', 'navigator', 'location', 'history', 'localStorage',
  'sessionStorage', 'console', 'setTimeout', 'clearTimeout', 'setInterval',
  'clearInterval', 'requestAnimationFrame', 'fetch', 'Blob', 'FileReader',
  'URL', 'URLSearchParams', 'Image', 'Event', 'CustomEvent', 'performance',
  'matchMedia', 'getComputedStyle', 'alert', 'confirm', 'prompt', 'btoa',
  'atob', 'crypto', 'AbortController', 'FormData', 'TextDecoder',
  'TextEncoder', 'caches', 'EventSource', 'globalThis'
];

const RULES = {
  'no-undef': 'error',
  'no-dupe-keys': 'error',
  'no-dupe-args': 'error',
  'no-dupe-class-members': 'error',
  'no-unreachable': 'error',
  'no-fallthrough': 'error',
  'no-self-assign': 'error',
  'no-const-assign': 'error',
  'no-func-assign': 'error',
  'no-obj-calls': 'error',
  'no-sparse-arrays': 'error',
  'use-isnan': 'error',
  'valid-typeof': 'error'
};

/* Anything in the files on the day this went in stays allowed BY NAME, and
   nothing new may join (rule 28a). Format: 'page:rule:message'. */
const ALLOWED = [];

const linter = new Linter();
let problems = [];
let blockCount = 0;

PAGES.forEach(page => {
  const html = fs.readFileSync(path.join(__dirname, page), 'utf8');
  const blocks = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    blocks.push({ code: m[1], line: html.slice(0, m.index).split('\n').length });
  }
  if (!blocks.length) {
    problems.push({ page, line: 0, rule: 'none', text: 'no inline script found' });
    return;
  }
  blockCount += blocks.length;

  const globals = {};
  const all = blocks.map(b => b.code).join('\n');
  for (const r of [/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm,
                   /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
                   /^(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*(?:=[^,;]*)?,\s*([A-Za-z_$][\w$]*)/gm,
                   /^class\s+([A-Za-z_$][\w$]*)/gm]) {
    let x;
    while ((x = r.exec(all))) globals[x[1]] = 'writable';
  }
  BROWSER.forEach(n => { globals[n] = 'readonly'; });

  const config = {
    parserOptions: { ecmaVersion: 2022, sourceType: 'script' },
    env: { browser: true, es2022: true },
    globals,
    rules: RULES
  };
  blocks.forEach(b => {
    linter.verify(b.code, config, { filename: page }).forEach(x => {
      problems.push({
        page,
        line: b.line + (x.line || 1) - 1,
        rule: x.ruleId || 'parse',
        text: x.message
      });
    });
  });
});

problems = problems.filter(p =>
  ALLOWED.indexOf(p.page + ':' + p.rule + ':' + p.text) < 0);

if (!problems.length) {
  console.log('  ✓ lint: nothing undefined, duplicated or unreachable in '
    + blockCount + ' script blocks across ' + PAGES.join(' + '));
  process.exit(0);
}
problems.slice(0, 40).forEach(p => {
  console.log('  ✗ ' + p.page + ':' + p.line + '  ' + p.text + '  [' + p.rule + ']');
});
if (problems.length > 40) console.log('  … and ' + (problems.length - 40) + ' more');
console.log('  ✖ lint: ' + problems.length + ' problem(s)');
process.exit(1);
