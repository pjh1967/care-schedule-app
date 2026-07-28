import { NextRequest, NextResponse } from "next/server";
import { readRange, writeRange, ensureSheetExists } from "@/lib/sheets";
import { REQUEST_SHEET, STAFF_MASTER_SHEET, ShiftType } from "@/lib/types";

export const dynamic = "force-dynamic";

const HEADER = ["이름", "직위", "년", "월", "일", "근무유형", "제출시각"];
const MAX_ROWS = 4000;

// GET /api/admin-requests?year=2026&month=8
// 요청입력_v2 시트 전체를 읽어, 해당 년/월에 해당하는 모든 직원의 요청을 날짜별로 묶어서 반환한다.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year"));
    const month = Number(searchParams.get("month"));
    if (!year || !month) return NextResponse.json({ error: "year, month가 필요합니다." }, { status: 400 });

    const [staffRows, reqRows] = await Promise.all([
      readRange(`${STAFF_MASTER_SHEET}!A2:B200`),
      readRange(`${REQUEST_SHEET}!A2:G4000`),
    ]);

    const roleByName = new Map<string, string>();
    staffRows.forEach((r) => {
      const name = String(r[0] ?? "").trim();
      if (name) roleByName.set(name, String(r[1] ?? "").trim());
    });

    // { 일: [{name, role, type}] }
    const byDay: Record<number, { name: string; role: string; type: ShiftType }[]> = {};
    reqRows.forEach((r) => {
      const name = String(r[0] ?? "").trim();
      if (!name) return;
      if (Number(r[2]) !== year || Number(r[3]) !== month) return;
      const day = Number(r[4]);
      const type = r[5] as ShiftType;
      if (!day || !type) return;
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push({ name, role: roleByName.get(name) || "", type });
    });

    return NextResponse.json({ byDay });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "조회 실패" }, { status: 500 });
  }
}

// POST { year, month, day, entries: {name, role, type}[] }
// 관리자가 특정 날짜의 전체 요청을 한 번에 저장한다. entries에 없는 직원은 그 날짜 요청이 삭제된다.
export async function POST(req: NextRequest) {
  try {
    const { year, month, day, entries } = (await req.json()) as {
      year: number;
      month: number;
      day: number;
      entries: { name: string; role?: string; type: ShiftType }[];
    };
    if (!year || !month || !day) return NextResponse.json({ error: "year, month, day가 필요합니다." }, { status: 400 });

    await ensureSheetExists(REQUEST_SHEET);
    const rows = await readRange(`${REQUEST_SHEET}!A1:G${MAX_ROWS}`);
    const existing = rows.length ? rows.slice(1) : [];

    // 이 (년,월,일)에 해당하는 기존 행은 전부 제거하고, entries로 다시 채운다.
    const others = existing.filter((r) => !(Number(r[2]) === year && Number(r[3]) === month && Number(r[4]) === day));

    const now = new Date().toISOString();
    const newRows = (entries || []).map((e) => [e.name, e.role || "", year, month, day, e.type, now]);

    const allRows = [HEADER, ...others, ...newRows];
    await writeRange(`${REQUEST_SHEET}!A1:G${Math.max(allRows.length, MAX_ROWS)}`, [
      ...allRows,
      ...Array.from({ length: Math.max(0, MAX_ROWS - allRows.length) }, () => ["", "", "", "", "", "", ""]),
    ]);

    return NextResponse.json({ ok: true, saved: newRows.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "저장 실패" }, { status: 500 });
  }
}
