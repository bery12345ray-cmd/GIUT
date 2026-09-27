// Real PostgreSQL migrations in an ephemeral PGlite database. No production data.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';

async function load(name) {
  const source = readFileSync(new URL('../lib/' + name + '.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}
const {postgresStatement} = await load('netlify-sql');
const {resolveSocialProfile} = await load('social-accounts');
const {readUserWorkspace} = await load('user-workspace');
const {readPublicCourse} = await load('public-course');
const pg = new PGlite();
after(() => pg.close());
for (const migration of ['001_giut-schema', '002_social-accounts','003_place-discoveries']) {
  await pg.exec(readFileSync(new URL(`../netlify/database/migrations/${migration}/migration.sql`, import.meta.url), 'utf8'));
}
class Statement {
  constructor(source, values = []) { this.source = source; this.values = values; }
  bind(...values) { return new Statement(this.source, values); }
  async all() {
    const result = await pg.query(postgresStatement(this.source), this.values);
    return {results: result.rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value !== null && [20,1700].includes(result.fields.find(f => f.name === key)?.dataTypeID) ? Number(value) : value])))};
  }
  async first() { return (await this.all()).results[0] || null; }
  run() { return this.all(); }
}
const db = {
  prepare: source => new Statement(source),
  batch: statements => pg.transaction(async tx => {for (const s of statements) await tx.query(postgresStatement(s.source), s.values);}),
};
let alice, bob, kakao;
test('verified provider subjects get separate stable UUIDs; email is not an account link', async () => {
  alice = await resolveSocialProfile(db, {provider: 'google', providerAccountId: 'subject-a', name: '앨리스', image: 'https://example.test/avatar.png'});
  bob = await resolveSocialProfile(db, {provider: 'google', providerAccountId: 'subject-b', name: '보브'});
  kakao = await resolveSocialProfile(db, {provider: 'kakao', providerAccountId: 'subject-a', name: '앨리스'});
  assert.notEqual(alice, bob); assert.notEqual(alice, kakao);
  assert.match(alice, /^[0-9a-f-]{36}$/);
  assert.equal(await resolveSocialProfile(db, {provider: 'google', providerAccountId: 'subject-a', name: '변경된 소셜 이름'}), alice);
  await assert.rejects(resolveSocialProfile(db, {provider: 'untrusted', providerAccountId: 'subject-a'}));
});
test('repeat login preserves edited nickname, bio and cat skin', async () => {
  await db.prepare('UPDATE profiles SET nickname=?,bio=?,avatar_skin=? WHERE id=?').bind('골목냥','산책 중','love',alice).run();
  await resolveSocialProfile(db, {provider: 'google', providerAccountId: 'subject-a', name: '덮어쓰면 안 됨'});
  const profile = await db.prepare('SELECT nickname,bio,avatar_skin FROM profiles WHERE id=?').bind(alice).first();
  assert.deepEqual(profile, {nickname:'골목냥',bio:'산책 중',avatar_skin:'love'});
});
test('PostgreSQL rejects duplicate identity mappings and invalid avatar skins', async () => {
  await assert.rejects(db.prepare('INSERT INTO social_accounts(provider,provider_account_id,user_id,created_at,last_login_at) VALUES(?,?,?,?,?)').bind('google','subject-a',bob,'now','now').run(), e => e.code === '23505');
  await assert.rejects(db.prepare('UPDATE profiles SET avatar_skin=? WHERE id=?').bind('javascript:alert(1)',alice).run(), e => e.code === '23514');
});
test('workspace scopes own places, courses, reactions, credits and profile to the verified user', async () => {
  const now = new Date().toISOString();
  for (const [id, uid] of [['alice-spot',alice],['bob-spot',bob]]) {
    await db.prepare('INSERT INTO spots(id,user_id,title,body,category,lat,lng,location,ar,route,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
      .bind(id,uid,id,'AR 메모','산책',37.5,127,'서울',1,'[]',now).run();
    await db.prepare('INSERT INTO courses(id,user_id,title,mode,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(id+'-course',uid,id+' 산책','walk',now,now).run();
    await db.prepare('INSERT INTO course_stops(course_id,spot_id,position) VALUES(?,?,?)').bind(id+'-course',id,0).run();
    await db.prepare('INSERT INTO credits(id,user_id,amount,reason,created_at) VALUES(?,?,?,?,?)').bind(id+'-credit',uid,uid===alice?10:40,'스팟 기록',now).run();
  }
  await db.prepare('INSERT INTO reactions(user_id,spot_id,kind,created_at) VALUES(?,?,?,?)').bind(alice,'bob-spot','save',now).run();
  await db.prepare('INSERT INTO reactions(user_id,spot_id,kind,created_at) VALUES(?,?,?,?)').bind(bob,'alice-spot','like',now).run();
  const a = await readUserWorkspace(db,alice), b = await readUserWorkspace(db,bob);
  assert.equal(a.user.id,alice); assert.equal(a.user.balance,10); assert.equal(b.user.balance,40);
  assert.equal(a.user.avatarSkin,'love'); assert.equal(a.user.receivedLikes,1);
  assert.deepEqual(a.mySpots.map(s=>s.id),['alice-spot']); assert.deepEqual(b.mySpots.map(s=>s.id),['bob-spot']);
  assert.deepEqual(a.myCourses.map(c=>c.id),['alice-spot-course']);
  assert.deepEqual(a.myCourses[0].spotIds,['alice-spot']);
  assert.deepEqual(a.interactions,{likedSpotIds:[],savedSpotIds:['bob-spot']});
  assert.deepEqual(b.interactions,{likedSpotIds:['alice-spot'],savedSpotIds:[]});
  assert.deepEqual(a.savedSpots.map(s=>s.id),['bob-spot']);
  assert.deepEqual(a.ledger.map(l=>l.id),['alice-spot-credit']);
  assert.equal(await readUserWorkspace(db,'unregistered-user'),null);
});
test('concurrent first-login conflict rolls back the losing profile', async () => {
  const users = await Promise.all(Array.from({length:3},()=>resolveSocialProfile(db,{provider:'kakao',providerAccountId:'race-test',name:'경쟁 테스트'})));
  assert.equal(new Set(users).size,1);
  assert.equal((await pg.query("SELECT COUNT(*)::int AS n FROM profiles WHERE nickname='경쟁 테스트'")).rows[0].n,1);
});

test('public course SQL works on PostgreSQL independently of the course list limit',async()=>{
 const now=new Date().toISOString();
 await db.prepare('INSERT INTO course_stops(course_id,spot_id,position) VALUES(?,?,?)').bind('alice-spot-course','bob-spot',1).run();
 for(let i=0;i<151;i++)await db.prepare('INSERT INTO courses(id,user_id,title,mode,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind('newer-'+i,bob,'코스 '+i,'walk',now,now).run();
 const data=await readPublicCourse(db,'alice-spot-course');
 assert.equal(data.course.userId,alice);assert.deepEqual(data.spots.map(s=>s.id),['alice-spot','bob-spot']);
 assert.ok(data.spots.every(s=>s.saved===0&&s.liked===0));assert.equal(data.spots[0].likes,1);
 assert.equal('ledger' in data,false);assert.equal('folders' in data,false);
 assert.equal(await readPublicCourse(db,'missing-course'),null);
});
