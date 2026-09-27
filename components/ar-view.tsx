'use client';
import {useCallback,useEffect,useImperativeHandle,useRef,useState,type Ref,type CSSProperties} from 'react';
import {Camera,ScanLine,Plus,RotateCcw,ChevronLeft,ChevronRight,Radio,LoaderCircle} from 'lucide-react';
import Giuti from '@/components/giuti';
import ARMemoryCard from '@/components/ar-memory-card';
import {beginNavigationSensors} from '@/lib/navigation-sensors';
import {smoothHeading} from '@/lib/navigation';
import {discoverARSpots,emptyARDiscovery,updateARDiscovery,AR_RADAR_RADIUS,AR_INTERACTION_RADIUS} from '@/lib/ar-discovery';
import {type Point,type Spot} from '@/lib/model';

export type ARViewControl={start:()=>void;stop:()=>void};

export default function ARView({ref,spots,onSelect,onCreate,onBrowse}:{ref:Ref<ARViewControl>;spots:Spot[];onSelect:(s:Spot)=>void;onCreate:(p:Point)=>void;onBrowse:()=>void}) {
  const video=useRef<HTMLVideoElement>(null),sensor=useRef<ReturnType<typeof beginNavigationSensors>|null>(null);
  const alive=useRef(true),generation=useRef(0),spotRef=useRef(spots),evidence=useRef(emptyARDiscovery());
  spotRef.current=spots;
  const [active,setActive]=useState(false),[busy,setBusy]=useState(false),[media,setMedia]=useState<MediaStream|null>(null);
  const [cameraError,setCameraError]=useState(''),[gpsError,setGPSError]=useState(''),[directionError,setDirectionError]=useState('');
  const [discovery,setDiscovery]=useState(emptyARDiscovery),[heading,setHeading]=useState<{value:number;time:number}|null>(null);
  const headingRef=useRef<number|null>(null),[now,setNow]=useState(Date.now());
  const [selectedId,setSelectedId]=useState<string|null>(null),[collapsed,setCollapsed]=useState(false);
  const [intro,setIntro]=useState<'hidden'|'visible'|'fading'>('hidden');
  const introShown=useRef(false);
  const release=useCallback(()=>{generation.current++;sensor.current?.stop();sensor.current=null;},[]);
  const stop=useCallback(()=>{release();setActive(false);setBusy(false);setMedia(null);setIntro('hidden');setHeading(null);evidence.current=emptyARDiscovery();setDiscovery(evidence.current);},[release]);

  useEffect(()=>{
    alive.current=true;
    const hidden=()=>{if(document.hidden)stop();};
    document.addEventListener('visibilitychange',hidden);
    return()=>{alive.current=false;release();document.removeEventListener('visibilitychange',hidden);};
  },[release,stop]);
  useEffect(()=>{if(!active)return;const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[active]);
  useEffect(()=>{
    const el=video.current;
    if(!el||!media)return;
    el.srcObject=media;
    el.play().catch(()=>{if(alive.current)setCameraError('카메라 재생을 시작하지 못했어요. 다시 연결해주세요.');});
    return()=>{el.srcObject=null;};
  },[media]);

  useEffect(()=>{
    if(intro!=='visible')return;
    const timer=window.setTimeout(()=>setIntro('fading'),3000);
    return()=>window.clearTimeout(timer);
  },[intro]);
  useEffect(()=>{
    if(intro!=='fading')return;
    const timer=window.setTimeout(()=>setIntro('hidden'),450);
    return()=>window.clearTimeout(timer);
  },[intro]);
  useImperativeHandle(ref,()=>({start,stop}));

  function start() {
    release();introShown.current=false;setIntro('hidden');const id=generation.current;
    evidence.current=emptyARDiscovery();setDiscovery(evidence.current);headingRef.current=null;
    setHeading(null);setMedia(null);setCameraError('');setGPSError('');setDirectionError('');
    setSelectedId(null);setCollapsed(false);setNow(Date.now());setActive(true);setBusy(true);
    const current=()=>alive.current&&generation.current===id;
    const next=beginNavigationSensors({camera:true,
      onFix:fix=>{
        if(!current())return;
        evidence.current=updateARDiscovery(evidence.current,fix,spotRef.current);
        setDiscovery(evidence.current);setGPSError('');setNow(Date.now());
      },
      onHeading:value=>{if(current()){headingRef.current=smoothHeading(headingRef.current,value);setHeading({value:headingRef.current,time:Date.now()});}},
      onStream:stream=>{if(!current()){stream.getTracks().forEach(t=>t.stop());return;}setMedia(stream);},
      onError:(kind,message)=>{
        if(!current())return;
        if(kind==='camera')setCameraError('카메라를 사용할 수 없어요. 브라우저의 카메라 권한을 확인해주세요.');
        else if(kind==='location'){setGPSError(message);evidence.current={...evidence.current,near:{},reliable:false};setDiscovery(evidence.current);}
        else setDirectionError('방향 센서를 사용할 수 없어 가까운 메모를 거리순으로 보여줘요.');
      }
    });
    sensor.current=next;
    void next.ready.finally(()=>{if(current())setBusy(false);});
  }

  const compass=heading&&!directionError&&now-heading.time<=12000?heading.value:null;
  const result=discoverARSpots(discovery,spots,compass,now);
  const nearby=result.nearby,visible=result.visible,nearest=nearby[0];
  const focused=visible.find(s=>s.spot.id===selectedId)||visible[0];
  const focusIndex=focused?visible.findIndex(s=>s.spot.id===focused.spot.id):0;
  const found=result.interactive.length>0;
  const canShowMemory=!!media&&!cameraError&&!gpsError&&result.reliable&&!!focused;
  const goodLocation=result.reliable&&!gpsError;
  function cycle(delta:number){const next=visible[(focusIndex+delta+visible.length)%visible.length];if(next){setSelectedId(next.spot.id);setCollapsed(false);}}
  let hint='아직 이 근처에 숨겨진 메모가 없다옹. 다른 골목도 기웃해볼까?';
  if(gpsError)hint=gpsError;
  else if(!discovery.fix)hint='현재 위치를 찾고 있다옹. 잠시만 기다려줘!';
  else if(!result.reliable)hint='위치가 정확하지 않다옹. 탁 트인 곳에서 잠깐 기다려줘.';
  else if(found)hint=visible.length?'이곳에 남겨진 이야기를 만나보라옹.':'바로 근처에 메모가 있다옹. 휴대폰을 천천히 돌려봐!';
  else if(nearest&&nearest.distance<=AR_INTERACTION_RADIUS)hint=discovery.fix.accuracy>20?'가까이 왔다옹! 위치가 더 정확해지면 메모를 열어줄게.':'거의 찾았다옹! 잠깐 멈춰서 위치를 확인해줘.';
  else if(nearest)hint=nearest.distance<=50?'조금만 더 가까이! 20m 안에 들어오면 메모가 보인다옹.':'이 근처 담벼락 뒤에 숨겨둔 메시지가 있다옹.';

  return <section className={'ar-view ar-discovery '+(active?'is-active':'')} aria-label="AR 골목 탐험">
    {active&&<video ref={video} muted playsInline autoPlay className="ar-camera" onPlaying={()=>{if(!introShown.current){introShown.current=true;setIntro('visible');}}}/>}
    <div className="ar-shade"/>
    {!active?<>
      <div className="ar-paused"><ScanLine size={32}/><h1>탐험 카메라가 쉬고 있어요.</h1><p>다시 연결하면 가까운 이야기를 찾을 수 있어요.</p><button type="button" className="lime-button" onClick={start}><Camera size={19}/>카메라 다시 연결</button><button type="button" className="text-button" onClick={onBrowse}>지도로 돌아가기</button></div>
    </>:<>
      <div className="discovery-statusbar"><span className="discovery-phase" role="status"><Radio size={16}/>{AR_RADAR_RADIUS}m 안 {nearby.length}개의 메모</span></div>
      {intro!=='hidden'&&<div className={'ar-entry-hint '+(intro==='fading'?'is-fading':'')} role="status"><span className="ar-entry-icon"><ScanLine size={22}/></span><p>카메라를 천천히 돌려서<br/>누군가 기웃거린 흔적을 찾아보세요.</p></div>}
      <div className="ar-note-stage">
        {busy&&!media?<div className="discovery-camera-state" role="status"><LoaderCircle size={27} className="spin"/>카메라를 연결하는 중…</div>:cameraError?<div className="discovery-camera-state" role="alert"><Camera size={28}/><p>{cameraError}</p><button type="button" className="ar-glass" onClick={start}><RotateCcw size={17}/>다시 연결</button></div>:canShowMemory&&!collapsed?<div className="ar-note-position" style={{'--note-drift':(compass===null?0:Math.max(-12,Math.min(12,focused.angle*.25)))+'px'} as CSSProperties}>
          <ARMemoryCard key={focused.spot.id} spot={focused.spot} distance={focused.distance} onOpen={()=>onSelect(focused.spot)} onDismiss={()=>setCollapsed(true)}/>
        </div>:null}
      </div>
      {canShowMemory&&<div className="discovery-memory-switcher">{collapsed?<button type="button" className="ar-glass" onClick={()=>setCollapsed(false)}><ScanLine size={17}/>메모 다시 보기</button>:visible.length>1?<><button type="button" aria-label="이전 AR 메모" onClick={()=>cycle(-1)}><ChevronLeft size={20}/></button><span>{focusIndex+1} / {visible.length}개의 메모</span><button type="button" aria-label="다음 AR 메모" onClick={()=>cycle(1)}><ChevronRight size={20}/></button></>:null}</div>}
      <footer className="discovery-footer">
        <div className="discovery-radar" role="status"><div className="discovery-cat"><Giuti pose={found?'happy':'curious'} animated label="골목대장 기웃이"/></div><div><p>{hint}</p>{goodLocation&&nearest&&<small>가장 가까운 메모 · 약 {Math.round(nearest.distance)}m</small>}</div></div>
        {directionError&&<p className="discovery-sensor-note">{directionError}</p>}
        <button type="button" className="lime-button" disabled={!goodLocation||!discovery.fix||discovery.fix.accuracy>20} onClick={()=>discovery.fix&&onCreate(discovery.fix)}><Plus size={20}/>여기에 AR 기록 남기기</button>
        {gpsError&&<button type="button" className="ar-glass" onClick={start}><RotateCcw size={16}/>위치 다시 확인</button>}
      </footer>
    </>}
  </section>;
}
