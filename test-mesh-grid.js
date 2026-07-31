/* === Unit tests for public/mesh-grid.js === */
'use strict';
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

// Simple browser-like mock context
function makeGridSandbox() {
  const ctx = {
    window: {},
    document: {
      documentElement: {
        setAttribute: () => {},
        getAttribute: () => 'dark',
        style: {
          setProperty: () => {},
          removeProperty: () => {}
        }
      },
      head: {
        appendChild: () => {}
      },
      createElement: (tag) => {
        return {
          id: '',
          textContent: '',
          style: { setProperty: () => {} },
          addEventListener: () => {},
          appendChild: () => {}
        };
      },
      getElementById: (id) => {
        if (id === 'gridModeSelect') {
          return { value: 'region', addEventListener: () => {} };
        }
        if (id === 'gridResolve1b') {
          return { checked: true, addEventListener: () => {} };
        }
        if (id === 'gridSearchInput') {
          return { value: '', addEventListener: () => {} };
        }
        return { addEventListener: () => {}, querySelectorAll: () => [] };
      },
      querySelectorAll: () => [],
      addEventListener: () => {}
    },
    localStorage: {
      store: {},
      getItem(k) { return this.store[k] || null; },
      setItem(k, v) { this.store[k] = String(v); },
      removeItem(k) { delete this.store[k]; }
    },
    location: {
      origin: 'http://localhost',
      hash: '#/mesh-grid'
    },
    navigator: {
      language: 'pl'
    },
    matchMedia: () => ({ matches: true }),
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    console: console,
    L10N: null,
    currentPage: 'mesh-grid',
    CLIENT_TTL: { nodeDetail: 1000 },
    ROLE_COLORS: { repeater: '#D55E00', companion: '#56B4E9' },
    RegionFilter: { regionQueryString: () => '', getRegionParam: () => '' },
    AreaFilter: { areaQueryString: () => '', getAreaParam: () => '' },
    registerPage: (name, obj) => {
      ctx.window[name] = obj;
    }
  };
  vm.createContext(ctx);
  return ctx;
}

function loadInCtx(ctx, file) {
  const code = fs.readFileSync(file, 'utf8');
  vm.runInContext(code, ctx, { filename: file });
}

console.log('=== mesh-grid.js: Localisation & translation tests ===');
{
  const ctx = makeGridSandbox();
  loadInCtx(ctx, 'public/mesh-grid.js');

  test('Mesh Grid is registered in pages', () => {
    assert.ok(ctx.window['mesh-grid']);
    assert.strictEqual(typeof ctx.window['mesh-grid'].init, 'function');
    assert.strictEqual(typeof ctx.window['mesh-grid'].destroy, 'function');
  });
}

console.log(`\n════════════════════════════════════════`);
console.log(`  Mesh Grid tests: ${passed} passed, ${failed} failed`);
console.log(`════════════════════════════════════════\n`);
if (failed > 0) process.exit(1);
