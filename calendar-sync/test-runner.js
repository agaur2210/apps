/**
 * Node.js test runner for calendar-sync unit tests.
 *
 * All tests in Tests.js are pure JS — no Google API calls — so they run
 * fine in Node with a minimal Logger polyfill.
 *
 * Usage:
 *   node calendar-sync/test-runner.js
 *
 * Exit code 0 = all tests passed, 1 = one or more failures.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

// ── Logger polyfill ───────────────────────────────────────────
const lines  = [];
const Logger = {
  log(msg) {
    const s = String(msg);
    lines.push(s);
    // Print failures and section/summary lines; suppress individual PASSes
    if (!s.startsWith('PASS')) console.log(s);
  },
};

// ── Minimal Utilities polyfill (only getUuid is needed by Settings.js) ──
const Utilities = {
  getUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },
};

// ── Build evaluation context ──────────────────────────────────
const context = vm.createContext({ Logger, Utilities, console, Date, JSON, Math, parseInt, isNaN, Set, Map, Object, Array, String, RegExp });

// Load source files in dependency order (Constants first, then pure helpers)
const srcDir = path.join(__dirname);
const loadOrder = ['Constants.js', 'Utils.js', 'Sync.js', 'Tests.js'];

for (const file of loadOrder) {
  const filePath = path.join(srcDir, file);
  const code     = fs.readFileSync(filePath, 'utf8');
  try {
    vm.runInContext(code, context, { filename: file });
  } catch (e) {
    console.error('Error loading ' + file + ': ' + e.message);
    process.exit(1);
  }
}

// ── Run tests ─────────────────────────────────────────────────
try {
  context.runTests();
} catch (e) {
  console.error('runTests() threw: ' + e.message);
  process.exit(1);
}

// ── Report ────────────────────────────────────────────────────
const failures = lines.filter(l => l.startsWith('FAIL'));
const passes   = lines.filter(l => l.startsWith('PASS'));

if (failures.length > 0) {
  console.error('\n' + failures.length + ' test(s) failed.');
  process.exit(1);
} else {
  console.log('\nAll ' + passes.length + ' tests passed.');
  process.exit(0);
}
