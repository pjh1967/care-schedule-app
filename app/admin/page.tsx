"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StaffConfig, GlobalRules, ShiftType } from "@/lib/types";

const C = {
  bg: "#0a0f1e",
  panel: "#111827",
  dark: "#0d1b2e",
  border: "#1e3a5f",
  teal: "#00b4a6",
  amber: "#f59e0b",
  red: "#ef4444",
  white: "#f0f4f8",
  gray: "#64748b",
};

const SHIFT_BG: Record<string, string> = { D: "#F4B942", N: "#5B5EA6", "/": "#A9D18E", 연차: "#FFD966", 교육: "#7DD3FC" };
const SHIFT_FG: Record<string, string> = { D: "#111", N: "#fff", "/": "#111", 연차: "#111", 교육: "#111" };

export default function AdminPage() {
  const router = useRouter();
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

  const logout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
  };

  const updateConfig = (name: string, patch: Partial<StaffConfig>) => {
    setStaffConfigs((prev) => prev.map((s) => (s.name === name ? { ...s, ...patch } : s)));
  };

  const total = new Date(year, month, 0).getDate();

  const S = {
    section: { background: C.panel, borderRadius: 14, padding: 18, border: `1px solid ${C.border}`, marginBottom: 16 },
    label: { fontSize: 13, color: C.gray, marginBottom: 6 },
    input: { background: C.dark, color: C.white, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 13 },
    btn: (bg: string) => ({ background: bg, color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" }),
  };

  return (
    <div style={{ minHeight: "100vh", color: C.white, fontFamily: "'맑은 고딕',sans-serif", padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: C.teal }}>📅 근무표 편성 관리자</div>
        <button onClick={logout} style={{ background: "transparent", color: C.gray, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>
          로그아웃
        </button>
      </div>

      <div style={S.section}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <div style={S.label}>년도</div>
            <select style={S.input} value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[2025, 2026, 2027].map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={S.label}>월</div>
            <select style={S.input} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}월
                </option>
              ))}
            </select>
          </div>
          <button onClick={generate} disabled={loading} style={S.btn(C.teal)}>
            {loading ? "처리 중..." : `${year}년 ${month}월 근무표 생성`}
          </button>
          {msg && <div style={{ color: C.amber, fontSize: 13 }}>{msg}</div>}
        </div>
      </div>

      {(violations.length > 0 || continuityNotes.length > 0) && (
        <div style={S.section}>
          {continuityNotes.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ color: C.teal, fontWeight: 700, marginBottom: 6 }}>🔄 연속성 반영 내역</div>
              {continuityNotes.map((n, i) => (
                <div key={i} style={{ fontSize: 13, color: C.gray }}>
                  {n}
                </div>
              ))}
            </div>
          )}
          {violations.length > 0 && (
            <div>
              <div style={{ color: C.amber, fontWeight: 700, marginBottom: 6 }}>⚠ 확인 필요</div>
              {violations.map((v, i) => (
                <div key={i} style={{ fontSize: 13, color: C.amber }}>
                  {v}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {schedule && (
        <div style={{ ...S.section, overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ position: "sticky", left: 0, background: C.panel, padding: "4px 8px", borderBottom: `1px solid ${C.border}` }}>이름</th>
                {Array.from({ length: total }, (_, i) => (
                  <th key={i} style={{ padding: "4px 4px", borderBottom: `1px solid ${C.border}`, color: C.gray }}>
                    {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(schedule).map(([name, days]) => (
                <tr key={name}>
                  <td style={{ position: "sticky", left: 0, background: C.panel, padding: "4px 8px", fontWeight: 700 }}>{name}</td>
                  {Array.from({ length: total }, (_, i) => {
                    const d = i + 1;
                    const s = days[d] || "";
                    return (
                      <td key={d} style={{ textAlign: "center", padding: "2px", background: SHIFT_BG[s] || "transparent", color: SHIFT_FG[s] || C.gray }}>
                        {s}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={S.section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>배정 기준</div>
          <button onClick={saveConfig} disabled={loading} style={S.btn(C.teal)}>
            설정 저장
          </button>
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
          <div>
            <div style={S.label}>최대 연속 근무일</div>
            <input style={S.input} type="number" value={rules.maxConsec} onChange={(e) => setRules({ ...rules, maxConsec: Number(e.target.value) })} />
          </div>
          <div>
            <div style={S.label}>최대 근무일수</div>
            <input style={S.input} type="number" value={rules.maxWorkDays} onChange={(e) => setRules({ ...rules, maxWorkDays: Number(e.target.value) })} />
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
            <thead>
              <tr style={{ color: C.gray }}>
                <th style={{ textAlign: "left", padding: "4px 8px" }}>이름</th>
                <th style={{ padding: "4px 8px" }}>유형</th>
                <th style={{ padding: "4px 8px" }}>오프셋(0-5)</th>
                <th style={{ padding: "4px 8px" }}>최소근무일</th>
                <th style={{ padding: "4px 8px" }}>제외요일(월0~일6, 콤마)</th>
              </tr>
            </thead>
            <tbody>
              {staffConfigs.map((s) => (
                <tr key={s.name} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: "4px 8px" }}>{s.name}</td>
                  <td style={{ padding: "4px 8px" }}>
                    <select style={S.input} value={s.type} onChange={(e) => updateConfig(s.name, { type: e.target.value as StaffConfig["type"] })}>
                      <option value="순환">순환</option>
                      <option value="주간전담">주간전담</option>
                      <option value="야간전담">야간전담</option>
                    </select>
                  </td>
                  <td style={{ padding: "4px 8px" }}>
                    <input style={{ ...S.input, width: 50 }} type="number" min={0} max={5} value={s.offset} onChange={(e) => updateConfig(s.name, { offset: Number(e.target.value) })} />
                  </td>
                  <td style={{ padding: "4px 8px" }}>
                    <input style={{ ...S.input, width: 60 }} type="number" value={s.minWorkDays} onChange={(e) => updateConfig(s.name, { minWorkDays: Number(e.target.value) })} />
                  </td>
                  <td style={{ padding: "4px 8px" }}>
                    <input
                      style={{ ...S.input, width: 100 }}
                      value={(s.excludeWeekdays || []).join(",")}
                      onChange={(e) =>
                        updateConfig(s.name, {
                          excludeWeekdays: e.target.value
                            .split(",")
                            .map((v) => Number(v.trim()))
                            .filter((n) => !Number.isNaN(n)),
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
