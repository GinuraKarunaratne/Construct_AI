import { cn } from "@/lib/utils";

type Variant =
  | "completed" | "in_progress" | "not_started" | "delayed"
  | "critical" | "high" | "medium" | "low"
  | "active" | "approved" | "draft"
  | "present" | "absent" | "half_day" | "leave"
  | "info" | "warning" | "success" | "default"
  | "in_stock" | "low_stock" | "at_reorder" | "out_of_stock";

const DOT_MAP: Record<Variant, string> = {
  completed:    "bg-success-500",
  in_progress:  "bg-info-500",
  not_started:  "bg-ink-400",
  delayed:      "bg-danger-500",

  critical:     "bg-danger-500",
  high:         "bg-warning-500",
  medium:       "bg-warning-500",
  low:          "bg-ink-400",

  active:       "bg-success-500",
  approved:     "bg-success-500",
  draft:        "bg-ink-400",

  present:      "bg-success-500",
  absent:       "bg-danger-500",
  half_day:     "bg-warning-500",
  leave:        "bg-info-500",

  info:         "bg-info-500",
  warning:      "bg-warning-500",
  success:      "bg-success-500",
  default:      "bg-ink-400",

  in_stock:     "bg-success-500",
  low_stock:    "bg-danger-500",
  at_reorder:   "bg-warning-500",
  out_of_stock: "bg-danger-500",
};

const TONE_MAP: Record<Variant, string> = {
  completed:    "status-badge-success",
  in_progress:  "status-badge-info",
  not_started:  "status-badge-neutral",
  delayed:      "status-badge-danger",

  critical:     "status-badge-danger",
  high:         "status-badge-warning",
  medium:       "status-badge-warning",
  low:          "status-badge-neutral",

  active:       "status-badge-success",
  approved:     "status-badge-success",
  draft:        "status-badge-neutral",

  present:      "status-badge-success",
  absent:       "status-badge-danger",
  half_day:     "status-badge-warning",
  leave:        "status-badge-info",

  info:         "status-badge-info",
  warning:      "status-badge-warning",
  success:      "status-badge-success",
  default:      "status-badge-neutral",

  in_stock:     "status-badge-success",
  low_stock:    "status-badge-danger",
  at_reorder:   "status-badge-warning",
  out_of_stock: "status-badge-danger",
};

interface BadgeProps {
  label: string;
  variant?: Variant | string;
  className?: string;
  /** Show colored dot prefix (Untitled UI style) */
  withDot?: boolean;
}

export function Badge({ label, variant = "default", className, withDot = true }: BadgeProps) {
  const v = (variant as Variant) in TONE_MAP ? (variant as Variant) : "default";
  return (
    <span
      className={cn(
        "status-badge capitalize",
        TONE_MAP[v],
        className
      )}
    >
      {withDot && <span className={cn("status-dot", DOT_MAP[v])} />}
      {label.replace(/_/g, " ")}
    </span>
  );
}
