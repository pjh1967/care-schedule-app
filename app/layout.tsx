import "./globals.css";

export const metadata = {
  title: "요양보호사 근무표 시스템",
  description: "근무 요청 입력 및 근무표 자동생성",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="font-sans bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
