"use client";

import { ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const SIZE_MAP = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({ open, onClose, title, description, children, size = "md" }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  const didAutoFocus = useRef(false);

  useEffect(() => {
    if (!open) {
      didAutoFocus.current = false;
      return;
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    }
    document.addEventListener("keydown", onKey);

    if (!didAutoFocus.current) {
      didAutoFocus.current = true;
      setTimeout(() => {
        panelRef.current
          ?.querySelector<HTMLElement>("input, select, button:not([data-close])")
          ?.focus();
      }, 50);
    }

    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          "relative z-10 w-full bg-white rounded-xl border border-surface-border",
          "flex flex-col max-h-[calc(100vh-2rem)]",
          SIZE_MAP[size]
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-surface-divider flex-shrink-0">
          <div className="min-w-0">
            <h2
              id="modal-title"
              className="text-lg font-semibold text-ink-900 tracking-tight"
            >
              {title}
            </h2>
            {description && (
              <p className="text-sm text-ink-500 mt-1">{description}</p>
            )}
          </div>
          <button
            data-close
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-ink-500 hover:text-ink-900 hover:bg-surface-subtle transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>
        {/* Body */}
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
