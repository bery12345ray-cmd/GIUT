import {handlers} from '@/lib/auth';
import {socialAuthSettings} from '@/lib/auth-settings';
import type {NextRequest} from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  if (!socialAuthSettings().secret && new URL(request.url).pathname.endsWith('/session')) {
    return Response.json(null, {headers: {'Cache-Control': 'private, no-store'}});
  }
  return handlers.GET(request);
}
export const POST = handlers.POST;
