"use client";

import { Suspense, useEffect, useState } from "react";
import { ShiftType, SHIFT_BADGE_CLASS, SHIFT_LABEL, SHIFT_TYPES, StaffMember } from "@/lib/types";
import { useYearMonth } from "@/lib/useYearMonth";
import { Card, Select, Button } from "@/components/ui";

const WD = ["일", "월", "화", "수", "목", "금", "토"];

type DayEntry = { name: string; role: string; type: ShiftType };

export default function RequestsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-400">불러오는 중...</div>}>
      <RequestsPageInner />
    </Suspense>
  );
}

function RequestsPageInner() {
  const { year, month, setYear, setMonth } = useYearMonth();
  const [byDay, setByDay] = useState<Record<number, DayEntry[]>>({});
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Record<string, ShiftType | "">>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/staff");
      const data = await res.json();
      if (data.staff) setStaff(data.staff);
    })();
  }, []);

  const loadMonth = async () => {
    setLoading(true);
    setMsg("불러오는 중...");
    setSelectedDay(null);
    try {
      const res = await fetch(`/api/admin-requests?year=${year}&month=${month}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setByDay(data.byDay || {});
      setMsg("");
    } catch (e) {
      setMsg("불러오기 실패: " + (e instanceof Error ? e.message : String(e)));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadMonth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const openDay = (d: number) => {
    setSelectedDay(d);
    const cur: Record<string, ShiftType | ""> = {};
    staff.forEach((s) => {
      const entry = (byDay[d] || []).find((e) => e.name === s.name);
      cur[s.name] = entry ? entry.type : "";
    });
    setEditValues(cur);
  };

  const saveDay = async () => {
    if (selectedDay === null) return;
    setSaving(true);
    setMsg("저장 중...");
    try {
      const entries = staff
        .filter((s) => editValues[s.name])
        .map((s) => ({ name: s.name, role: s.role, type: editValues[s.name] as ShiftType }));
      const res = await fetch("/api/admin-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, day: selectedDay, entries }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMsg("저장 완료");
      await loadMonth();
      setSelectedDay(null);
    } catch (e) {
      setMsg("저장 실패: " + (e instanceof Error ? e.message : String(e)));
    }
    setSaving(false);
  };

  const total = new Date(year, month, 0).getDate();
  const firstWd = new Date(year, month - 1, 1).getDay();
  const totalCount = Object.values(byDay).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      <h1 className="text-xl font-bold text-gray-900">근무요청사항</h1>

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
          <div className="text-sm text-gray-500">{loading ? msg : `이번 달 요청 총 ${totalCount}건`}</div>
        </div>
        <div className="text-xs text-gray-400 mt-2">날짜를 클릭하면 그날의 요청을 직접 추가·수정·삭제할 수 있습니다.</div>
      </Card>

      <Card>
        <div className="grid grid-cols-7 gap-1.5">
          {WD.map((w) => (
            <div key={w} className={`text-center text-xs font-medium pb-1.5 border-b border-gray-200 ${w === "일" ? "text-red-500" : w === "토" ? "text-blue-600" : "text-gray-500"}`}>
              {w}
            </div>
          ))}
          {Array.from({ length: firstWd }, (_, i) => (
            <div key={`e${i}`} />
          ))}
          {Array.from({ length: total }, (_, i) => {
            const d = i + 1;
            const wd = new Date(year, month - 1, d).getDay();
            const entries = byDay[d] || [];
            const active = selectedDay === d;
            return (
              <button
                key={d}
                onClick={() => openDay(d)}
                className={`text-left min-h-[92px] rounded-lg border p-1.5 transition-colors ${
                  active ? "border-emerald-400 ring-1 ring-emerald-300" : "border-gray-100 hover:border-emerald-200"
                } ${wd === 0 ? "bg-red-50/30" : wd === 6 ? "bg-blue-50/30" : ""}`}
              >
                <div className={`text-xs font-medium mb-1 ${wd === 0 ? "text-red-500" : wd === 6 ? "text-blue-600" : "text-gray-500"}`}>{d}</div>
                <div className="flex flex-col gap-0.5">
                  {entries.map((e, idx) => (
                    <div key={idx} className={`text-[11px] rounded px-1 py-0.5 border truncate ${SHIFT_BADGE_CLASS[e.type]}`} title={`${e.name} (${e.role}) — ${SHIFT_LABEL[e.type]}`}>
                      {e.name} {SHIFT_LABEL[e.type]}
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {selectedDay !== null && (
        <Card>
          <div className="flex justify-between items-center mb-3">
            <div className="text-base font-semibold text-gray-900">
              {month}월 {selectedDay}일 요청 편집
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setSelectedDay(null)}>
                닫기
              </Button>
              <Button onClick={saveDay} disabled={saving}>
                {saving ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
          {msg && <div className="text-sm text-amber-700 mb-2">{msg}</div>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs">
                  <th className="text-left py-1.5 px-2 font-medium">이름</th>
                  <th className="text-left py-1.5 px-2 font-medium">직위</th>
                  <th className="py-1.5 px-2 font-medium">요청</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => {
                  const val = editValues[s.name];
                  const rowClass = val ? SHIFT_BADGE_CLASS[val] : "text-gray-800";
                  return (
                    <tr key={s.name} className={`border-t border-gray-100 ${rowClass}`}>
                      <td className="py-1.5 px-2 font-medium">{s.name}</td>
                      <td className="py-1.5 px-2 opacity-80">{s.role}</td>
                      <td className="py-1.5 px-2">
                        <Select
                          value={editValues[s.name] || ""}
                          onChange={(e) => setEditValues((prev) => ({ ...prev, [s.name]: e.target.value as ShiftType | "" }))}
                          className="w-32"
                        >
                          <option value=""></option>
                          {SHIFT_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {SHIFT_LABEL[t]}
                            </option>
                          ))}
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
