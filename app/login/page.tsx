"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";

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
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <div className="text-lg font-bold text-gray-900 text-center mb-1">관리자 로그인</div>
        <div className="text-sm text-gray-500 text-center mb-6">근무표 편성 관리자</div>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="비밀번호"
          className="mb-3 py-2"
        />
        <Button onClick={submit} disabled={loading} className="w-full py-2.5">
          {loading ? "확인 중..." : "로그인"}
        </Button>
        {msg && <p className="text-sm text-red-600 text-center mt-3">{msg}</p>}
      </Card>
    </div>
  );
}
