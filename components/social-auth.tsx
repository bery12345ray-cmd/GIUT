'use client';
import {useEffect, useState} from 'react';
import {signIn, signOut} from 'next-auth/react';
import {useQueryClient} from '@tanstack/react-query';
import {Copy, LoaderCircle, LogOut} from 'lucide-react';

function GoogleIcon() {
  return <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.61 24.46c0-1.36-.12-2.66-.35-3.92H24v7.43h11a9.4 9.4 0 0 1-4.08 6.17v5.13h6.61c3.87-3.56 6.08-8.8 6.08-14.81Z"/><path fill="#34A853" d="M24 44c5.51 0 10.13-1.83 13.51-4.96l-6.61-5.13c-1.83 1.23-4.17 1.97-6.9 1.97-5.32 0-9.84-3.59-11.46-8.43H5.72v5.29A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.54 27.45a12 12 0 0 1 0-6.9v-5.29H5.72a20 20 0 0 0 0 17.48l6.82-5.29Z"/><path fill="#EA4335" d="M24 12.12c3 0 5.68 1.03 7.8 3.05l5.85-5.85A19.63 19.63 0 0 0 24 4 20 20 0 0 0 5.72 15.26l6.82 5.29C14.16 15.71 18.68 12.12 24 12.12Z"/></svg>;
}
function KakaoIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3C6.48 3 2 6.5 2 10.82c0 2.79 1.86 5.23 4.65 6.62l-.94 3.48c-.08.28.25.5.49.34l4.08-2.73c.56.07 1.14.11 1.72.11 5.52 0 10-3.5 10-7.82S17.52 3 12 3Z"/></svg>;
}

export default function AuthPanel({initialError = ''}: {initialError?: string}) {
  const [ready, setReady] = useState<{google: boolean; kakao: boolean} | null>(null);
  const [busy, setBusy] = useState<'google' | 'kakao' | null>(null);
  const [error, setError] = useState(initialError);
  const [embedded, setEmbedded] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setEmbedded(/KAKAOTALK|Instagram|FBAN|FBAV|NAVER\(/i.test(navigator.userAgent));
    fetch('/api/auth/availability', {cache: 'no-store', signal: controller.signal})
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setReady)
      .catch(e => {if (e.name !== 'AbortError') {setReady({google: false, kakao: false}); setError('로그인 연결을 확인하지 못했어요. 창을 닫고 다시 열어주세요.');}});
    return () => controller.abort();
  }, []);
  async function start(provider: 'google' | 'kakao') {
    setError('');
    if (!ready?.[provider]) {
      setError(`${provider === 'google' ? '구글' : '카카오'} 로그인은 운영자의 연결 설정이 필요해요. 설정이 끝나면 여기서 시작할 수 있어요.`);
      return;
    }
    setBusy(provider);
    try { await signIn(provider, {redirectTo: '/'}); }
    catch { setError('로그인 페이지를 열지 못했어요. 다시 시도해주세요.'); setBusy(null); }
  }
  return <div className="social-auth-panel">
    <div className="social-auth-buttons" aria-label="소셜 로그인">
      <button className="social-auth-button social-google" disabled={!ready || !!busy} onClick={() => start('google')}>
        {busy === 'google' ? <LoaderCircle className="spin"/> : <GoogleIcon/>}<span>{busy === 'google' ? '구글로 이동 중…' : '구글로 시작하기'}</span>
      </button>
      <button className="social-auth-button social-kakao" disabled={!ready || !!busy} onClick={() => start('kakao')}>
        {busy === 'kakao' ? <LoaderCircle className="spin"/> : <KakaoIcon/>}<span>{busy === 'kakao' ? '카카오로 이동 중…' : '카카오로 시작하기'}</span>
      </button>
    </div>
    {error && <p className="social-auth-error" role="alert">{error}</p>}
    {embedded && <div className="social-browser-help"><p>앱 안에서 구글 로그인이 열리지 않나요? 주소를 복사해 Safari 또는 Chrome에서 열어주세요.</p><button onClick={async () => {try {await navigator.clipboard.writeText(window.location.origin); setCopied(true);} catch {setError('브라우저 메뉴에서 ‘다른 브라우저로 열기’를 선택해주세요.');}}}><Copy size={14}/>{copied ? '주소를 복사했어요' : '기웃 주소 복사'}</button></div>}
    <p className="social-auth-note">처음이라면 계정이 만들어져요.<br/>내 기록은 같은 로그인 계정으로 다시 만날 수 있어요.</p>
  </div>;
}

export function SignOutButton({onDone}: {onDone: () => void}) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <div className="social-signout"><button className="text-button" disabled={busy} onClick={async () => {
    setBusy(true); setError('');
    try {await signOut({redirect: false}); await client.cancelQueries(); client.clear(); onDone();}
    catch {setError('로그아웃하지 못했어요. 다시 시도해주세요.');}
    finally {setBusy(false);}
  }}><LogOut size={16}/>{busy ? '로그아웃 중…' : '로그아웃'}</button>{error && <p role="alert">{error}</p>}</div>;
}
