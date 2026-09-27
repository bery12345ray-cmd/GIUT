/** Server-only database interface; also used by isolated PostgreSQL tests. */
export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{results: T[]}>;
  run(): Promise<unknown>;
}
export interface DataStore {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<unknown>;
}
