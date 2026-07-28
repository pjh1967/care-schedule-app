"use client";

import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import { StaffConfig, GlobalRules, roleGroupIndex, ROLE_GROUP_LABELS } from "@/lib/types";
import { useYearMonth } from "@/lib/useYearMonth";
import { Button, Card, Select, Input } from "@/components/ui";

const WD_MON_FIRST = ["월", "화", "수", "목", "금", "토", "일"]; // 0=월 ~ 6=일 (lib/schedule.ts weekdayMonFirst와 동일 순서)

const TYPE_ROW_CLASS: Record<StaffConfig["type"], string> = {
  순환: "",
  주간전담: "bg-amber-50",
  야간전담: "bg-indigo-50",
  주중근무: "bg-sky-50",
};

function groupedStaff<T extends { role: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => roleGroupIndex(a.role) - roleGroupIndex(b.role));
}

export default function RulesPage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-400">불러오는 중...</div>}>
      <RulesPageInner />
    </Suspense>
  );
}

function RulesPageInner() {
  const { year, month, setYear, setMonth } = useYearMonth();
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
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [staffLoaded, setStaffLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [scRes, rRes] = await Promise.all([fetch("/api/staff-config"), fetch("/api/rules")]);
      const sc = await scRes.json();
      const r = await rRes.json();
      if (sc.staffConfigs) setStaffConfigs(sc.staffConfigs);
      if (r.rules) setRules(r.rules);
      setStaffLoaded(true);
    })();
  }, []);

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
      setMsg(`${data.referenceMonth?.month ?? ""}월 실이력 기반 추천값을 그룹설정 칸에 채웠습니다. 확인 후 "설정 저장"을 눌러주세요.`);
    } catch (e) {
      setMsg("추천 실패: " + (e instanceof Error ? e.message : String(e)));
    }
    setLoading(false);
  };

  // 년/월을 고를 때마다(직원 목록이 준비된 뒤) 자동으로 전달 실이력 기반 추천을 계산한다.
  useEffect(() => {
    if (!staffLoaded) return;
    recommendOffsets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, staffLoaded]);

  const saveConfig = async () => {
    setLoading(true);
    setMsg("설정 저장 중...");
    await fetch("/api/staff-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staffConfigs }) });
    await fetch("/api/rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rules }) });
    setMsg("설정 저장 완료");
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

  const sortedConfigs = useMemo(() => groupedStaff(staffConfigs), [staffConfigs]);

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      <h1 className="text-xl font-bold text-gray-900">배정 기준</h1>

      <Card>
        <div className="flex justify-between items-center mb-1 flex-wrap gap-3">
          <div className="flex gap-3 items-end">
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
          </div>
          <Button variant="outline" onClick={saveConfig} disabled={loading}>
            설정 저장
          </Button>
        </div>
        <div className="text-xs text-gray-400 mb-4 mt-2">
          {year}년 {month}월 기준 · 전달 실이력으로 그룹설정을 자동 추천했습니다.{" "}
          <button onClick={recommendOffsets} disabled={loading} className="text-emerald-700 hover:underline disabled:opacity-50">
            다시 계산
          </button>
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

      <Card>
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
