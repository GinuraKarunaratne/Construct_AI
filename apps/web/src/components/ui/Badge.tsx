import { cn } from "@/lib/utils";

type Variant =
  | "completed"
  | "in_progress"
  | "not_started"
  | "delayed"
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "active"
  | "approved"
  | "draft"
  | "present"
  | "absent"
  | "half_day"
  | "leave"
  | "info"
  | "warning"
  | "success"
  | "default";

// Semantic, restrained — no rainbow, just functional color
const VARIANT_MAP: Record<Variant, string> = {
  completed:   "bg-green-100   text-green-700   ring-green-200/60",
  in_progress: "bg-brand-50    text-brand-700   ring-brand-200/60",
  not_started: "bg-stone-100   text-stone-500   ring-stone-200/60",
  delayed:     "bg-red-100     text-red-700     ring-red-200/60",
  critical:    "bg-red-100     text-red-700     ring-red-200/60",
  high:        "bg-orange-100  text-orange-700  ring-orange-200/60",
  medium:      "bg-amber-100   text-amber-700   ring-amber-200/60",
  low:         "bg-stone-100   text-stone-500   ring-stone-200/60",
  active:      "bg-green-100   text-green-700   ring-green-200/60",
  approved:    "bg-green-100   text-green-700   ring-green-200/60",
  draft:       "bg-stone-100   text-stone-500   ring-stone-200/60",
  present:     "bg-green-100   text-green-700   ring-green-200/60",
  absent:      "bg-red-100     text-red-700     ring-red-200/60",
  half_day:    "bg-amber-100   text-amber-700   ring-amber-200/60",
  leave:       "bg-violet-100  text-violet-700  ring-violet-200/60",
  info:        "bg-sky-100     text-sky-700     ring-sky-200/60",
  warning:     "bg-amber-100   text-amber-700   ring-amber-200/60",
  success:     "bg-green-100   text-green-700   ring-green-200/60",
  default:     "bg-stone-100   text-stone-600   ring-stone-200/60",
};

interface BadgeProps {
  label: string;
  variant?: Variant | string;
  className?: string;
}

export function Badge({ label, variant = "default", className }: BadgeProps) {
  const style = VARIANT_MAP[variant as Variant] ?? VARIANT_MAP.default;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md",
        "text-[11px] font-semibold capitalize ring-1",
        style,
        className
      )}
    >
      {label.replace(/_/g, " ")}
    </span>
  );
}
