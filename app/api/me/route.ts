import {db, identity, respondError, HttpError} from '@/lib/server';
import {readUserWorkspace} from '@/lib/user-workspace';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET() {
  try {
    const user = (await identity(true))!;
    const workspace = await readUserWorkspace(db(), user.id);
    if (!workspace) throw new HttpError(404, '프로필을 찾지 못했어요. 다시 로그인해주세요.');
    return Response.json(workspace, {headers: {'Cache-Control': 'private, no-store', 'Vary': 'Cookie'}});
  } catch (error) { return respondError(error); }
}
