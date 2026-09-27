// Synthetic GPS, camera and Kakao responses. These tests do not represent a field walk.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import test,{after} from 'node:test';
import {createServer} from 'vite';

const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({root,configFile:false,appType:'custom',resolve:{alias:[{find:'@/lib/server',replacement:'test-backend'},{find:'@',replacement:root}]},server:{middlewareMode:true},plugins:[{
 name:'isolated-test-backend',enforce:'pre',
 resolveId(id){if(id==='test-backend')return '\0test-backend';},
 load(id){if(id==='\0test-backend')return `
  export class HttpError extends Error {constructor(status,message){super(message);this.status=status;}}
  export const db=()=>globalThis.__giutTestBackend.db;
  export const bindings=()=>globalThis.__giutTestBackend.env;
  export async function identity(required){const u=globalThis.__giutTestBackend.user;if(required&&!u)throw new HttpError(401,'로그인이 필요해요.');return u;}
  export async function ensureProfile(u){await db().prepare('INSERT OR IGNORE INTO profiles(id,nickname,bio,created_at) VALUES(?,?,?,?)').bind(u.id,u.nickname,'','2026-01-01').run();}
  export function checkOrigin(req){if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)throw new HttpError(403,'origin');}
  export function respondError(e){if(!(e instanceof HttpError))throw e;return Response.json({error:e.message},{status:e.status});}
 `;}
}]});
const nav=await vite.ssrLoadModule('/lib/navigation.ts');
const {parseWalkingRoute}=await vite.ssrLoadModule('/lib/walking-route.ts');
const {acquireStartFix,beginNavigationSensors,compassHeading}=await vite.ssrLoadModule('/lib/navigation-sensors.ts');
const collections=await vite.ssrLoadModule('/app/api/collections/route.ts');
const publicCourses=await vite.ssrLoadModule('/app/api/courses/[id]/route.ts');
const {courseShareData,sharedCourseId}=await vite.ssrLoadModule('/lib/course-share.ts');
const walking=await vite.ssrLoadModule('/app/api/walking-route/route.ts');
after(async()=>{await vite.close();delete globalThis.__giutTestBackend;});

const point={lat:37.54,lng:127.04};
const fix=(seconds,extra={})=>({...point,accuracy:8,timestamp:100000+seconds*1000,...extra});
const leg={path:[point,{lat:37.541,lng:127.04},{lat:37.541,lng:127.041}],distance:200,duration:180,steps:[{instruction:'북쪽 골목으로',startIndex:0,distance:110},{instruction:'오른쪽으로',startIndex:1,distance:90}]};

test('follows the next bend in the walking path, rather than the destination bearing',()=>{
 const p=nav.routeProgress(point,leg);assert.ok(p.bearing<1||p.bearing>359);assert.equal(p.instruction,'북쪽 골목으로');assert.equal(p.remaining,200);
 const bend=nav.routeProgress({lat:37.541,lng:127.0405},leg);assert.ok(Math.abs(bend.bearing-90)<1);assert.equal(bend.instruction,'오른쪽으로');assert.ok(bend.remaining>30&&bend.remaining<60);
 assert.ok(nav.smoothHeading(359,1)>359||nav.smoothHeading(359,1)<1);assert.equal(nav.angleDelta(1,359),2);
});

test('arrival needs three accurate, consecutive fixes over four seconds',()=>{
 let e=nav.freshEvidence();
 for(const [seconds,arrived] of [[0,false],[2,false],[4,true]]){const r=nav.updateEvidence(e,fix(seconds),point,0);assert.equal(r.arrived,arrived);e=r.evidence;}
 assert.equal(nav.updateEvidence(nav.freshEvidence(),fix(0,{accuracy:35}),point,0).arrived,false);
 let r=nav.updateEvidence(nav.freshEvidence(),fix(0),point,0);r=nav.updateEvidence(r.evidence,fix(2),point,0);r=nav.updateEvidence(r.evidence,fix(20),point,0);assert.equal(r.arrived,false);assert.equal(r.evidence.nearCount,1);
 assert.equal(nav.usableFix(fix(0),120001),false);assert.equal(nav.usableFix(fix(0,{accuracy:90}),100000),false);
});

