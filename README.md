# GIUT · 기웃

골목대장 고양이 ‘기웃이’와 함께 필터 없는 로컬 스팟을 발견하고, 사진과 AR 메모를 남기며, 나만의 산책·러닝 코스를 공유하는 위치 기반 웹 서비스입니다.

## 주요 기능

- 카카오 지도 기반 주변 스팟 탐색
- 카메라 AR 메모와 고양이 발자국 방향 안내
- 사진·장소 기록, 댓글, 좋아요, 스크랩 폴더
- 사용자 코스 생성 및 공유
- Google·Kakao 소셜 로그인
- 사용자별 프로필, 스팟, 코스, 상호작용 데이터 저장
- Meta Quest 3 WebXR 체험 화면

## 실행 방법

Node.js 22 이상이 필요합니다.

```bash
npm install
npm run dev
```

프로덕션 빌드는 다음 명령으로 확인합니다.

```bash
npm run build
```

## 환경 변수

실제 키는 저장소에 올리지 않고 Netlify의 Environment variables에서 관리합니다.

- `AUTH_SECRET`
- `AUTH_URL`
- `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
- `AUTH_KAKAO_ID`, `AUTH_KAKAO_SECRET`
- `KAKAO_JAVASCRIPT_KEY`, `KAKAO_REST_API_KEY`
- `GIUT_ALLOWED_ORIGINS`

## 배포

Next.js 애플리케이션이며 `netlify.toml` 설정으로 Netlify에 배포할 수 있습니다.
