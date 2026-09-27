# 기웃 소셜 로그인과 계정별 저장소

## 구현 환경과 코드

기존 **Next.js 16 / React 19 + Netlify PostgreSQL + Netlify Blobs**를 유지합니다. 카카오와 구글을 함께 지원하기 위해 Auth.js (`next-auth` 5 beta.32 고정)를 사용합니다. Netlify Identity 활성화는 필요 없습니다.

| 요청 결과물 | 파일 |
| --- | --- |
| 로그인 모달·브랜드 버튼 | `components/spotmap.tsx`, `components/social-auth.tsx`, `app/social-auth.css` |
| 구글·카카오 OAuth 및 서버 세션 검증 | `lib/auth.ts`, `lib/social-accounts.ts`, `app/api/auth/[...nextauth]/route.ts`, `lib/server.ts` |
| 프로필 스킨 UI | `components/profile-avatar.tsx` |
| DB 스키마 | `netlify/database/migrations/001_giut-schema/migration.sql`, `002_social-accounts/migration.sql` |
| 개인 저장소 조회·상태 관리 | `app/api/me/route.ts`, `lib/user-workspace.ts`, `hooks/use-my-workspace.ts` |

## 실제 로그인 활성화 — 운영자 설정 필요

Netlify에 배포하는 것과 구글·카카오 앱을 연결하는 것은 별도입니다. 제공자 키가 없으면 버튼은 보이되, 클릭 시 연결 설정이 필요하다고 안내하며 가짜 로그인을 만들지 않습니다.

Netlify → giut → Environment variables에서 아래 값을 설정하세요. **비밀값은 채팅이나 Git에 넣지 마세요.** `Contains secret values`를 선택하고 Production 값으로 등록한 뒤 재배포합니다. 저장 후에는 키 이름과 Production 값의 등록 여부를 다시 확인합니다.

범위 선택을 지원하는 요금제에서는 Functions만 선택합니다. 현재 Free 요금제의 화면에서는 범위 선택이 잠겨 있으며, 비밀값을 선택하면 Builds·Functions·Runtime이 함께 선택되고 Post processing은 제외됩니다. 따라서 서버 함수에만 제한하려면 요금제 변경이 필요하고, Free를 유지하려면 이 세 실행 범위에서 키를 사용하는 설정을 운영자가 확인해야 합니다. `NEXT_PUBLIC_` 변수나 `next.config.ts`의 `env`에는 비밀값을 넣지 않습니다.

| 이름 | 내용 |
| --- | --- |
| `GIUT_SOCIAL_AUTH_SECRET` | 32바이트 이상 무작위 세션 암호화 키. 한번 설정한 키는 유지합니다. 변경하면 기존 로그인이 만료됩니다. |
| `AUTH_GOOGLE_ID` | Google OAuth 웹 클라이언트 ID |
| `AUTH_GOOGLE_SECRET` | 해당 Google 클라이언트 Secret |
| `AUTH_KAKAO_ID` | Kakao REST API 키 — JavaScript 지도 키가 아님 |
| `AUTH_KAKAO_SECRET` | Kakao Login에서 활성화한 Client Secret |

### Google

Google Cloud/Google Auth Platform에서 웹 애플리케이션 OAuth 클라이언트를 만들고 승인된 리디렉션 URI를 정확히 등록합니다.

`https://giut.netlify.app/api/auth/callback/google`

외부 사용자용 동의 화면과 공개 상태를 확인하세요. 테스트 상태라면 등록한 테스트 사용자만 로그인할 수 있습니다. 요청 권한은 기본 프로필과 이메일뿐입니다. 앱 내장 브라우저에서는 구글이 로그인을 제한할 수 있으므로 Safari/Chrome을 사용합니다.

### Kakao

기웃 운영용 카카오 앱은 **`기웃(GIUT)` / 앱 ID `1583057`**입니다. 카카오 로그인은 활성화되어 있으며, 닉네임과 프로필 사진은 선택 동의로 설정했습니다. 이후 설정도 이 앱을 재사용합니다. 앱을 새로 만들면 동일 사용자의 제공자 식별자가 달라질 수 있으므로 임의로 다른 앱으로 교체하지 않습니다.

Kakao Developers에서 해당 앱의 **카카오 로그인 → 사용 설정**을 ON으로 설정합니다. **카카오 로그인 → 동의항목**에서 닉네임·프로필 사진을 설정하고, **앱 → 플랫폼 키 → REST API 키**에서 아래 Redirect URI를 등록합니다.

`https://giut.netlify.app/api/auth/callback/kakao`

같은 REST API 키의 **클라이언트 시크릿** 설정을 확인합니다. 현재 새 REST API 키는 클라이언트 시크릿이 활성화된 상태로 생성됩니다. 기존 키를 사용하는 경우에도 해당 기능이 활성화되어 있어야 합니다. 이메일 권한은 요청하지 않습니다. 지도 SDK의 웹 도메인 `https://giut.netlify.app`과 `KAKAO_JAVASCRIPT_KEY` 설정은 로그인용 REST API 키의 리다이렉트 설정과 별개입니다.

