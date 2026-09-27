import {checkOrigin,identity,HttpError} from '@/lib/server';
import {recordPoint} from '@/lib/record-input';
import {reverseGeocode} from '@/lib/reverse-geocode';

export const dynamic='force-dynamic';
export async function POST(req:Request){
  try{
    checkOrigin(req);await identity(true);
    const parsed=recordPoint.safeParse(await req.json());
    if(!parsed.success)throw new HttpError(400,'현재 위치를 다시 확인해주세요.');
    // Kakao Login also uses the app's REST API key. Never expose this key to the client.
    const key=process.env.KAKAO_REST_API_KEY||process.env.AUTH_KAKAO_ID;
    let address:string|null=null;
    if(key){try{address=await reverseGeocode(parsed.data,key);}catch{/* A geocoder outage must not discard a valid GPS fix. */}}
    if(!address)return Response.json({address:null,warning:'현재 위치는 확인했어요. 주소를 불러오지 못해 위치만 저장됩니다.'},{headers:{'Cache-Control':'private, no-store'}});
    return Response.json({address},{headers:{'Cache-Control':'private, no-store'}});
  }catch(e){
    return Response.json({error:e instanceof Error?e.message:'주소를 확인하지 못했어요.'},{status:e instanceof HttpError?e.status:503,headers:{'Cache-Control':'private, no-store'}});
  }
}
