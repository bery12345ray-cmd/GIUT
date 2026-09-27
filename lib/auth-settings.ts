export function socialAuthSettings() {
  const secret = process.env.GIUT_SOCIAL_AUTH_SECRET || process.env.AUTH_SECRET;
  return {
    secret,
    google: !!(secret && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
    kakao: !!(secret && process.env.AUTH_KAKAO_ID && process.env.AUTH_KAKAO_SECRET),
  };
}
