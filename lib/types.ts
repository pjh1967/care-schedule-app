// 근무기호: saesun-care-schedule과 동일 체계
export const CYCLE = ["D", "D", "N", "N", "/", "/"] as const;
export type CycleShift = (typeof CYCLE)[number];
export type ShiftType = CycleShift | "연차" | "교육";

export const REST_LIKE = new Set<ShiftType>(["/", "연차", "교육"]);

export interface StaffConfig {
  name: string;
  role: string;
  type: "순환" | "주간전담" | "야간전담";
  offset: number; // 0~5, 순환형만 사용 (설정된 기준값. 실제 생성 시 전달 이력이 있으면 이 값 대신 이력 기반 값을 우선 사용)
  minWorkDays: number;
  excludeWeekdays: number[]; // 0=월 ~ 6=일, 이 요일엔 근무 배정 안 함(공가)
}

export interface GlobalRules {
  maxConsec: number; // 최대 연속 근무일
  maxWorkDays: number; // 최대 근무일수
  pairs: { a: string; b: string; mode: "같은조" | "다른조" }[];
}

export type MonthRequests = Record<string, Record<number, ShiftType>>; // { 직원명: { 일: 근무유형 } }

export const SCHEDULE_SHEET = "근무표_v2";
export const REQUEST_SHEET = "요청입력_v2";
export const RULES_SHEET = "배정기준_v2";
export const STAFF_MASTER_SHEET = "직원마스터"; // saesun 기존 시트 재사용
