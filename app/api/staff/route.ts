import { NextResponse } from "next/server";
import { readRange } from "@/lib/sheets";
import { STAFF_MASTER_SHEET, StaffMember } from "@/lib/types";

export const dynamic = "force-dynamic";

// saesun-care-schedule의 직원마스터 시트(이름/직위/성별/업무순위)를 그대로 읽어온다.
export async function GET() {
  try {
    const rows = await readRange(`${STAFF_MASTER_SHEET}!A2:D200`);
    const staff: StaffMember[] = rows
      .filter((r) => r[0])
      .map((r) => ({ name: String(r[0]).trim(), role: String(r[1] ?? "").trim() }));
    return NextResponse.json({ staff });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "직원 목록 조회 실패" }, { status: 500 });
  }
}
