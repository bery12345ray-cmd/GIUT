'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {gsap} from 'gsap';
import {useQuery} from '@tanstack/react-query';
import {PawPrint,Camera,Map,MapPin,ArrowUpRight,ChevronLeft,ArrowRight,Navigation,Pause,Play,RotateCcw,Check,ScanLine,LoaderCircle,LocateFixed,Clock,X} from 'lucide-react';
import {Dialog,DialogViewportContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import RouteMap from '@/components/route-map';
import Giuti from '@/components/giuti';
import {apiRequest} from '@/lib/api-client';
import {type Spot,formatDistance} from '@/lib/model';
import {durationText,type WalkingRoute} from '@/lib/walking-route';
import {destinationProgress,freshEvidence,usableFix,routeProgress,updateEvidence,smoothHeading,angleDelta,type LocationFix} from '@/lib/navigation';
import {beginNavigationSensors} from '@/lib/navigation-sensors';

export type FollowTarget={spots:Spot[];title:string;mode:'walk'|'run'};
type Phase='preview'|'navigating'|'paused'|'arrived'|'complete';
type Progress=ReturnType<typeof routeProgress>;

function WhitePawTrail({angle}:{angle:number}){
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!root.current)return;const mm=gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)',()=>{const feet=root.current!.querySelectorAll('.guide-paw');gsap.timeline({repeat:-1,repeatDelay:.35}).fromTo(feet,{autoAlpha:0,scale:.68},{autoAlpha:.62,scale:1,duration:.32,stagger:.19,ease:'power2.out'}).to(feet,{autoAlpha:0,duration:.6,stagger:.12},'>-.15');});
  mm.add('(prefers-reduced-motion: reduce)',()=>{gsap.set(root.current!.querySelectorAll('.guide-paw'),{autoAlpha:.55});});return()=>mm.revert();
 },[]);
 useEffect(()=>{if(root.current)gsap.to(root.current,{x:Math.max(-100,Math.min(100,angle*1.2)),rotation:angle*.45,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:.5,ease:'power2.out',overwrite:true});return()=>{if(root.current)gsap.killTweensOf(root.current);};},[angle]);
 return <div className="white-paw-trail" ref={root} aria-hidden="true">{Array.from({length:8},(_,i)=><span className="guide-paw" key={i} style={{bottom:18+i*30,left:`calc(50% + ${i%2?15:-28}px)`,width:Math.max(23,53-i*4),height:Math.max(23,53-i*4)}}><PawPrint fill="currentColor" strokeWidth={0} style={{transform:i%2?'scaleX(-1)':'none'}}/></span>)}</div>;
}

