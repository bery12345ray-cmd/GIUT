// Adapt the existing parameterized SQLite statements to PostgreSQL, without
// interpolating values. Only application-owned SQL goes through this adapter.
export function postgresStatement(source: string) {
  const ignore = /^\s*INSERT OR IGNORE\b/i.test(source);
  let index = 0;
  let sql = source.replace(/^\s*INSERT OR IGNORE\b/i, 'INSERT');
  sql = sql.replace(/('(?:''|[^'])*')|\?/g, (match, quoted) => quoted || `$${++index}`);
  sql = sql.replace(/\bAS\s+([a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*)\b/g, 'AS "$1"');
  sql = sql.trim().replace(/;$/, '');
  if (ignore) sql += ' ON CONFLICT DO NOTHING';
  return sql;
}
