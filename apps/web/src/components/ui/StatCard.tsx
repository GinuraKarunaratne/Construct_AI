import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type Tone = "orange" | "green" | "red" | "amber" | "violet" | "sky" | "neutral";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  icon?: string;     // legacy — accepted but not used
  color?: string;    // legacy — accepted but not used
  Icon?: LucideIcon;
  trend?: "up" | "down" | "flat";
}

const TONE_MAP: Record<Tone, { icon: string; value: string; bg: string }> = {
  orange:  { icon: "text-brand-600", value: "text-brand-600", bg: "bg-brand-50"  },
  green:   { icon: "text-green-600", value: "text-green-700", bg: "bg-green-50"  },
  red:     { icon: "text-red-500",   value: "text-red-700",   bg: "bg-red-50"    },
  amber:   { icon: "text-amber-600", value: "text-amber-700", bg: "bg-amber-50"  },
  violet:  { icon: "text-violet-600",value: "text-violet-700",bg: "bg-violet-50" },
  sky:     { icon: "text-sky-600",   value: "text-sky-700",   bg: "bg-sky-50"    },
  neutral: { icon: "text-stone-400", value: "text-stone-700", bg: "bg-stone-100" },
};

export function StatCard({ label, value, sub, tone = "neutral", Icon }: StatCardProps) {
  const t = TONE_MAP[tone];

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-5 hover:shadow-md transition-shadow duration-150">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider leading-tight">
          {label}
        </p>
        {Icon && (
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", t.bg)}>
            <Icon className={cn("w-4 h-4", t.icon)} strokeWidth={2} />
          </div>
        )}
      </div>
      <p className={cn("text-2xl font-bold mt-2.5 leading-none tracking-tight", t.value)}>
        {value}
      </p>
      {sub && (
        <p className="text-xs text-stone-400 mt-1.5 leading-snug">{sub}</p>
      )}
    </div>
  );
}
