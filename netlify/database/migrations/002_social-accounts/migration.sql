-- Additive migration: existing profiles, places, photos and credits are preserved.
ALTER TABLE profiles ADD COLUMN avatar_url text;
ALTER TABLE profiles ADD COLUMN avatar_skin text NOT NULL DEFAULT 'wave'
  CHECK (avatar_skin IN ('wave', 'explore', 'love', 'social'));

CREATE TABLE social_accounts (
  provider text NOT NULL CHECK (provider IN ('google', 'kakao')),
  provider_account_id text NOT NULL,
  user_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at text NOT NULL,
  last_login_at text NOT NULL,
  PRIMARY KEY (provider, provider_account_id),
  UNIQUE (user_id, provider)
);
CREATE INDEX idx_social_accounts_user ON social_accounts(user_id);
