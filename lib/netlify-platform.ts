import {getDatabase} from '@netlify/database';
import {getStore, getDeployStore} from '@netlify/blobs';
import {postgresStatement} from './netlify-sql';

// Reuse connections within a warm function, but do not connect during builds.
let pool: ReturnType<typeof getDatabase>['pool'] | undefined;
function databasePool() { return pool ??= getDatabase().pool; }

type Row = Record<string, unknown>;
type Result = {rows: Row[]; fields?: {name: string; dataTypeID: number}[]};
function normalize(result: Result) {
  return result.rows.map(row => {
    const output = {...row};
    for (const field of result.fields || []) {
      const value = output[field.name];
      if (value !== null && typeof value === 'string' && [20, 1700].includes(field.dataTypeID)) {
        const number = Number(value);
        if (Number.isFinite(number) && Math.abs(number) <= Number.MAX_SAFE_INTEGER) output[field.name] = number;
      }
    }
    return output;
  });
}
class Statement {
  constructor(readonly source: string, readonly values: unknown[] = []) {}
  bind(...values: unknown[]) { return new Statement(this.source, values); }
  async all<T = Row>(): Promise<{results: T[]}> {
    const result = await databasePool().query(postgresStatement(this.source), this.values);
    return {results: normalize(result) as T[]};
  }
  async first<T = Row>(): Promise<T | null> { return (await this.all<T>()).results[0] ?? null; }
  async run() { return this.all(); }
}
export const database = {
  prepare(source: string) { return new Statement(source); },
  async batch(statements: Statement[]) {
    const client = await databasePool().connect();
    try {
      await client.query('BEGIN');
      const result = [];
      for (const statement of statements) {
        result.push(await client.query(postgresStatement(statement.source), statement.values));
      }
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  },
};

function photoStore() {
  // Preview uploads must never affect the production store.
  return process.env.GIUT_DEPLOY_CONTEXT === 'production'
    ? getStore({name: 'giut-photos', consistency: 'strong'})
    : getDeployStore({name: 'giut-photos', consistency: 'strong'});
}
export const bucket = {
  async put(key: string, data: ArrayBuffer, options: {httpMetadata: {contentType: string}}) {
    await photoStore().set(key, data, {metadata: {contentType: options.httpMetadata.contentType}});
  },
  async get(key: string) {
    const result = await photoStore().getWithMetadata(key, {type: 'stream'});
    if (!result) return null;
    return {body: result.data as ReadableStream<Uint8Array>, httpMetadata: {contentType: String(result.metadata.contentType || 'image/jpeg')}};
  },
  async delete(key: string) { await photoStore().delete(key); },
};
