"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { StaffConfig, GlobalRules, ShiftType, SHIFT_BADGE_CLASS, roleGroupIndex, ROLE_GROUP_LABELS } from "@/lib/types";
import type { ContinuityDetail } from "@/lib/schedule";
import { Button, Card, Select, Input } from "@/components/ui";

const WD_MON_FIRST = ["월", "화", "수", "목", "금", "토", "일"]; // 0=월 ~ 6=일 (lib/schedule.ts weekdayMonFirst와 동일 순서)

// 유형별 배정기준 행 배경색 (주간전담/야간전담 시각 구분)
const TYPE_ROW_CLASS: Record<StaffConfig["type"], string> = {
  순환: "",
  주간전담: "bg-amber-50",
  야간전담: "bg-indigo-50",
  주중근무: "bg-sky-50",
};

function groupedStaff<T extends { role: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => roleGroupIndex(a.role) - roleGroupIndex(b.role));
}

function roleAbbrev(role: string): string {
  return role ? `${role[0]})` : "";
}

export default function AdminPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [staffConfigs, setStaffConfigs] = useState<StaffConfig[]>([]);
  const [rules, setRules] = useState<GlobalRules>({
    maxConsec: 5,
    maxWorkDays: 26,
    minDayStaffWeekday: 2,
    minNightStaffWeekday: 2,
    minDayStaffWeekend: 2,
    minNightStaffWeekend: 2,
    pairs: [],
  });
  const [schedule, setSchedule] = useState<Record<string, Record<number, ShiftType>> | null>(null);
  const [violations, setViolations] = useState<string[]>([]);
  const [continuityNotes, setContinuityNotes] = useState<string[]>([]);
  const [continuityDetails, setContinuityDetails] = useState<ContinuityDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const [scRes, rRes] = await Promise.all([fetch("/api/staff-config"), fetch("/api/rules")]);
      const sc = await scRes.json();
      const r = await rRes.json();
      if (sc.staffConfigs) setStaffConfigs(sc.staffConfigs);
      if (r.rules) setRules(r.rules);
    })();
  }, []);

  const saveConfig = async () => {
    setLoading(true);
    setMsg("설정 저장 중...");
    await fetch("/api/staff-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staffConfigs }) });
    await fetch("/api/rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rules }) });
    setMsg("설정 저장 완료");
    setLoading(false);
  };

  const generate = async () => {
    setLoading(true);
    setMsg("근무표 생성 중...");
    setSchedule(null);
    setContinuityDetails([]);
    try {
      const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year, month }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSchedule(data.schedule);
      setViolations(data.violations || []);
      setContinuityNotes(data.continuityNotes || []);
      setContinuityDetails(data.continuityDetails || []);
      setMsg("생성 완료 (근무표_v2 시트에 저장됨)");
    } catch (e) {
      setMsg("생성 실패: " + (e instanceof Error ? e.message : String(e)));
    }
    setLoading(false);
  };

  const updateConfig = (name: string, patch: Partial<StaffConfig>) => {
    setStaffConfigs((prev) => prev.map((s) => (s.name === name ? { ...s, ...patch } : s)));
  };

  const toggleExcludeWeekday = (name: string, idx: number) => {
    setStaffConfigs((prev) =>
      prev.map((s) => {
        if (s.name !== name) return s;
        const cur = new Set(s.excludeWeekdays || []);
        if (cur.has(idx)) cur.delete(idx);
        else cur.add(idx);
        return { ...s, excludeWeekdays: Array.from(cur).sort((a, b) => a - b) };
      })
    );
  };

  const addPair = () => {
    if (staffConfigs.length < 2) return;
    setRules((prev) => ({ ...prev, pairs: [...prev.pairs, { a: staffConfigs[0].name, b: staffConfigs[1].name, mode: "같은조" }] }));
  };

  const updatePair = (idx: number, patch: Partial<GlobalRules["pairs"][number]>) => {
    setRules((prev) => ({ ...prev, pairs: prev.pairs.map((p, i) => (i === idx ? { ...p, ...patch } : p)) }));
  };

  const removePair = (idx: number) => {
    setRules((prev) => ({ ...prev, pairs: prev.pairs.filter((_, i) => i !== idx) }));
  };

  const recommendOffsets = async () => {
    setLoading(true);
    setMsg("전달 실이력 기반 그룹설정 추천 계산 중...");
    try {
      const res = await fetch("/api/recommend-offsets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStaffConfigs((prev) =>
        prev.map((s) => {
          const rec = data.recommendations?.[s.name];
          return rec ? { ...s, offset: rec.offset } : s;
        })
      );
      setContinuityNotes(data.notes || []);
      setContinuityDetails(data.details || []);
      setMsg(`${data.referenceMonth?.month ?? ""}월 실이력 기반 추천값을 그룹설정 칸에 채웠습니다. 확인 후 "설정 저장"을 눌러주세요.`);
    } catch (e) {
      setMsg("추천 실패: " + (e instanceof Error ? e.message : String(e)));
    }
    setLoading(false);
  };

  const total = new Date(year, month, 0).getDate();

  // 배정기준 표: 직위 그룹 순서로 정렬
  const sortedConfigs = useMemo(() => groupedStaff(staffConfigs), [staffConfigs]);

  // 근무표 표: staffConfigs의 role 정보를 이름으로 매핑해 사용
  const roleByName = useMemo(() => {
    const m: Record<string, string> = {};
    staffConfigs.forEach((s) => (m[s.name] = s.role));
    return m;
  }, [staffConfigs]);

  const sortedScheduleNames = useMemo(() => {
    if (!schedule) return [];
    return groupedStaff(Object.keys(schedule).map((name) => ({ name, role: roleByName[name] || "" }))).map((s) => s.name);
  }, [schedule, roleByName]);

  // 팀장/요양보호사, 조리원 이름 목록 (일별 합계 계산용)
  const caregiverNames = useMemo(() => staffConfigs.filter((s) => s.role === "팀장" || s.role === "요양보호사").map((s) => s.name), [staffConfigs]);
  const cookNames = useMemo(() => staffConfigs.filter((s) => s.role === "조리원").map((s) => s.name), [staffConfigs]);

  const dayCareCount = (d: number) => (schedule ? caregiverNames.filter((n) => schedule[n]?.[d] === "D").length : 0);
  const nightCareCount = (d: number) => (schedule ? caregiverNames.filter((n) => schedule[n]?.[d] === "N").length : 0);
  const careTotalCount = (d: number) => dayCareCount(d) + nightCareCount(d);
  const cookWorkCount = (d: number) => (schedule ? cookNames.filter((n) => schedule[n]?.[d] === "D" || schedule[n]?.[d] === "N").length : 0);
  const allTotalCount = (d: number) => careTotalCount(d) + cookWorkCount(d);

  const personalTotals = (name: string) => {
    if (!schedule) return { D: 0, N: 0, 연차: 0, 공가: 0 };
    const days = schedule[name] || {};
    let D = 0,
      N = 0,
      leave = 0,
      off = 0;
    Object.values(days).forEach((s) => {
      if (s === "D") D++;
      else if (s === "N") N++;
      else if (s === "연차") leave++;
      else if (s === "/") off++;
    });
    return { D, N, 연차: leave, 공가: off };
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      <h1 className="text-xl font-bold text-gray-900">근무표 편성</h1>

      <Card id="generate">
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <div className="text-xs text-gray-500 mb-1">년도</div>
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-auto">
              {[2025, 2026, 2027].map((y) => (
                <option key={y}>{y}</option>
              ))}
            </Select>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">월</div>
            <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-auto">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}월
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={generate} disabled={loading}>
            {loading ? "처리 중..." : `${year}년 ${month}월 근무표 생성`}
          </Button>
          {msg && <div className="text-sm text-amber-700">{msg}</div>}
        </div>
      </Card>

      {continuityDetails.length > 0 && (
        <Card noPadding className="overflow-x-auto">
          <div className="px-4 pt-4 pb-2">
            <div className="text-sm font-semibold text-emerald-700">연속성 반영 내역 — 팀장·요양보호사</div>
            <div className="text-xs text-gray-500 mt-0.5">{continuityDetails[0]?.prevMonthLabel} 마지막 5일 실이력 → {month}월 1일 시작 근무형태 · 그룹설정</div>
          </div>
          <table className="min-w-[720px] text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs">
                <th className="text-left px-3 py-2 font-medium border-b border-gray-200">이름</th>
                <th className="px-2 py-2 font-medium border-b border-gray-200">직위</th>
                {Array.from({ length: 5 }, (_, i) => {
                  const entry = continuityDetails[0]?.last5[i];
                  const monthLabel = continuityDetails[0]?.prevMonthLabel?.split(" ")[1] || "";
                  return (
                    <th key={i} className="px-1 py-2 font-medium border-b border-gray-200 leading-tight">
                      <div className="text-[10px] text-gray-400">{monthLabel}</div>
                      <div>{entry ? `${entry.day}일` : "-"}</div>
                    </th>
                  );
                })}
                <th className="px-2 py-2 font-medium border-b border-l border-gray-200">{month}월 1일</th>
                <th className="px-2 py-2 font-medium border-b border-gray-200">그룹설정</th>
                <th className="px-2 py-2 font-medium border-b border-gray-200">근거</th>
              </tr>
            </thead>
            <tbody>
              {continuityDetails.map((cd) => (
                <tr key={cd.name} className="border-t border-gray-100">
                  <td className="px-3 py-1.5 font-medium text-gray-800">{cd.name}</td>
                  <td className="px-2 py-1.5 text-gray-500">{cd.role}</td>
                  {Array.from({ length: 5 }, (_, i) => {
                    const entry = cd.last5[i];
                    return (
                      <td key={i} className="text-center px-1 py-1.5">
                        {entry?.shift ? (
                          <span className={`inline-flex w-6 h-6 items-center justify-center rounded border text-xs font-medium ${SHIFT_BADGE_CLASS[entry.shift]}`}>{entry.shift}</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-center px-2 py-1.5 border-l border-gray-100">
                    {cd.startShift ? (
                      <span className={`inline-flex w-6 h-6 items-center justify-center rounded border text-xs font-medium ${SHIFT_BADGE_CLASS[cd.startShift]}`}>{cd.startShift}</span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="text-center px-2 py-1.5 text-gray-600">{cd.groupOffset ?? "-"}</td>
                  <td className="text-center px-2 py-1.5">
                    {cd.basis === "history" && <span className="text-emerald-700 text-xs font-medium">이력기반</span>}
                    {cd.basis === "fallback" && <span className="text-amber-700 text-xs font-medium">기본값</span>}
                    {cd.basis === "fixed" && <span className="text-gray-400 text-xs font-medium">고정유형</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {(violations.length > 0 || (continuityNotes.length > 0 && continuityDetails.length === 0)) && (
        <Card>
          {continuityNotes.length > 0 && continuityDetails.length === 0 && (
            <div className="mb-3">
              <div className="text-sm font-semibold text-emerald-700 mb-1.5">연속성 반영 내역</div>
              {continuityNotes.map((n, i) => (
                <div key={i} className="text-sm text-gray-600">
                  {n}
                </div>
              ))}
            </div>
          )}
          {violations.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-amber-700 mb-1.5">확인 필요</div>
              {violations.map((v, i) => (
                <div key={i} className="text-sm text-amber-700">
                  {v}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {schedule && (
        <Card noPadding className="overflow-x-auto">
          <table className="min-w-[1100px] text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left font-medium border-b border-gray-200 z-10">이름</th>
                <th className="sticky left-[72px] bg-gray-50 px-2 py-2 text-left font-medium border-b border-gray-200 z-10">직위</th>
                {Array.from({ length: total }, (_, i) => {
                  const d = i + 1;
                  const wd = new Date(year, month - 1, d).getDay();
                  const wdLabel = ["일", "월", "화", "수", "목", "금", "토"][wd];
                  const wdColor = wd === 0 ? "text-red-500" : wd === 6 ? "text-blue-600" : "text-gray-400";
                  return (
                    <th key={i} className="px-1 py-2 font-medium border-b border-gray-200 leading-tight">
                      <div>{d}</div>
                      <div className={`text-[10px] font-normal ${wdColor}`}>({wdLabel})</div>
                    </th>
                  );
                })}
                <th className="px-1.5 py-2 font-medium border-b border-l border-gray-200 bg-amber-50 text-amber-700">주간</th>
                <th className="px-1.5 py-2 font-medium border-b border-gray-200 bg-indigo-50 text-indigo-700">야간</th>
                <th className="px-1.5 py-2 font-medium border-b border-gray-200 bg-purple-50 text-purple-700">연차</th>
                <th className="px-1.5 py-2 font-medium border-b border-gray-200 bg-gray-100 text-gray-600">합계</th>
              </tr>
            </thead>
            <tbody>
              {sortedScheduleNames.map((name, idx) => {
                const role = roleByName[name] || "";
                const prevRole = idx > 0 ? roleByName[sortedScheduleNames[idx - 1]] || "" : null;
                const showDivider = idx > 0 && roleGroupIndex(role) !== roleGroupIndex(prevRole || "");
                const days = schedule[name];
                const t = personalTotals(name);
                return (
                  <Fragment key={name}>
                    {showDivider && (
                      <tr key={`div-${name}`}>
                        <td colSpan={2 + total} className="sticky left-0 bg-gray-100 border-y border-gray-200 px-3 py-1 text-xs font-semibold text-gray-500">
                          {ROLE_GROUP_LABELS[roleGroupIndex(role)]}
                        </td>
                        <td colSpan={4} className="bg-gray-100 border-y border-gray-200"></td>
                      </tr>
                    )}
                    <tr key={name} className="border-b border-gray-100 last:border-0">
                      <td className="sticky left-0 bg-white px-3 py-1.5 font-medium text-gray-800 z-10">{name}</td>
                      <td className="sticky left-[72px] bg-white px-2 py-1.5 text-gray-500 z-10">{roleAbbrev(role)}</td>
                      {Array.from({ length: total }, (_, i) => {
                        const d = i + 1;
                        const s = days[d] || "";
                        return (
                          <td key={d} className="text-center px-0.5 py-1.5">
                            {s && <span className={`inline-flex w-6 h-6 items-center justify-center rounded border text-xs font-medium ${SHIFT_BADGE_CLASS[s]}`}>{s}</span>}
                          </td>
                        );
                      })}
                      <td className="text-center px-1.5 py-1.5 border-l border-gray-100 font-semibold text-amber-700">{t.D}</td>
                      <td className="text-center px-1.5 py-1.5 font-semibold text-indigo-700">{t.N}</td>
                      <td className="text-center px-1.5 py-1.5 font-semibold text-purple-700">{t.연차}</td>
                      <td className="text-center px-1.5 py-1.5 font-semibold text-gray-600">{t.D + t.N + t.연차}</td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              {[
                { label: "요)주간", tone: "text-amber-700 bg-amber-50", calc: dayCareCount },
                { label: "요)야간", tone: "text-indigo-700 bg-indigo-50", calc: nightCareCount },
                { label: "요)주야", tone: "text-gray-700 bg-gray-100", calc: careTotalCount },
                { label: "요+조)", tone: "text-emerald-700 bg-emerald-50", calc: allTotalCount },
              ].map((row) => (
                <tr key={row.label} className={row.tone}>
                  <th className={`sticky left-0 px-3 py-1 text-left font-semibold border-t border-gray-200 z-10 ${row.tone}`}>{row.label}</th>
                  <th className={`sticky left-[72px] px-2 py-1 border-t border-gray-200 z-10 ${row.tone}`}></th>
                  {Array.from({ length: total }, (_, i) => (
                    <th key={i} className="px-1 py-1 font-semibold border-t border-gray-200">
                      {row.calc(i + 1)}
                    </th>
                  ))}
                  <th className="border-t border-l border-gray-200"></th>
                  <th className="border-t border-gray-200"></th>
                  <th className="border-t border-gray-200"></th>
                  <th className="border-t border-gray-200"></th>
                </tr>
              ))}
            </tfoot>
          </table>
        </Card>
      )}

      <Card id="rules">
        <div className="flex justify-between items-center mb-4">
          <div className="text-base font-semibold text-gray-900">배정 기준</div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={recommendOffsets} disabled={loading}>
              {year}년 {month}월 기준 · 전달 실이력으로 그룹설정 추천받기
            </Button>
            <Button variant="outline" onClick={saveConfig} disabled={loading}>
              설정 저장
            </Button>
          </div>
        </div>
        {msg && <div className="text-sm text-amber-700 mb-3">{msg}</div>}
        <div className="flex gap-6 mb-3 flex-wrap">
          <div>
            <div className="text-xs text-gray-500 mb-1">최대 연속 근무일</div>
            <Input type="number" value={rules.maxConsec} onChange={(e) => setRules({ ...rules, maxConsec: Number(e.target.value) })} className="w-24" />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">최대 근무일수</div>
            <Input type="number" value={rules.maxWorkDays} onChange={(e) => setRules({ ...rules, maxWorkDays: Number(e.target.value) })} className="w-24" />
          </div>
        </div>
        <div className="text-xs text-gray-500 mb-1.5 font-medium">법정 기준</div>
        <div className="flex gap-6 mb-5 flex-wrap items-end">
          <div>
            <div className="text-xs text-gray-500 mb-1">주중 주간 최소 인원</div>
            <Input type="number" value={rules.minDayStaffWeekday} onChange={(e) => setRules({ ...rules, minDayStaffWeekday: Number(e.target.value) })} className="w-24" />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">주중 야간 최소 인원</div>
            <Input type="number" value={rules.minNightStaffWeekday} onChange={(e) => setRules({ ...rules, minNightStaffWeekday: Number(e.target.value) })} className="w-24" />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">주말 주간 최소 인원</div>
            <Input type="number" value={rules.minDayStaffWeekend} onChange={(e) => setRules({ ...rules, minDayStaffWeekend: Number(e.target.value) })} className="w-24" />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">주말 야간 최소 인원</div>
            <Input type="number" value={rules.minNightStaffWeekend} onChange={(e) => setRules({ ...rules, minNightStaffWeekend: Number(e.target.value) })} className="w-24" />
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <div className="text-xs text-gray-500">야간 후 최소 휴식</div>
            <div className="text-sm font-semibold text-gray-800">
              11시간 <span className="text-xs font-normal text-gray-400">(근로기준법 권고 기준 · 순환 근무주기에 이미 반영되어 있어 별도 입력이 필요 없습니다)</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mb-3 text-xs text-gray-500 items-center">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-amber-50 border border-amber-200" /> 주간전담
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-indigo-50 border border-indigo-200" /> 야간전담
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-sky-50 border border-sky-200" /> 주중근무
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs">
                <th className="text-left py-2 px-2 font-medium">이름</th>
                <th className="py-2 px-2 font-medium">직위</th>
                <th className="py-2 px-2 font-medium">유형</th>
                <th className="py-2 px-2 font-medium">그룹설정(0-5)</th>
                <th className="py-2 px-2 font-medium">최소근무일</th>
                <th className="py-2 px-2 font-medium">제외요일</th>
              </tr>
            </thead>
            <tbody>
              {sortedConfigs.map((s, idx) => {
                const prevRole = idx > 0 ? sortedConfigs[idx - 1].role : null;
                const showDivider = idx > 0 && roleGroupIndex(s.role) !== roleGroupIndex(prevRole || "");
                const rowClass = TYPE_ROW_CLASS[s.type] || "";
                return (
                  <Fragment key={s.name}>
                    {showDivider && (
                      <tr key={`div-${s.name}`}>
                        <td colSpan={6} className="bg-gray-100 border-y border-gray-200 px-2 py-1 text-xs font-semibold text-gray-500">
                          {ROLE_GROUP_LABELS[roleGroupIndex(s.role)]}
                        </td>
                      </tr>
                    )}
                    <tr key={s.name} className={`border-t border-gray-100 ${rowClass}`}>
                      <td className="py-1.5 px-2 text-gray-800">{s.name}</td>
                      <td className="py-1.5 px-2 text-gray-500">{s.role}</td>
                      <td className="py-1.5 px-2">
                        <Select value={s.type} onChange={(e) => updateConfig(s.name, { type: e.target.value as StaffConfig["type"] })}>
                          <option value="순환">순환</option>
                          <option value="주간전담">주간전담</option>
                          <option value="야간전담">야간전담</option>
                          <option value="주중근무">주중근무</option>
                        </Select>
                      </td>
                      <td className="py-1.5 px-2">
                        <Input type="number" min={0} max={5} value={s.offset} onChange={(e) => updateConfig(s.name, { offset: Number(e.target.value) })} className="w-16" />
                      </td>
                      <td className="py-1.5 px-2">
                        <Input type="number" value={s.minWorkDays} onChange={(e) => updateConfig(s.name, { minWorkDays: Number(e.target.value) })} className="w-16" />
                      </td>
                      <td className="py-1.5 px-2">
                        <div className="flex gap-0.5">
                          {WD_MON_FIRST.map((w, wIdx) => {
                            const active = (s.excludeWeekdays || []).includes(wIdx);
                            return (
                              <button
                                key={wIdx}
                                type="button"
                                onClick={() => toggleExcludeWeekday(s.name, wIdx)}
                                className={`w-6 h-6 text-[11px] rounded ${
                                  active ? "bg-emerald-700 text-white" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
                                }`}
                                title={active ? `${w}요일 근무 제외됨 (클릭 시 해제)` : `${w}요일 근무 제외하려면 클릭`}
                              >
                                {w}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card id="pairs">
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="text-base font-semibold text-gray-900">페어링</div>
            <div className="text-xs text-gray-500 mt-0.5">두 직원이 항상 같은 조로 근무하거나(같은조), 절대 겹치지 않게(다른조) 묶을 수 있습니다.</div>
          </div>
          <Button variant="outline" onClick={saveConfig} disabled={loading}>
            설정 저장
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {rules.pairs.map((p, idx) => (
            <div key={idx} className="flex gap-2 items-center flex-wrap">
              <Select value={p.a} onChange={(e) => updatePair(idx, { a: e.target.value })} className="w-40">
                {staffConfigs.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Select value={p.mode} onChange={(e) => updatePair(idx, { mode: e.target.value as "같은조" | "다른조" })} className="w-24">
                <option value="같은조">같은조</option>
                <option value="다른조">다른조</option>
              </Select>
              <Select value={p.b} onChange={(e) => updatePair(idx, { b: e.target.value })} className="w-40">
                {staffConfigs.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <button onClick={() => removePair(idx)} className="text-xs text-red-500 hover:underline">
                삭제
              </button>
            </div>
          ))}
          {rules.pairs.length === 0 && <div className="text-sm text-gray-400">등록된 페어링이 없습니다.</div>}
          <Button variant="outline" onClick={addPair} className="self-start mt-2">
            + 페어링 추가
          </Button>
        </div>
      </Card>
    </div>
  );
}
