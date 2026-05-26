"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FolderOpen, CalendarDays, Package,
  Users, Banknote, BarChart2, Bell, Settings, LogOut,
  ChevronLeft, ChevronRight, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/AuthContext";
import { useSidebar } from "@/context/SidebarContext";

const NAV_ITEMS = [
  { href: "/dashboard",  label: "Dashboard",  Icon: LayoutDashboard },
  { href: "/projects",   label: "Projects",   Icon: FolderOpen      },
  { href: "/schedule",   label: "Schedule",   Icon: CalendarDays    },
  { href: "/materials",  label: "Materials",  Icon: Package         },
  { href: "/labour",     label: "Labour",     Icon: Users           },
  { href: "/payroll",    label: "Payroll",    Icon: Banknote        },
  { href: "/costs",      label: "Costs",      Icon: BarChart2       },
  { href: "/alerts",     label: "Alerts",     Icon: Bell            },
];

const BOTTOM_ITEMS = [
  { href: "/settings", label: "Settings", Icon: Settings },
];

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

interface NavItemProps {
  href: string;
  label: string;
  Icon: React.ElementType;
  active: boolean;
  collapsed: boolean;
  badge?: number;
  onNavigate?: () => void;
}

function NavItem({ href, label, Icon, active, collapsed, badge, onNavigate }: NavItemProps) {
  return (
    <div className="relative group/item px-3">
      <Link
        href={href}
        aria-label={label}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold",
          "transition-colors duration-100 overflow-hidden whitespace-nowrap",
          active
            ? "bg-surface-subtle text-ink-900"
            : "text-ink-600 hover:text-ink-900 hover:bg-surface-subtle/60"
        )}
      >
        <Icon
          className={cn("w-5 h-5 flex-shrink-0", active ? "text-ink-900" : "text-ink-500")}
          strokeWidth={active ? 2 : 1.75}
        />
        <span className={cn(
          "flex-1 transition-[opacity,max-width] duration-200 overflow-hidden",
          collapsed ? "md:max-w-0 md:opacity-0 max-w-full opacity-100" : "max-w-full opacity-100"
        )}>
          {label}
        </span>
        {badge != null && badge > 0 && !collapsed && (
          <span className="ml-auto flex-shrink-0 min-w-[20px] h-5 px-1.5 bg-danger-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
        {badge != null && badge > 0 && collapsed && (
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-danger-500 rounded-full" />
        )}
      </Link>

      {/* Collapsed tooltip — desktop only */}
      {collapsed && (
        <div
          role="tooltip"
          className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-[200] px-2.5 py-1.5 bg-ink-900 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 group-hover/item:opacity-100 transition-opacity duration-150 hidden md:block"
        >
          {label}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { collapsed, toggle, mobileOpen, closeMobile } = useSidebar();

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-ink-900/40 z-[99] md:hidden backdrop-blur-sm"
          onClick={closeMobile}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          // Base
          "bg-white flex flex-col h-full flex-shrink-0 border-r border-surface-border",
          // Mobile: fixed overlay
          "fixed inset-y-0 left-0 z-[100] w-[260px] transition-transform duration-300 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: inline, collapsible
          "md:relative md:translate-x-0 md:transition-[width] md:duration-200 md:ease-out",
          collapsed ? "md:w-[72px]" : "md:w-[260px]",
        )}
      >
        {/* Brand */}
        <div className={cn(
          "flex items-center gap-3 px-5 py-5 border-b border-surface-divider flex-shrink-0 overflow-hidden",
          collapsed && "md:px-4 md:justify-center"
        )}>
          {/* Logo mark — geometric, flat */}
          <div className="w-9 h-9 rounded-lg bg-ink-900 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none">
              <path d="M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z" fill="currentColor" opacity="0.4"/>
              <path d="M4 4h7v7H4z M13 13h7v7h-7z" fill="currentColor"/>
            </svg>
          </div>
          <div className={cn(
            "overflow-hidden transition-[opacity,max-width] duration-200 flex-1 min-w-0",
            collapsed ? "md:max-w-0 md:opacity-0 max-w-full opacity-100" : "max-w-full opacity-100"
          )}>
            <p className="text-ink-900 font-bold text-base leading-tight whitespace-nowrap tracking-tight">ConstructAI</p>
            <p className="text-ink-500 text-xs leading-tight whitespace-nowrap mt-0.5">Project Management</p>
          </div>
          {/* Mobile close button */}
          <button
            onClick={closeMobile}
            aria-label="Close navigation"
            className="ml-auto p-1.5 rounded-lg text-ink-500 hover:text-ink-900 hover:bg-surface-subtle transition-colors md:hidden flex-shrink-0"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Main nav */}
        <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto overflow-x-visible scrollbar-hide">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                Icon={item.Icon}
                active={active}
                collapsed={collapsed}
                onNavigate={closeMobile}
              />
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-surface-divider py-3 space-y-0.5 flex-shrink-0">
          {BOTTOM_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                Icon={item.Icon}
                active={active}
                collapsed={collapsed}
                onNavigate={closeMobile}
              />
            );
          })}

          {/* User card */}
          <div className="px-3 pt-3">
            <div className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg overflow-hidden",
              collapsed && "md:justify-center md:px-0"
            )}>
              <div className="w-9 h-9 rounded-full bg-ink-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                {user ? initials(user.name) : "?"}
              </div>
              <div className={cn(
                "flex-1 min-w-0 overflow-hidden transition-[opacity,max-width] duration-200",
                collapsed ? "md:max-w-0 md:opacity-0 max-w-full opacity-100" : "max-w-full opacity-100"
              )}>
                <p className="text-sm font-semibold text-ink-900 truncate leading-tight whitespace-nowrap">{user?.name ?? "—"}</p>
                <p className="text-xs text-ink-500 truncate leading-tight capitalize whitespace-nowrap mt-0.5">
                  {user?.role?.replace(/_/g, " ") ?? ""}
                </p>
              </div>
              <button
                onClick={logout}
                aria-label="Sign out"
                className={cn(
                  "p-1.5 rounded-lg text-ink-500 hover:text-danger-600 hover:bg-danger-50 transition-colors flex-shrink-0",
                  collapsed && "md:hidden"
                )}
              >
                <LogOut className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>

        {/* Collapse toggle — desktop only */}
        <button
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "hidden md:flex mx-3 mb-3 items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium",
            "text-ink-500 hover:text-ink-900 hover:bg-surface-subtle transition-colors duration-100",
            collapsed && "justify-center"
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </aside>
    </>
  );
}
