import {db,respondError,HttpError} from '@/lib/server';
import {readPublicCourse} from '@/lib/public-course';
export const dynamic='force-dynamic';

export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const {id}=await params;
    if(!/^[a-zA-Z0-9_-]{1,180}$/.test(id))throw new HttpError(404,'코스를 찾을 수 없어요.');
    const data=await readPublicCourse(db(),id);
    if(!data)throw new HttpError(404,'삭제되었거나 찾을 수 없는 코스예요.');
    return Response.json(data,{headers:{'Cache-Control':'no-store'}});
  }catch(e){return respondError(e);}
}
