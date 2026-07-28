import { NextRequest, NextResponse } from "next/server";
import { readRange, writeRange, ensureSheetExists } from "@/lib/sheets";
import { REQUEST_SHEET, DayRequests, ShiftType } from "@/lib/types";

export const dynamic = "force-dynamic";

const HEADER = ["이름", "직위", "년", "월", "일", "근무유형", "제출시각"];
const MAX_ROWS = 4000;

async function readAllRows(): Promise<string[][]> {
  await ensureSheetExists(REQUEST_SHEET);
  const rows = await readRange(`${REQUEST_SHEET}!A1:G${MAX_ROWS}`);
  if (rows.length === 0) {
    await writeRange(`${REQUEST_SHEET}!A1:G1`, [HEADER]);
    return [HEADER];
  }
  return rows;
}

// GET /api/requests?name=홍길동&year=2026&month=8
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");
    const year = Number(searchParams.get("year"));
    const month = Number(searchParams.get("month"));
    if (!name || !year || !month) {
      return NextResponse.json({ error: "name, year, month가 필요합니다." }, { status: 400 });
    }
    const rows = await readAllRows();
    const reqs: DayRequests = {};
    rows.slice(1).forEach((r) => {
      if (String(r[0]).trim() === name && Number(r[2]) === year && Number(r[3]) === month && r[5]) {
        reqs[Number(r[4])] = r[5] as ShiftType;
      }
    });
    return NextResponse.json({ requests: reqs });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "요청 조회 실패" }, { status: 500 });
  }
}

// POST { name, role, year, month, requests: {day: shiftType} }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, role, year, month, requests } = body as {
      name: string;
      role: string;
      year: number;
      month: number;
      requests: DayRequests;
    };
    if (!name || !year || !month) {
      return NextResponse.json({ error: "name, year, month가 필요합니다." }, { status: 400 });
    }

    const rows = await readAllRows();
    const others = rows.slice(1).filter((r) => {
      const sameStaff = String(r[0]).trim() === name;
      const sameMonth = Number(r[2]) === year && Number(r[3]) === month;
      return !(sameStaff && sameMonth);
    });

    const now = new Date().toISOString();
    const newRows = Object.entries(requests)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([day, type]) => [name, role || "", year, month, Number(day), type, now]);

    const allRows = [HEADER, ...others, ...newRows];

    await writeRange(`${REQUEST_SHEET}!A1:G${Math.max(allRows.length, MAX_ROWS)}`, [
      ...allRows,
      ...Array.from({ length: Math.max(0, MAX_ROWS - allRows.length) }, () => ["", "", "", "", "", "", ""]),
    ]);

    return NextResponse.json({ ok: true, saved: newRows.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "요청 저장 실패" }, { status: 500 });
  }
}
