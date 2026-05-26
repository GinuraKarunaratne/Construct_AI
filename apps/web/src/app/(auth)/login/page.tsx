"use client";

import { useState, FormEvent } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { AlertCircle, BarChart2, Package, CalendarDays } from "lucide-react";

const FEATURES = [
  { Icon: BarChart2,    label: "AI Cost Forecasting", desc: "ML-powered overrun prediction" },
  { Icon: CalendarDays, label: "Smart Scheduling",     desc: "Weather-aware task management" },
  { Icon: Package,      label: "Inventory Tracking",   desc: "Real-time stock monitoring"    },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Invalid email or password";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-surface-bg">
      {/* ── Left panel — branding ──────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] flex-shrink-0 bg-ink-900 px-12 py-14">
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-ink-900" fill="none">
                <path d="M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z" fill="currentColor" opacity="0.4"/>
                <path d="M4 4h7v7H4z M13 13h7v7h-7z" fill="currentColor"/>
              </svg>
            </div>
            <span className="text-white font-bold text-lg tracking-tight">ConstructAI</span>
          </div>

          <h2 className="text-4xl font-bold text-white leading-tight tracking-tight mb-4">
            Construction management,<br />
            <span className="text-ink-400">intelligently automated.</span>
          </h2>
          <p className="text-ink-400 text-sm leading-relaxed max-w-sm">
            Monitor budgets, track labour, manage materials, and forecast project
            outcomes — all in one unified platform.
          </p>

          <div className="mt-10 space-y-4">
            {FEATURES.map(({ Icon, label, desc }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-white" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="text-xs text-ink-400 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Demo accounts */}
        <div className="rounded-xl border border-white/10 p-5">
          <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-3">
            Demo accounts
          </p>
          <div className="space-y-1">
            {[
              { role: "Project Manager",  email: "pm@constructai.lk",         pw: "demo1234" },
              { role: "Site Supervisor",  email: "supervisor@constructai.lk", pw: "demo1234" },
              { role: "Finance Officer",  email: "finance@constructai.lk",    pw: "demo1234" },
            ].map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => { setEmail(acc.email); setPassword(acc.pw); }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left group"
              >
                <div>
                  <p className="text-sm font-semibold text-white">
                    {acc.role}
                  </p>
                  <p className="text-xs font-mono text-ink-400">{acc.email}</p>
                </div>
                <span className="text-xs text-ink-500 font-mono">{acc.pw}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — form ─────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-surface-bg">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-lg bg-ink-900 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none">
                <path d="M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z" fill="currentColor" opacity="0.4"/>
                <path d="M4 4h7v7H4z M13 13h7v7h-7z" fill="currentColor"/>
              </svg>
            </div>
            <span className="text-ink-900 font-bold text-base tracking-tight">ConstructAI</span>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-ink-900 tracking-tight">Welcome back</h1>
            <p className="text-sm text-ink-500 mt-2">Sign in to access your dashboard</p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-center gap-3 px-4 py-3 rounded-lg bg-danger-50 border border-danger-100 text-danger-700 text-sm"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
              {error}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="form-label">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="pm@constructai.lk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
              />
            </div>

            <div>
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* Mobile demo hint */}
          <div className="mt-6 lg:hidden">
            <p className="text-xs text-ink-500 text-center">
              Demo:{" "}
              <button
                type="button"
                onClick={() => { setEmail("pm@constructai.lk"); setPassword("demo1234"); }}
                className="font-mono text-ink-700 hover:text-ink-900 transition-colors"
              >
                pm@constructai.lk
              </button>
              {" / "}
              <span className="font-mono text-ink-700">demo1234</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
