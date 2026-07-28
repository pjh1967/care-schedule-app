"use client";

import { useState } from "react";
import { SHIFT_TYPES, SHIFT_LABEL, SHIFT_BADGE_CLASS, StaffMember, DayRequests, ShiftType } from "@/lib/types";
import { Button, Card, Badge, Select } from "@/components/ui";

const WD = ["일", "월", "화", "수", "목", "금", "토"];

type Step = "select" | "input" | "done";

export default function StaffRequestPage() {
  const [step, setStep] = useState<Step>("select");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(false);
  const [myName, setMyName] = useState("");
  const [myRole, setMyRole] = useState("");
  const [requests, setRequests] = useState<DayRequests>({});
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const total = new Date(year, month, 0).getDate();

  const loadStaff = async () => {
    if (staffLoaded) return;
    setLoading(true);
    setMsg("직원 목록 불러오는 중...");
    try {
      const res = await fetch("/api/staff");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStaff(data.staff);
      setStaffLoaded(true);
      setMsg("");
    } catch (e) {
      setMsg("불러오기 실패: " + (e instanceof Error ? e.message : String(e)));
    }
    setLoading(false);
  };

  if (!staffLoaded && !loading && staff.length === 0 && msg === "") {
    loadStaff();
  }

  const selectEmp = async (name: string, role: string) => {
    setLoading(true);
    setMsg("기존 요청 불러오는 중...");
    setMyName(name);
    setMyRole(role);
    try {
      const res = await fetch(`/api/requests?name=${encodeURIComponent(name)}&year=${year}&month=${month}`);
      const data = await res.json();
      setRequests(data.requests || {});
      setStep("input");
    } catch {
      setRequests({});
      setStep("input");
    }
    setMsg("");
    setLoading(false);
  };

  const toggle = (d: number) => {
    setRequests((prev) => {
      const cur = prev[d];
      const idx = SHIFT_TYPES.indexOf(cur as ShiftType);
      const next = { ...prev };
      if (idx === -1) next[d] = SHIFT_TYPES[0];
      else if (idx < SHIFT_TYPES.length - 1) next[d] = SHIFT_TYPES[idx + 1];
      else delete next[d];
      return next;
    });
  };

  const save = async () => {
    setLoading(true);
    setMsg("저장 중...");
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: myName, role: myRole, year, month, requests }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStep("done");
      setMsg("");
    } catch (e) {
      setMsg("저장 실패: " + (e instanceof Error ? e.message : String(e)));
    }
    setLoading(false);
  };

  const summary: Record<string, number> = {};
  SHIFT_TYPES.forEach((t) => (summary[t] = 0));
  Object.values(requests).forEach((v) => {
    if (summary[v] !== undefined) summary[v]++;
  });

  return (
    <div className="min-h-screen p-4 md:p-8 flex justify-center">
      <div className="w-full max-w-lg">
        <h1 className="text-xl font-bold text-gray-900 mb-1 text-center">근무 요청 입력</h1>
        <p className="text-sm text-gray-500 mb-6 text-center">근무 희망 일정을 입력해 주세요</p>

        {step === "select" && (
          <Card>
            <div className="flex gap-2 justify-center mb-4">
              <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-auto">
                {[2025, 2026, 2027].map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </Select>
              <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-auto">
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}월
                  </option>
                ))}
              </Select>
            </div>

            {loading && <p className="text-sm text-amber-700 text-center">{msg}</p>}
            {!loading && staff.length === 0 && msg && <p className="text-sm text-amber-700 text-center">{msg}</p>}

            {!loading && staff.length > 0 && (
              <div className="flex flex-col gap-2">
                {staff.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => selectEmp(s.name, s.role)}
                    className="flex justify-between items-center rounded-lg border border-gray-200 px-4 py-3 text-sm hover:bg-gray-50 transition-colors"
                  >
                    <span className="font-medium text-gray-800">{s.name}</span>
                    <span className="text-xs text-gray-500">{s.role}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}

        {step === "input" && (
          <div className="flex flex-col gap-3">
            <Card>
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-lg font-bold text-gray-900">{myName}</div>
                  <div className="text-xs text-gray-500">
                    {myRole} · {year}년 {month}월
                  </div>
                </div>
                <button onClick={() => setStep("select")} className="text-xs text-gray-500 border border-gray-200 rounded-md px-2 py-1 hover:bg-gray-50">
                  ← 변경
                </button>
              </div>
              <div className="flex gap-1.5 flex-wrap mt-3">
                {SHIFT_TYPES.map((t) => (
                  <Badge key={t} tone="neutral" className={`border ${SHIFT_BADGE_CLASS[t]}`}>
                    {SHIFT_LABEL[t]} {summary[t]}일
                  </Badge>
                ))}
              </div>
            </Card>

            <div className="text-xs text-gray-500 text-center bg-gray-100 rounded-lg py-2 px-3">
              날짜 클릭 →{" "}
              {SHIFT_TYPES.map((t) => (
                <span key={t} className={`inline-block border rounded px-1.5 mx-0.5 font-medium ${SHIFT_BADGE_CLASS[t]}`}>
                  {SHIFT_LABEL[t]}
                </span>
              ))}
              → 다시 클릭 시 삭제
            </div>

            <Card>
              <div className="grid grid-cols-7 gap-1">
                {WD.map((w) => (
                  <div key={w} className={`text-center text-xs font-medium pb-1 border-b border-gray-100 ${w === "일" ? "text-red-500" : w === "토" ? "text-blue-600" : "text-gray-500"}`}>
                    {w}
                  </div>
                ))}
                {Array.from({ length: new Date(year, month - 1, 1).getDay() }, (_, i) => (
                  <div key={`e${i}`} />
                ))}
                {Array.from({ length: total }, (_, i) => {
                  const d = i + 1;
                  const wd = new Date(year, month - 1, d).getDay();
                  const req = requests[d];
                  return (
                    <div
                      key={d}
                      onClick={() => toggle(d)}
                      className={`rounded-md text-center cursor-pointer select-none py-1.5 border ${
                        req ? SHIFT_BADGE_CLASS[req] : wd === 0 ? "border-gray-100 text-red-300" : wd === 6 ? "border-gray-100 text-blue-300" : "border-gray-100 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <div className="text-sm font-medium">{d}</div>
                      <div className="text-[10px] mt-0.5">{req ? SHIFT_LABEL[req] : WD[wd]}</div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Button onClick={save} disabled={loading} className="w-full py-3 text-base">
              {loading ? "저장 중..." : "요청 저장"}
            </Button>
            <button onClick={() => setRequests({})} className="text-xs text-red-500 hover:underline self-center">
              전체 초기화
            </button>
            {msg && <p className="text-sm text-amber-700 text-center">{msg}</p>}
          </div>
        )}

        {step === "done" && (
          <Card className="text-center">
            <div className="text-lg font-bold text-emerald-700 mb-1">요청 저장 완료</div>
            <p className="text-sm text-gray-500 mb-4">
              {myName}님의 {year}년 {month}월 근무 요청이 저장되었습니다.
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-left">
              {SHIFT_TYPES.map(
                (t) =>
                  summary[t] > 0 && (
                    <div key={t} className="flex justify-between text-sm py-1 border-b border-gray-100 last:border-0">
                      <span className="text-gray-500">{SHIFT_LABEL[t]}</span>
                      <span className="font-bold text-gray-800">{summary[t]}일</span>
                    </div>
                  )
              )}
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setStep("select");
                setRequests({});
              }}
              className="w-full"
            >
              다른 직원 요청 입력
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
