import { NextRequest, NextResponse } from "next/server";
import { readRange, writeRange, ensureSheetExists } from "@/lib/sheets";
import { RULES_SHEET, STAFF_MASTER_SHEET, StaffConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

// 배정기준_v2!A2:E200 : 이름 | 유형(순환/주간전담/야간전담) | 오프셋(0-5) | 최소근무일 | 제외요일(콤마, 0=월~6=일)
const CONFIG_RANGE = "A2:E200";
const CONFIG_HEADER = ["이름", "유형", "오프셋", "최소근무일", "제외요일(0=월,6=일 콤마구분)"];

export async function GET() {
  try {
    await ensureSheetExists(RULES_SHEET);
    const [staffRows, configRows] = await Promise.all([
      readRange(`${STAFF_MASTER_SHEET}!A2:D200`),
      readRange(`${RULES_SHEET}!${CONFIG_RANGE}`),
    ]);

    const configByName = new Map<string, string[]>();
    configRows.forEach((r) => {
      if (r[0]) configByName.set(String(r[0]).trim(), r);
    });

    const staffConfigs: StaffConfig[] = staffRows
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

    return NextResponse.json({ staffConfigs });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "조회 실패" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { staffConfigs } = (await req.json()) as { staffConfigs: StaffConfig[] };
    await ensureSheetExists(RULES_SHEET);
    const rows = staffConfigs.map((s) => [s.name, s.type, s.offset, s.minWorkDays, (s.excludeWeekdays || []).join(",")]);
    await writeRange(`${RULES_SHEET}!A1:E1`, [CONFIG_HEADER]);
    await writeRange(`${RULES_SHEET}!${CONFIG_RANGE}`, rows.length ? rows : [["", "", "", "", ""]]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "저장 실패" }, { status: 500 });
  }
}
