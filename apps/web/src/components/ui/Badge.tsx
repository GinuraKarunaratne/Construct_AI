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

// Pill badges — border-based, no ring
const VARIANT_MAP: Record<Variant, string> = {
  completed:   "bg-green-50   text-green-700   border-green-200",
  in_progress: "bg-brand-50   text-brand-700   border-brand-200",
  not_started: "bg-stone-100  text-stone-500   border-stone-200",
  delayed:     "bg-red-50     text-red-600     border-red-200",
  critical:    "bg-red-50     text-red-600     border-red-200",
  high:        "bg-orange-50  text-orange-700  border-orange-200",
  medium:      "bg-amber-50   text-amber-700   border-amber-200",
  low:         "bg-stone-100  text-stone-500   border-stone-200",
  active:      "bg-green-50   text-green-700   border-green-200",
  approved:    "bg-green-50   text-green-700   border-green-200",
  draft:       "bg-stone-100  text-stone-500   border-stone-200",
  present:     "bg-green-50   text-green-700   border-green-200",
  absent:      "bg-red-50     text-red-600     border-red-200",
  half_day:    "bg-amber-50   text-amber-700   border-amber-200",
  leave:       "bg-violet-50  text-violet-700  border-violet-200",
  info:        "bg-sky-50     text-sky-700     border-sky-200",
  warning:     "bg-amber-50   text-amber-700   border-amber-200",
  success:     "bg-green-50   text-green-700   border-green-200",
  default:     "bg-stone-100  text-stone-600   border-stone-200",
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
        "inline-flex items-center px-2.5 py-0.5 rounded-full",
        "text-[11px] font-semibold capitalize border",
        style,
        className
      )}
    >
      {label.replace(/_/g, " ")}
    </span>
  );
}
