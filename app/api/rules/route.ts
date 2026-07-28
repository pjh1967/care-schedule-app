import { NextRequest, NextResponse } from "next/server";
import { readRange, writeRange, ensureSheetExists } from "@/lib/sheets";
import { RULES_SHEET, GlobalRules } from "@/lib/types";

export const dynamic = "force-dynamic";

// 배정기준_v2 시트 내 별도 영역
//   G2 = 최대연속근무일수, H2 = 최대근무일수
//   J2:L30 = 페어링(직원A, 직원B, 모드)
export async function GET() {
  try {
    await ensureSheetExists(RULES_SHEET);
    const [gh, pairRows] = await Promise.all([
      readRange(`${RULES_SHEET}!G2:H2`),
      readRange(`${RULES_SHEET}!J2:L30`),
    ]);
    const rules: GlobalRules = {
      maxConsec: gh?.[0]?.[0] ? Number(gh[0][0]) : 5,
      maxWorkDays: gh?.[0]?.[1] ? Number(gh[0][1]) : 26,
      pairs: pairRows.filter((r) => r[0] && r[1]).map((r) => ({ a: r[0], b: r[1], mode: (r[2] as GlobalRules["pairs"][number]["mode"]) || "같은조" })),
    };
    return NextResponse.json({ rules });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "조회 실패" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { rules } = (await req.json()) as { rules: GlobalRules };
    await ensureSheetExists(RULES_SHEET);
    await writeRange(`${RULES_SHEET}!G1:H1`, [["최대연속근무일", "최대근무일"]]);
    await writeRange(`${RULES_SHEET}!G2:H2`, [[rules.maxConsec, rules.maxWorkDays]]);
    await writeRange(`${RULES_SHEET}!J1:L1`, [["직원A", "직원B", "모드"]]);
    const pairRows = rules.pairs.map((p) => [p.a, p.b, p.mode]);
    await writeRange(`${RULES_SHEET}!J2:L30`, pairRows.length ? pairRows : [["", "", ""]]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "저장 실패" }, { status: 500 });
  }
}
