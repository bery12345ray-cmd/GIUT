'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Plus,ChevronUp,ChevronDown,Route,LoaderCircle,X,MapPin,ArrowUpRight} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Checkbox} from '@/components/ui/checkbox';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {toast} from 'sonner';
import RouteMap from './route-map';
import {useCollectionActions} from '@/hooks/use-collections';
import {apiRequest} from '@/lib/api-client';
import {MAX_COURSE_STOPS,type Course} from '@/lib/collections';
import {durationText,walkingURL,type WalkingRoute} from '@/lib/walking-route';
import {formatDistance,type Spot} from '@/lib/model';

export default function CourseEditor({initial,spots,kakaoKey,onClose,onSaved}:{initial:{course?:Course;ids:string[]};spots:Spot[];kakaoKey:string;onClose:()=>void;onSaved:(id:string)=>void}){
 const [title,setTitle]=useState(initial.course?.title||''),[description,setDescription]=useState(initial.course?.description||'');
 const [ids,setIds]=useState(initial.ids.slice(0,MAX_COURSE_STOPS)),[adding,setAdding]=useState(!initial.ids.length),[filter,setFilter]=useState('');
 const [route,setRoute]=useState<WalkingRoute|null>(null),[routeError,setRouteError]=useState(''),[routing,setRouting]=useState(false);
 const mutation=useCollectionActions(),abort=useRef<AbortController|null>(null);
 const selected=useMemo(()=>ids.map(id=>spots.find(s=>s.id===id)).filter((s):s is Spot=>!!s),[ids,spots]);
 const available=spots.filter(s=>(s.saved||s.userId===initial.course?.userId||ids.includes(s.id))&&(!filter||`${s.title} ${s.location}`.includes(filter)));
 useEffect(()=>{abort.current?.abort();setRoute(null);setRouteError('');setRouting(false);return()=>abort.current?.abort();},[ids]);
 function move(index:number,by:number){const copy=[...ids];[copy[index],copy[index+by]]=[copy[index+by],copy[index]];setIds(copy);}
 async function preview(){const controller=new AbortController();abort.current?.abort();abort.current=controller;setRouting(true);setRouteError('');try{const result=await apiRequest<{route:WalkingRoute}>('/api/walking-route',{spotIds:ids},controller.signal);setRoute(result.route);}catch(e){if(!controller.signal.aborted)setRouteError((e as Error).message);}finally{if(!controller.signal.aborted)setRouting(false);}}
 return <Dialog open onOpenChange={o=>{if(!o)onClose();}}><DialogContent className="app-dialog course-editor"><DialogHeader><p className="eyebrow">MAKE YOUR LITTLE ROUTE</p><DialogTitle>{initial.course?'코스 수정하기':'나만의 한 바퀴 만들기'}</DialogTitle><DialogDescription>장소를 고르고 방문할 순서를 정해주세요. 최대 6곳까지 연결할 수 있어요.</DialogDescription></DialogHeader>
  <form onSubmit={async e=>{e.preventDefault();try{const result=await mutation.mutateAsync({op:initial.course?'course-update':'course-create',id:initial.course?.id,title,description,mode:initial.course?.mode||'walk',spotIds:ids});toast.success(initial.course?'코스를 수정했어요.':'새 코스를 등록했어요.');onSaved(result.id!);}catch{}}}>
   <label className="form-label">코스 이름<Input required value={title} maxLength={60} onChange={e=>setTitle(e.target.value)} placeholder="예: 노을 따라 걷는 동네 한 바퀴"/></label>
   <label className="form-label">코스 이야기<Textarea value={description} maxLength={500} onChange={e=>setDescription(e.target.value)} placeholder="이 길에서 쉬어갈 곳, 달리기 좋은 시간…"/></label>
   <div className="section-title"><h3>방문 순서 <span>{selected.length} / 6</span></h3><button type="button" className="text-button" onClick={()=>setAdding(!adding)}><Plus size={16}/>장소 고르기</button></div>
   {initial.ids.length>6&&<p className="form-note">처음 6곳이 선택됐어요. 원하는 장소로 바꿔주세요.</p>}
   <div className="course-stop-list">{selected.map((s,i)=><div className="course-stop-row" key={s.id}><span className="stop-number">{i+1}</span>{s.image&&<img src={s.image} alt=""/>}<span><strong>{s.title}</strong><small>{s.location}</small></span><div className="order-buttons"><button type="button" aria-label={s.title+' 위로 이동'} disabled={!i} onClick={()=>move(i,-1)}><ChevronUp size={16}/></button><button type="button" aria-label={s.title+' 아래로 이동'} disabled={i===selected.length-1} onClick={()=>move(i,1)}><ChevronDown size={16}/></button></div><button type="button" className="icon-button" aria-label={s.title+' 코스에서 빼기'} onClick={()=>setIds(ids.filter(id=>id!==s.id))}><X size={15}/></button></div>)}</div>
   {adding&&<div className="course-place-picker"><Input aria-label="저장한 장소 검색" placeholder="저장한 장소 검색" value={filter} onChange={e=>setFilter(e.target.value)}/>{available.length?available.map(s=><label key={s.id}><Checkbox checked={ids.includes(s.id)} disabled={!ids.includes(s.id)&&ids.length>=6} onCheckedChange={checked=>setIds(current=>checked===true?[...current,s.id]:current.filter(id=>id!==s.id))}/><span>{s.title}<small>{s.location}</small></span></label>):<p>먼저 지도에서 마음에 드는 장소를 저장해주세요.</p>}</div>}
   {selected.length>=2&&<><RouteMap spots={selected} route={route} kakaoKey={kakaoKey}/><div className="course-route-summary">{route?<span><Route size={16}/>{formatDistance(route.distance)} · 약 {durationText(route.duration)} <small>도보 기준</small></span>:<span>경로 조회 전에는 방문 순서만 저장돼요.</span>}<button type="button" className="text-button" disabled={routing} onClick={preview}>{routing?<LoaderCircle className="spin" size={16}/>:<MapPin size={16}/>}경로 확인</button></div>{routeError&&<div className="route-inline-error"><p>{routeError}</p><a href={walkingURL(undefined,selected)} target="_blank" rel="noreferrer">카카오맵 길찾기 <ArrowUpRight size={14}/></a></div>}</>}
   <p className="form-note">등록한 코스의 이름·이야기·방문 순서는 누구나 볼 수 있어요. 내 저장 폴더는 나만 볼 수 있어요.</p>
   <button className="primary-button" disabled={!title.trim()||selected.length<2||selected.length!==ids.length||mutation.isPending}>{mutation.isPending?<LoaderCircle className="spin" size={18}/>:<Route size={18}/>} {initial.course?'변경 저장하기':'코스 등록하기'}</button>
  </form>
 </DialogContent></Dialog>;
}
