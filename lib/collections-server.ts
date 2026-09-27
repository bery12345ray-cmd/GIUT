import {db} from '@/lib/server';

// Migrate each user's existing unfiled saves without removing or duplicating saves.
export async function ensureDefaultFolder(userId:string){
 const d=db(),id='later:'+userId,now=new Date().toISOString();
 await d.batch([
  d.prepare('INSERT OR IGNORE INTO scrap_folders(id,user_id,name,is_default,created_at,updated_at) VALUES(?,?,?,1,?,?)').bind(id,userId,'나중에 기웃거리기',now,now),
  d.prepare(`INSERT OR IGNORE INTO folder_spots(folder_id,spot_id,position,created_at)
   SELECT ?,r.spot_id,COALESCE((SELECT MAX(position) FROM folder_spots WHERE folder_id=?),-1)+ROW_NUMBER() OVER (ORDER BY r.created_at,r.spot_id),r.created_at
   FROM reactions r WHERE r.user_id=? AND r.kind='save' AND NOT EXISTS
   (SELECT 1 FROM folder_spots fs JOIN scrap_folders f ON f.id=fs.folder_id WHERE f.user_id=? AND fs.spot_id=r.spot_id)`).bind(id,id,userId,userId),
 ]);
}
