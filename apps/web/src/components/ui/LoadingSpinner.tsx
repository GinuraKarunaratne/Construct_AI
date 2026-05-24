import { cn } from "@/lib/utils";

export function LoadingSpinner({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <div className="w-7 h-7 border-[2.5px] border-brand-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-stone-400">{message}</p>
    </div>
  );
}

/* ── Skeleton primitives ─────────────────────────────────────────────────── */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-stone-200/80",
        className
      )}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-2.5 w-40" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-stone-100">
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="divide-y divide-stone-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-5 py-3.5 flex items-center gap-4">
            <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-2.5 w-24" />
            </div>
            <Skeleton className="h-5 w-16 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────────── */

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      {icon && (
        <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center mb-4 text-stone-400">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-stone-700">{title}</p>
      {description && (
        <p className="text-xs text-stone-400 mt-1 max-w-[240px] leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
