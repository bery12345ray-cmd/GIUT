import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Kakao from 'next-auth/providers/kakao';
import {database} from './netlify-platform';
import {resolveSocialProfile} from './social-accounts';
import {socialAuthSettings} from './auth-settings';

// Fixed deployment origin, never a client-supplied Host/X-Forwarded-Host value.
if (process.env.GIUT_AUTH_ORIGIN) process.env.AUTH_URL = process.env.GIUT_AUTH_ORIGIN;

export const {handlers, auth} = NextAuth(() => {
  const settings = socialAuthSettings();
  return {
    secret: settings.secret,
    trustHost: true,
    session: {strategy: 'jwt', maxAge: 7 * 24 * 60 * 60},
    pages: {signIn: '/login', error: '/login'},
    providers: [
      ...(settings.google ? [Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
        checks: ['pkce', 'state'],
        authorization: {params: {scope: 'openid profile email', prompt: 'select_account'}},
      })] : []),
      ...(settings.kakao ? [Kakao({
        clientId: process.env.AUTH_KAKAO_ID,
        clientSecret: process.env.AUTH_KAKAO_SECRET,
        checks: ['state'],
        authorization: {url: 'https://kauth.kakao.com/oauth/authorize', params: {scope: 'profile_nickname profile_image'}},
      })] : []),
    ],
    callbacks: {
      async jwt({token, account, user}) {
        if (account && user) {
          token.userId = await resolveSocialProfile(database, {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            name: user.name, image: user.image,
          });
        }
        // Ignore client session.update() data; never accept a browser userId.
        return token;
      },
      async session({session, token}) {
        if (session.user && typeof token.userId === 'string') session.user.id = token.userId;
        return session;
      },
      async redirect({url, baseUrl}) {
        if (url.startsWith('/') && !url.startsWith('//')) return new URL(url, baseUrl).href;
        try { if (new URL(url).origin === new URL(baseUrl).origin) return url; } catch {}
        return baseUrl;
      },
    },
    // Avoid logging authorization codes, access tokens, user profiles or secrets.
    logger: {error(error) { console.error('GIUT authentication error:', error.name); }},
  };
});
