import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const js = ts.transpileModule(readFileSync(new URL('../lib/request-origin.ts', import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.ESNext}}).outputText;
const {isSameOriginRequest} = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const publicOrigin = 'https://giut.netlify.app';
const request = (origin, extra = {}) => new Request('http://internal:3000/api/spotmap', {headers: {...(origin === undefined ? {} : {origin}), ...extra}});

test('canonical site origin is accepted behind the Next.js adapter', () => {
  assert.equal(isSameOriginRequest(request(publicOrigin), publicOrigin), true);
});
test('untrusted and lookalike origins stay blocked', () => {
  for (const origin of ['https://example.com', publicOrigin + '.example.com', 'http://giut.netlify.app', 'null']) {
    assert.equal(isSameOriginRequest(request(origin), publicOrigin), false);
  }
});
test('forwarded headers cannot authorize an external origin', () => {
  assert.equal(isSameOriginRequest(request('https://example.com', {'x-forwarded-host': 'example.com', 'x-forwarded-proto': 'https'}), publicOrigin), false);
});
test('preview origins do not authorize the production origin', () => {
  const preview = 'https://deploy-preview-1--giut.netlify.app';
  assert.equal(isSameOriginRequest(request(preview), preview), true);
  assert.equal(isSameOriginRequest(request(publicOrigin), preview), false);
});
test('local development falls back to the actual request origin', () => {
  assert.equal(isSameOriginRequest(request('http://internal:3000')), true);
  assert.equal(isSameOriginRequest(request(publicOrigin)), false);
});
test('non-browser clients are still checked by authentication, not CORS', () => {
  assert.equal(isSameOriginRequest(request(undefined), publicOrigin), true);
});
