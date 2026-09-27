'use client';
import {Footprints,Check,LoaderCircle,Plus,ArrowUpRight,MessageCircle,Bell} from 'lucide-react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {apiRequest} from '@/lib/api-client';
import type {DiscoveryNotice} from '@/lib/discoveries';
import type {Spot} from '@/lib/model';
import Giuti from './giuti';

export type PlaceStory=Pick<Spot,'id'|'title'|'body'|'image'|'createdAt'|'nickname'|'example'>;
const when=(v:string)=>new Intl.DateTimeFormat('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'}).format(new Date(v));

export function DiscoveryButton({spot,userId,onLogin}:{spot:Spot;userId?:string;onLogin:()=>void}) {
  const client=useQueryClient();
  const mutation=useMutation({mutationFn:async()=>{
    const p=await new Promise<GeolocationPosition>((resolve,reject)=>{
      if(!navigator.geolocation){reject(new Error('이 기기에서는 현재 위치를 확인할 수 없어요.'));return;}
      navigator.geolocation.getCurrentPosition(resolve,e=>reject(new Error(e.code===1?'위치 권한을 허용해야 현장 발견을 남길 수 있어요.':'위치를 찾지 못했어요. 탁 트인 곳에서 다시 시도해주세요.')),{enableHighAccuracy:true,timeout:15000,maximumAge:0});
    });
    return apiRequest<{created:boolean}>('/api/spotmap',{op:'discover',spotId:spot.id,lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp});
  },onSuccess:async result=>{
    await Promise.all(['spotmap','comments','me','activity'].map(key=>client.invalidateQueries({queryKey:[key]})));
    toast.success(result.created?'발견한 마음을 전했어요!':'이미 발견한 기록이에요.',{description:result.created?'작성자의 골목 소식에 알림이 남았어요.':undefined});
  },onError:e=>toast.error(e.message)});
  if(spot.example)return <p className="discovery-demo-note">체험용 기록이에요. 실제 이용자의 기록에서 발견 반응을 남겨보세요.</p>;
  if(spot.userId===userId)return spot.discoveries?<div className="discovery-received"><Footprints size={20}/><span>{spot.discoveries}명이 이 기록을 발견했어요.</span></div>:null;
  return <section className={'place-discovery '+(spot.discovered?'is-discovered':'')}>
    <div><Footprints size={22}/><span><strong>이 기록을 보고 찾아왔나요?</strong><small>{spot.discoveries?`${spot.discoveries}명이 발견한 기록`:'작성자에게 발견한 마음을 전해보세요.'}</small></span></div>
    <button disabled={!!spot.discovered||mutation.isPending} onClick={()=>userId?mutation.mutate():onLogin()}>{mutation.isPending?<LoaderCircle size={17} className="spin"/>:spot.discovered?<Check size={17}/>:<Footprints size={17}/>} {mutation.isPending?'현재 위치 확인 중…':spot.discovered?'발견을 남겼어요':'발견했어요'}</button>
    <p>위치 오차를 포함해 100m 안에서 한 번만 남겨요. 확인에 쓴 내 좌표는 저장하거나 작성자에게 보여주지 않아요.</p>
  </section>;
}

export function PlaceStories({spot,stories,loading,error,onRetry,onOpen,onWrite}:{spot:Spot;stories:PlaceStory[];loading:boolean;error:boolean;onRetry:()=>void;onOpen:(id:string)=>void;onWrite:()=>void}) {
  if(spot.example)return null;
  return <section className="place-stories"><div className="section-title"><h3>이 장소에 쌓인 이야기</h3><span>최근 기록부터</span></div>
    <p className="stories-description">같은 자리에서 만난 다른 순간들. 이 장소에 이어 남긴 기록을 모았어요.</p>
    {loading?<p role="status">이야기를 불러오는 중…</p>:error?<button className="text-button" onClick={onRetry}>이야기 다시 불러오기</button>:<div className="story-timeline">{stories.map(s=><button key={s.id} className={s.id===spot.id?'current-story':''} aria-current={s.id===spot.id?'true':undefined} onClick={()=>onOpen(s.id)}>{s.image?<img src={s.image} alt=""/>:<span className="story-image-placeholder"><MessageCircle size={20}/></span>}<span><small>{when(s.createdAt)} 등록 · {s.nickname}</small><strong>{s.title}</strong>{s.id===spot.id&&<em>지금 보는 기록</em>}</span><ArrowUpRight size={16}/></button>)}</div>}
    <button className="outline-button" onClick={onWrite}><Plus size={17}/>이 장소에 사진·이야기 이어 남기기</button>
  </section>;
}

export function useDiscoveryActivity(userId?:string) {
  return useQuery<{notices:DiscoveryNotice[];unread:number}>({queryKey:['activity',userId||'guest'],queryFn:({signal})=>apiRequest('/api/activity',undefined,signal),enabled:!!userId,refetchInterval:30000});
}
export function ActivityList({userId,onOpen,onLogin}:{userId?:string;onOpen:(id:string)=>void;onLogin:()=>void}) {
  const activity=useDiscoveryActivity(userId),client=useQueryClient();
  const read=useMutation({mutationFn:(ids:string[])=>apiRequest('/api/activity',{ids}),onSuccess:()=>client.invalidateQueries({queryKey:['activity',userId]}),onError:e=>toast.error(e.message)});
  if(!userId)return <div className="empty-state"><Giuti pose="wave" className="empty-giuti"/><h3>내 기록에 도착한 소식</h3><p>로그인하면 누군가 발견한 내 기록을 확인할 수 있어요.</p><button className="primary-button" onClick={onLogin}>로그인하기</button></div>;
  if(activity.isPending)return <p role="status">골목 소식을 불러오는 중…</p>;
  if(activity.isError)return <div className="inline-error"><p>소식을 불러오지 못했어요.</p><button onClick={()=>activity.refetch()}>다시 시도</button></div>;
  const notices=activity.data?.notices||[];
  if(!notices.length)return <div className="empty-state"><Giuti pose="sleep" animated className="empty-giuti"/><h3>아직 조용한 골목이에요.</h3><p>누군가 내 기록을 보고 찾아오면<br/>여기에 발견 소식이 도착해요.</p></div>;
  return <div className="activity-feed">{!!activity.data?.unread&&<button className="text-button activity-read" disabled={read.isPending} onClick={()=>read.mutate(notices.filter(n=>!n.readAt).map(n=>n.id))}>보이는 알림 모두 읽음</button>}{notices.map(n=><button className={'activity-item '+(!n.readAt?'unread':'')} key={n.id} onClick={()=>{if(!n.readAt)read.mutate([n.id]);onOpen(n.spotId);}}><span className="activity-icon"><Footprints size={22}/></span><span><strong>누군가 당신의 기록을 발견했어요!</strong><p>{n.title}</p><small>{when(n.createdAt)}</small></span>{!n.readAt&&<Bell size={13} aria-label="읽지 않은 알림"/>}</button>)}</div>;
}
