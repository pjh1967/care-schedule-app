// 근무기호: saesun-care-schedule과 동일 체계
export const CYCLE = ["D", "D", "N", "N", "/", "/"] as const;
export type CycleShift = (typeof CYCLE)[number];
export type ShiftType = CycleShift | "연차" | "교육";

export const REST_LIKE = new Set<ShiftType>(["/", "연차", "교육"]);

export interface StaffConfig {
  name: string;
  role: string;
  type: "순환" | "주간전담" | "야간전담" | "주중근무";
  offset: number; // 0~5, 순환형만 사용 (설정된 기준값. 실제 생성 시 전달 이력이 있으면 이 값 대신 이력 기반 값을 우선 사용)
  minWorkDays: number;
  excludeWeekdays: number[]; // 0=월 ~ 6=일, 이 요일엔 근무 배정 안 함(공가)
}

export interface GlobalRules {
  maxConsec: number; // 최대 연속 근무일
  maxWorkDays: number; // 최대 근무일수
  minDayStaff: number; // 주간 최소 인원 (법정 최소 기준, 편집 가능)
  minNightStaff: number; // 야간 최소 인원 (법정 최소 기준, 편집 가능)
  pairs: { a: string; b: string; mode: "같은조" | "다른조" }[];
}

export type MonthRequests = Record<string, Record<number, ShiftType>>; // { 직원명: { 일: 근무유형 } }

export const SCHEDULE_SHEET = "근무표_v2";
export const REQUEST_SHEET = "요청입력_v2";
export const RULES_SHEET = "배정기준_v2";
export const STAFF_MASTER_SHEET = "직원마스터"; // saesun 기존 시트 재사용

// ── 직원용 요청 입력 화면에서 쓰는 값 ──────────────────────────
export const SHIFT_TYPES: ShiftType[] = ["D", "N", "연차", "교육", "/"];

export const SHIFT_LABEL: Record<ShiftType, string> = {
  D: "주간",
  N: "야간",
  연차: "연차",
  교육: "교육",
  "/": "휴무",
};

// 디자인 가이드 2-3(semantic) + 보조 sky/indigo 색상 활용
export const SHIFT_BADGE_CLASS: Record<ShiftType, string> = {
  D: "bg-amber-50 text-amber-700 border-amber-200",
  N: "bg-indigo-50 text-indigo-700 border-indigo-200",
  연차: "bg-purple-50 text-purple-700 border-purple-200",
  교육: "bg-sky-50 text-sky-700 border-sky-200",
  "/": "bg-gray-100 text-gray-600 border-gray-200",
};

export interface StaffMember {
  name: string;
  role: string;
}

export type DayRequests = Record<number, ShiftType>; // { 일: 근무유형 }

// ── 직위 구분선/정렬용 그룹 (관리자 화면에서 공용으로 사용) ─────────
export const ROLE_GROUP_LABELS = ["시설장", "부원장", "사회복지사", "간호조무사", "팀장 및 요양보호사", "조리원", "기타"];

export function roleGroupIndex(role: string): number {
  switch (role) {
    case "시설장":
      return 0;
    case "부원장":
      return 1;
    case "사회복지사":
      return 2;
    case "간호조무사":
      return 3;
    case "팀장":
    case "요양보호사":
      return 4;
    case "조리원":
      return 5;
    default:
      return 6;
  }
}

