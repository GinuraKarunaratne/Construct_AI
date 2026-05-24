import { clsx } from "clsx";

type Severity = "critical" | "warning" | "info";

interface AlertBannerProps {
  severity: Severity;
  message: string;
}

const SEVERITY_STYLES: Record<Severity, { bar: string; bg: string; text: string; label: string }> = {
  critical: { bar: "bg-red-500",    bg: "bg-red-50 border-red-200",     text: "text-red-800",   label: "Critical" },
  warning:  { bar: "bg-amber-500",  bg: "bg-amber-50 border-amber-200", text: "text-amber-800", label: "Warning"  },
  info:     { bar: "bg-blue-500",   bg: "bg-blue-50 border-blue-200",   text: "text-blue-800",  label: "Info"     },
};

export function AlertBanner({ severity, message }: AlertBannerProps) {
  const s = SEVERITY_STYLES[severity];
  return (
    <div className={clsx("flex items-start gap-3 rounded-lg border px-4 py-3 text-sm", s.bg)}>
      <span className={clsx("mt-0.5 w-2 h-2 rounded-full flex-shrink-0", s.bar)} />
      <div className={clsx("flex-1", s.text)}>
        <span className="font-semibold mr-1">{s.label}:</span>
        {message}
      </div>
    </div>
  );
}
