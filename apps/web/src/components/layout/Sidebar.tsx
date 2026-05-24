"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  CalendarDays,
  Package,
  Users,
  Banknote,
  BarChart2,
  Bell,
  Settings,
  LogOut,
  Building2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/AuthContext";
import { useSidebar } from "@/context/SidebarContext";

const NAV_ITEMS = [
  { href: "/dashboard",  label: "Dashboard", Icon: LayoutDashboard },
  { href: "/projects",   label: "Projects",  Icon: FolderOpen      },
  { href: "/schedule",   label: "Schedule",  Icon: CalendarDays    },
  { href: "/materials",  label: "Materials", Icon: Package         },
  { href: "/labour",     label: "Labour",    Icon: Users           },
  { href: "/payroll",    label: "Payroll",   Icon: Banknote        },
  { href: "/costs",      label: "Costs",     Icon: BarChart2       },
  { href: "/alerts",     label: "Alerts",    Icon: Bell            },
];

const BOTTOM_ITEMS = [
  { href: "/settings",   label: "Settings",  Icon: Settings        },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface NavItemProps {
  href: string;
  label: string;
  Icon: React.ElementType;
  active: boolean;
  collapsed: boolean;
  badge?: number;
}

function NavItem({ href, label, Icon, active, collapsed, badge }: NavItemProps) {
  return (
    <div className="relative group/item px-2">
      <Link
        href={href}
        aria-label={label}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 overflow-hidden whitespace-nowrap",
          active
            ? "bg-brand-600 text-white"
            : "text-stone-400 hover:text-white hover:bg-stone-800/70"
        )}
      >
        <Icon className="w-[18px] h-[18px] flex-shrink-0 shrink-0" strokeWidth={1.75} />
        <span
          className={cn(
            "flex-1 transition-[opacity,max-width] duration-200 overflow-hidden",
            collapsed ? "max-w-0 opacity-0" : "max-w-full opacity-100"
          )}
        >
          {label}
        </span>
        {badge != null && badge > 0 && !collapsed && (
          <span className="ml-auto flex-shrink-0 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
        {badge != null && badge > 0 && collapsed && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        )}
      </Link>

      {/* Tooltip — collapsed mode only */}
      {collapsed && (
        <div
          role="tooltip"
          className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[200] px-2.5 py-1.5 bg-stone-800 text-white text-xs font-medium rounded-lg shadow-xl border border-stone-700 whitespace-nowrap opacity-0 group-hover/item:opacity-100 transition-opacity duration-150"
        >
          {label}
          {/* Arrow */}
          <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-stone-800" />
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { collapsed, toggle } = useSidebar();

  return (
    <aside
      className={cn(
        "relative flex-shrink-0 bg-stone-900 flex flex-col h-full",
        "transition-[width] duration-200 ease-out",
        collapsed ? "w-16" : "w-[220px]"
      )}
    >
      {/* ── Brand ──────────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex items-center gap-3 border-b border-stone-700/60 flex-shrink-0 overflow-hidden",
          collapsed ? "px-[14px] py-4 justify-center" : "px-5 py-4"
        )}
      >
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4.5 h-4.5 text-white" strokeWidth={2} />
        </div>
        <div
          className={cn(
            "overflow-hidden transition-[opacity,max-width] duration-200",
            collapsed ? "max-w-0 opacity-0" : "max-w-full opacity-100"
          )}
        >
          <p className="text-white font-semibold text-sm leading-tight whitespace-nowrap">
            ConstructAI
          </p>
          <p className="text-stone-500 text-[11px] leading-tight whitespace-nowrap mt-0.5">
            Project Management
          </p>
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────────────────────── */}
      <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto overflow-x-visible scrollbar-hide">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              Icon={item.Icon}
              active={active}
              collapsed={collapsed}
            />
          );
        })}
      </nav>

      {/* ── Bottom section ──────────────────────────────────────────── */}
      <div className="border-t border-stone-700/60 py-3 space-y-0.5 flex-shrink-0">
        {BOTTOM_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              Icon={item.Icon}
              active={active}
              collapsed={collapsed}
            />
          );
        })}

        {/* User identity */}
        <div
          className={cn(
            "mx-2 flex items-center gap-3 px-3 py-2.5 overflow-hidden",
            collapsed && "justify-center"
          )}
        >
          <div className="w-7 h-7 rounded-full bg-brand-600/20 border border-brand-600/40 flex items-center justify-center text-[11px] font-bold text-brand-400 flex-shrink-0">
            {user ? initials(user.name) : "?"}
          </div>
          <div
            className={cn(
              "flex-1 min-w-0 overflow-hidden transition-[opacity,max-width] duration-200",
              collapsed ? "max-w-0 opacity-0" : "max-w-full opacity-100"
            )}
          >
            <p className="text-[13px] text-white font-medium truncate leading-tight whitespace-nowrap">
              {user?.name ?? "—"}
            </p>
            <p className="text-[11px] text-stone-500 truncate leading-tight capitalize whitespace-nowrap">
              {user?.role?.replace(/_/g, " ") ?? ""}
            </p>
          </div>
        </div>

        {/* Sign out */}
        <div className="relative group/logout px-2">
          <button
            onClick={logout}
            aria-label="Sign out"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-stone-500 hover:text-red-400 hover:bg-stone-800/70 text-sm font-medium transition-colors duration-150 overflow-hidden whitespace-nowrap"
          >
            <LogOut className="w-[18px] h-[18px] flex-shrink-0 shrink-0" strokeWidth={1.75} />
            <span
              className={cn(
                "transition-[opacity,max-width] duration-200 overflow-hidden",
                collapsed ? "max-w-0 opacity-0" : "max-w-full opacity-100"
              )}
            >
              Sign out
            </span>
          </button>
          {collapsed && (
            <div
              role="tooltip"
              className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[200] px-2.5 py-1.5 bg-stone-800 text-white text-xs font-medium rounded-lg shadow-xl border border-stone-700 whitespace-nowrap opacity-0 group-hover/logout:opacity-100 transition-opacity duration-150"
            >
              Sign out
              <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-stone-800" />
            </div>
          )}
        </div>
      </div>

      {/* ── Collapse toggle ─────────────────────────────────────────── */}
      <button
        onClick={toggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "absolute -right-3 top-[72px] z-10",
          "w-6 h-6 rounded-full bg-stone-700 hover:bg-brand-600",
          "flex items-center justify-center",
          "text-stone-300 hover:text-white",
          "border border-stone-600 hover:border-brand-600",
          "transition-colors duration-150 shadow-sm"
        )}
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
        )}
      </button>
    </aside>
  );
}
