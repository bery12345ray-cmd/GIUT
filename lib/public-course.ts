import type {DataStore} from './data-store';
import type {Course} from './collections';
import type {Spot} from './model';

export type PublicCourse = {course:Course;spots:Spot[]};

/** Courses and their places are public; folders, account data and personal reactions are never returned. */
export async function readPublicCourse(db:DataStore,id:string):Promise<PublicCourse|null> {
  const course=await db.prepare(`SELECT c.id,c.user_id AS userId,c.title,c.description,c.mode,
    c.created_at AS createdAt,c.updated_at AS updatedAt,p.nickname
    FROM courses c JOIN profiles p ON p.id=c.user_id WHERE c.id=?`).bind(id).first<Omit<Course,'spotIds'>>();
  if(!course)return null;
  const result=await db.prepare(`SELECT s.id,s.user_id AS userId,s.title,s.body,s.category,s.lat,s.lng,s.location,
    s.image,s.ar,s.route,s.example,s.created_at AS createdAt,p.nickname,
    (SELECT COUNT(*) FROM reactions r WHERE r.spot_id=s.id AND r.kind='like') AS likes,
    (SELECT COUNT(*) FROM reactions r WHERE r.spot_id=s.id AND r.kind='save') AS saves,
    (SELECT COUNT(*) FROM comments c WHERE c.spot_id=s.id) AS comments
    FROM course_stops cs JOIN spots s ON s.id=cs.spot_id JOIN profiles p ON p.id=s.user_id
    WHERE cs.course_id=? ORDER BY cs.position,s.id`).bind(id).all<Omit<Spot,'route'|'liked'|'saved'> & {route:string}>();
  const spots=result.results.map(s=>({...s,nickname:Number(s.example)?'골목대장 기웃이':s.nickname,
    route:JSON.parse(s.route||'[]'),liked:0,saved:0}));
  return {course:{...course,spotIds:spots.map(s=>s.id)},spots};
}
