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
  if (type === "주중근무") return wdMon === 5 || wdMon === 6; // 토·일 휴무 (월~금만 근무)
  return false; // 주간전담/야간전담/순환은 자동 주말휴무 없음 — 제외요일로만 휴무 지정
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
 * 이전 달 실이력에서, 뒤에서부터 "인접한 두 날짜가 모두 순환값(D/N/휴무)이고 정상적인
 * 6일 주기 조합을 이루는" 가장 최근 지점을 찾아, 거기서부터 월말까지 기계적으로 이어간 뒤
 * 이번 달 1일의 순환 인덱스를 계산한다.
 *
 * 단순히 "마지막 2개의 순환값"만 보면, 그 두 값이 하필 수동 조정(대타 등)으로 정상 조합이
 * 아닐 때 곧바로 "이력 부족"으로 포기하게 된다. 이를 방지하기 위해 더 이전 날짜까지
 * 계속 거슬러 올라가며 "정상적으로 이어지는 인접 쌍"을 찾는다.
 */
export function continuedCycleIndexForDay1(prevMonthDays: (ShiftType | undefined)[]): number | null {
  // prevMonthDays: index 0 = 이전달 1일 ... 마지막 = 이전달 말일, 순서대로
  const lastIdx = prevMonthDays.length - 1;
  for (let i = lastIdx; i >= 1; i--) {
    const a = prevMonthDays[i - 1]; // 앞날
    const b = prevMonthDays[i]; // 뒷날 (더 최근)
    if (!isCycleShift(a) || !isCycleShift(b)) continue;
    const pOfB = findCycleIndex(a, b);
    if (pOfB === null) continue; // 이 인접쌍은 정상 조합이 아님 → 더 앞으로 계속 탐색
    const stepsToMonthEnd = lastIdx - i; // b(날짜 i)에서 월말까지 며칠 남았는지
    const lastDayIndex = (pOfB + stepsToMonthEnd) % 6;
    return (lastDayIndex + 1) % 6; // 다음 달 1일 인덱스
  }
  return null; // 한 달 전체를 훑어도 정상 조합을 못 찾음 → 진짜 이력 부족
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
        continuityNotes.push(`${emp.name}: 전달 이력에서 정상 순환 패턴을 찾지 못함(이력 없음 또는 한 달 내내 불규칙) → 기본 오프셋(${emp.offset})으로 대체`);
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

  // ── 7단계: 야간 후 주간 금지(11시간 최소휴식) 위반 수정 ──
  // 앞 단계들(요청 반영/최대연속조정/최소근무일 채우기 등)을 거치며 "N 다음날 D"가
  // 생겼을 수 있으므로, 모든 직원에 대해 마지막에 한 번 더 스캔해서 강제로 고친다.
  // 단, 두 날 모두 직원의 명시적 요청이면 시스템이 임의로 덮어쓰지 않고 경고만 남긴다.
  staffConfigs.forEach((emp) => {
    for (let d = 1; d < total; d++) {
      const cur = sched[emp.name][d];
      const next = sched[emp.name][d + 1];
      if (cur === "N" && next === "D") {
        const curIsReq = !!requests[emp.name]?.[d];
        const nextIsReq = !!requests[emp.name]?.[d + 1];
        if (curIsReq && nextIsReq) {
          violations.push(`${emp.name}: ${m}/${d}(야간)→${m}/${d + 1}(주간) 요청이 최소휴식(11시간) 규정과 충돌 — 직접 확인 필요`);
        } else if (!nextIsReq) {
          sched[emp.name][d + 1] = "/";
        } else {
          // 다음날만 요청이면 그 전날(N) 쪽을 휴무로 조정
          sched[emp.name][d] = "/";
        }
      }
    }
  });

  // ── 8단계: 주중/주말 최소 인원 자동 보충 ──
  for (let d = 1; d <= total; d++) {
    const wdMon = weekdayMonFirst(y, m, d);
    const isWeekend = wdMon === 5 || wdMon === 6;
    const minDay = isWeekend ? rules.minDayStaffWeekend : rules.minDayStaffWeekday;
    const minNight = isWeekend ? rules.minNightStaffWeekend : rules.minNightStaffWeekday;

    const fillShort = (shiftType: "D" | "N", minCount: number) => {
      let count = staffConfigs.filter((e) => sched[e.name][d] === shiftType).length;
      if (count >= minCount) return;
      const candidates = staffConfigs.filter((e) => {
        if (sched[e.name][d] !== "/") return false; // 쉬는 사람만 후보
        if (requests[e.name]?.[d]) return false; // 직원 요청은 건드리지 않음
        const prev = sched[e.name][d - 1];
        const next = sched[e.name][d + 1];
        if (shiftType === "D" && prev === "N") return false; // 야간 다음날 주간 금지
        if (shiftType === "N" && next === "D") return false; // 이 날 야간으로 바꾸면 다음날 주간과 충돌
        return true;
      });
      for (const c of candidates) {
        if (count >= minCount) break;
        sched[c.name][d] = shiftType;
        count++;
      }
      if (count < minCount) {
        violations.push(`${m}/${d}(${isWeekend ? "주말" : "주중"}) ${shiftType === "D" ? "주간" : "야간"} 인원 자동보충 실패 (가능인원 부족, ${count}/${minCount}명)`);
      }
    };

    fillShort("D", minDay);
    fillShort("N", minNight);
  }

  return { schedule: sched, violations, continuityNotes };
}
