import { NextRequest, NextResponse } from "next/server";
import { loadStaffConfigs, loadPrevMonthHistoryMerged } from "@/lib/scheduleData";
import { continuedCycleIndexForDay1, daysIn, weekdayMonFirst } from "@/lib/schedule";
import type { ContinuityDetail } from "@/lib/schedule";
import { CYCLE, ShiftType, StaffConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

// 특정 유형(주간전담/야간전담/주중근무)의 "이번 달 1일" 근무형태를 요청 반영 없이 단순 계산
// (그룹설정 추천 화면에서 미리보기 용도로만 사용 — 실제 생성 시에는 요청 등이 추가로 반영됨)
function previewDay1Shift(type: StaffConfig["type"], wdMon0: number, excludeWeekdays: number[]): ShiftType {
  const excluded = new Set(excludeWeekdays || []);
  if (type === "주중근무") return wdMon0 === 5 || wdMon0 === 6 || excluded.has(wdMon0) ? "/" : "D";
  if (type === "주간전담") return excluded.has(wdMon0) ? "/" : "D";
  if (type === "야간전담") return excluded.has(wdMon0) ? "/" : "N";
  return "/"; // 순환형은 별도 분기에서 처리
}

// POST { year, month } — 이 년/월을 "생성 대상"으로 보고, 그 전달의 실이력을 근거로
// 순환형 직원별 추천 오프셋을 계산한다 (실제로 저장하지는 않음 — 화면에서 검토 후 저장).
export async function POST(req: NextRequest) {
  try {
    const { year, month } = (await req.json()) as { year: number; month: number };
    if (!year || !month) return NextResponse.json({ error: "year, month가 필요합니다." }, { status: 400 });

    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;

    const [staffConfigs, prevMonthHistory] = await Promise.all([loadStaffConfigs(), loadPrevMonthHistoryMerged(prevYear, prevMonth)]);

    // 참고: lib/schedule.ts의 순환형 fallback 로직은 "그룹설정(오프셋)" 값을
    // 이번 달 1일의 순환 인덱스로 그대로 사용한다(별도 기준일 환산 없음).
    // 따라서 여기서도 day1Index를 그대로 오프셋 값으로 반환해야 실제 생성 결과와 일치한다.
    const recommendations: Record<string, { offset: number; basis: "history" | "no-history" }> = {};
    const notes: string[] = [];
    const wdMon0 = weekdayMonFirst(year, month, 1);

    const details: ContinuityDetail[] = staffConfigs
      .filter((emp) => emp.role === "팀장" || emp.role === "요양보호사")
      .map((emp) => {
        const hist = prevMonthHistory[emp.name] || [];
        const histTotal = hist.length;
        const last5: { day: number; shift: ShiftType | undefined }[] = [];
        for (let i = Math.max(0, histTotal - 5); i < histTotal; i++) last5.push({ day: i + 1, shift: hist[i] });
        const prevMonthLabel = `${prevYear}년 ${prevMonth}월`;

        if (emp.type !== "순환") {
          return {
            name: emp.name,
            role: emp.role,
            type: emp.type,
            prevMonthLabel,
            last5,
            startShift: previewDay1Shift(emp.type, wdMon0, emp.excludeWeekdays),
            basis: "fixed" as const,
            groupOffset: null,
          };
        }

        const day1Index = histTotal ? continuedCycleIndexForDay1(hist) : null;
        if (day1Index !== null) {
          recommendations[emp.name] = { offset: day1Index, basis: "history" };
          notes.push(`${emp.name}: 전달 이력 기반 추천 오프셋 ${day1Index} (${prevMonth}월 마지막 실이력 기준, ${year}년 ${month}월 1일 = ${CYCLE[day1Index]})`);
          return { name: emp.name, role: emp.role, type: emp.type, prevMonthLabel, last5, startShift: CYCLE[day1Index], basis: "history" as const, groupOffset: day1Index };
        }
        const fallbackIdx = ((emp.offset % 6) + 6) % 6;
        recommendations[emp.name] = { offset: emp.offset, basis: "no-history" };
        notes.push(`${emp.name}: ${prevMonth}월 이력에서 정상 순환 패턴을 찾지 못함(이력 없음 또는 한 달 내내 불규칙) → 기존 값(${emp.offset}) 유지`);
        return { name: emp.name, role: emp.role, type: emp.type, prevMonthLabel, last5, startShift: CYCLE[fallbackIdx], basis: "fallback" as const, groupOffset: emp.offset };
      });

    return NextResponse.json({ recommendations, notes, details, referenceMonth: { year: prevYear, month: prevMonth }, daysChecked: daysIn(prevYear, prevMonth) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "추천 계산 실패" }, { status: 500 });
  }
}
