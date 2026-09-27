import {z} from 'zod';
import {distance,type Point} from '@/lib/model';

export type WalkingStep={instruction:string;startIndex:number;distance:number};
export type WalkingLeg={path:Point[];distance:number;duration:number;steps:WalkingStep[]};
export type WalkingRoute={legs:WalkingLeg[];distance:number;duration:number;provider:'kakao';fetchedAt:string};
const pair=z.tuple([z.number().min(-180).max(180),z.number().min(-90).max(90)]);
const step=z.object({properties:z.object({distance:z.number().nonnegative(),guidance:z.string(),time:z.number().nonnegative()}),path:z.object({points:z.array(pair).min(1).max(20000)})});
const payload=z.object({status:z.literal('OK'),route:z.object({properties:z.object({totalDistance:z.number().nonnegative(),totalTime:z.number().nonnegative()}),legs:z.array(z.object({properties:z.object({distance:z.number().nonnegative(),time:z.number().nonnegative()}),steps:z.array(step).min(1).max(2000)})).min(1).max(6)})});

// Contract: https://developers.kakao.com/docs/ko/kakaomap/rest-api#route-walk
export function parseWalkingRoute(raw:unknown,expectedLegs:number):WalkingRoute{
 const result=payload.safeParse(raw);if(!result.success)throw new Error('INVALID_ROUTE_RESPONSE');
 if(result.data.route.legs.length!==expectedLegs)throw new Error('INCOMPLETE_ROUTE');
 const legs=result.data.route.legs.map(l=>{
  const path:Point[]=[],steps:WalkingStep[]=[];
  for(const s of l.steps){
   const points=s.path.points.map(([lng,lat])=>({lat,lng}));
   if(path.length&&distance(path[path.length-1],points[0])>30)throw new Error('DISCONTINUOUS_ROUTE');
   const startIndex=Math.max(0,path.length-1);
   for(const p of points)if(!path.length||distance(path[path.length-1],p)>.05)path.push(p);
   steps.push({instruction:s.properties.guidance,startIndex,distance:s.properties.distance});
  }
  if(path.length<2||l.properties.distance<=0)throw new Error('EMPTY_ROUTE');
  return {path,steps,distance:l.properties.distance,duration:l.properties.time};
 });
 if(result.data.route.properties.totalDistance<=0)throw new Error('EMPTY_ROUTE');
 return {legs,distance:result.data.route.properties.totalDistance,duration:result.data.route.properties.totalTime,provider:'kakao',fetchedAt:new Date().toISOString()};
}

export function walkingURL(origin:Point|undefined,stops:(Point&{title:string})[]){
 const points=[...(origin?[{...origin,title:'현재 위치'}]:[]),...stops];
 if(points.length<2)return stops[0]?`https://map.kakao.com/link/to/${encodeURIComponent(stops[0].title)},${stops[0].lat},${stops[0].lng}`:'https://map.kakao.com/';
 return 'https://map.kakao.com/link/by/walk/'+points.map(p=>`${encodeURIComponent(p.title)},${p.lat},${p.lng}`).join('/');
}
export function durationText(seconds:number){const minutes=Math.max(1,Math.round(seconds/60));return minutes>=60?`${Math.floor(minutes/60)}시간 ${minutes%60}분`:`${minutes}분`;}
