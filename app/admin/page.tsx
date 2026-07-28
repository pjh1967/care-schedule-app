"use client";

import { useEffect, useState } from "react";
import { StaffConfig, GlobalRules, ShiftType, SHIFT_BADGE_CLASS } from "@/lib/types";
import { Button, Card, Select, Input } from "@/components/ui";

const WD_MON_FIRST = ["월", "화", "수", "목", "금", "토", "일"]; // 0=월 ~ 6=일 (lib/schedule.ts weekdayMonFirst와 동일 순서)

export default function AdminPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [staffConfigs, setStaffConfigs] = useState<StaffConfig[]>([]);
  const [rules, setRules] = useState<GlobalRules>({ maxConsec: 5, maxWorkDays: 26, pairs: [] });
  const [schedule, setSchedule] = useState<Record<string, Record<number, ShiftType>> | null>(null);
  const [violations, setViolations] = useState<string[]>([]);
  const [continuityNotes, setContinuityNotes] = useState<string[]>([]);
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
    try {
      const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year, month }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSchedule(data.schedule);
      setViolations(data.violations || []);
      setContinuityNotes(data.continuityNotes || []);
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

  const total = new Date(year, month, 0).getDate();

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
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

      {(violations.length > 0 || continuityNotes.length > 0) && (
        <Card>
          {continuityNotes.length > 0 && (
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
          <table className="min-w-[900px] text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left font-medium border-b border-gray-200">이름</th>
                {Array.from({ length: total }, (_, i) => (
                  <th key={i} className="px-1 py-2 font-medium border-b border-gray-200">
                    {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(schedule).map(([name, days]) => (
                <tr key={name} className="border-b border-gray-100 last:border-0">
                  <td className="sticky left-0 bg-white px-3 py-1.5 font-medium text-gray-800">{name}</td>
                  {Array.from({ length: total }, (_, i) => {
                    const d = i + 1;
                    const s = days[d] || "";
                    return (
                      <td key={d} className="text-center px-0.5 py-1.5">
                        {s && <span className={`inline-flex w-6 h-6 items-center justify-center rounded border text-xs font-medium ${SHIFT_BADGE_CLASS[s]}`}>{s}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card id="rules">
        <div className="flex justify-between items-center mb-4">
          <div className="text-base font-semibold text-gray-900">배정 기준</div>
          <Button variant="outline" onClick={saveConfig} disabled={loading}>
            설정 저장
          </Button>
        </div>
        <div className="flex gap-6 mb-5 flex-wrap">
          <div>
            <div className="text-xs text-gray-500 mb-1">최대 연속 근무일</div>
            <Input type="number" value={rules.maxConsec} onChange={(e) => setRules({ ...rules, maxConsec: Number(e.target.value) })} className="w-24" />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">최대 근무일수</div>
            <Input type="number" value={rules.maxWorkDays} onChange={(e) => setRules({ ...rules, maxWorkDays: Number(e.target.value) })} className="w-24" />
          </div>
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
              {staffConfigs.map((s) => (
                <tr key={s.name} className="border-t border-gray-100">
                  <td className="py-1.5 px-2 text-gray-800">{s.name}</td>
                  <td className="py-1.5 px-2 text-gray-500">{s.role}</td>
                  <td className="py-1.5 px-2">
                    <Select value={s.type} onChange={(e) => updateConfig(s.name, { type: e.target.value as StaffConfig["type"] })}>
                      <option value="순환">순환</option>
                      <option value="주간전담">주간전담</option>
                      <option value="야간전담">야간전담</option>
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
                      {WD_MON_FIRST.map((w, idx) => {
                        const active = (s.excludeWeekdays || []).includes(idx);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleExcludeWeekday(s.name, idx)}
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
              ))}
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
