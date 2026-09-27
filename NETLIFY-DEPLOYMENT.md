# 기웃 Netlify 배포

기존 Sites 운영본을 유지하면서 만든 별도 `netlify-deploy` 브랜치입니다.

- Netlify project: `giut` (`54492173-86f8-4b68-bae1-5a6c0480ffc9`)
- Build: `npm run build`, publish: `.next`
- Runtime: Next.js, Netlify Database (PostgreSQL), Netlify Blobs
- Accounts: Auth.js Google/Kakao. 필요한 운영 설정과 코드·DB 구조는 `SOCIAL-LOGIN-SETUP.md`를 참고합니다. Netlify Identity 활성화는 필요하지 않습니다.
- `KAKAO_JAVASCRIPT_KEY`와 `KAKAO_REST_API_KEY`는 Netlify 비밀 환경변수에 별도로 등록해야 합니다. 기존 Sites의 비밀값을 읽어 복사하지 않습니다.
- Kakao JavaScript SDK 허용 도메인: `https://giut.netlify.app`

## 데이터

기존 Sites D1/R2 데이터와 계정은 원래 사이트에 그대로 보존합니다. 새 Netlify 데이터베이스는 별도 저장소이며 기존 사용자 기록은 아직 이전하지 않았습니다. 원본 계정 ID와 새 소셜 계정 ID를 소유자 확인 없이 연결하지 않습니다.

## 검증

`npm run build`로 Next.js 빌드와 타입 검사를 수행합니다.
`node --test --test-concurrency=1 tests/social-workspace.test.mjs tests/netlify-sql.test.mjs tests/request-origin.test.mjs tests/ar-discovery.test.mjs tests/follow-and-collections.test.mjs tests/place-discoveries.test.mjs`로 계정별 데이터, SQL 변환, 요청 출처 검사, AR/폴더/길안내 및 발견 알림 동작을 검증합니다. 실제 모바일 GPS·카메라 테스트는 별도입니다.

## 탐험과 발견 반응

- 첫 화면에서 현재 위치 주변 3km 또는 직접 고른 지역을 탐색합니다. 둘러보기에는 로그인이 필요하지 않습니다.
- 새 기록은 사진 또는 본문이 있어야 하며, 사진·이야기·선택한 위치가 공개되는 데 동의해야 저장됩니다. 사진은 브라우저에서 다시 인코딩해 위치 메타데이터를 제거합니다.
- `003_place-discoveries`는 기존 기록을 보존하면서 `spots.place_id`와 `discoveries`를 추가합니다. 같은 장소에 이어 쓰기를 선택한 기록만 묶으며, 가까운 좌표라는 이유로 자동 병합하지 않습니다.
- 발견 반응은 로그인된 계정이 다른 이용자의 실제 기록에 한 번만 남길 수 있습니다. 30초 이내 GPS 정보, 50m 이하 오차, 거리와 오차의 합 100m 이내를 서버에서 확인합니다. 기기가 제공하는 위치 정보이므로 엄격한 방문 증명으로 사용하지 않습니다.
- `discoveries`에는 계정·기록 식별자와 등록/읽음 시각만 저장합니다. 방문자 좌표는 저장하지 않습니다. `/api/activity`는 세션으로 검증한 작성자에게만 알림을 반환하며, 방문자 식별자는 반환하지 않습니다. 읽지 않은 알림을 먼저 표시합니다.
- 예시 기록에는 체험용 표시를 유지하며 발견 반응은 허용하지 않습니다. 실제 방문 반응이나 사용자가 올린 사진을 임의로 생성하지 않습니다.

## 장소 상세와 코스 공유

현장 혼잡도 제보 UI와 조회·등록 API를 제거했습니다. 이전 배포의 DB 테이블은 데이터 보존을 위해 변경하지 않으며 새 화면에서는 사용하지 않습니다. 장소 댓글은 ‘댓글’로 표시합니다.

