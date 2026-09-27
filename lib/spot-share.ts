import type {Spot} from '@/lib/model';

export function spotShareData(spot:Pick<Spot,'id'|'title'|'nickname'>, origin:string):ShareData {
  const url=new URL('/',origin);
  url.searchParams.set('spot',spot.id);
  return {title:`${spot.title} · 기웃`,text:`${spot.nickname}님이 남긴 골목 기록, 같이 기웃해요.`,url:url.href};
}

export function sharedSpotId(search:string) {
  const id=new URLSearchParams(search).get('spot');
  return id && /^[a-zA-Z0-9_-]{1,100}$/.test(id) ? id : null;
}

export async function shareSpot(data:ShareData, platform:Pick<Navigator,'share'|'canShare'>):Promise<'shared'|'cancelled'|'fallback'> {
  try {
    if(typeof platform.share!=='function' || (typeof platform.canShare==='function' && !platform.canShare(data))) return 'fallback';
    // Called directly from the share button; keep the native user gesture.
    await platform.share(data);
    return 'shared';
  } catch(error) {
    return (error as {name?:string})?.name==='AbortError' ? 'cancelled' : 'fallback';
  }
}
