import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type Tone = "orange" | "green" | "red" | "amber" | "violet" | "sky" | "neutral";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  Icon?: LucideIcon;
  trend?: "up" | "down" | "flat";
  trendLabel?: string;
  /** Legacy props — accepted but not used */
  icon?: string;
  color?: string;
}

// Untitled UI palette — neutral foundation with status-color accents
const ICON_COLOR: Record<Tone, string> = {
  orange:  "text-ink-700 bg-surface-subtle",
  green:   "text-success-600 bg-success-50",
  red:     "text-danger-500 bg-danger-50",
  amber:   "text-warning-600 bg-warning-50",
  violet:  "text-ink-700 bg-surface-subtle",
  sky:     "text-info-600 bg-info-50",
  neutral: "text-ink-500 bg-surface-subtle",
};

export function StatCard({ label, value, sub, tone = "neutral", Icon, trend, trendLabel }: StatCardProps) {
  const iconClass = ICON_COLOR[tone];

  return (
    <div className="bg-white rounded-xl border border-surface-border p-5 sm:p-6">
      {/* Header row: label + icon */}
      <div className="flex items-start justify-between gap-3 mb-4">
        {Icon && (
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", iconClass)}>
            <Icon className="w-5 h-5" strokeWidth={1.75} />
          </div>
        )}
        {trend && (
          <span className={cn(
            "inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full",
            trend === "up"   ? "text-success-700 bg-success-50" :
            trend === "down" ? "text-danger-700 bg-danger-50" :
                               "text-ink-500 bg-surface-subtle"
          )}>
            {trend === "up"   ? <TrendingUp className="w-3 h-3" strokeWidth={2} /> :
             trend === "down" ? <TrendingDown className="w-3 h-3" strokeWidth={2} /> :
                                <Minus className="w-3 h-3" strokeWidth={2} />}
            {trendLabel}
          </span>
        )}
      </div>

      {/* Label */}
      <p className="text-sm font-medium text-ink-600">{label}</p>

      {/* Value */}
      <p className="text-3xl font-bold leading-tight tracking-tight tabular-nums text-ink-900 mt-1.5">
        {value}
      </p>

      {/* Sub */}
      {sub && (
        <p className="text-sm text-ink-500 mt-1.5 truncate">{sub}</p>
      )}
    </div>
  );
}
