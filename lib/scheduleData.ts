import { readRange, ensureSheetExists } from "./sheets";
import { SCHEDULE_SHEET, RULES_SHEET, STAFF_MASTER_SHEET, StaffConfig, GlobalRules, ShiftType } from "./types";
import { daysIn } from "./schedule";

const SCHED_MAX_ROWS = 3000;
const DAY_COL_START = 5; // E열부터 1일

export async function loadStaffConfigs(): Promise<StaffConfig[]> {
  const [staffRows, configRows] = await Promise.all([
    readRange(`${STAFF_MASTER_SHEET}!A2:D200`),
    readRange(`${RULES_SHEET}!A2:E200`),
  ]);
  const configByName = new Map<string, string[]>();
  configRows.forEach((r) => {
    if (r[0]) configByName.set(String(r[0]).trim(), r);
  });
  return staffRows
    .filter((r) => r[0])
    .map((r) => {
      const name = String(r[0]).trim();
      const role = String(r[1] ?? "").trim();
      const cfg = configByName.get(name);
      return {
        name,
        role,
        type: (cfg?.[1] as StaffConfig["type"]) || "순환",
        offset: cfg?.[2] ? Number(cfg[2]) : 0,
        minWorkDays: cfg?.[3] ? Number(cfg[3]) : 22,
        excludeWeekdays: cfg?.[4] ? String(cfg[4]).split(",").map(Number).filter((n) => !Number.isNaN(n)) : [],
      };
    });
}

export async function loadRules(): Promise<GlobalRules> {
  const [gh, minStaff, pairRows] = await Promise.all([
    readRange(`${RULES_SHEET}!G2:H2`),
    readRange(`${RULES_SHEET}!N2:Q2`),
    readRange(`${RULES_SHEET}!J2:L30`),
  ]);
  return {
    maxConsec: gh?.[0]?.[0] ? Number(gh[0][0]) : 5,
    maxWorkDays: gh?.[0]?.[1] ? Number(gh[0][1]) : 26,
    minDayStaffWeekday: minStaff?.[0]?.[0] ? Number(minStaff[0][0]) : 2,
    minNightStaffWeekday: minStaff?.[0]?.[1] ? Number(minStaff[0][1]) : 2,
    minDayStaffWeekend: minStaff?.[0]?.[2] ? Number(minStaff[0][2]) : 2,
    minNightStaffWeekend: minStaff?.[0]?.[3] ? Number(minStaff[0][3]) : 2,
    pairs: pairRows.filter((r) => r[0] && r[1]).map((r) => ({ a: r[0], b: r[1], mode: (r[2] as GlobalRules["pairs"][number]["mode"]) || "같은조" })),
  };
}

/**
 * saesun-care-schedule이 이미 쓰고 있는 실제 운영 시트(근무표_1월~근무표_12월)를 "읽기 전용"으로 읽는다.
 * 컬럼 구조: A=이름 B=직위 C=성별 D=업무순위 E~AI=1~31일 (2,3행이 헤더, 3행부터 데이터).
 * 이 앱은 이 시트에 절대 쓰지 않는다 — 전달 실이력 연속성 계산의 "참고 자료"로만 읽는다.
 * 시트가 없거나 형식이 다르면 null을 반환하고, 그 경우 호출부는 자체 근무표_v2 이력으로 대체한다.
 */
export async function loadMonthHistoryFromMonthlySheet(year: number, month: number): Promise<Record<string, (ShiftType | undefined)[]> | null> {
  try {
    const sheetName = `근무표_${month}월`;
    const total = daysIn(year, month);
    const rows = await readRange(`${sheetName}!A3:AI200`);
    if (!rows || rows.length === 0) return null;
    const result: Record<string, (ShiftType | undefined)[]> = {};
    rows.forEach((r) => {
      const name = String(r[0] ?? "").trim();
      if (!name) return;
      const days: (ShiftType | undefined)[] = [];
      for (let d = 1; d <= total; d++) {
        const v = r[4 + (d - 1)]; // E열(5번째, index 4)부터 1일
        days.push((v as ShiftType) || undefined);
      }
      result[name] = days;
    });
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null; // 시트가 없거나 읽기 실패 → 이력 없음으로 취급 (자체 근무표_v2로 대체)
  }
}

/**
 * 전달 실이력 병합: saesun의 근무표_N월(있으면 우선) + 이 앱 자체의 근무표_v2(보완).
 * 같은 이름이 양쪽에 있으면 saesun 쪽 값을 우선 사용한다.
 */
export async function loadPrevMonthHistoryMerged(year: number, month: number): Promise<Record<string, (ShiftType | undefined)[]>> {
  const [fromSaesun, fromV2] = await Promise.all([loadMonthHistoryFromMonthlySheet(year, month), loadMonthHistory(year, month)]);
  return { ...fromV2, ...(fromSaesun || {}) };
}
export async function loadMonthHistory(year: number, month: number): Promise<Record<string, (ShiftType | undefined)[]>> {
  await ensureSheetExists(SCHEDULE_SHEET);
  const rows = await readRange(`${SCHEDULE_SHEET}!A2:AI${SCHED_MAX_ROWS}`);
  const total = daysIn(year, month);
  const result: Record<string, (ShiftType | undefined)[]> = {};
  rows.forEach((r) => {
    const name = String(r[0] ?? "").trim();
    if (!name) return;
    if (Number(r[2]) !== year || Number(r[3]) !== month) return;
    const days: (ShiftType | undefined)[] = [];
    for (let d = 1; d <= total; d++) {
      const v = r[DAY_COL_START - 1 + (d - 1)];
      days.push((v as ShiftType) || undefined);
    }
    result[name] = days;
  });
  return result;
}
