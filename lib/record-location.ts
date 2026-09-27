import type {Point} from '@/lib/model';

export type RecordLocation=Point&{address:string;warning?:string};

export function currentRecordPoint(signal:AbortSignal):Promise<Point>{
  return new Promise((resolve,reject)=>{
    if(signal.aborted){reject(new DOMException('Aborted','AbortError'));return;}
    if(!navigator.geolocation){reject(new Error('현재 위치를 지원하는 브라우저에서 열어주세요.'));return;}
    let watch:number|undefined,finished=false;
    const cleanup=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);if(watch!==undefined)navigator.geolocation.clearWatch(watch);};
    const fail=(error:Error)=>{if(finished)return;finished=true;cleanup();reject(error);};
    const abort=()=>fail(new DOMException('Aborted','AbortError'));
    const timer=setTimeout(()=>fail(new Error('정확한 위치를 아직 찾지 못했어요. 휴대폰의 정확한 위치를 켜고 창가나 실외에서 다시 확인해주세요.')),20000);
    signal.addEventListener('abort',abort,{once:true});
    watch=navigator.geolocation.watchPosition(p=>{
      if(finished)return;
      const {latitude:lat,longitude:lng,accuracy}=p.coords;
      if(!Number.isFinite(lat)||!Number.isFinite(lng)||!Number.isFinite(accuracy)||accuracy>100||Math.abs(lat)>90||Math.abs(lng)>180)return;
      finished=true;cleanup();resolve({lat,lng});
    },e=>{
      if(e.code===1)fail(new Error('위치 권한이 꺼져 있어요. 브라우저 설정에서 위치 접근을 허용한 뒤 다시 확인해주세요.'));
      // Temporary unavailable/timeout readings can improve on the next update.
    },{enableHighAccuracy:true,timeout:15000,maximumAge:10000});
    if(finished&&watch!==undefined)navigator.geolocation.clearWatch(watch);
  });
}

export async function resolveRecordLocation(point:Point,signal:AbortSignal):Promise<RecordLocation>{
  const response=await fetch('/api/location',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(point),signal,cache:'no-store'});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'현재 주소를 확인하지 못했어요. 다시 시도해주세요.');
  if(result.address===null&&typeof result.warning==='string')return {...point,address:'',warning:result.warning};
  if(typeof result.address!=='string'||!result.address.trim())throw new Error('현재 주소를 확인하지 못했어요. 다시 시도해주세요.');
  return {...point,address:result.address};
}
