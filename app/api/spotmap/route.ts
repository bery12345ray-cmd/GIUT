import {z} from 'zod';
import {db,bindings,identity,ensureProfile,ensureExamples,checkOrigin,respondError,HttpError} from '@/lib/server';
import {readUserProfile} from '@/lib/user-workspace';
import {recordDiscovery,DiscoveryError} from '@/lib/discoveries';
import {createRecordSchema,recordTitle} from '@/lib/record-input';
import {distance} from '@/lib/model';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const u=await identity();await ensureExamples();if(u)await ensureProfile(u);const d=db();const uid=u?.id||'';const url=new URL(req.url);const id=url.searchParams.get('spot');
 const all=await d.prepare(`SELECT s.id,s.user_id AS userId,s.title,s.body,s.category,s.lat,s.lng,s.location,s.image,s.ar,s.route,s.example,s.created_at AS createdAt,p.nickname,COALESCE(s.place_id,s.id) AS placeId,
 (SELECT COUNT(*) FROM discoveries v WHERE v.spot_id=s.id) AS discoveries,
 EXISTS(SELECT 1 FROM discoveries v WHERE v.spot_id=s.id AND v.user_id=?) AS discovered,
 (SELECT COUNT(*) FROM reactions r WHERE r.spot_id=s.id AND r.kind='like') AS likes,
 (SELECT COUNT(*) FROM reactions r WHERE r.spot_id=s.id AND r.kind='save') AS saves,
 (SELECT COUNT(*) FROM comments c WHERE c.spot_id=s.id) AS comments,
 EXISTS(SELECT 1 FROM reactions r WHERE r.spot_id=s.id AND r.kind='like' AND r.user_id=?) AS liked,
 EXISTS(SELECT 1 FROM reactions r WHERE r.spot_id=s.id AND r.kind='save' AND r.user_id=?) AS saved

 FROM spots s JOIN profiles p ON p.id=s.user_id WHERE (CAST(? AS text) IS NULL OR s.id=?) ORDER BY s.example,s.created_at DESC LIMIT 500`).bind(uid,uid,uid,id,id).all();
 const records=all.results.map(s=>({...s,placeId:String(s.placeId),nickname:Number(s.example)===1?'골목대장 기웃이':s.nickname,route:JSON.parse(String(s.route||'[]'))}));
 if(id){if(!records.length)throw new HttpError(404,'이 장소의 기록이 삭제되었어요.');const comments=await d.prepare('SELECT c.id,c.body,c.created_at AS createdAt,c.user_id AS userId,p.nickname FROM comments c JOIN profiles p ON p.id=c.user_id WHERE c.spot_id=? ORDER BY c.created_at LIMIT 200').bind(id).all();
 const stories=await d.prepare(`SELECT s.id,s.title,s.body,s.image,s.example,s.created_at AS createdAt,p.nickname
 FROM spots s JOIN profiles p ON p.id=s.user_id WHERE COALESCE(s.place_id,s.id)=?
 ORDER BY s.created_at DESC,s.id DESC LIMIT 100`).bind(records[0].placeId).all();
 return Response.json({spot:records[0],comments:comments.results,stories:stories.results},{headers:{'Cache-Control':'private, no-store'}});}
 let profile=null,ledger:unknown[]=[];
 if(u){profile=await readUserProfile(d,uid);ledger=(await d.prepare('SELECT id,amount,reason,created_at AS createdAt FROM credits WHERE user_id=? ORDER BY created_at DESC LIMIT 100').bind(uid).all()).results;}
 return Response.json({spots:records,user:profile,ledger,kakaoKey:bindings().KAKAO_JAVASCRIPT_KEY||'',signInPath:'/#login'},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return respondError(e);}}

