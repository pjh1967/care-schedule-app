// 근무표_v2 자동생성 엔진
//
// 핵심: "전달 근무표 반영" — 이전 달 근무표_v2에 실제로 저장된 마지막 며칠의
// 근무이력을 읽어서, 이번 달 1일의 순환주기(D-D-N-N-/-/, 6일 주기) 위치를
// 실제 이력에 맞춰 이어간다. 이력이 없으면(최초 실행 등) 직원 기본 오프셋으로 대체한다.

import { CYCLE, CycleShift, ShiftType, StaffConfig, GlobalRules, MonthRequests } from "./types";

export function daysIn(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

// 0=월 ~ 6=일
export function weekdayMonFirst(y: number, m: number, d: number) {
  const wd = new Date(y, m - 1, d).getDay(); // 0=일
  return wd === 0 ? 6 : wd - 1;
}

function isCycleShift(s: ShiftType | undefined): s is CycleShift {
  return s === "D" || s === "N" || s === "/";
}

/** 유형별로 고정된 주간 휴무 요일인지 (0=월 ~ 6=일, weekdayMonFirst 기준) */
function isTypeFixedOffDay(type: StaffConfig["type"], wdMon: number): boolean {
  if (type === "주간전담" || type === "야간전담") return wdMon === 6; // 일요일만 기본 휴무
  if (type === "주중근무") return wdMon === 5 || wdMon === 6; // 토·일 휴무 (월~금만 근무)
  return false; // 순환형은 6일 주기 자체에서 휴무가 나옴
}

/**
 * (직전값, 직전직전값) 쌍으로 순환주기 내 "직전값"의 위치(index)를 찾는다.
 * CYCLE = [D,D,N,N,/,/] 은 인접 2개 값 조합이 모두 서로 달라(6가지 조합이 유일)
 * 이 쌍만으로 정확한 위치를 역산할 수 있다.
 */
function findCycleIndex(prev2: CycleShift, prev1: CycleShift): number | null {
  for (let p = 0; p < 6; p++) {
    if (CYCLE[p] === prev1 && CYCLE[(p + 5) % 6] === prev2) return p;
  }
  return null;
}

/**
 * 이전 달 마지막 며칠의 실제 이력(day -> shift)에서 뒤에서부터
 * 순환값(D/N//)인 항목 2개를 찾아 이번 달 1일의 순환 인덱스를 계산한다.
 * 못 찾으면 null (formula fallback 필요).
 */
export function continuedCycleIndexForDay1(prevMonthDays: (ShiftType | undefined)[]): number | null {
  // prevMonthDays: index 0 = 이전달 1일 ... 마지막 = 이전달 말일, 순서대로
  const cycleEntries: CycleShift[] = [];
  for (let i = prevMonthDays.length - 1; i >= 0 && cycleEntries.length < 2; i--) {
    const s = prevMonthDays[i];
    if (isCycleShift(s)) cycleEntries.unshift(s);
  }
  if (cycleEntries.length < 2) return null;
  const [prev2, prev1] = cycleEntries;
  const pIndexOfPrev1 = findCycleIndex(prev2, prev1);
  if (pIndexOfPrev1 === null) return null;
  return (pIndexOfPrev1 + 1) % 6;
}

interface GenerateInput {
  year: number;
  month: number;
  staffConfigs: StaffConfig[];
  rules: GlobalRules;
  requests: MonthRequests; // 이번 달 직원 요청 (최우선 반영)
  prevMonthHistory: Record<string, (ShiftType | undefined)[]>; // 직원명 -> 이전달 1~말일 배열
}

export interface GenerateResult {
  schedule: Record<string, Record<number, ShiftType>>;
  violations: string[];
  continuityNotes: string[];
}

export function generateSchedule(input: GenerateInput): GenerateResult {
  const { year: y, month: m, staffConfigs, rules, requests, prevMonthHistory } = input;
  const total = daysIn(y, m);
  const violations: string[] = [];
  const continuityNotes: string[] = [];
  const sched: Record<string, Record<number, ShiftType>> = {};

  staffConfigs.forEach((emp) => {
    sched[emp.name] = {};
    const req = requests[emp.name] || {};
    const excluded = new Set(emp.excludeWeekdays || []);

    // ── 1단계: 순환 인덱스 결정 (전달 이력 우선, 없으면 설정된 오프셋) ──
    let startIdx: number;
    if (emp.type === "순환") {
      const history = prevMonthHistory[emp.name];
      const continued = history ? continuedCycleIndexForDay1(history) : null;
      if (continued !== null) {
        startIdx = continued;
        continuityNotes.push(`${emp.name}: 전달 실이력 기반 순환 이어가기 적용 (1일 = ${CYCLE[startIdx]})`);
      } else {
        // fallback: 설정된 기본 오프셋을 그대로 1일 인덱스로 사용
        startIdx = ((emp.offset % 6) + 6) % 6;
        continuityNotes.push(`${emp.name}: 전달 이력 부족 → 기본 오프셋(${emp.offset})으로 대체`);
      }
    } else {
      startIdx = -1; // 미사용
    }

    // ── 2단계: 기본 배정 ──
    for (let d = 1; d <= total; d++) {
      const wdMon = weekdayMonFirst(y, m, d);
      const r = req[d];
      if (r) {
        sched[emp.name][d] = r; // 직원 요청 최우선
        continue;
      }
      if (emp.type === "주간전담") {
        sched[emp.name][d] = isTypeFixedOffDay(emp.type, wdMon) || excluded.has(wdMon) ? "/" : "D";
        continue;
      }
      if (emp.type === "야간전담") {
        sched[emp.name][d] = isTypeFixedOffDay(emp.type, wdMon) || excluded.has(wdMon) ? "/" : "N";
        continue;
      }
      if (emp.type === "주중근무") {
        sched[emp.name][d] = isTypeFixedOffDay(emp.type, wdMon) || excluded.has(wdMon) ? "/" : "D";
        continue;
      }
      // 순환형
      const idx = (startIdx + (d - 1)) % 6;
      const base = CYCLE[idx];
      sched[emp.name][d] = base === "/" ? "/" : excluded.has(wdMon) ? "/" : base;
    }

    // ── 3단계: 최대 연속 근무 제한 ──
    let consec = 0;
    for (let d = 1; d <= total; d++) {
      const s = sched[emp.name][d];
      if (s === "D" || s === "N") {
        consec++;
        if (consec > rules.maxConsec && !req[d]) {
          sched[emp.name][d] = "/";
          consec = 0;
        }
      } else {
        consec = 0;
      }
    }

    // ── 4단계: 최소 근무일 보장 ──
    const defShift: ShiftType = emp.type === "야간전담" ? "N" : "D";
    let workCount = Object.values(sched[emp.name]).filter((s) => s === "D" || s === "N").length;
    if (workCount < emp.minWorkDays) {
      let need = emp.minWorkDays - workCount;
      for (let d = 1; d <= total && need > 0; d++) {
        const s = sched[emp.name][d];
        const wdMon = weekdayMonFirst(y, m, d);
        if (s === "/" && !excluded.has(wdMon) && !isTypeFixedOffDay(emp.type, wdMon) && !req[d]) {
          sched[emp.name][d] = defShift;
          need--;
        }
      }
      const after = Object.values(sched[emp.name]).filter((s) => s === "D" || s === "N").length;
      if (after < emp.minWorkDays) violations.push(`${emp.name} 최소근무 미충족 (${after}/${emp.minWorkDays}일)`);
    }

    // ── 5단계: 최대 근무일 초과 제한 ──
    let workCount2 = Object.values(sched[emp.name]).filter((s) => s === "D" || s === "N").length;
    if (workCount2 > rules.maxWorkDays) {
      let over = workCount2 - rules.maxWorkDays;
      for (let d = total; d >= 1 && over > 0; d--) {
        const s = sched[emp.name][d];
        if ((s === "D" || s === "N") && !req[d]) {
          sched[emp.name][d] = "/";
          over--;
        }
      }
    }
  });

  // ── 6단계: 페어링 ──
  (rules.pairs || []).forEach((pair) => {
    if (!pair.a || !pair.b || pair.a === pair.b || !sched[pair.a] || !sched[pair.b]) return;
    for (let d = 1; d <= daysIn(y, m); d++) {
      const sa = sched[pair.a][d];
      const sb = sched[pair.b][d];
      const aWork = sa === "D" || sa === "N";
      const bWork = sb === "D" || sb === "N";
      if (pair.mode === "같은조") {
        if (aWork && !bWork && !requests[pair.b]?.[d]) sched[pair.b][d] = sa;
        else if (!aWork && bWork && !requests[pair.a]?.[d]) sched[pair.a][d] = sb;
      } else if (aWork && bWork && sa === sb && !requests[pair.b]?.[d]) {
        sched[pair.b][d] = "/";
      }
    }
  });

  // ── 최소 근무일수 산정을 위한 최소 인원 점검(경고용) ──
  for (let d = 1; d <= total; d++) {
    let dc = 0,
      nc = 0;
    staffConfigs.forEach((emp) => {
      const s = sched[emp.name][d];
      if (s === "D") dc++;
      if (s === "N") nc++;
    });
    if (dc < 2) violations.push(`${m}/${d} 주간 인원부족(${dc}명)`);
    if (nc < 2) violations.push(`${m}/${d} 야간 인원부족(${nc}명)`);
  }

  return { schedule: sched, violations, continuityNotes };
}
