declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    BUCKET: R2Bucket;
    KAKAO_JAVASCRIPT_KEY?: string;
  }
}