test('a GPS jump and duplicate timestamp cannot complete a spot',()=>{
 let e=nav.updateEvidence(nav.freshEvidence(),fix(0,{lat:37.55}),point,1000).evidence;
 let r=nav.updateEvidence(e,fix(2),point,0);assert.equal(r.accepted,false);assert.equal(r.arrived,false);
 e=nav.updateEvidence(nav.freshEvidence(),fix(0),point,0).evidence;
 r=nav.updateEvidence(e,fix(0),point,0);assert.equal(r.accepted,false);assert.equal(r.arrived,false);
});

test('off-route needs sustained accurate evidence and clears when back on path',()=>{
 let e=nav.freshEvidence();for(const [t,off] of [[0,false],[2,false],[4,true]]){const r=nav.updateEvidence(e,fix(t,{lat:37.539}),point,65);assert.equal(r.offRoute,off);e=r.evidence;}
 assert.equal(nav.updateEvidence(e,fix(6,{lat:37.539}),point,10).offRoute,false);
 e=nav.freshEvidence();for(const t of [0,2,4]){const r=nav.updateEvidence(e,fix(t,{lat:37.539,accuracy:35}),point,70);assert.equal(r.offRoute,false);e=r.evidence;}
});

function routeFixture(points=[point,{lat:37.541,lng:127.04}]){
 return {status:'OK',route:{properties:{totalDistance:111,totalTime:100},legs:[{properties:{distance:111,time:100},steps:[{properties:{distance:111,time:100,guidance:'골목을 따라 이동'},path:{points:points.map(p=>[p.lng,p.lat])}}]}]}};
}
test('parses the official Kakao contract with longitude first and rejects incomplete paths',()=>{
 const route=parseWalkingRoute(routeFixture(),1);assert.deepEqual(route.legs[0].path[0],point);assert.equal(route.distance,111);assert.equal(route.duration,100);
 assert.throws(()=>parseWalkingRoute(routeFixture(),2),/INCOMPLETE/);
 assert.throws(()=>parseWalkingRoute({...routeFixture(),status:'ROUTE_RESULT_NOT_FOUND'},1),/INVALID/);
 const bad=routeFixture();bad.route.legs[0].steps.push({properties:{distance:100,time:100,guidance:'disconnected'},path:{points:[[128,38],[128,38.001]]}});assert.throws(()=>parseWalkingRoute(bad,1),/DISCONTINUOUS/);
 assert.throws(()=>parseWalkingRoute(routeFixture([point]),1),/EMPTY/);
});

test('unreliable compass accuracy cannot fall through to an absolute heading',()=>{
 assert.equal(compassHeading({webkitCompassHeading:45,webkitCompassAccuracy:60,absolute:true,alpha:90}),null);
 assert.equal(compassHeading({webkitCompassHeading:45,webkitCompassAccuracy:8,absolute:true,alpha:90}),45);
 assert.equal(compassHeading({absolute:false,alpha:90}),null);
 assert.equal(compassHeading({absolute:true,alpha:90}),270);
});

