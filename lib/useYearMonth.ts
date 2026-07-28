"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

/**
 * 년/월 선택을 URL 쿼리스트링(?year=&month=)에 저장해서 관리자 페이지 간(근무표 생성/배정
 * 기준/근무요청사항) 이동해도 선택이 유지되도록 한다. useSearchParams를 쓰므로 이 훅을
 * 사용하는 페이지는 <Suspense>로 감싸야 한다.
 */
export function useYearMonth() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const now = new Date();
  const year = Number(searchParams.get("year")) || now.getFullYear();
  const month = Number(searchParams.get("month")) || now.getMonth() + 1;

  const push = (y: number, m: number) => {
    router.replace(`${pathname}?year=${y}&month=${m}`);
  };

  const setYear = (y: number) => push(y, month);
  const setMonth = (m: number) => push(year, m);

  return { year, month, setYear, setMonth };
}

/** 현재 년/월 쿼리스트링을 그대로 유지하며 다른 관리자 페이지로 이동할 링크를 만든다. */
export function useYearMonthQuery() {
  const searchParams = useSearchParams();
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  return year && month ? `?year=${year}&month=${month}` : "";
}
