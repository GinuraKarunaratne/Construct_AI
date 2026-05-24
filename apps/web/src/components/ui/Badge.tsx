import { clsx } from "clsx";

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

const VARIANT_MAP: Record<Variant, string> = {
  completed:   "bg-green-100 text-green-700",
  in_progress: "bg-blue-100 text-blue-700",
  not_started: "bg-slate-100 text-slate-600",
  delayed:     "bg-red-100 text-red-700",
  critical:    "bg-red-100 text-red-700",
  high:        "bg-orange-100 text-orange-700",
  medium:      "bg-yellow-100 text-yellow-700",
  low:         "bg-slate-100 text-slate-500",
  active:      "bg-green-100 text-green-700",
  approved:    "bg-green-100 text-green-700",
  draft:       "bg-slate-100 text-slate-600",
  present:     "bg-green-100 text-green-700",
  absent:      "bg-red-100 text-red-700",
  half_day:    "bg-yellow-100 text-yellow-700",
  leave:       "bg-purple-100 text-purple-700",
  info:        "bg-blue-100 text-blue-700",
  warning:     "bg-amber-100 text-amber-700",
  success:     "bg-green-100 text-green-700",
  default:     "bg-slate-100 text-slate-600",
};

interface BadgeProps {
  label: string;
  variant?: Variant | string;
  className?: string;
}

export function Badge({ label, variant = "default", className }: BadgeProps) {
  const style =
    VARIANT_MAP[variant as Variant] ?? VARIANT_MAP.default;
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize",
        style,
        className
      )}
    >
      {label.replace(/_/g, " ")}
    </span>
  );
}
