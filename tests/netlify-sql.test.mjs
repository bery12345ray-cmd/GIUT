import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const js = ts.transpileModule(readFileSync(new URL('../lib/netlify-sql.ts', import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.ESNext}}).outputText;
const {postgresStatement} = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
test('bind values stay parameterized and quoted question marks stay literal', () => {
  assert.equal(postgresStatement("SELECT '?' AS literal, ? AS value WHERE name='It''s ?' AND id=?"), "SELECT '?' AS literal, $1 AS value WHERE name='It''s ?' AND id=$2");
});
test('conflict handling keeps existing rows and camel case response aliases', () => {
  assert.equal(postgresStatement('INSERT OR IGNORE INTO profiles(id) VALUES(?);'), 'INSERT INTO profiles(id) VALUES($1) ON CONFLICT DO NOTHING');
  assert.equal(postgresStatement('SELECT id AS userId, created_at AS createdAt, count(*) AS n'), 'SELECT id AS "userId", created_at AS "createdAt", count(*) AS n');
});
