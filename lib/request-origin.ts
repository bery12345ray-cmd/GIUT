// Netlify's Next.js adapter can use an internal Request URL. Only trust the
// canonical origins supplied by the deployment, never forwarded user headers.
export function isSameOriginRequest(request: Request, configuredOrigins = '') {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const configured = configuredOrigins.split(',').filter(Boolean);
  const allowed = configured.length ? configured : [new URL(request.url).origin];
  return allowed.some(value => {
    try { return origin === new URL(value).origin; }
    catch { return false; }
  });
}
