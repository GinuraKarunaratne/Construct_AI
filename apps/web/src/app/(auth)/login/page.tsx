"use client";

import { useState, FormEvent } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { Building2 } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center bg-stone-900 px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600 mb-4 shadow-lg shadow-brand-900/30">
            <Building2 className="w-6 h-6 text-white" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            ConstructAI
          </h1>
          <p className="text-stone-400 text-sm mt-1">
            Smart Construction Management
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl shadow-stone-950/30 ring-1 ring-stone-200/20 p-8">
          <h2 className="text-base font-semibold text-stone-800 mb-6">
            Sign in to your account
          </h2>

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
            >
              <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
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
              className="btn-primary w-full justify-center py-2.5 mt-2"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* Demo hint */}
          <div className="mt-5 pt-4 border-t border-stone-100">
            <p className="text-[11px] text-stone-400 text-center leading-relaxed">
              Demo:{" "}
              <span className="font-mono text-stone-500">pm@constructai.lk</span>
              {" / "}
              <span className="font-mono text-stone-500">demo1234</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
