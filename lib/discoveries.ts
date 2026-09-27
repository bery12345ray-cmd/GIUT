import {z} from 'zod';
import {distance} from './model';
import type {DataStore} from './data-store';

export type DiscoveryNotice = {id:string; spotId:string; title:string; createdAt:string; readAt:string|null};
export class DiscoveryError extends Error {
  constructor(public status:number, message:string) { super(message); }
}
const fixSchema = z.object({
  lat:z.number().min(-90).max(90), lng:z.number().min(-180).max(180),
  accuracy:z.number().min(0).max(50), timestamp:z.number().finite(),
});

/** userId is always the verified session ID. A device fix is not proof of attendance. */
export async function recordDiscovery(db:DataStore,userId:string,spotId:string,fix:unknown,now=Date.now()) {
  const parsed=fixSchema.safeParse(fix);
  if(!parsed.success) throw new DiscoveryError(400,'위치 오차가 50m 이내일 때 남길 수 있어요. 위치를 다시 확인해주세요.');
  const p=parsed.data;
  if(now-p.timestamp>30000 || p.timestamp>now+1000) throw new DiscoveryError(400,'위치 정보가 오래됐어요. 현재 위치를 다시 확인해주세요.');
  const spot=await db.prepare('SELECT id,user_id,lat,lng,example FROM spots WHERE id=?').bind(spotId).first();
  if(!spot) throw new DiscoveryError(404,'이 장소의 기록이 삭제되었어요.');
  if(spot.user_id===userId) throw new DiscoveryError(400,'다른 사람이 남긴 기록을 발견해보세요.');
  if(Number(spot.example)) throw new DiscoveryError(400,'체험용 기록에는 발견 반응을 남기지 않아요.');
  if(distance(p,{lat:Number(spot.lat),lng:Number(spot.lng)})+p.accuracy>100)
    throw new DiscoveryError(400,'위치 오차를 포함해 기록에서 100m 안에 있어야 해요. 조금 더 가까이 가주세요.');
  const created=await db.prepare(`INSERT INTO discoveries(id,user_id,spot_id,created_at)
    VALUES(?,?,?,?) ON CONFLICT(user_id,spot_id) DO NOTHING RETURNING id`)
    .bind(crypto.randomUUID(),userId,spotId,new Date(now).toISOString()).first();
  return {created:!!created};
}

export async function readDiscoveryActivity(db:DataStore,userId:string) {
  const [notices,total]=await Promise.all([
    db.prepare(`SELECT d.id,d.spot_id AS spotId,s.title,d.created_at AS createdAt,d.read_at AS readAt
      FROM discoveries d JOIN spots s ON s.id=d.spot_id
      WHERE s.user_id=? ORDER BY (d.read_at IS NOT NULL),d.created_at DESC,d.id DESC LIMIT 100`).bind(userId).all<DiscoveryNotice>(),
    db.prepare(`SELECT COUNT(*) AS unread FROM discoveries d JOIN spots s ON s.id=d.spot_id
      WHERE s.user_id=? AND d.read_at IS NULL`).bind(userId).first<{unread:number}>(),
  ]);
  return {notices:notices.results,unread:Number(total?.unread||0)};
}

export async function markDiscoveryRead(db:DataStore,userId:string,ids:string[]) {
  if(!ids.length)return;
  await db.prepare(`UPDATE discoveries SET read_at=? WHERE read_at IS NULL
    AND spot_id IN (SELECT id FROM spots WHERE user_id=?)
    AND id IN (${ids.map(()=>'?').join(',')})`).bind(new Date().toISOString(),userId,...ids).run();
}