코스 UI는 `components/course-editor.tsx`(코스 이름·코스 이야기와 장소 순서), `components/course-detail.tsx`(상세), `components/course-share.tsx`(외부 공유)로 나뉩니다. 공통 조회·갱신은 `hooks/use-collections.ts`에서 관리합니다. 코스 종류 입력은 제거했고 기존 코스의 내부 이동 모드는 편집 시 유지합니다.

`/?course=<id>` 링크는 `/api/courses/[id]`에서 해당 공개 코스와 순서대로 정렬한 장소를 조회합니다. 코스 목록 150개·지도 기록 500개 제한과 무관하게 직접 조회하며, 비공개 저장 폴더·계정 정보·개인 반응은 반환하지 않습니다. 링크는 코스 수정 후에도 동일하고 삭제된 코스에는 안내가 나옵니다.

공유는 Clipboard API의 링크 복사 및 Web Share API의 기기 공유 목록을 사용합니다. 카카오톡은 기기 공유 목록에 제공될 때 선택할 수 있고, 그렇지 않으면 복사한 링크를 대화방에 붙여넣습니다. 카카오 JavaScript SDK 전용 공유 기능이나 앱 키 설정에 의존하지 않습니다. 실제 앱 전송은 기기에서 확인해야 합니다.

## 업로드 묶음

2026-09-27 UX 수정에서 Quest 타임캡슐 화면과 `/mr` 경로를 제거했습니다. 모바일 AR 탐험은 유지합니다. 현재 수정본은 아직 운영 사이트에 배포하지 않았습니다.

현재 주소 조회는 인증된 `POST /api/location`에서 카카오 Local API를 호출합니다. 기존 `KAKAO_REST_API_KEY`를 우선 사용하고, 없으면 같은 카카오 앱의 REST API 키인 `AUTH_KAKAO_ID`를 사용합니다. 해당 앱의 Local API 사용 권한이 필요합니다. 키는 서버에서만 사용합니다. 위치 권한 또는 주소 조회 실패 시 현재 주소를 재확인할 때까지 새 기록을 저장하지 않습니다.

커밋 후 아래와 같이 새 빈 디렉터리에 소스를 내보냅니다. `app/globals.css`에서 참조하는 `vendor/`도 반드시 포함해야 합니다.

```bash
giut_upload_dir=$(mktemp -d /tmp/giut-netlify.XXXXXX)
git archive HEAD app components hooks lib public vendor netlify next.config.ts postcss.config.mjs package.json package-lock.json tsconfig.json netlify.toml NETLIFY-DEPLOYMENT.md | tar -x -C "$giut_upload_dir"
```

검증은 이 묶음의 별도 복사본에서 `npm ci --no-audit --no-fund` 및 `CONTEXT=production npm run build`로 실행합니다. 업로드할 묶음에는 `.next`, 환경 파일, Git 인증 정보 또는 과거 배포 ZIP을 넣지 않습니다.

운영 사진은 사이트 범위 Blobs에, 비운영 사진은 배포 범위 Blobs에 저장합니다. 빌드 시 비밀값이 아닌 배포 컨텍스트만 고정하며, 데이터베이스 연결은 요청 시 초기화하고 함수 인스턴스 안에서 재사용합니다.

쓰기 요청의 출처는 Netlify가 빌드에 제공하는 `URL`(운영에서만), `DEPLOY_PRIME_URL`, `DEPLOY_URL`로 제한합니다. 내부 프록시 주소나 사용자가 보낸 전달 헤더를 공개 주소로 신뢰하지 않습니다. [Netlify 환경변수 설명](https://docs.netlify.com/build/configure-builds/environment-variables/#deploy-urls-and-metadata)

## 비밀값 보호

빌드 결과와 로컬 환경 파일을 제외한 Git 추적 파일만 배포용 디렉터리에 내보내며, 인증 정보는 소스와 브라우저 번들에 넣지 않습니다. 사이트는 공개이나 쓰기 작업은 Auth.js 서버 세션 검증을 통과한 사용자만 수행할 수 있습니다.
