// Real SQL in a disposable PostgreSQL database, with synthetic location samples.
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {PGlite} from '@electric-sql/pglite';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({root,configFile:false,appType:'custom',resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false}});
const {postgresStatement}=await vite.ssrLoadModule('/lib/netlify-sql.ts');
const {recordDiscovery,readDiscoveryActivity,markDiscoveryRead}=await vite.ssrLoadModule('/lib/discoveries.ts');
const {createRecordSchema,recordTitle}=await vite.ssrLoadModule('/lib/record-input.ts');
const pg=new PGlite();
after(async()=>{await pg.close();await vite.close();});
for(const name of ['001_giut-schema','002_social-accounts','003_place-discoveries'])await pg.exec(readFileSync(new URL(`../netlify/database/migrations/${name}/migration.sql`,import.meta.url),'utf8'));
class Statement{
 constructor(source,values=[]){this.source=source;this.values=values;}
 bind(...values){return new Statement(this.source,values);}
 async all(){return {results:(await pg.query(postgresStatement(this.source),this.values)).rows};}
 async first(){return (await this.all()).results[0]||null;}
 run(){return this.all();}
}
const db={prepare:s=>new Statement(s),batch:async s=>pg.transaction(async tx=>{for(const q of s)await tx.query(postgresStatement(q.source),q.values);})};
const now=Date.now(),point={lat:37.54,lng:127.04},fix={...point,accuracy:8,timestamp:now};
for(const id of ['owner','visitor','other'])await db.prepare('INSERT INTO profiles(id,nickname,created_at) VALUES(?,?,?)').bind(id,id,new Date(now).toISOString()).run();
for(const [id,owner,example] of [['place','owner',0],['other-place','other',0],['demo','owner',1]])await db.prepare('INSERT INTO spots(id,user_id,title,body,category,lat,lng,location,example,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,owner,id,'한 줄','산책',point.lat,point.lng,'한 장소',example,new Date(now).toISOString()).run();

test('discovery requires fresh accurate location, rejects own records and examples',async()=>{
 for(const evidence of [{...fix,accuracy:51},{...fix,timestamp:now-31000},{...fix,timestamp:now+2000},{...fix,lat:NaN},{...fix,lat:38}])await assert.rejects(recordDiscovery(db,'visitor','place',evidence,now),e=>e.status===400);
 await assert.rejects(recordDiscovery(db,'owner','place',fix,now),e=>e.status===400);
 await assert.rejects(recordDiscovery(db,'visitor','demo',fix,now),e=>e.status===400);
 await assert.rejects(recordDiscovery(db,'visitor','missing',fix,now),e=>e.status===404);
 const edge={...fix,lat:point.lat+95/6371000*180/Math.PI,accuracy:8};
 await assert.rejects(recordDiscovery(db,'visitor','place',edge,now),e=>e.status===400);
 assert.equal((await pg.query('SELECT COUNT(*)::int n FROM discoveries')).rows[0].n,0);
});
test('a valid discovery creates one durable notice; retries and concurrency do not duplicate it',async()=>{
 const results=await Promise.all(Array.from({length:3},()=>recordDiscovery(db,'visitor','place',fix,now)));
 assert.equal(results.filter(r=>r.created).length,1);
 const activity=await readDiscoveryActivity(db,'owner');
 assert.equal(activity.unread,1);assert.equal(activity.notices.length,1);assert.equal(activity.notices[0].spotId,'place');
 assert.deepEqual((await readDiscoveryActivity(db,'other')).notices,[]);
 assert.deepEqual((await readDiscoveryActivity(db,'visitor')).notices,[]);
 const stored=(await pg.query('SELECT * FROM discoveries')).rows[0];
 assert.deepEqual(Object.keys(stored).sort(),['id','user_id','spot_id','created_at','read_at'].sort());
 assert.equal('userId' in activity.notices[0],false);assert.equal('lat' in activity.notices[0],false);
});
test('only the record owner can mark its notice read; duplicate discovery never makes it unread again',async()=>{
 const notice=(await readDiscoveryActivity(db,'owner')).notices[0];
 await markDiscoveryRead(db,'other',[notice.id]);assert.equal((await readDiscoveryActivity(db,'owner')).unread,1);
 await markDiscoveryRead(db,'owner',[notice.id]);assert.equal((await readDiscoveryActivity(db,'owner')).unread,0);
 assert.equal((await recordDiscovery(db,'visitor','place',fix,now)).created,false);
 assert.equal((await readDiscoveryActivity(db,'owner')).unread,0);
});
test('removing a place cascades its discovery notices without touching another place',async()=>{
 await recordDiscovery(db,'visitor','other-place',fix,now);
 await db.prepare('DELETE FROM spots WHERE id=?').bind('other-place').run();
 assert.equal((await readDiscoveryActivity(db,'other')).notices.length,0);
 assert.equal((await readDiscoveryActivity(db,'owner')).notices.length,1);
});
test('records accept a photo or text, require public confirmation, and derive a short title',()=>{
 const base={...point,location:'골목 벤치',image:null,publicConsent:true};
 assert.equal(createRecordSchema.safeParse({...base,body:'바람이 시원해요.'}).success,true);
 assert.equal(createRecordSchema.safeParse({...base,image:'/api/media/photo'}).success,true);
 assert.equal(createRecordSchema.safeParse(base).success,false);
 assert.equal(createRecordSchema.safeParse({...base,body:'이야기',publicConsent:false}).success,false);
 assert.equal(createRecordSchema.safeParse({...base,body:'이야기',publicConsent:undefined}).success,false);
 assert.equal(recordTitle({title:'',body:'첫 줄\n다음 줄',location:'벤치'}),'첫 줄');
 assert.equal(recordTitle({title:'',body:'',location:'벤치'}),'벤치');
});
test('place grouping is explicit and survives removal of the first story',async()=>{
 for(const [id,group] of [['story-a','place'],['story-b','place'],['separate',null]])await db.prepare('INSERT INTO spots(id,user_id,title,body,category,lat,lng,location,created_at,place_id) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,'visitor',id,'다른 순간','산책',point.lat,point.lng,'한 장소',new Date(now).toISOString(),group).run();
 const stories=()=>db.prepare('SELECT id FROM spots WHERE COALESCE(place_id,id)=? ORDER BY id').bind('place').all();
 assert.deepEqual((await stories()).results.map(s=>s.id),['place','story-a','story-b']);
 await db.prepare('DELETE FROM spots WHERE id=?').bind('place').run();
 assert.deepEqual((await stories()).results.map(s=>s.id),['story-a','story-b']);
 assert.equal((await readDiscoveryActivity(db,'owner')).notices.length,0);
});
