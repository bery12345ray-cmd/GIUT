import type {Point} from '@/lib/model';

type AddressResult={documents?:{road_address?:{address_name?:string}|null;address?:{address_name?:string}|null;address_name?:string;region_type?:string}[]};

export async function reverseGeocode(point:Point,key:string,request:typeof fetch=fetch){
  for(const endpoint of ['coord2address','coord2regioncode']){
    const url=new URL(`https://dapi.kakao.com/v2/local/geo/${endpoint}.json`);
    url.search=new URLSearchParams({x:String(point.lng),y:String(point.lat),input_coord:'WGS84'}).toString();
    const response=await request(url,{headers:{Authorization:`KakaoAK ${key}`},signal:AbortSignal.timeout(8000),cache:'no-store'});
    if(!response.ok)throw new Error('주소 서비스에 연결하지 못했어요. 잠시 후 다시 확인해주세요.');
    const data=await response.json() as AddressResult;
    const item=endpoint==='coord2regioncode'?(data.documents?.find(d=>d.region_type==='H')||data.documents?.[0]):data.documents?.[0];
    const address=item?.road_address?.address_name||item?.address?.address_name||item?.address_name;
    if(address?.trim())return address.trim();
  }
  throw new Error('이 위치의 주소를 찾지 못했어요. 가까운 길에서 다시 확인해주세요.');
}