export async function POST(req:Request){try{
 checkOrigin(req);const u=(await identity(true))!;await ensureProfile(u);const d=db();const b=await req.json() as Record<string,unknown>;const now=new Date().toISOString();
 if(b.op==='create'){
  const parsed=createRecordSchema.safeParse(b);if(!parsed.success)throw new HttpError(400,parsed.error.issues[0].message);const s=parsed.data;let img=s.image;
  if(img){if(!img.startsWith('/api/media/'))throw new HttpError(400,'사진을 다시 업로드해주세요.');const key=img.slice('/api/media/'.length);const f=await d.prepare('SELECT id FROM uploads WHERE id=? AND user_id=?').bind(key,u.id).first();if(!f)throw new HttpError(403,'직접 업로드한 사진을 선택해주세요.');}
  const id=crypto.randomUUID();const today=now.slice(0,10);
  let placeId=id;
  if(s.sourceSpotId){const source=await d.prepare('SELECT COALESCE(place_id,id) AS placeId,lat,lng,example FROM spots WHERE id=?').bind(s.sourceSpotId).first();if(!source)throw new HttpError(404,'이어 남길 장소가 삭제되었어요.');if(Number(source.example))throw new HttpError(400,'체험용 장소는 새 기록으로 남겨주세요.');if(distance(s,{lat:Number(source.lat),lng:Number(source.lng)})>100)throw new HttpError(400,'같은 장소의 이야기는 그 장소 가까이에서 남겨주세요.');placeId=String(source.placeId);}
  await d.batch([d.prepare('INSERT INTO spots(id,user_id,title,body,category,lat,lng,location,image,ar,route,example,created_at,place_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,u.id,recordTitle(s),s.body,s.category,s.lat,s.lng,s.location,img,s.ar?1:0,JSON.stringify(s.route),0,now,placeId),
    d.prepare('INSERT OR IGNORE INTO credits(id,user_id,amount,reason,created_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM credits WHERE user_id=? AND reason=? AND created_at>=?)<5').bind('post:'+id,u.id,10,'스팟 기록',now,u.id,'스팟 기록',today)]);
  return Response.json({ok:true,id});
 }
 if(b.op==='profile'){const p=z.object({nickname:z.string().trim().min(2).max(20),bio:z.string().trim().max(160),avatarSkin:z.enum(['wave','explore','love','social']).default('wave')}).safeParse(b);if(!p.success)throw new HttpError(400,'닉네임은 2~20자, 소개는 160자까지 입력하고 프로필 스킨을 선택해주세요.');await d.prepare('UPDATE profiles SET nickname=?,bio=?,avatar_skin=? WHERE id=?').bind(p.data.nickname,p.data.bio,p.data.avatarSkin,u.id).run();return Response.json({ok:true});}
 if(typeof b.spotId!=='string')throw new HttpError(400,'스팟을 선택해주세요.');const s=await d.prepare('SELECT id,user_id,lat,lng,example FROM spots WHERE id=?').bind(b.spotId).first();if(!s)throw new HttpError(404,'찾을 수 없는 스팟이에요.');
 if(b.op==='discover'){
  try{return Response.json({ok:true,...await recordDiscovery(d,u.id,b.spotId,b)});}catch(e){if(e instanceof DiscoveryError)throw new HttpError(e.status,e.message);throw e;}
 }else if(b.op==='reaction'){
  if(b.kind!=='like'&&b.kind!=='save')throw new HttpError(400,'올바르지 않은 반응이에요.');if(typeof b.active!=='boolean')throw new HttpError(400,'반응 상태를 확인해주세요.');
  if(b.active){const statements=[d.prepare('INSERT OR IGNORE INTO reactions(user_id,spot_id,kind,created_at) VALUES(?,?,?,?)').bind(u.id,b.spotId,b.kind,now)];
   if(b.kind==='like'&&s.user_id!==u.id&&Number(s.example)===0)statements.push(d.prepare('INSERT OR IGNORE INTO credits(id,user_id,amount,reason,created_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM credits WHERE user_id=? AND reason=? AND created_at>=?)<10').bind('like:'+u.id+':'+b.spotId,u.id,1,'스팟에 공감',now,u.id,'스팟에 공감',now.slice(0,10)));
   await d.batch(statements);
  }else if(b.kind==='save')await d.batch([d.prepare('DELETE FROM folder_spots WHERE spot_id=? AND folder_id IN (SELECT id FROM scrap_folders WHERE user_id=?)').bind(b.spotId,u.id),d.prepare("DELETE FROM reactions WHERE user_id=? AND spot_id=? AND kind='save'").bind(u.id,b.spotId)]);
  else await d.prepare('DELETE FROM reactions WHERE user_id=? AND spot_id=? AND kind=?').bind(u.id,b.spotId,b.kind).run();
 }else if(b.op==='comment'){
  const body=z.string().trim().min(1).max(500).safeParse(b.body);if(!body.success)throw new HttpError(400,'댓글은 1~500자로 적어주세요.');await d.prepare('INSERT INTO comments(id,spot_id,user_id,body,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),b.spotId,u.id,body.data,now).run();
 }else if(b.op==='delete-comment'){
  if(typeof b.commentId!=='string')throw new HttpError(400,'댓글을 선택해주세요.');await d.prepare('DELETE FROM comments WHERE id=? AND spot_id=? AND user_id=?').bind(b.commentId,b.spotId,u.id).run();
 }else if(b.op==='delete'){
  if(s.user_id!==u.id)throw new HttpError(403,'내 기록만 삭제할 수 있어요.');await d.batch([d.prepare('DELETE FROM comments WHERE spot_id=?').bind(b.spotId),d.prepare('DELETE FROM reactions WHERE spot_id=?').bind(b.spotId),d.prepare('DELETE FROM reports WHERE spot_id=?').bind(b.spotId),d.prepare('DELETE FROM spots WHERE id=? AND user_id=?').bind(b.spotId,u.id)]);
 }else if(b.op==='report'){
  const reason=z.string().trim().min(2).max(500).safeParse(b.reason);if(!reason.success)throw new HttpError(400,'신고 사유를 입력해주세요.');await d.prepare('INSERT OR IGNORE INTO reports(id,spot_id,user_id,reason,created_at) VALUES(?,?,?,?,?)').bind(u.id+':'+b.spotId,b.spotId,u.id,reason.data,now).run();
 }else throw new HttpError(400,'지원하지 않는 요청이에요.');return Response.json({ok:true});
 }catch(e){return respondError(e);}}