function startLocationFixture(){
 const state={watchCleared:[],timerCleared:[],callback:null,error:null,timer:null};
 return {state,platform:{watch(success,error){state.callback=success;state.error=error;return 7;},clearWatch:id=>state.watchCleared.push(id),setTimer(callback){state.timer=callback;return 8;},clearTimer:id=>state.timerCleared.push(id)}};
}
test('initial GPS waits for a better fix but accepts a usable mobile coarse fix',async()=>{
 const f=startLocationFixture(),pending=acquireStartFix(undefined,f.platform);
 f.state.callback(fix(0,{accuracy:180}));f.state.callback(fix(1,{accuracy:90}));f.state.timer();
 const result=await pending;assert.equal(result.accuracy,90);assert.deepEqual(f.state.watchCleared,[7]);assert.deepEqual(f.state.timerCleared,[8]);
});
test('initial GPS resolves early when accurate and rejects denied or unusable fixes',async()=>{
 let f=startLocationFixture(),pending=acquireStartFix(undefined,f.platform);f.state.callback(fix(0,{accuracy:35}));assert.equal((await pending).accuracy,35);
 f=startLocationFixture();pending=acquireStartFix(undefined,f.platform);f.state.error(1);await assert.rejects(pending,/위치 권한/);
 f=startLocationFixture();pending=acquireStartFix(undefined,f.platform);f.state.callback(fix(0,{accuracy:400}));f.state.timer();await assert.rejects(pending,/충분히 정확/);
});
test('initial GPS watch is released when route lookup is cancelled',async()=>{
 const f=startLocationFixture(),controller=new AbortController(),pending=acquireStartFix(controller.signal,f.platform);controller.abort();await assert.rejects(pending,e=>e.name==='AbortError');assert.deepEqual(f.state.watchCleared,[7]);assert.deepEqual(f.state.timerCleared,[8]);
});

function sensorFixture(overrides={}){
 const events={stopped:0,cleared:[],unlistened:0,fixes:[],headings:[],errors:[],streams:[]};
 const stream={getTracks:()=>[{stop:()=>events.stopped++}]};
 const platform={watch(receive,error){events.receive=receive;events.locationError=error;return 42;},clearWatch:id=>events.cleared.push(id),camera:async()=>stream,orientationPermission:async()=>'granted',listenHeading(receive){events.direction=receive;return()=>events.unlistened++;},...overrides};
 const session=beginNavigationSensors({camera:true,onFix:f=>events.fixes.push(f),onHeading:h=>events.headings.push(h),onError:(kind,message)=>events.errors.push({kind,message}),onStream:s=>events.streams.push(s)},platform);
 return {session,events,stream};
}
test('granted sensors receive fixes and release camera, GPS and listeners on end',async()=>{
 const {session,events}=sensorFixture();await session.ready;events.receive(fix(0));events.direction(45);assert.equal(events.streams.length,1);assert.equal(events.fixes.length,1);assert.deepEqual(events.headings,[45]);
 session.stop();session.stop();events.receive(fix(2));events.direction(90);assert.equal(events.fixes.length,1);assert.deepEqual(events.cleared,[42]);assert.equal(events.unlistened,1);assert.equal(events.stopped,1);
});
test('camera rejection and direction rejection preserve GPS for map guidance',async()=>{
 const {session,events}=sensorFixture({camera:async()=>{throw Object.assign(new Error('denied'),{name:'NotAllowedError'});},orientationPermission:async()=>'denied'});await session.ready;events.receive(fix(0));assert.equal(events.fixes.length,1);assert.deepEqual(events.errors.map(e=>e.kind).sort(),['camera','direction']);assert.equal(events.streams.length,0);session.stop();
});
test('location denial and unsupported direction are reported without crashing',async()=>{
 const {session,events}=sensorFixture({listenHeading:()=>{throw new Error('unsupported');}});await session.ready;events.locationError('위치 권한 거부');assert.deepEqual(events.errors.map(e=>e.kind),['direction','location']);session.stop();
 const sync=sensorFixture({orientationPermission:()=>{throw new Error('unsupported');},camera:()=>{throw new Error('unsupported');}});await sync.session.ready;assert.equal(sync.events.errors.length,2);sync.session.stop();
});
test('late permission results release the camera after end or map fallback',async()=>{
 for(const method of ['stop','stopCamera']){
  let resolve;const mediaPromise=new Promise(r=>{resolve=r;});const f=sensorFixture({camera:()=>mediaPromise});f.session[method]();resolve(f.stream);await f.session.ready;assert.equal(f.events.streams.length,0);assert.equal(f.events.stopped,1);f.session.stop();
 }
});

