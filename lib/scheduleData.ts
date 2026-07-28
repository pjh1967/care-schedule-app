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
  const [gh, pairRows] = await Promise.all([
    readRange(`${RULES_SHEET}!G2:H2`),
    readRange(`${RULES_SHEET}!J2:L30`),
  ]);
  return {
    maxConsec: gh?.[0]?.[0] ? Number(gh[0][0]) : 5,
    maxWorkDays: gh?.[0]?.[1] ? Number(gh[0][1]) : 26,
    pairs: pairRows.filter((r) => r[0] && r[1]).map((r) => ({ a: r[0], b: r[1], mode: (r[2] as GlobalRules["pairs"][number]["mode"]) || "같은조" })),
  };
}

/** 근무표_v2에서 특정 년/월 전체 행을 읽어 {직원명: [1일..말일]} 형태로 변환 */
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
