"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.error) {
        setMsg(data.error);
      } else {
        router.push("/admin");
        router.refresh();
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "로그인 실패");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'맑은 고딕',sans-serif" }}>
      <div style={{ background: "#111827", borderRadius: 16, padding: 32, width: 340, border: "1px solid #1e3a5f" }}>
        <div style={{ fontSize: 40, textAlign: "center", marginBottom: 8 }}>🔐</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#00b4a6", textAlign: "center", marginBottom: 4 }}>관리자 로그인</div>
        <div style={{ fontSize: 13, color: "#64748b", textAlign: "center", marginBottom: 20 }}>근무표 편성 관리자앱</div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="비밀번호"
          style={{ width: "100%", boxSizing: "border-box", background: "#0d1b2e", color: "#f0f4f8", border: "1px solid #1e3a5f", borderRadius: 8, padding: "12px 14px", fontSize: 16, marginBottom: 12 }}
        />
        <button
          onClick={submit}
          disabled={loading}
          style={{ width: "100%", background: "#00b4a6", color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontSize: 16, fontWeight: 700, cursor: "pointer" }}
        >
          {loading ? "확인 중..." : "로그인"}
        </button>
        {msg && <div style={{ color: "#f59e0b", fontSize: 13, textAlign: "center", marginTop: 10 }}>{msg}</div>}
      </div>
    </div>
  );
}
