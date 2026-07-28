"use client";

import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import { StaffConfig, ShiftType, SHIFT_BADGE_CLASS, roleGroupIndex, ROLE_GROUP_LABELS } from "@/lib/types";
import type { ContinuityDetail } from "@/lib/schedule";
import { useYearMonth } from "@/lib/useYearMonth";
import { Button, Card, Select } from "@/components/ui";

function groupedStaff<T extends { role: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => roleGroupIndex(a.role) - roleGroupIndex(b.role));
}

function roleAbbrev(role: string): string {
  return role ? `${role[0]})` : "";
}

export default function GeneratePage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-400">불러오는 중...</div>}>
      <GeneratePageInner />
    </Suspense>
  );
}

function GeneratePageInner() {
  const { year, month, setYear, setMonth } = useYearMonth();
  const [staffConfigs, setStaffConfigs] = useState<StaffConfig[]>([]);
  const [schedule, setSchedule] = useState<Record<string, Record<number, ShiftType>> | null>(null);
  const [violations, setViolations] = useState<string[]>([]);
  const [continuityNotes, setContinuityNotes] = useState<string[]>([]);
  const [continuityDetails, setContinuityDetails] = useState<ContinuityDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/staff-config");
      const data = await res.json();
      if (data.staffConfigs) setStaffConfigs(data.staffConfigs);
    })();
  }, []);

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

  const total = new Date(year, month, 0).getDate();

  const roleByName = useMemo(() => {
    const m: Record<string, string> = {};
    staffConfigs.forEach((s) => (m[s.name] = s.role));
    return m;
  }, [staffConfigs]);

  const sortedScheduleNames = useMemo(() => {
    if (!schedule) return [];
    return groupedStaff(Object.keys(schedule).map((name) => ({ name, role: roleByName[name] || "" }))).map((s) => s.name);
  }, [schedule, roleByName]);

  const caregiverNames = useMemo(() => staffConfigs.filter((s) => s.role === "팀장" || s.role === "요양보호사").map((s) => s.name), [staffConfigs]);
  const cookNames = useMemo(() => staffConfigs.filter((s) => s.role === "조리원").map((s) => s.name), [staffConfigs]);

  const { violatedNameMap, violatedDayMap } = useMemo(() => {
    const nameMap = new Map<string, string[]>();
    const dayMap = new Map<number, string[]>();
    const addName = (name: string, msg: string) => nameMap.set(name, [...(nameMap.get(name) || []), msg]);
    const addDay = (day: number, msg: string) => dayMap.set(day, [...(dayMap.get(day) || []), msg]);

    violations.forEach((v) => {
      const minWorkMatch = v.match(/^(\S+) 최소근무 미충족/);
      if (minWorkMatch) addName(minWorkMatch[1], v);

      const restConflictMatch = v.match(/^(\S+): \d+\/(\d+)\(야간\)→\d+\/(\d+)\(주간\)/);
      if (restConflictMatch) {
        addName(restConflictMatch[1], v);
        addDay(Number(restConflictMatch[2]), v);
        addDay(Number(restConflictMatch[3]), v);
      }

      const dayLevelMatch = v.match(/^\d+\/(\d+)\(/);
      if (dayLevelMatch) addDay(Number(dayLevelMatch[1]), v);
    });

    return { violatedNameMap: nameMap, violatedDayMap: dayMap };
  }, [violations]);

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
      <h1 className="text-xl font-bold text-gray-900">근무표 생성</h1>

      <Card>
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
            <div className="text-xs text-gray-500 mt-0.5">
              {continuityDetails[0]?.prevMonthLabel} 마지막 5일 실이력 → {month}월 1일 시작 근무형태 · 그룹설정
            </div>
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

      {continuityNotes.length > 0 && continuityDetails.length === 0 && (
        <Card>
          <div className="text-sm font-semibold text-emerald-700 mb-1.5">연속성 반영 내역</div>
          {continuityNotes.map((n, i) => (
            <div key={i} className="text-sm text-gray-600">
              {n}
            </div>
          ))}
        </Card>
      )}

      {schedule && (
        <Card noPadding className="overflow-x-auto">
          {(violatedNameMap.size > 0 || violatedDayMap.size > 0) && (
            <div className="px-4 pt-3 pb-1 flex items-center gap-2 text-xs text-gray-500">
              <span className="inline-block w-3 h-3 rounded bg-red-100/70 border border-red-200" /> 확인 필요 — 위에 마우스를 올리면 사유가 표시됩니다
            </div>
          )}
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
                  const dayIssues = violatedDayMap.get(d);
                  return (
                    <th
                      key={i}
                      className={`px-1 py-2 font-medium border-b border-gray-200 leading-tight ${dayIssues ? "bg-red-100/70" : ""}`}
                      title={dayIssues?.join("\n")}
                    >
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
                    <tr key={name} className={`border-b border-gray-100 last:border-0 ${violatedNameMap.has(name) ? "bg-red-100/60" : ""}`} title={violatedNameMap.get(name)?.join("\n")}>
                      <td className={`sticky left-0 px-3 py-1.5 font-medium text-gray-800 z-10 ${violatedNameMap.has(name) ? "bg-red-50" : "bg-white"}`}>{name}</td>
                      <td className={`sticky left-[72px] px-2 py-1.5 text-gray-500 z-10 ${violatedNameMap.has(name) ? "bg-red-50" : "bg-white"}`}>{roleAbbrev(role)}</td>
                      {Array.from({ length: total }, (_, i) => {
                        const d = i + 1;
                        const s = days[d] || "";
                        const dayIssues = violatedDayMap.get(d);
                        return (
                          <td key={d} className={`text-center px-0.5 py-1.5 ${dayIssues ? "bg-red-100/70" : ""}`} title={dayIssues?.join("\n")}>
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
    </div>
  );
}
