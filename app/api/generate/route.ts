import { NextRequest, NextResponse } from "next/server";
import { readRange, writeRange, ensureSheetExists } from "@/lib/sheets";
import { SCHEDULE_SHEET, REQUEST_SHEET, StaffConfig, MonthRequests, ShiftType } from "@/lib/types";
import { generateSchedule, daysIn } from "@/lib/schedule";
import { loadStaffConfigs, loadRules, loadPrevMonthHistoryMerged } from "@/lib/scheduleData";

export const dynamic = "force-dynamic";

// 근무표_v2 시트 컬럼: 이름 | 직위 | 년 | 월 | 1 | 2 | ... | 31
const SCHED_MAX_ROWS = 3000;

function colToLetter(col: number) {
  let s = "";
  while (col > 0) {
    const rem = (col - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
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
      loadPrevMonthHistoryMerged(prevYear, prevMonth),
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
