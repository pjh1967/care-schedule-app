"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useYearMonthQuery } from "@/lib/useYearMonth";

const NAV = [
  { href: "/admin/generate", label: "근무표 생성" },
  { href: "/admin/requests", label: "근무요청사항" },
  { href: "/admin/rules", label: "배정 기준" },
];

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  const query = useYearMonthQuery(); // 현재 년/월 선택을 유지한 채 페이지 이동
  return (
    <>
      {NAV.map((n) => {
        const active = pathname === n.href;
        return (
          <Link
            key={n.href}
            href={`${n.href}${query}`}
            onClick={onNavigate}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-emerald-50 text-emerald-700" : "text-gray-700 hover:bg-emerald-50 hover:text-emerald-700"}`}
          >
            {n.label}
          </Link>
        );
      })}
    </>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const logout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
  };

  return (
    <div className="min-h-screen md:flex">
      {/* 모바일 토글 */}
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden fixed top-3 left-3 z-30 w-9 h-9 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-600"
        aria-label="메뉴 열기"
      >
        ☰
      </button>

      {/* 사이드바 */}
      <aside
        className={`fixed md:static z-20 top-0 left-0 h-full w-60 bg-gray-50 md:bg-white border-r border-gray-200 flex flex-col transition-transform md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-6 border-b border-gray-100">
          <div className="text-base font-bold text-gray-900">근무표 편성</div>
          <div className="text-xs text-gray-500 mt-0.5">관리자</div>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          <Suspense fallback={null}>
            <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
          </Suspense>
        </nav>
        <div className="px-3 py-4 border-t border-gray-100">
          <button onClick={logout} className="w-full text-left rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100">
            로그아웃
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-black/20 z-10 md:hidden" onClick={() => setOpen(false)} />}

      {/* 콘텐츠 */}
      <main className="flex-1 p-4 md:p-8 min-w-0">{children}</main>
    </div>
  );
}
