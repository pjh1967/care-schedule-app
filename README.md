# care-schedule-app (v3 — 통합 + 디자인 시스템 적용)

care-schedule-app과 care-staff-app을 하나의 Next.js 프로젝트로 합쳤습니다.
저장소·Vercel 프로젝트·환경변수를 하나로 관리하면 됩니다. care-staff-app 저장소는
더 이상 배포하지 않아도 됩니다(별도로 아카이브하거나 그대로 두셔도 무방합니다).

## 라우트 구성
| 경로 | 용도 | 접근 |
|---|---|---|
| `/` | 직원 근무 요청 입력 (달력형) | 공개 (로그인 없음) |
| `/admin` | 근무표 자동생성 + 배정기준 관리 | 비밀번호 로그인 필요 |
| `/login` | 관리자 로그인 | 공개 |

미들웨어(`middleware.ts`)가 `/admin/*`, `/api/generate`, `/api/rules`, `/api/staff-config`만
비밀번호 세션으로 보호하고, `/`, `/api/staff`, `/api/requests`는 그대로 공개로 둡니다 — 지금까지의
"직원은 링크만 있으면 접속, 관리자만 비밀번호"라는 구조가 그대로 유지됩니다.

## 디자인
saesun-care-schedule과 동일한 디자인 시스템(Tailwind CSS)을 적용했습니다.
- 배경 `#f9fafb`(gray-50), 카드는 흰색 + `rounded-xl` + 옅은 테두리
- 포인트 컬러: emerald-700(`#047857`) — 주요 버튼, 강조 텍스트
- 관리자 화면은 좌측 240px 고정 사이드바 + 우측 콘텐츠(반응형, 768px 미만에서 사이드바 토글)
- 버튼/뱃지/배너/입력창 스타일 전부 디자인 가이드 문서 기준으로 통일 (`components/ui.tsx`)

## 시트 구조 (변경 없음)
| 시트 | 용도 |
|---|---|
| `직원마스터` | saesun 기존 시트 재사용 |
| `요청입력_v2` | 직원 요청 |
| `근무표_v2` | 생성 결과 |
| `배정기준_v2` | 순환유형/오프셋/최소근무일/제외요일 + 전체규칙 + 페어링 |

## 환경변수 (saesun-care-schedule과 동일한 이름 사용)
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_SPREADSHEET_ID=...
ADMIN_PASSWORD=관리자_비밀번호   # saesun과 같은 값 재사용 가능
SESSION_SECRET=임의의_긴_랜덤_문자열   # 이 앱에만 필요한 새 값
```
saesun-care-schedule Vercel 프로젝트의 Environment Variables에서 위 이름들을 찾아 값을 그대로
복사해 이 프로젝트에 붙여넣으면 됩니다 (변수 이름이 saesun과 완전히 동일하도록 맞췄습니다).

## 배포 (기존 care-schedule-app 저장소 재사용)
1. 로컬 `care-schedule-app` 폴더에서 `.git`만 남기고 기존 파일 삭제
2. 이 폴더 내용 복사해 넣기
3. `git add . && git commit -m "직원용앱 통합 + 디자인시스템 적용" && git push`
4. Vercel에서 기존 5개 환경변수가 이미 등록되어 있다면 추가 작업 없이 자동 재배포됩니다
5. 배포 후 `/`(직원용)와 `/admin`(관리자용) 둘 다 정상 동작하는지 확인

## 참고
- care-staff-app 저장소/Vercel 프로젝트는 더 이상 사용하지 않습니다. 직원들에게 공유하던
  URL이 있다면, 이 앱의 배포 주소(`/`)로 안내를 바꿔주세요.
- Next.js 16 전환 시 `middleware.ts` → `proxy.ts` 이전이 필요합니다(saesun-care-schedule과 동일 이슈).
