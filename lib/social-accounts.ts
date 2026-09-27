import type {DataStore} from './data-store';

export type SocialIdentity = {
  provider: string; providerAccountId: string;
  name?: string | null; image?: string | null;
};

function safeAvatar(value?: string | null) {
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(value);
    // Kakao sometimes supplies http profile URLs; always load them over HTTPS.
    if (url.protocol === 'http:') url.protocol = 'https:';
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

/** Call only with a provider identity already verified by Auth.js OAuth. */
export async function resolveSocialProfile(db: DataStore, identity: SocialIdentity) {
  const {provider, providerAccountId} = identity;
  if (!['google', 'kakao'].includes(provider) || !providerAccountId || providerAccountId.length > 255) {
    throw new Error('Invalid social identity');
  }
  const lookup = () => db.prepare('SELECT user_id AS userId FROM social_accounts WHERE provider=? AND provider_account_id=?')
    .bind(provider, providerAccountId).first<{userId: string}>();
  const now = new Date().toISOString();
  const existing = await lookup();
  if (existing) {
    await db.prepare('UPDATE social_accounts SET last_login_at=? WHERE provider=? AND provider_account_id=?')
      .bind(now, provider, providerAccountId).run();
    return existing.userId;
  }
  const id = crypto.randomUUID();
  const nickname = identity.name?.trim().slice(0, 20) || '새로운 탐험가';
  try {
    await db.batch([
      db.prepare('INSERT INTO profiles(id,nickname,bio,avatar_url,avatar_skin,created_at) VALUES(?,?,?,?,?,?)')
        .bind(id, nickname.length < 2 ? nickname + '냥' : nickname, '', safeAvatar(identity.image), 'wave', now),
      db.prepare('INSERT INTO social_accounts(provider,provider_account_id,user_id,created_at,last_login_at) VALUES(?,?,?,?,?)')
        .bind(provider, providerAccountId, id, now, now),
    ]);
    return id;
  } catch (error) {
    // Two simultaneous first logins must resolve to one profile, without orphans.
    if ((error as {code?: string}).code === '23505') {
      const winner = await lookup();
      if (winner) return winner.userId;
    }
    throw error;
  }
}