async function backend(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
 for(const f of ['0000_solid_moonstone.sql','0001_colorful_warbird.sql'])sqlite.exec(await readFile(root+'drizzle/'+f,'utf8'));
 class Statement{
  constructor(sql,values=[]){this.sql=sql;this.values=values;}bind(...values){return new Statement(this.sql,values);}
  async all(){return {results:sqlite.prepare(this.sql).all(...this.values).map(row=>({...row}))};}
  async first(){return (await this.all()).results[0]||null;}async run(){return sqlite.prepare(this.sql).run(...this.values);}
 }
 const db={prepare:sql=>new Statement(sql),async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 const ctx={db,env:{},user:{id:'user-a',nickname:'테스트 탐험가'},sqlite};globalThis.__giutTestBackend=ctx;
 for(const id of ['user-a','user-b'])sqlite.prepare('INSERT INTO profiles(id,nickname,bio,created_at) VALUES(?,?,?,?)').run(id,id,'','2026-01-01');
 for(let i=1;i<=3;i++)sqlite.prepare('INSERT INTO spots(id,user_id,title,body,category,lat,lng,location,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run('spot-'+i,'user-a','장소 '+i,'테스트 기록','산책',37.54+i*.001,127.04,'테스트 골목','2026-01-01');
 return ctx;
}
const request=(body,origin='https://giut.example')=>new Request('https://giut.example/api/test',{method:'POST',headers:{'Content-Type':'application/json',origin},body:JSON.stringify(body)});
async function action(body){const response=await collections.POST(request(body));return {status:response.status,...await response.json()};}

test('course links contain only a validated course ID, never a folder or previous URL parameters',()=>{
 const data=courseShareData({id:'course-123',title:'동네 한 바퀴',nickname:'탐험가'},'https://giut.example/?spot=private&token=secret#login');
 assert.equal(data.url,'https://giut.example/?course=course-123');
 assert.equal(sharedCourseId(new URL(data.url).search),'course-123');
 for(const search of ['?course=','?course=../../private','?course='+('a'.repeat(181)),'?spot=course-123'])assert.equal(sharedCourseId(search),null);
});

test('guest course links return current ordered places without exposing private folders or workspace',async()=>{
 const ctx=await backend();try{
  await action({op:'folder-create',name:'비공개 폴더',spotId:'spot-3'});
  const c=await action({op:'course-create',title:'새 코스',description:'코스 이야기',spotIds:['spot-2','spot-1']});
  assert.equal(c.status,200);
  ctx.user=null;
  const response=await publicCourses.GET(new Request('https://giut.example/api/courses/'+c.id),{params:Promise.resolve({id:c.id})});
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  const data=await response.json();assert.deepEqual(Object.keys(data).sort(),['course','spots']);
  assert.equal(data.course.mode,'walk');assert.deepEqual(data.course.spotIds,['spot-2','spot-1']);
  assert.deepEqual(data.spots.map(s=>s.id),['spot-2','spot-1']);assert.ok(data.spots.every(s=>!s.saved&&!s.liked));
  assert.ok(!JSON.stringify(data).includes('비공개 폴더'));assert.ok(!JSON.stringify(data).includes('spot-3'));
  assert.equal((await action({op:'course-update',id:c.id,title:'변조',description:'',spotIds:['spot-1','spot-2']})).status,401);
 }finally{ctx.sqlite.close();}
});

test('shared course links follow edits and handle deleted places and deleted courses',async()=>{
 const ctx=await backend();try{
  const c=await action({op:'course-create',title:'코스',description:'처음',mode:'run',spotIds:['spot-1','spot-2']});
  const get=()=>publicCourses.GET(new Request('https://giut.example/api/courses/'+c.id),{params:Promise.resolve({id:c.id})});
  await action({op:'course-update',id:c.id,title:'수정한 코스',description:'새 이야기',mode:'run',spotIds:['spot-2','spot-1']});
  let data=await (await get()).json();assert.equal(data.course.title,'수정한 코스');assert.equal(data.course.description,'새 이야기');assert.equal(data.course.mode,'run');assert.deepEqual(data.course.spotIds,['spot-2','spot-1']);
  ctx.sqlite.prepare('DELETE FROM spots WHERE id=?').run('spot-2');
  data=await (await get()).json();assert.deepEqual(data.course.spotIds,['spot-1']);
  ctx.sqlite.prepare('DELETE FROM spots WHERE id=?').run('spot-1');
  assert.deepEqual((await (await get()).json()).spots,[]);
  await action({op:'course-delete',id:c.id});assert.equal((await get()).status,404);
  const invalid=await publicCourses.GET(new Request('https://giut.example/api/courses/invalid'),{params:Promise.resolve({id:"' OR 1=1--"})});assert.equal(invalid.status,404);
 }finally{ctx.sqlite.close();}
});

test('migrates existing saves, allows multiple folders, and removes save only after last membership',async()=>{
 const ctx=await backend();try{
  ctx.sqlite.prepare("INSERT INTO reactions(user_id,spot_id,kind,created_at) VALUES('user-a','spot-1','save','2026-01-01')").run();
  let data=await (await collections.GET()).json();assert.deepEqual(data.folders[0].spotIds,['spot-1']);
  const a=await action({op:'folder-create',name:'주말',spotId:'spot-1'});assert.equal(a.status,200);
  assert.equal((await action({op:'folder-toggle',id:'later:user-a',spotId:'spot-1',active:false})).status,200);
  assert.equal(ctx.sqlite.prepare("SELECT COUNT(*) AS n FROM reactions WHERE kind='save'").get().n,1);
  await action({op:'folder-toggle',id:a.id,spotId:'spot-1',active:false});
  assert.equal(ctx.sqlite.prepare("SELECT COUNT(*) AS n FROM reactions WHERE kind='save'").get().n,0);
  data=await (await collections.GET()).json();assert.ok(data.folders.every(f=>!f.spotIds.length));
 }finally{ctx.sqlite.close();}
});
test('folder order persists, course is an independent ordered snapshot, and deleting a folder preserves saves',async()=>{
 const ctx=await backend();try{
  const f=await action({op:'folder-create',name:'산책',spotId:'spot-1'});await action({op:'folder-toggle',id:f.id,spotId:'spot-2',active:true});
  await action({op:'folder-order',id:f.id,spotIds:['spot-2','spot-1']});
  let data=await (await collections.GET()).json();assert.deepEqual(data.folders.find(x=>x.id===f.id).spotIds,['spot-2','spot-1']);
  const c=await action({op:'course-create',title:'한 바퀴',description:'함께',mode:'run',spotIds:['spot-2','spot-1']});assert.equal(c.status,200);
  await action({op:'folder-order',id:f.id,spotIds:['spot-1','spot-2']});await action({op:'folder-delete',id:f.id});
  data=await (await collections.GET()).json();assert.deepEqual(data.courses[0].spotIds,['spot-2','spot-1']);assert.deepEqual(new Set(data.folders[0].spotIds),new Set(['spot-1','spot-2']));
  assert.equal(ctx.sqlite.prepare("SELECT COUNT(*) AS n FROM reactions WHERE kind='save'").get().n,2);
  assert.equal((await action({op:'folder-delete',id:'later:user-a'})).status,400);
 }finally{ctx.sqlite.close();}
});
test('folder and course mutations enforce ownership and reject stale or duplicate order',async()=>{
 const ctx=await backend();try{
  const f=await action({op:'folder-create',name:'내 폴더',spotId:'spot-1'});const c=await action({op:'course-create',title:'내 코스',description:'',mode:'walk',spotIds:['spot-1','spot-2']});
  assert.equal((await action({op:'folder-order',id:f.id,spotIds:[]})).status,409);
  assert.equal((await action({op:'course-create',title:'중복',description:'',mode:'walk',spotIds:['spot-1','spot-1']})).status,400);
  ctx.user={id:'user-b',nickname:'다른 탐험가'};
  assert.equal((await action({op:'folder-toggle',id:f.id,spotId:'spot-2',active:true})).status,404);
  assert.equal((await action({op:'course-update',id:c.id,title:'수정',description:'',mode:'walk',spotIds:['spot-2','spot-1']})).status,404);
  const data=await (await collections.GET()).json();assert.ok(data.folders.every(x=>x.id!==f.id));assert.equal(data.courses[0].id,c.id);
  ctx.user=null;assert.equal((await action({op:'folder-create',name:'미인증'})).status,401);
 }finally{ctx.sqlite.close();}
});
test('route endpoint refuses missing key and upstream failure, sends ordered waypoints server-side',async()=>{
 const ctx=await backend(),originalFetch=globalThis.fetch;let calls=0;try{
  globalThis.fetch=async()=>{calls++;throw new Error('unexpected');};
  let response=await walking.POST(request({origin:point,spotIds:['spot-1']}));assert.equal(response.status,503);assert.equal((await response.json()).code,'ROUTING_NOT_CONFIGURED');assert.equal(calls,0);
  ctx.user=null;response=await walking.POST(request({origin:point,spotIds:['spot-1']}));assert.equal(response.status,503);assert.equal((await response.json()).code,'ROUTING_NOT_CONFIGURED');ctx.user={id:'user-a',nickname:'테스트 탐험가'};
  ctx.env.KAKAO_REST_API_KEY='synthetic-test-key';
  globalThis.fetch=async(url,opts)=>{calls++;assert.equal(new URL(url).pathname,'/v2/routing/walk');assert.equal(new URL(url).searchParams.get('start_x'),'127.04');assert.equal(new URL(url).searchParams.get('via_y'),'37.542');assert.equal(new URL(url).searchParams.get('end_y'),'37.541');assert.equal(opts.headers.Authorization,'KakaoAK synthetic-test-key');return Response.json({}, {status:403});};
  response=await walking.POST(request({origin:point,spotIds:['spot-2','spot-1']}));assert.equal((await response.json()).code,'ROUTING_AUTH_ERROR');
  globalThis.fetch=async()=>Response.json(routeFixture([point,{lat:37.541,lng:127.04}]));response=await walking.POST(request({origin:point,spotIds:['spot-1']}));assert.equal(response.status,200);const body=await response.json();assert.equal(body.route.provider,'kakao');assert.ok(!JSON.stringify(body).includes('synthetic-test-key'));
  globalThis.fetch=async()=>Response.json({status:'ROUTE_RESULT_NOT_FOUND'});response=await walking.POST(request({origin:point,spotIds:['spot-1']}));assert.equal(response.status,422);assert.equal((await response.json()).code,'NO_WALKING_ROUTE');
  globalThis.fetch=async()=>{throw Object.assign(new Error('timeout'),{name:'TimeoutError'});};response=await walking.POST(request({origin:point,spotIds:['spot-1']}));assert.equal(response.status,504);
 }finally{globalThis.fetch=originalFetch;ctx.sqlite.close();}
});

test('destination fallback provides bearing and straight-line distance without a route provider',()=>{
 const north=nav.destinationProgress(point,{lat:point.lat+.001,lng:point.lng});
 assert.ok(north.remaining>110&&north.remaining<112);
 assert.ok(north.bearing<1||north.bearing>359);
 const east=nav.destinationProgress(point,{lat:point.lat,lng:point.lng+.001});
 assert.ok(Math.abs(east.bearing-90)<1);
 assert.equal(east.offset,0);
 assert.equal(nav.destinationProgress(point,point).remaining,0);
 assert.match(east.instruction,/목적지 방향/);
});
