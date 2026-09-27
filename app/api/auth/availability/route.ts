import {socialAuthSettings} from '@/lib/auth-settings';
export const dynamic = 'force-dynamic';
export function GET() {
  const {google, kakao} = socialAuthSettings();
  // Only readiness booleans: never expose credentials or enumerate environment values.
  return Response.json({google, kakao}, {headers: {'Cache-Control': 'no-store'}});
}
