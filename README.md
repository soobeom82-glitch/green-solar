# Solar View

그린솔라 발전소의 실시간 출력, 발전량 추이, 설비 상태와 장애 정보를 확인하는 반응형 대시보드입니다. Next.js App Router와 Vercel Functions를 기준으로 구성되어 있습니다.

## 주요 기능

- 전체·발전소별 현재 출력과 금일/금월/누적 발전량
- 시간별 출력 및 최근 일별 발전량 추이
- 발전소 상태와 통신 지연 표시
- 장애·알림 및 월간 보고서 화면
- 30초 자동 갱신
- NREMS 연동 실패 또는 미설정 시 데모 모드
- 데스크톱 및 모바일 반응형 UI

## 로컬 실행

```bash
npm install
npm run dev -- --hostname 127.0.0.1
```

브라우저에서 `http://127.0.0.1:3000`을 엽니다.

## 환경변수

`.env.example`을 참고해 아래 서버 전용 변수를 설정합니다. 계정정보에 `NEXT_PUBLIC_` 접두사를 붙이면 안 됩니다.

```text
NREMS_USER=
NREMS_PASSWORD=
NREMS_BASE_URL=http://nrems.co.kr
NREMS_GROUP_ID=726
NREMS_MANAGER_GROUP_ID=0
NREMS_STRICT=false
```

Vercel에서는 Project Settings → Environment Variables에 같은 이름으로 등록합니다.

## 확인 명령

```bash
npm run typecheck
npm run build
```

## API 경로

- `GET /api/dashboard`: NREMS 데이터를 대시보드 형식으로 정규화
- `GET /api/health`: 서버 및 NREMS 환경변수 설정 상태 확인

NREMS 계정정보와 로그인 세션은 Route Handler 내부에서만 사용되며 브라우저 번들에 포함되지 않습니다.
