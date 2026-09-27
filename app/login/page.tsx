import AuthPanel from '@/components/social-auth';
import Giuti from '@/components/giuti';
export const dynamic = 'force-dynamic';
export default async function Login({searchParams}: {searchParams: Promise<{error?: string}>}) {
  const {error} = await searchParams;
  return <main className="auth-page"><section className="auth-page-card">
    <h1>우리, 조금 더 기웃해볼까요?</h1><p>로그인하고 나만의 장소와 이야기를 모아보세요.</p>
    <div className="auth-page-cat"><Giuti pose="wave" animated/></div>
    <AuthPanel initialError={error?(error==='AccessDenied'?'로그인이 취소되었어요. 원할 때 다시 시작해주세요.':'로그인을 완료하지 못했어요. 잠시 후 다시 시도해주세요.'):''}/><a className="auth-page-back" href="/">로그인 없이 둘러보기</a>
  </section></main>;
}
