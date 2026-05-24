import { clsx } from "clsx";

type Color = "blue" | "green" | "purple" | "red" | "indigo" | "amber";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: Color;
  icon?: string; // accepted but not rendered (icon-free design)
}

const COLOR_MAP: Record<Color, string> = {
  blue:   "bg-blue-50 text-blue-700",
  green:  "bg-emerald-50 text-emerald-700",
  purple: "bg-purple-50 text-purple-700",
  red:    "bg-red-50 text-red-700",
  indigo: "bg-indigo-50 text-indigo-700",
  amber:  "bg-amber-50 text-amber-700",
};

export function StatCard({ label, value, sub, color = "blue" }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-shadow">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={clsx("text-2xl font-bold mt-1.5", COLOR_MAP[color])}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}
