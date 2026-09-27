import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({root,configFile:false,appType:'custom',resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false}});
const {reverseGeocode}=await vite.ssrLoadModule('/lib/reverse-geocode.ts');
const {createRecordSchema}=await vite.ssrLoadModule('/lib/record-input.ts');
const {currentRecordPoint,resolveRecordLocation}=await vite.ssrLoadModule('/lib/record-location.ts');
after(()=>vite.close());
const point={lat:37.5445,lng:127.0433};
test('address lookup uses longitude as x and returns the road address',async()=>{
 const address=await reverseGeocode(point,'test-only-key',async(url,options)=>{
  assert.equal(url.searchParams.get('x'),'127.0433');assert.equal(url.searchParams.get('y'),'37.5445');
  assert.equal(options.cache,'no-store');
  return Response.json({documents:[{road_address:{address_name:'서울 성동구 연무장길'},address:{address_name:'서울 성동구 성수동2가'}}]});
 });
 assert.equal(address,'서울 성동구 연무장길');
});
test('a place without a street address falls back to the administrative area',async()=>{
 const calls=[];
 const address=await reverseGeocode(point,'test-only-key',async url=>{
  calls.push(url.pathname);
  return Response.json({documents:calls.length===1?[]:[{region_type:'B',address_name:'법정동'},{region_type:'H',address_name:'서울 성동구 성수2가1동'}]});
 });
 assert.equal(calls.length,2);assert.equal(address,'서울 성동구 성수2가1동');
});
test('failed or empty lookups do not invent an address from coordinates',async()=>{
 await assert.rejects(reverseGeocode(point,'test-only-key',async()=>new Response('',{status:403})),/주소 서비스/);
 await assert.rejects(reverseGeocode(point,'test-only-key',async()=>Response.json({documents:[]})),/주소를 찾지 못했어요/);
});
test('new records always enable AR, including older clients sending false',()=>{
 const base={...point,location:'서울 성동구 연무장길',title:'인생 젤라또',body:'골목에서 발견했어요.',image:null,publicConsent:true};
 assert.equal(createRecordSchema.parse(base).ar,true);
 assert.equal(createRecordSchema.parse({...base,ar:false}).ar,true);
});

test('a rough first GPS reading waits for a precise fix and releases its watcher',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');let success,cleared;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{geolocation:{watchPosition(cb){success=cb;return 42;},clearWatch(id){cleared=id;}}}});
 try{
  let settled=false;const promise=currentRecordPoint(new AbortController().signal).then(p=>{settled=true;return p;});
  success({coords:{latitude:37.54,longitude:127.04,accuracy:600}});await Promise.resolve();assert.equal(settled,false);
  success({coords:{latitude:37.5445,longitude:127.0433,accuracy:25}});
  assert.deepEqual(await promise,point);assert.equal(cleared,42);
 }finally{if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;}
});
test('closing location acquisition releases the GPS watcher',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');let cleared;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{geolocation:{watchPosition(){return 9;},clearWatch(id){cleared=id;}}}});
 try{const controller=new AbortController();const promise=currentRecordPoint(controller.signal);controller.abort();await assert.rejects(promise,{name:'AbortError'});assert.equal(cleared,9);}
 finally{if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;}
});
test('address outage retains GPS without inventing an address; auth failure still rejects',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>Response.json({address:null,warning:'주소 연결 실패'});
  const result=await resolveRecordLocation(point,new AbortController().signal);assert.equal(result.address,'');assert.equal(result.lat,point.lat);assert.equal(result.warning,'주소 연결 실패');
  globalThis.fetch=async()=>Response.json({error:'로그인이 필요해요.'},{status:401});
  await assert.rejects(resolveRecordLocation(point,new AbortController().signal),/로그인/);
 }finally{globalThis.fetch=original;}
});
