import type {LocationFix} from '@/lib/navigation';
export type SensorProblem='camera'|'location'|'direction';
export type SensorPlatform={
 watch:(success:(fix:LocationFix)=>void,error:(message:string)=>void)=>number;
 clearWatch:(id:number)=>void;
 camera:()=>Promise<MediaStream>;
 orientationPermission:()=>Promise<string>;
 listenHeading:(receive:(heading:number)=>void)=>()=>void;
};
type StartLocationPlatform={
 watch:(success:(fix:LocationFix)=>void,error:(code:number)=>void)=>number;
 clearWatch:(id:number)=>void;
 setTimer:(callback:()=>void,delay:number)=>number;
 clearTimer:(id:number)=>void;
};
const browserStartLocation=():StartLocationPlatform=>({
 watch:(success,error)=>{
  if(!navigator.geolocation)throw new Error('현재 위치를 지원하지 않는 브라우저예요.');
  return navigator.geolocation.watchPosition(p=>success({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp}),e=>error(e.code),{enableHighAccuracy:true,timeout:12000,maximumAge:0});
 },
 clearWatch:id=>navigator.geolocation.clearWatch(id),
 setTimer:(callback,delay)=>window.setTimeout(callback,delay),
 clearTimer:id=>window.clearTimeout(id),
});
export function acquireStartFix(signal?:AbortSignal,platform=browserStartLocation()){
 return new Promise<LocationFix>((resolve,reject)=>{
  let watch:number|null=null,timer:number|null=null,best:LocationFix|null=null,done=false;
  const finish=(error?:Error)=>{if(done)return;done=true;if(watch!==null)platform.clearWatch(watch);if(timer!==null)platform.clearTimer(timer);signal?.removeEventListener('abort',abort);if(error)reject(error);else resolve(best!);};
  const abort=()=>finish(new DOMException('Aborted','AbortError'));
  if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});
  try{
   watch=platform.watch(fix=>{
    if(done||!Number.isFinite(fix.lat)||!Number.isFinite(fix.lng)||!Number.isFinite(fix.accuracy)||fix.accuracy<0)return;
    if(!best||fix.accuracy<best.accuracy)best=fix;
    if(fix.accuracy<=60)finish();
   },code=>{if(code===1)finish(new Error('위치 권한을 허용하면 현재 위치에서 길을 찾을 수 있어요.'));});
   if(done){platform.clearWatch(watch);watch=null;return;}
   timer=platform.setTimer(()=>best&&best.accuracy<=250?finish():finish(new Error('현재 위치를 충분히 정확하게 찾지 못했어요. 창가나 실외에서 다시 시도해주세요.')),8000);
  }catch(e){finish(e instanceof Error?e:new Error('현재 위치를 지원하지 않는 브라우저예요.'));}
 });
}
export function compassHeading(e:{webkitCompassHeading?:number;webkitCompassAccuracy?:number;absolute?:boolean;alpha:number|null}){
 if(typeof e.webkitCompassHeading==='number')return Number.isFinite(e.webkitCompassHeading)&&(e.webkitCompassAccuracy===undefined||(e.webkitCompassAccuracy>=0&&e.webkitCompassAccuracy<=25))?(e.webkitCompassHeading+360)%360:null;
 return e.absolute&&e.alpha!==null&&Number.isFinite(e.alpha)?(360-e.alpha+360)%360:null;
}
function browserPlatform():SensorPlatform{return {
 watch:(success,error)=>{
  if(!navigator.geolocation)throw new Error('현재 위치를 지원하지 않는 브라우저예요.');
  return navigator.geolocation.watchPosition(p=>success({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp}),e=>error(e.code===1?'위치 권한을 허용하면 안내할 수 있어요.':e.code===3?'위치 확인 시간이 길어지고 있어요. 다시 시도해주세요.':'현재 위치를 찾지 못했어요. 탁 트인 곳에서 다시 확인해주세요.'),{enableHighAccuracy:true,timeout:12000,maximumAge:0});
 },clearWatch:id=>navigator.geolocation.clearWatch(id),
 camera:()=>navigator.mediaDevices?.getUserMedia?navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false}):Promise.reject(new Error('카메라를 사용할 수 없어요. 휴대폰 브라우저에서 직접 열어주세요.')),
 orientationPermission:()=>{
  const device=typeof DeviceOrientationEvent!=='undefined'?DeviceOrientationEvent as typeof DeviceOrientationEvent&{requestPermission?:()=>Promise<string>}:null;
  return device?.requestPermission?device.requestPermission():Promise.resolve('granted');
 },
 listenHeading:receive=>{
  const listener=(event:DeviceOrientationEvent)=>{
   const e=event as DeviceOrientationEvent&{webkitCompassHeading?:number;webkitCompassAccuracy?:number};
   const heading=compassHeading(e);if(heading!==null)receive(heading);
  };
  window.addEventListener('deviceorientation',listener);window.addEventListener('deviceorientationabsolute',listener as EventListener);
  return()=>{window.removeEventListener('deviceorientation',listener);window.removeEventListener('deviceorientationabsolute',listener as EventListener);};
 }
};}
export function beginNavigationSensors(options:{camera:boolean;onFix:(fix:LocationFix)=>void;onHeading:(heading:number)=>void;onStream:(stream:MediaStream)=>void;onError:(kind:SensorProblem,message:string)=>void},platform=browserPlatform()){
 let stopped=false,cameraAllowed=options.camera,watch:number|null=null,stream:MediaStream|null=null,unlisten=()=>{};
 const report=(kind:SensorProblem,message:string)=>{if(!stopped)options.onError(kind,message);};
 // Both permission requests start in the original button gesture, before an await.
 const request=<T,>(fn:()=>Promise<T>)=>{try{return fn();}catch(e){return Promise.reject(e);}};
 const orientation=options.camera?request(platform.orientationPermission).then(result=>{if(result!=='granted')report('direction','방향 권한을 허용한 뒤 다시 연결해주세요.');}).catch(()=>report('direction','방향 센서를 확인할 수 없어요. 휴대폰 브라우저에서 방향 권한을 확인해주세요.')):Promise.resolve();
 const camera=options.camera?request(platform.camera).then(media=>{if(stopped||!cameraAllowed){media.getTracks().forEach(t=>t.stop());return;}stream=media;options.onStream(media);}).catch(e=>report('camera',e?.name==='NotAllowedError'?'카메라 권한을 허용한 뒤 다시 연결해주세요.':e?.message||'카메라에 연결하지 못했어요. 다시 연결해주세요.')):Promise.resolve();
 try{watch=platform.watch(fix=>{if(!stopped)options.onFix(fix);},message=>report('location',message));}catch(e){report('location',(e as Error).message);}
 try{unlisten=platform.listenHeading(heading=>{if(!stopped&&Number.isFinite(heading))options.onHeading(heading);});}catch{report('direction','방향 센서를 확인할 수 없어요. 휴대폰 브라우저에서 방향 권한을 확인해주세요.');}
 const stopCamera=()=>{cameraAllowed=false;stream?.getTracks().forEach(t=>t.stop());stream=null;};
 return {ready:Promise.all([orientation,camera]),stopCamera,stop:()=>{if(stopped)return;stopped=true;stopCamera();if(watch!==null)platform.clearWatch(watch);watch=null;unlisten();}};
}
