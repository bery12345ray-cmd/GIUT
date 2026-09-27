'use client';
import {useEffect,useRef,useMemo,useState} from 'react';
import {LocateFixed,MapPin} from 'lucide-react';
import MapCanvas,{type MapControl} from '@/components/map-canvas';
import {type Spot,type Point} from '@/lib/model';
import type {WalkingRoute} from '@/lib/walking-route';
const empty:Point[]=[];
export default function RouteMap({spots,route,origin,kakaoKey,onSelect}:{spots:Spot[];route?:WalkingRoute|null;origin?:Point|null;kakaoKey?:string;onSelect?:(s:Spot)=>void}){
 const map=useRef<MapControl|null>(null);const [provider,setProvider]=useState('loading');
 const path=useMemo(()=>route?.legs.flatMap(l=>l.path)||empty,[route]);
 const fitPoints=useMemo(()=>path.length?path:[...spots,...(origin?[origin]:[])],[path,spots]);
 const latestFit=useRef(fitPoints);latestFit.current=fitPoints;
 useEffect(()=>{map.current?.fit(fitPoints);},[fitPoints]);
 return <div className="route-map"><MapCanvas spots={spots} kakaoKey={kakaoKey} draftRoute={empty} navigationPath={path} currentLocation={origin||undefined} numbered onPick={()=>{}} onSelect={s=>onSelect?.(s)} onProvider={setProvider} onReady={c=>{map.current=c;c.fit(latestFit.current);}}/>
  {provider==='loading'&&<span className="route-map-loading"><MapPin size={17}/>지도를 불러오는 중…</span>}
  <button className="route-fit" aria-label="전체 경로 보기" onClick={()=>map.current?.fit(latestFit.current)}><LocateFixed size={19}/></button>
  {!path.length&&<span className="route-map-caption">방문할 장소 · 경로 조회 전</span>}
 </div>;
}
