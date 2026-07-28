import { ButtonHTMLAttributes, ReactNode } from "react";

// ── 버튼 (디자인 가이드 4장) ──────────────────────────────────
type ButtonVariant = "primary" | "secondary" | "outline" | "danger-text";

const BUTTON_BASE = "rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "bg-emerald-700 text-white px-4 py-2 hover:bg-emerald-800",
  secondary: "bg-white text-gray-600 border border-gray-200 px-3 py-1.5 hover:bg-gray-50",
  outline: "bg-white text-emerald-700 border border-emerald-200 px-3 py-1.5 hover:bg-emerald-50",
  "danger-text": "bg-transparent text-red-500 text-xs hover:underline p-0 font-normal",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: { variant?: ButtonVariant; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${BUTTON_BASE} ${VARIANT_CLASS[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

// ── 카드 (디자인 가이드 6장) ──────────────────────────────────
export function Card({ children, className = "", noPadding = false, id }: { children: ReactNode; className?: string; noPadding?: boolean; id?: string }) {
  return (
    <div id={id} className={`bg-white border border-gray-200 rounded-xl shadow-sm ${noPadding ? "overflow-hidden" : "p-4"} ${className}`}>
      {children}
    </div>
  );
}

// ── 배지 (디자인 가이드 8장) ──────────────────────────────────
type Semantic = "danger" | "warning" | "info" | "special" | "neutral";

const SEMANTIC_CLASS: Record<Semantic, string> = {
  danger: "bg-red-50 text-red-600",
  warning: "bg-amber-50 text-amber-700",
  info: "bg-blue-50 text-blue-700",
  special: "bg-purple-50 text-purple-700",
  neutral: "bg-gray-100 text-gray-700",
};

export function Badge({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: Semantic; className?: string }) {
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${SEMANTIC_CLASS[tone]} ${className}`}>{children}</span>;
}

// ── 알림 배너 (디자인 가이드 8장) ─────────────────────────────
const BANNER_CLASS: Record<Semantic, string> = {
  danger: "bg-red-50 border-red-200 text-red-700",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  info: "bg-blue-50 border-blue-200 text-blue-800",
  special: "bg-purple-50 border-purple-200 text-purple-700",
  neutral: "bg-gray-100 border-gray-200 text-gray-700",
};

export function Banner({ children, tone = "info" }: { children: ReactNode; tone?: Semantic }) {
  return <div className={`rounded-lg border px-4 py-2 text-sm ${BANNER_CLASS[tone]}`}>{children}</div>;
}

// ── 입력 요소 (디자인 가이드 5장) ─────────────────────────────
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-md border border-gray-200 px-2 py-1 text-sm bg-white ${props.className || ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`w-full rounded-md border border-gray-200 px-2 py-1 text-sm bg-white ${props.className || ""}`} />;
}