개발용 콜백은 위 URL의 도메인을 `http://localhost:3000`으로 바꿉니다. 배포 미리보기는 해당 주소의 별도 콜백 등록과 테스트용 인증 키가 필요합니다. 운영 인증은 운영 도메인으로 돌아옵니다.

## DB 설계와 접근 경계

사용자별 물리 DB를 만들지 않고, 하나의 DB에서 **검증된 내부 사용자 UUID로 소유권을 분리**합니다. DB 비밀번호는 서버에만 있고 브라우저는 DB에 직접 접근하지 않습니다. 이 설계의 접근 제어는 서버 API에서 시행하며 Supabase RLS를 사용하는 구조가 아닙니다.

| 테이블 | 사용자 소유 데이터·역할 |
| --- | --- |
| `profiles` | UUID, 닉네임, 소개, 소셜 프로필 이미지, 기웃이 스킨 |
| `social_accounts` | `(provider, provider_account_id)` → 내부 UUID. 고유키·외래키로 중복 방지 |
| `spots`, `uploads` | `user_id`로 기록·사진 소유권. AR 메모는 `spots.body`, 분류는 `category`, 위치·경로 포함 |
| `courses`, `course_stops` | `user_id`로 산책/러닝 코스 소유권 및 방문 순서 |
| `reactions` | `(user_id, spot_id, kind)` 고유키. `like`/`save` |
| `scrap_folders`, `folder_spots` | 본인만 조회·편집하는 스크랩 폴더와 장소 순서 |
| `credits` | 서버가 적립한 냥 원장. 잔액은 `SUM(amount)`이며 클라이언트가 수정 불가 |

프로필 닉네임·소개, 업로드한 장소·AR 기록, 공유 코스와 댓글은 기존 서비스 정책대로 공개됩니다. **개인 대시보드·냥 원장·좋아요/스크랩 목록·폴더는 본인만 조회**합니다. 공개 기록도 수정/삭제는 소유자만 가능합니다. 좋아요/스크랩의 전체 개수는 공개됩니다.

Google/Kakao에 같은 이메일이 있더라도 자동으로 계정을 합치지 않습니다. 같은 데이터로 돌아오려면 같은 제공자의 같은 계정으로 로그인해야 합니다. 계정 연결은 본인 소유 확인을 갖춘 별도 기능이 필요합니다. 기존 Sites 계정과 기록도 자동 이전·병합하지 않습니다.

## 로그인 후 상태 관리

1. Auth.js가 소셜 제공자의 응답을 검증하고 서버가 UUID를 조회/생성합니다.
2. 암호화된 HttpOnly 세션 쿠키에 내부 ID가 담깁니다. OAuth access/refresh token은 앱 DB에 저장하지 않습니다.
3. `SessionProvider`의 `useSession()`으로 현재 ID를 받아 `useMyWorkspace()`를 활성화합니다.
4. 훅은 `GET /api/me`를 호출합니다. API는 쿼리 문자열의 사용자 ID를 받지 않고 **서버 세션**으로만 데이터를 선택합니다.
5. React Query 키는 `['me', userId]`입니다. 지도·댓글·폴더 캐시도 계정별로 나누며, 계정 변경 시 이전 요청 취소·캐시 삭제·화면 상태 초기화를 수행합니다.
6. 기록/프로필/좋아요/스크랩/코스 변경 성공 후 `me`를 무효화하여 잔액과 목록을 다시 불러옵니다. 응답은 `private, no-store`입니다.

```tsx
const {data, isPending, isError} = useMyWorkspace();
// data.user: 닉네임, 이미지/스킨, 냥 잔액
// data.mySpots / data.myCourses
// data.interactions.likedSpotIds / savedSpotIds
// data.likedSpots / data.savedSpots / data.ledger
```

## 검증과 운영 주의

```bash
npm run build
node --test --test-concurrency=1 tests/social-workspace.test.mjs tests/netlify-sql.test.mjs tests/request-origin.test.mjs tests/ar-discovery.test.mjs tests/follow-and-collections.test.mjs
```

새 마이그레이션은 기존 데이터를 지우지 않고 프로필 필드와 계정 매핑 테이블만 추가합니다. Netlify Database가 배포 시 마이그레이션을 적용합니다. 테스트는 별도 메모리 PostgreSQL을 사용하며 운영 데이터를 변경하지 않습니다.

실제 OAuth 왕복은 운영자의 키 설정 이후 Google 계정 2개와 Kakao 계정으로 최종 확인해야 합니다. 버튼 표시, 빌드 성공, DB 테스트 통과만으로 실제 로그인이 검증된 것은 아닙니다. 인앱 브라우저/새 기기, 로그아웃 후 재로그인, 다른 계정 전환, 타인의 수정·삭제 거부도 확인하세요.

공식 참고: [Auth.js Google](https://authjs.dev/getting-started/providers/google), [Auth.js Kakao](https://authjs.dev/getting-started/providers/kakao), [Auth.js 설치](https://authjs.dev/getting-started/installation), [카카오 로그인 설정](https://developers.kakao.com/docs/ko/kakaologin/prerequisite), [Netlify 환경변수 범위](https://docs.netlify.com/build/environment-variables/overview/).
