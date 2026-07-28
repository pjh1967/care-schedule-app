export const metadata = {
  title: "근무표 편성 관리자",
  description: "요양보호사 근무표 자동생성 관리자앱",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, background: "#0a0f1e" }}>{children}</body>
    </html>
  );
}
