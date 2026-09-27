import {z} from 'zod';
import {db,identity,ensureProfile,checkOrigin,respondError,HttpError} from '@/lib/server';
import {ensureDefaultFolder} from '@/lib/collections-server';
import {MAX_COURSE_STOPS,type ScrapFolder,type Course} from '@/lib/collections';
export const dynamic='force-dynamic';
const id=z.string().min(1).max(180);
const names=z.string().trim().min(1,'폴더 이름을 입력해주세요.').max(40,'폴더 이름은 40자까지 입력해주세요.');
const courseFields={title:z.string().trim().min(1).max(60),description:z.string().trim().max(500),mode:z.enum(['walk','run']).default('walk'),spotIds:z.array(id).min(2).max(MAX_COURSE_STOPS)};
const action=z.discriminatedUnion('op',[
 z.object({op:z.literal('folder-create'),name:names,spotId:id.optional()}),
 z.object({op:z.literal('folder-rename'),id,name:names}),
 z.object({op:z.literal('folder-delete'),id}),
 z.object({op:z.literal('folder-toggle'),id,spotId:id,active:z.boolean()}),
 z.object({op:z.literal('folder-order'),id,spotIds:z.array(id).max(200)}),
 z.object({op:z.literal('course-create'),...courseFields}),
 z.object({op:z.literal('course-update'),id,...courseFields}),
 z.object({op:z.literal('course-delete'),id}),
]);
export async function GET(){try{
 const u=await identity(),d=db();let folders:ScrapFolder[]=[];
 if(u){await ensureProfile(u);await ensureDefaultFolder(u.id);
  const rows=(await d.prepare('SELECT id,name,is_default AS isDefault,created_at AS createdAt,updated_at AS updatedAt FROM scrap_folders WHERE user_id=? ORDER BY is_default DESC,created_at DESC').bind(u.id).all<Omit<ScrapFolder,'spotIds'>>()).results;
  const items=(await d.prepare('SELECT fs.folder_id,fs.spot_id FROM folder_spots fs JOIN scrap_folders f ON f.id=fs.folder_id WHERE f.user_id=? ORDER BY fs.position,fs.created_at').bind(u.id).all<{folder_id:string;spot_id:string}>()).results;
  folders=rows.map(f=>({...f,spotIds:items.filter(i=>i.folder_id===f.id).map(i=>i.spot_id)}));
 }
 const rows=(await d.prepare('SELECT c.id,c.user_id AS userId,c.title,c.description,c.mode,c.created_at AS createdAt,c.updated_at AS updatedAt,p.nickname FROM courses c JOIN profiles p ON p.id=c.user_id ORDER BY c.created_at DESC LIMIT 150').all<Omit<Course,'spotIds'>>()).results;
 const items=(await d.prepare('SELECT course_id,spot_id FROM course_stops ORDER BY position').all<{course_id:string;spot_id:string}>()).results;
 return Response.json({folders,courses:rows.map(c=>({...c,spotIds:items.filter(i=>i.course_id===c.id).map(i=>i.spot_id)}))},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return respondError(e);}}

export async function POST(req:Request){try{
 checkOrigin(req);const u=(await identity(true))!;await ensureProfile(u);await ensureDefaultFolder(u.id);
 const parsed=action.safeParse(await req.json());if(!parsed.success)throw new HttpError(400,'이름과 장소를 확인해주세요. 코스는 서로 다른 장소 2~6곳으로 만들 수 있어요.');
 const b=parsed.data,d=db(),now=new Date().toISOString();
 const exists=async(spotId:string)=>{if(!await d.prepare('SELECT id FROM spots WHERE id=?').bind(spotId).first())throw new HttpError(404,'삭제되었거나 찾을 수 없는 장소예요. 목록을 새로고침해주세요.');};
 if(b.op==='folder-create'){
  const count=await d.prepare('SELECT COUNT(*) AS n FROM scrap_folders WHERE user_id=?').bind(u.id).first<{n:number}>();if((count?.n||0)>=50)throw new HttpError(400,'폴더는 최대 50개까지 만들 수 있어요.');
  if(b.spotId)await exists(b.spotId);const folderId=crypto.randomUUID();
  const statements=[d.prepare('INSERT INTO scrap_folders(id,user_id,name,is_default,created_at,updated_at) VALUES(?,?,?,0,?,?)').bind(folderId,u.id,b.name,now,now)];
  if(b.spotId){statements.push(d.prepare('INSERT INTO folder_spots(folder_id,spot_id,position,created_at) VALUES(?,?,0,?)').bind(folderId,b.spotId,now),d.prepare("INSERT OR IGNORE INTO reactions(user_id,spot_id,kind,created_at) VALUES(?,?,'save',?)").bind(u.id,b.spotId,now));}
  await d.batch(statements);return Response.json({ok:true,id:folderId});
 }
 if(b.op.startsWith('folder-')&&'id' in b){
  const folder=await d.prepare('SELECT id,is_default FROM scrap_folders WHERE id=? AND user_id=?').bind(b.id,u.id).first<{id:string;is_default:number}>();if(!folder)throw new HttpError(404,'내 폴더를 찾을 수 없어요.');
  if(b.op==='folder-rename'){if(folder.is_default)throw new HttpError(400,'기본 폴더의 이름은 변경할 수 없어요.');await d.prepare('UPDATE scrap_folders SET name=?,updated_at=? WHERE id=? AND user_id=?').bind(b.name,now,b.id,u.id).run();}
  if(b.op==='folder-delete'){
   if(folder.is_default)throw new HttpError(400,'기본 폴더는 삭제할 수 없어요.');
   // A folder is an organizer: deleting it keeps its places in the default folder.
   await d.batch([
    d.prepare(`INSERT OR IGNORE INTO folder_spots(folder_id,spot_id,position,created_at) SELECT ?,fs.spot_id,COALESCE((SELECT MAX(position) FROM folder_spots WHERE folder_id=?),-1)+ROW_NUMBER() OVER (ORDER BY fs.position),? FROM folder_spots fs WHERE fs.folder_id=?`).bind('later:'+u.id,'later:'+u.id,now,b.id),
    d.prepare('DELETE FROM scrap_folders WHERE id=? AND user_id=?').bind(b.id,u.id),
   ]);
  }
  if(b.op==='folder-toggle'){
   await exists(b.spotId);
   if(b.active)await d.batch([
    d.prepare('INSERT OR IGNORE INTO folder_spots(folder_id,spot_id,position,created_at) SELECT ?,?,COALESCE(MAX(position),-1)+1,? FROM folder_spots WHERE folder_id=?').bind(b.id,b.spotId,now,b.id),
    d.prepare("INSERT OR IGNORE INTO reactions(user_id,spot_id,kind,created_at) VALUES(?,?,'save',?)").bind(u.id,b.spotId,now),
    d.prepare('UPDATE scrap_folders SET updated_at=? WHERE id=?').bind(now,b.id),
   ]);else await d.batch([
    d.prepare('DELETE FROM folder_spots WHERE folder_id=? AND spot_id=?').bind(b.id,b.spotId),
    d.prepare(`DELETE FROM reactions WHERE user_id=? AND spot_id=? AND kind='save' AND NOT EXISTS (SELECT 1 FROM folder_spots fs JOIN scrap_folders f ON fs.folder_id=f.id WHERE f.user_id=? AND fs.spot_id=?)`).bind(u.id,b.spotId,u.id,b.spotId),
    d.prepare('UPDATE scrap_folders SET updated_at=? WHERE id=?').bind(now,b.id),
   ]);
  }
  if(b.op==='folder-order'){
   const items=(await d.prepare('SELECT spot_id FROM folder_spots WHERE folder_id=?').bind(b.id).all<{spot_id:string}>()).results;
   if(new Set(b.spotIds).size!==b.spotIds.length||items.length!==b.spotIds.length||items.some(i=>!b.spotIds.includes(i.spot_id)))throw new HttpError(409,'폴더 내용이 변경됐어요. 새로고침한 뒤 다시 정렬해주세요.');
   await d.batch([...b.spotIds.map((s,i)=>d.prepare('UPDATE folder_spots SET position=? WHERE folder_id=? AND spot_id=?').bind(i,b.id,s)),d.prepare('UPDATE scrap_folders SET updated_at=? WHERE id=?').bind(now,b.id)]);
  }
  return Response.json({ok:true});
 }
 if(b.op==='course-create'||b.op==='course-update'){
  if(new Set(b.spotIds).size!==b.spotIds.length)throw new HttpError(400,'같은 장소를 두 번 추가할 수 없어요.');
  for(const spotId of b.spotIds)await exists(spotId);
  if(b.op==='course-update'&&!await d.prepare('SELECT id FROM courses WHERE id=? AND user_id=?').bind(b.id,u.id).first())throw new HttpError(404,'내 코스를 찾을 수 없어요.');
  const courseId=b.op==='course-create'?crypto.randomUUID():b.id;
  const statements=b.op==='course-create'?[d.prepare('INSERT INTO courses(id,user_id,title,description,mode,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(courseId,u.id,b.title,b.description,b.mode,now,now)]:[d.prepare('UPDATE courses SET title=?,description=?,mode=?,updated_at=? WHERE id=? AND user_id=?').bind(b.title,b.description,b.mode,now,courseId,u.id),d.prepare('DELETE FROM course_stops WHERE course_id=?').bind(courseId)];
  statements.push(...b.spotIds.map((spotId,i)=>d.prepare('INSERT INTO course_stops(course_id,spot_id,position) VALUES(?,?,?)').bind(courseId,spotId,i)));
  await d.batch(statements);return Response.json({ok:true,id:courseId});
 }
 if(b.op==='course-delete'){await d.prepare('DELETE FROM courses WHERE id=? AND user_id=?').bind(b.id,u.id).run();return Response.json({ok:true});}
 throw new HttpError(400,'지원하지 않는 요청이에요.');
 }catch(e){return respondError(e);}}
