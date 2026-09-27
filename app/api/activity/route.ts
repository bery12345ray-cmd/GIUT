import {z} from 'zod';
import {db,identity,checkOrigin,respondError,HttpError} from '@/lib/server';
import {readDiscoveryActivity,markDiscoveryRead} from '@/lib/discoveries';
export const dynamic='force-dynamic';
export async function GET(){try{
  const user=(await identity(true))!;
  return Response.json(await readDiscoveryActivity(db(),user.id),{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return respondError(e);}}
export async function POST(req:Request){try{
  checkOrigin(req);const user=(await identity(true))!;
  const body=z.object({ids:z.array(z.string().min(1).max(100)).max(100)}).safeParse(await req.json());
  if(!body.success)throw new HttpError(400,'읽을 알림을 다시 선택해주세요.');
  await markDiscoveryRead(db(),user.id,body.data.ids);
  return Response.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return respondError(e);}}
