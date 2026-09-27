import {z} from 'zod';
import {bindings,db,identity,checkOrigin,HttpError} from '@/lib/server';
import {parseWalkingRoute} from '@/lib/walking-route';
export const dynamic='force-dynamic';
const requestSchema=z.object({origin:z.object({lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180)}).optional(),spotIds:z.array(z.string().min(1).max(180)).min(1).max(6)});
export async function POST(req:Request){
 try{
  checkOrigin(req);await identity();
  const parsed=requestSchema.safeParse(await req.json());if(!parsed.success)throw new HttpError(400,'방문할 장소와 현재 위치를 확인해주세요.');
  const {origin,spotIds}=parsed.data;if(new Set(spotIds).size!==spotIds.length)throw new HttpError(400,'같은 장소를 두 번 선택할 수 없어요.');
  const key=bindings().KAKAO_REST_API_KEY;
  if(!key)return Response.json({error:'도보 길안내 연결을 준비하고 있어요. 카카오맵에서 길을 확인할 수 있어요.',code:'ROUTING_NOT_CONFIGURED'},{status:503});
  const spots=await Promise.all(spotIds.map(id=>db().prepare('SELECT lat,lng,title FROM spots WHERE id=?').bind(id).first<{lat:number;lng:number;title:string}>()));
  if(spots.some(s=>!s))throw new HttpError(404,'삭제된 장소가 포함되어 있어요. 코스를 다시 확인해주세요.');
  const points=[...(origin?[{...origin,title:'현재 위치'}]:[]),...spots.filter(s=>s!==null)];
  if(points.length<2)throw new HttpError(400,'출발 위치를 확인해주세요.');
  const first=points[0],last=points[points.length-1],via=points.slice(1,-1);
  const url=new URL('https://dapi.kakao.com/v2/routing/walk');
  url.search=new URLSearchParams({start_x:String(first.lng),start_y:String(first.lat),end_x:String(last.lng),end_y:String(last.lat),s_name:first.title,e_name:last.title,input_coord:'WGS84',output_coord:'WGS84',route_mode:'BROAD_FIRST',...(via.length?{via_x:via.map(p=>p.lng).join(','),via_y:via.map(p=>p.lat).join(','),v_name:via.map(p=>p.title.replaceAll(',',' ')).join(',')}:{})}).toString();
  const upstream=await fetch(url,{headers:{Authorization:'KakaoAK '+key},signal:AbortSignal.timeout(15000)});
  if(upstream.status===401||upstream.status===403)return Response.json({error:'도보 길안내 연결 설정을 확인하고 있어요. 카카오맵 길찾기를 이용해주세요.',code:'ROUTING_AUTH_ERROR'},{status:503});
  if(upstream.status===429)return Response.json({error:'길찾기 요청이 많아요. 잠시 후 다시 시도해주세요.',code:'ROUTING_LIMIT'},{status:429});
  if(!upstream.ok)throw new HttpError(502,'경로를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
  const raw=await upstream.json() as {status?:string};
  if(raw.status!=='OK'){
   const message=raw.status==='SAME_POINT'?'출발지와 목적지가 매우 가까워 경로를 만들 수 없어요.':raw.status==='TOO_FAR_AWAY'?'도보로 안내하기에는 너무 멀어요. 가까운 장소부터 선택해주세요.':'이 장소까지 이어지는 도보 경로를 찾지 못했어요.';
   return Response.json({error:message,code:raw.status==='SAME_POINT'?'SAME_POINT':'NO_WALKING_ROUTE'},{status:422});
  }
  try{return Response.json({route:parseWalkingRoute(raw,points.length-1)},{headers:{'Cache-Control':'private, no-store'}});}catch{return Response.json({error:'완전한 도보 경로를 확인하지 못했어요. 카카오맵에서 길을 확인해주세요.',code:'INVALID_ROUTE'},{status:502});}
 }catch(e){
  if(e instanceof HttpError)return Response.json({error:e.message,code:'REQUEST_ERROR'},{status:e.status});
  if(e instanceof Error&&(e.name==='TimeoutError'||e.name==='AbortError'))return Response.json({error:'경로 검색 시간이 길어지고 있어요. 다시 시도해주세요.',code:'ROUTING_TIMEOUT'},{status:504});
  return Response.json({error:'길찾기에 연결하지 못했어요. 연결을 확인하고 다시 시도해주세요.',code:'ROUTING_UNAVAILABLE'},{status:503});
 }
}
