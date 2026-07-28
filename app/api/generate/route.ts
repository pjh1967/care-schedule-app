import { NextRequest, NextResponse } from "next/server";
import { readRange, writeRange, ensureSheetExists } from "@/lib/sheets";
import { SCHEDULE_SHEET, REQUEST_SHEET, StaffConfig, MonthRequests, ShiftType } from "@/lib/types";
import { generateSchedule, daysIn } from "@/lib/schedule";
import { loadStaffConfigs, loadRules, loadPrevMonthHistoryMerged } from "@/lib/scheduleData";

export const dynamic = "force-dynamic";

// 근무표_v2 시트 형식 (saesun의 근무표_N월 실제 시트와 동일한 레이아웃):
//   A1 = "년.월" (예: 2026.8)
//   2행 = 이름 | 직위 | 성별 | 업무순위 | 1 | 2 | ... | 31 (날짜 헤더)
//   1행의 E열부터 = 각 날짜에 해당하는 요일
//   3행부터 = 실제 데이터
// 한 시트에는 "가장 최근에 생성한 한 달치"만 보관한다(확정 후 실제 근무표_N월 시트로
// 수동 복사하는 걸 전제로 하므로, 매달 생성할 때마다 덮어씀).
const SCHED_MAX_ROWS = 3000;
const WD_LABELS = ["일", "월", "화", "수", "목", "금", "토"]; // Date.getDay() 순서

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
  const total = daysIn(year, month);

  // 1행: A1 = 년.월, E1부터 각 날짜의 요일
  const row1: (string | number)[] = [`${year}.${month}`, "", "", ""];
  for (let d = 1; d <= 31; d++) {
    if (d <= total) {
      const wd = new Date(year, month - 1, d).getDay();
      row1.push(WD_LABELS[wd]);
    } else {
      row1.push("");
    }
  }

  // 2행: 헤더
  const row2 = ["이름", "직위", "성별", "업무순위", ...Array.from({ length: 31 }, (_, i) => String(i + 1))];

  // 3행부터: 데이터
  const dataRows = staffConfigs.map((emp) => {
    const dayVals = Array.from({ length: 31 }, (_, i) => {
      const d = i + 1;
      if (d > total) return "";
      return schedule[emp.name]?.[d] || "";
    });
    return [emp.name, emp.role, emp.gender || "", emp.rank || "", ...dayVals];
  });

  const allRows = [row1, row2, ...dataRows];
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
      continuityDetails: result.continuityDetails,
      staff: staffConfigs.map((s) => ({ name: s.name, role: s.role })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "근무표 생성 실패" }, { status: 500 });
  }
}
