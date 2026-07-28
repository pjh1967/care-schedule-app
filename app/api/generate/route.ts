import { NextRequest, NextResponse } from "next/server";
import { readRange, writeRange, ensureSheetExists } from "@/lib/sheets";
import { SCHEDULE_SHEET, REQUEST_SHEET, RULES_SHEET, STAFF_MASTER_SHEET, StaffConfig, GlobalRules, MonthRequests, ShiftType } from "@/lib/types";
import { generateSchedule, daysIn } from "@/lib/schedule";

export const dynamic = "force-dynamic";

// 근무표_v2 시트 컬럼: 이름 | 직위 | 년 | 월 | 1 | 2 | ... | 31
const SCHED_MAX_ROWS = 3000;
const DAY_COL_START = 5; // E열부터 1일

function colToLetter(col: number) {
  let s = "";
  while (col > 0) {
    const rem = (col - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}

async function loadStaffConfigs(): Promise<StaffConfig[]> {
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

async function loadRules(): Promise<GlobalRules> {
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

async function loadRequests(year: number, month: number): Promise<MonthRequests> {
  const rows = await readRange(`${REQUEST_SHEET}!A2:G4000`);
  const reqs: MonthRequests = {};
  rows.forEach((r) => {
    const name = String(r[0] ?? "").trim();
    if (!name) return;
    if (Number(r[2]) !== year || Number(r[3]) !== month) return;
    const day = Number(r[4]);
    const type = r[5] as ShiftType;
    if (!day || !type) return;
    if (!reqs[name]) reqs[name] = {};
    reqs[name][day] = type;
  });
  return reqs;
}

/** 근무표_v2에서 특정 년/월 전체 행을 읽어 {직원명: [1일..말일]} 형태로 변환 */
async function loadMonthHistory(year: number, month: number): Promise<Record<string, (ShiftType | undefined)[]>> {
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

async function saveScheduleToSheet(year: number, month: number, staffConfigs: StaffConfig[], schedule: Record<string, Record<number, ShiftType>>) {
  await ensureSheetExists(SCHEDULE_SHEET);
  const rows = await readRange(`${SCHEDULE_SHEET}!A1:AI${SCHED_MAX_ROWS}`);
  const header = ["이름", "직위", "년", "월", ...Array.from({ length: 31 }, (_, i) => String(i + 1))];
  const others = (rows.length ? rows.slice(1) : []).filter((r) => !(Number(r[2]) === year && Number(r[3]) === month));

  const total = daysIn(year, month);
  const newRows = staffConfigs.map((emp) => {
    const dayVals = Array.from({ length: 31 }, (_, i) => {
      const d = i + 1;
      if (d > total) return "";
      return schedule[emp.name]?.[d] || "";
    });
    return [emp.name, emp.role, year, month, ...dayVals];
  });

  const allRows = [header, ...others, ...newRows];
  const lastCol = colToLetter(4 + 31); // AI
  await writeRange(`${SCHEDULE_SHEET}!A1:${lastCol}${Math.max(allRows.length, SCHED_MAX_ROWS)}`, [
    ...allRows,
    ...Array.from({ length: Math.max(0, SCHED_MAX_ROWS - allRows.length) }, () => Array(4 + 31).fill("")),
  ]);
}

export async function POST(req: NextRequest) {
  try {
    const { year, month } = (await req.json()) as { year: number; month: number };
    if (!year || !month) return NextResponse.json({ error: "year, month가 필요합니다." }, { status: 400 });

    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;

    const [staffConfigs, rules, requests, prevMonthHistory] = await Promise.all([
      loadStaffConfigs(),
      loadRules(),
      loadRequests(year, month),
      loadMonthHistory(prevYear, prevMonth),
    ]);

    if (staffConfigs.length === 0) {
      return NextResponse.json({ error: "직원마스터 시트에서 직원 정보를 찾을 수 없습니다." }, { status: 400 });
    }

    const result = generateSchedule({ year, month, staffConfigs, rules, requests, prevMonthHistory });
    await saveScheduleToSheet(year, month, staffConfigs, result.schedule);

    return NextResponse.json({
      schedule: result.schedule,
      violations: result.violations,
      continuityNotes: result.continuityNotes,
      staff: staffConfigs.map((s) => ({ name: s.name, role: s.role })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "근무표 생성 실패" }, { status: 500 });
  }
}
