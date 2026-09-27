// Synthetic positions and mocked share sheets; no device GPS or SNS messages.
import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';

const root=fileURLToPath(new URL('..',import.meta.url));
const vite=await createServer({root,configFile:false,appType:'custom',resolve:{alias:{'@':root}},server:{middlewareMode:true,hmr:false}});
const ar=await vite.ssrLoadModule('/lib/ar-discovery.ts');
const share=await vite.ssrLoadModule('/lib/spot-share.ts');
after(()=>vite.close());
const origin={lat:37.54,lng:127.04};
const stamp=100000;
const spot=(metres,id='memory')=>({...origin,lat:origin.lat+metres/6371000*180/Math.PI,id,ar:1});
const fix=(seconds,values={})=>({...origin,accuracy:8,timestamp:stamp+seconds*1000,...values});
const update=(state,sample,spots)=>ar.updateARDiscovery(state,sample,spots,sample.timestamp);
const see=(state,spots,heading=null,now=state.fix.timestamp)=>ar.discoverARSpots(state,spots,heading,now);
function twoFixes(spots){let s=update(ar.emptyARDiscovery(),fix(0),spots);return update(s,fix(2),spots);}

test('50–100m is radar only; 20–50m stays radar and non-AR records never appear',()=>{
  const spots=[spot(60,'radar'),spot(99.9,'edge'),spot(100.1,'outside'),spot(30,'approach'),{...spot(8,'ordinary'),ar:0}];
  const result=see(twoFixes(spots),spots);
  assert.deepEqual(result.nearby.map(s=>s.spot.id),['approach','radar','edge']);
  assert.equal(result.visible.length,0);assert.equal(result.interactive.length,0);
});
test('15–20m notes need two accurate fixes across two seconds; outside 20m cannot unlock',()=>{
  const spots=[spot(15,'close'),spot(19.9,'edge'),spot(20.1,'outside')];
  const one=update(ar.emptyARDiscovery(),fix(0),spots);
  assert.equal(see(one,spots).visible.length,0);
  const duplicate=update(one,fix(0),spots);assert.equal(see(duplicate,spots).visible.length,0);
  const early=update(one,fix(1),spots);assert.equal(see(early,spots).visible.length,0);
  const ready=update(early,fix(2),spots);
  assert.deepEqual(see(ready,spots).visible.map(s=>s.spot.id),['close','edge']);
  const away=update(ready,fix(4,{lat:origin.lat-8/6371000*180/Math.PI}),spots);
  assert.equal(see(away,spots).visible.length,0);
});
test('poor, stale or nonfinite location suspends interaction and resets entry evidence',()=>{
  const spots=[spot(10)];const ready=twoFixes(spots);
  const coarse=update(ready,fix(3,{accuracy:30}),spots);
  assert.equal(see(coarse,spots).nearby.length,1);assert.equal(see(coarse,spots).visible.length,0);
  const recovering=update(coarse,fix(4),spots);assert.equal(see(recovering,spots).visible.length,0);
  assert.equal(see(update(recovering,fix(6),spots),spots).visible.length,1);
  assert.equal(see(ready,spots,null,ready.fix.timestamp+12001).nearby.length,0);
  for(const values of [{accuracy:80},{accuracy:NaN},{lat:NaN},{lng:181},{accuracy:-1}]) {
    assert.equal(see(update(ready,fix(4,values),spots),spots).nearby.length,0);
  }
});
test('a single implausible GPS jump cannot reveal a close note',()=>{
  const spots=[spot(8)];
  const far=update(ar.emptyARDiscovery(),fix(0,{lat:37.55}),spots);
  const jumped=update(far,fix(2),spots);
  assert.equal(jumped.reliable,false);assert.equal(see(jumped,spots).visible.length,0);
});
test('phone direction filters close notes; unavailable compass explicitly supports distance order',()=>{
  const spots=[spot(10,'north'),spot(-10,'south'),spot(0,'underfoot')],state=twoFixes(spots);
  assert.deepEqual(see(state,spots,0).visible.map(s=>s.spot.id),['underfoot','north']);
  assert.deepEqual(see(state,spots,180).visible.map(s=>s.spot.id),['underfoot','south']);
  assert.equal(see(state,spots,null).visible.length,3);
  assert.equal(see(state,[],null).visible.length,0);
});
test('sharing uses a clean per-spot URL; native cancel is not an error or a second share',async()=>{
  const data=share.spotShareData({id:'memory-1',title:'볕 드는 골목',nickname:'기웃이'},'https://spotmap.gptgroup0608.chatgpt.site/?token=secret#private');
  assert.equal(data.url,'https://spotmap.gptgroup0608.chatgpt.site/?spot=memory-1');
  assert.equal(share.sharedSpotId(new URL(data.url).search),'memory-1');
  assert.equal(share.sharedSpotId('?spot=<script>'),null);
  let received;
  assert.equal(await share.shareSpot(data,{share:async value=>{received=value;},canShare:()=>true}),'shared');
  assert.deepEqual(received,data);
  assert.equal(await share.shareSpot(data,{share:async()=>{throw Object.assign(new Error(),{name:'AbortError'});}}),'cancelled');
  assert.equal(await share.shareSpot(data,{}),'fallback');
  assert.equal(await share.shareSpot(data,{share:async()=>{throw new Error('Permission denied');}}),'fallback');
  assert.equal(await share.shareSpot(data,{share:async()=>assert.fail('unsupported share called'),canShare:()=>false}),'fallback');
});
