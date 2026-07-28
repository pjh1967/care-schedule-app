import { NextRequest, NextResponse } from "next/server";
import { loadStaffConfigs, loadPrevMonthHistoryMerged } from "@/lib/scheduleData";
import { continuedCycleIndexForDay1, daysIn } from "@/lib/schedule";
import { CYCLE } from "@/lib/types";

export const dynamic = "force-dynamic";

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

    staffConfigs.forEach((emp) => {
      if (emp.type !== "순환") return;
      const history = prevMonthHistory[emp.name];
      const day1Index = history ? continuedCycleIndexForDay1(history) : null;
      if (day1Index !== null && day1Index !== undefined) {
        recommendations[emp.name] = { offset: day1Index, basis: "history" };
        notes.push(`${emp.name}: 전달 이력 기반 추천 오프셋 ${day1Index} (${prevMonth}월 마지막 실이력 기준, ${year}년 ${month}월 1일 = ${CYCLE[day1Index]})`);
      } else {
        recommendations[emp.name] = { offset: emp.offset, basis: "no-history" };
        notes.push(`${emp.name}: ${prevMonth}월 이력에서 정상 순환 패턴을 찾지 못함(이력 없음 또는 한 달 내내 불규칙) → 기존 값(${emp.offset}) 유지`);
      }
    });

    return NextResponse.json({ recommendations, notes, referenceMonth: { year: prevYear, month: prevMonth }, daysChecked: daysIn(prevYear, prevMonth) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "추천 계산 실패" }, { status: 500 });
  }
}