export default function FollowGuide({target,kakaoKey,onClose,onOpen}:{target:FollowTarget;kakaoKey:string;onClose:()=>void;onOpen:(s:Spot)=>void}){
 const [phase,setPhase]=useState<Phase>('preview'),[view,setView]=useState<'map'|'camera'>('map');
 const [route,setRoute]=useState<WalkingRoute|null>(null),[fix,setFix]=useState<LocationFix|null>(null),[waypoint,setWaypoint]=useState(0),[base,setBase]=useState(0);
 const [notice,setNotice]=useState(''),[gpsError,setGPSError]=useState('');
 const routeAttempted=useRef(false);
 const [heading,setHeading]=useState<{value:number;time:number}|null>(null),[progress,setProgress]=useState<Progress|null>(null),[offRoute,setOffRoute]=useState(false),[now,setNow]=useState(Date.now());
 const [media,setMedia]=useState<MediaStream|null>(null),[cameraBusy,setCameraBusy]=useState(false);
 const video=useRef<HTMLVideoElement>(null),session=useRef<ReturnType<typeof beginNavigationSensors>|null>(null),abort=useRef<AbortController|null>(null),generation=useRef(0),mounted=useRef(true);
 const evidence=useRef(freshEvidence()),segment=useRef<number|undefined>(undefined),headingValue=useRef<number|null>(null);
 const state=useRef({phase,route,waypoint,base});state.current={phase,route,waypoint,base};
 const current=target.spots[waypoint],leg=route?.legs[waypoint-base];
 const memoryQuery=useQuery<{spot:Spot}>({queryKey:['arrival-memory',current.id],queryFn:({signal})=>apiRequest('/api/spotmap?spot='+encodeURIComponent(current.id),undefined,signal),enabled:phase==='arrived',staleTime:0});
 const memory=memoryQuery.data?.spot;
 const goodGPS=usableFix(fix,now)&&!gpsError;
 const goodHeading=heading!==null&&now-heading.time<12000;
 const delta=progress&&heading?angleDelta(progress.bearing,heading.value):0;
 const showPaws=phase==='navigating'&&view==='camera'&&!!media&&goodGPS&&goodHeading&&!offRoute&&!!progress&&progress.offset<=Math.max(35,(fix?.accuracy||0)*1.5)&&Math.abs(delta)<85;
 const remainder=route&&leg&&progress?progress.remaining+route.legs.slice(waypoint-base+1).reduce((sum,l)=>sum+l.distance,0):route?.distance||0;
 const remainingStops=useMemo(()=>target.spots.slice(base),[target.spots,base]);
 const stop=useCallback(()=>{generation.current++;session.current?.stop();session.current=null;setMedia(null);setCameraBusy(false);},[]);
 const pause=useCallback((message='잠시 쉬어가는 중이에요.')=>{stop();setPhase('paused');setNotice(message);evidence.current=freshEvidence();},[stop]);
 useEffect(()=>{
  mounted.current=true;const hidden=()=>{if(document.hidden&&state.current.phase==='navigating')pause('화면을 벗어나 안내를 일시정지했어요.');};document.addEventListener('visibilitychange',hidden);
  return()=>{mounted.current=false;generation.current++;abort.current?.abort();session.current?.stop();document.removeEventListener('visibilitychange',hidden);};
 },[pause]);
 useEffect(()=>{if(phase!=='navigating')return;const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[phase]);
 useEffect(()=>{if(video.current&&media){video.current.srcObject=media;video.current.play().catch(()=>{setNotice('카메라 재생을 시작하지 못했어요. 지도 보기로 전환해주세요.');});}},[media,view]);
 const onFix=useCallback((candidate:LocationFix)=>{
  if(!mounted.current)return;setNow(Date.now());
  const s=state.current,l=s.route?.legs[s.waypoint-s.base];
  if(s.phase!=='navigating')return;
  if(!usableFix(candidate)){setFix(candidate);setGPSError('위치 오차가 커요. 정확한 위치를 다시 확인하고 있어요.');evidence.current=freshEvidence();return;}
  const p=l?routeProgress(candidate,l,segment.current):destinationProgress(candidate,target.spots[s.waypoint]);const result=updateEvidence(evidence.current,candidate,target.spots[s.waypoint],p.offset);evidence.current=result.evidence;
  if(!result.accepted){setGPSError('위치가 크게 달라져 다시 확인하고 있어요.');return;}
  setFix(candidate);setGPSError('');segment.current=p.index;setProgress(p);setOffRoute(result.offRoute);
  if(result.arrived){stop();setPhase('arrived');setOffRoute(false);setNotice('기웃이의 발자국이 여기에서 멈췄어요.');}
 },[target.spots,stop]);

 // Route enrichment is optional: camera and direction guidance never wait for it.
 useEffect(()=>{
  if(phase!=='navigating'||!goodGPS||!fix||routeAttempted.current)return;
  routeAttempted.current=true;const controller=new AbortController();abort.current=controller;
  const from=waypoint;
  apiRequest<{route:WalkingRoute}>('/api/walking-route',{origin:{lat:fix.lat,lng:fix.lng},spotIds:target.spots.slice(from).map(s=>s.id)},controller.signal).then(response=>{
   if(!mounted.current||controller.signal.aborted)return;
   segment.current=undefined;setBase(from);setRoute(response.route);
  }).catch(()=>{/* Destination-bearing guidance remains available without a routing provider. */});
 },[phase,goodGPS,fix,waypoint,target.spots]);
 function findRoute(){abort.current?.abort();routeAttempted.current=false;setRoute(null);state.current.route=null;setProgress(null);segment.current=undefined;start('camera');}
 function start(mode:'map'|'camera'){
  stop();const id=++generation.current;setPhase('navigating');state.current={...state.current,phase:'navigating'};setView(mode);setNotice('');setGPSError('');setOffRoute(false);setHeading(null);headingValue.current=null;setNow(Date.now());setCameraBusy(mode==='camera');evidence.current=freshEvidence();
  let cameraFallback=false;
  const next=beginNavigationSensors({camera:mode==='camera',onFix,onHeading:value=>{if(!mounted.current||id!==generation.current)return;headingValue.current=smoothHeading(headingValue.current,value);setHeading({value:headingValue.current,time:Date.now()});},onStream:stream=>{if(!mounted.current||id!==generation.current){stream.getTracks().forEach(t=>t.stop());return;}setMedia(stream);setCameraBusy(false);},onError:(kind,message)=>{if(!mounted.current||id!==generation.current)return;setNotice(message);if(kind==='location'){setGPSError(message);setProgress(null);}if(kind==='camera'){cameraFallback=true;session.current?.stopCamera();setMedia(null);setCameraBusy(false);}}});
  session.current=next;if(cameraFallback)next.stopCamera();next.ready.finally(()=>{if(mounted.current&&id===generation.current)setCameraBusy(false);});
 }
 function mapView(){session.current?.stopCamera();setMedia(null);setView('map');setCameraBusy(false);}
 function nextStop(){if(waypoint===target.spots.length-1){setPhase('complete');stop();return;}abort.current?.abort();routeAttempted.current=false;setRoute(null);setWaypoint(v=>v+1);setPhase('paused');setProgress(null);segment.current=undefined;evidence.current=freshEvidence();setNotice('다음 장소로 이동할 준비가 됐어요.');setView('map');}
 function close(){abort.current?.abort();stop();onClose();}
 const visibleMessage=offRoute?'경로에서 벗어났어요. 현재 위치에서 다시 찾아볼까요?':gpsError||(!goodGPS&&phase==='navigating'?'현재 위치를 다시 확인하고 있어요.':notice);
 return <Dialog open onOpenChange={o=>{if(!o)close();}}><DialogViewportContent className={'follow-guide '+(view==='camera'?'camera-mode':'')}>
  <DialogHeader className="sr-only"><DialogTitle>같이 기웃거리기 · {target.title}</DialogTitle><DialogDescription>저장한 장소까지 GPS 기반 도보 방향 안내</DialogDescription></DialogHeader>
  <header className="follow-header"><button className="icon-button" aria-label="길안내 종료" onClick={close}><ChevronLeft size={22}/></button><div><small>{target.spots.length>1?'코스 따라가기':'스팟 따라가기'}</small><strong>같이 기웃거리기</strong></div><button className="icon-button" aria-label="닫기" onClick={close}><X size={20}/></button></header>
  <div className="follow-body">
   {phase==='complete'?<div className="follow-complete"><Giuti pose="happy" animated/><p className="eyebrow">A LITTLE ADVENTURE, COMPLETE</p><h2>오늘도 잘 기웃거렸어요!</h2><p>{target.spots.length}곳의 이야기를 만났어요.</p><button className="primary-button" onClick={close}>지도 돌아가기 <ArrowRight size={17}/></button></div>:<>
    {phase==='arrived'?<div className="arrival-panel"><Giuti pose="happy" animated/><span className="arrival-label"><Check size={16}/>목적지 가까이에 도착했어요</span><h2>{current.title}</h2><p>{current.ar?'이곳에 남겨진 AR 기록을 열어보세요.':'이 장소에 남겨진 이야기를 만나보세요.'}</p>{memoryQuery.isPending?<p role="status">이 장소의 기록을 불러오는 중…</p>:memoryQuery.isError?<div className="follow-error" role="alert"><p>{memoryQuery.error.message}</p><button className="text-button" onClick={()=>memoryQuery.refetch()}>기록 다시 불러오기</button></div>:memory&&<button className="arrival-memory" onClick={()=>onOpen(memory)}>{memory.image&&<img src={memory.image} alt=""/>}<span><small>{memory.ar?'AR 사진·메모':'장소 기록'} · {memory.nickname}</small><small>{new Date(memory.createdAt).toLocaleString('ko-KR')}</small><strong>{memory.title}</strong><p>{memory.body.slice(0,80)}</p><span>사진·이야기·댓글 보기 <ArrowUpRight size={15}/></span></span></button>}<button className="primary-button" onClick={nextStop}>{waypoint===target.spots.length-1?'탐험 마치기':'다음 경유지로 이동'}<ArrowRight size={18}/></button><small className="arrival-accuracy">GPS 위치를 기준으로 확인했어요.</small></div>:<>
     <div className="follow-surface">
      {view==='camera'&&phase==='navigating'?<div className="follow-camera"><video ref={video} autoPlay muted playsInline/>{showPaws&&<WhitePawTrail angle={delta}/>}<div className="camera-nav-label"><PawPrint size={14}/>{route?'도보 경로':'목적지 방향'} · 고양이 발자국</div>{cameraBusy?<div className="camera-state"><LoaderCircle className="spin" size={25}/><p>카메라를 연결하는 중…</p></div>:!showPaws&&<div className="camera-state"><Navigation size={26} style={{transform:`rotate(${delta}deg)`}}/><p>{!media?'카메라 권한을 확인하고 다시 시작해주세요.':!goodGPS?'정확한 위치를 확인하고 있어요.':!goodHeading?'휴대폰을 천천히 돌려 방향을 확인해주세요.':offRoute?'경로를 다시 확인해주세요.':Math.abs(delta)>=85?'발자국 방향으로 천천히 돌아보세요.':'도보 경로에 가까이 이동해주세요.'}</p></div>}</div>:<RouteMap spots={remainingStops} route={route} origin={fix} kakaoKey={kakaoKey}/>}
      {phase==='paused'&&<div className="follow-paused"><Pause size={18}/>잠시 멈춤</div>}
     </div>
     <div className="follow-content"><div className="follow-destination"><span className="destination-icon"><PawPrint size={21}/></span><div><small>{target.spots.length>1?`${waypoint+1} / ${target.spots.length}번째 장소`:'함께 찾아갈 장소'}</small><h2>{current.title}</h2></div>{current.image&&<img src={current.image} alt=""/>}</div>
      {route&&<div className="follow-metrics"><span><RouteMetricIcon/>{formatDistance(phase==='navigating'?remainder:route.legs.slice(waypoint-base).reduce((sum,l)=>sum+l.distance,0))}<small>남은 거리</small></span><span><Clock size={16}/>약 {durationText(phase==='navigating'&&leg?Math.max(0,leg.duration*(progress?progress.remaining/leg.distance:1)+route.legs.slice(waypoint-base+1).reduce((sum,l)=>sum+l.duration,0)):route.legs.slice(waypoint-base).reduce((sum,l)=>sum+l.duration,0))}<small>도보 기준</small></span>{fix&&<small>GPS ±{Math.round(fix.accuracy)}m</small>}</div>}
      {phase==='preview'&&<ol className="follow-itinerary"><li><span className="origin-number"/><span>현재 위치</span></li>{target.spots.slice(waypoint).map((s,i)=><li key={s.id}><span className="stop-number">{waypoint+i+1}</span><button onClick={()=>onOpen(s)}>{s.title}{!!s.ar&&<ScanLine size={14}/>}</button></li>)}</ol>}
      {phase==='navigating'&&progress&&goodGPS&&!offRoute&&<p className="follow-instruction"><Navigation size={18}/>{progress.instruction}</p>}
      {visibleMessage&&<div className={'follow-notice '+(offRoute||gpsError?'problem':'')} role="status">{visibleMessage}{offRoute&&<button onClick={findRoute}>경로 다시 찾기 <RotateCcw size={14}/></button>}</div>}
      {!route&&fix&&progress&&<div className="follow-metrics"><span><MapPin size={16}/>{formatDistance(progress.remaining)}<small>목적지까지 직선거리</small></span></div>}
      {(phase==='preview'||phase==='paused')&&<div className="follow-start-actions"><button className="primary-button" onClick={()=>start('camera')}><PawPrint size={20}/>{phase==='paused'?'이어서 발자국 따라가기':'현재 위치에서 발자국 따라가기'}</button></div>}
      {phase==='navigating'&&<div className="follow-active-actions"><button className="outline-button" onClick={()=>view==='map'?start('camera'):mapView()}>{view==='map'?<Camera size={18}/>:<Map size={18}/>} {view==='map'?'발자국 보기':'지도 보기'}</button><button className="outline-button" onClick={()=>start('camera')}><RotateCcw size={18}/>다시 연결</button><button className="outline-button" onClick={()=>pause()}><Pause size={18}/>일시정지</button><button className="outline-button" onClick={close}>종료</button></div>}
      <p className="follow-caption">{route?'도보 경로의 방향을 안내해요.':'목적지 방향 안내예요. 도로의 굴곡이나 장애물은 반영하지 않아요.'} 발자국은 실제 바닥에 고정되지 않아요. 주변 길과 횡단보도를 확인해주세요.</p>
     </div>
    </>}
   </>}
  </div>
 </DialogViewportContent></Dialog>;
}
function RouteMetricIcon(){return <MapPin size={16}/>;}
