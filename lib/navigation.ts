import {distance,bearing,type Point} from '@/lib/model';
import type {WalkingLeg} from '@/lib/walking-route';
export type LocationFix=Point&{accuracy:number;timestamp:number};
export type NavigationEvidence={lastFix:LocationFix|null;nearSince:number|null;nearCount:number;offSince:number|null;offCount:number};
export const freshEvidence=():NavigationEvidence=>({lastFix:null,nearSince:null,nearCount:0,offSince:null,offCount:0});
export function angleDelta(target:number,current:number){return ((target-current+540)%360)-180;}
export function smoothHeading(previous:number|null,next:number){return previous===null?next:(previous+angleDelta(next,previous)*.24+360)%360;}
export function usableFix(fix:LocationFix|null,now=Date.now()){return !!fix&&Number.isFinite(fix.lat)&&Number.isFinite(fix.lng)&&Number.isFinite(fix.accuracy)&&fix.accuracy>=0&&fix.accuracy<=40&&now-fix.timestamp<=12000&&now>=fix.timestamp-1000;}
export function acceptFix(previous:LocationFix|null,fix:LocationFix){
 if(!usableFix(fix,fix.timestamp))return false;
 if(!previous)return true;
 const seconds=(fix.timestamp-previous.timestamp)/1000;
 if(seconds<=0)return false;
 return seconds>30||distance(previous,fix)<=Math.max(45,seconds*7+Math.max(previous.accuracy,fix.accuracy));
}
function projection(point:Point,a:Point,b:Point){
 const ky=111195,kx=ky*Math.cos(point.lat*Math.PI/180),ax=(a.lng-point.lng)*kx,ay=(a.lat-point.lat)*ky,bx=(b.lng-point.lng)*kx,by=(b.lat-point.lat)*ky;
 const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));
 return {point:{lat:a.lat+(b.lat-a.lat)*t,lng:a.lng+(b.lng-a.lng)*t},t,offset:Math.hypot(ax+dx*t,ay+dy*t)};
}
export function routeProgress(fix:Point,leg:WalkingLeg,previousIndex?:number){
 const path=leg.path;let best={index:0,t:0,offset:Infinity,point:path[0]};
 const from=previousIndex===undefined?0:Math.max(0,previousIndex-5),to=previousIndex===undefined?path.length-1:Math.min(path.length-1,previousIndex+50);
 for(let i=from;i<to;i++){const p=projection(fix,path[i],path[i+1]);if(p.offset<best.offset)best={...p,index:i};}
 const lengths=path.slice(1).map((p,i)=>distance(path[i],p)),total=lengths.reduce((s,l)=>s+l,0);
 const traversed=lengths.slice(0,best.index).reduce((s,l)=>s+l,0)+(lengths[best.index]||0)*best.t;
 let look=14,target=path[path.length-1],cursor=best.point;
 for(let i=best.index+1;i<path.length;i++){const d=distance(cursor,path[i]);if(d>=look){const t=look/(d||1);target={lat:cursor.lat+(path[i].lat-cursor.lat)*t,lng:cursor.lng+(path[i].lng-cursor.lng)*t};break;}look-=d;cursor=path[i];}
 const step=[...leg.steps].reverse().find(s=>s.startIndex<=best.index)||leg.steps[0];
 return {index:best.index,offset:best.offset,remaining:leg.distance*(1-Math.min(1,traversed/(total||1))),target,bearing:bearing(fix,target),instruction:step?.instruction||'경로를 따라 이동해주세요.'};
}
export function updateEvidence(previous:NavigationEvidence,fix:LocationFix,destination:Point,offRouteDistance:number){
 if(!acceptFix(previous.lastFix,fix))return {evidence:{...previous,nearSince:null,nearCount:0,offSince:null,offCount:0},accepted:false,arrived:false,offRoute:false};
 const recent=previous.lastFix&&fix.timestamp-previous.lastFix.timestamp<12000;
 const near=fix.accuracy<=20&&distance(fix,destination)<=20;
 const off=fix.accuracy<=30&&offRouteDistance>Math.max(45,fix.accuracy*2);
 const evidence:NavigationEvidence={lastFix:fix,nearSince:near?(recent&&previous.nearSince!==null?previous.nearSince:fix.timestamp):null,nearCount:near?(recent?previous.nearCount:0)+1:0,offSince:off?(recent&&previous.offSince!==null?previous.offSince:fix.timestamp):null,offCount:off?(recent?previous.offCount:0)+1:0};
 return {evidence,accepted:true,arrived:near&&evidence.nearCount>=3&&fix.timestamp-evidence.nearSince!>=4000,offRoute:off&&evidence.offCount>=3&&fix.timestamp-evidence.offSince!>=4000};
}

/** Bearing-only fallback. Never represent this as a walkable street route. */
export function destinationProgress(fix:Point,destination:Point){
 return {index:0,offset:0,remaining:distance(fix,destination),target:destination,bearing:bearing(fix,destination),instruction:'발자국이 가리키는 목적지 방향을 확인해주세요.'};
}
