import { ShieldCheck, Sparkles, Home } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-[var(--color-dark-bg)] p-8 flex flex-col items-center justify-center">
      <div className="max-w-md w-full rounded-2xl bg-[var(--color-dark-surface)] border border-[var(--color-dark-border)] p-6 shadow-xl">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2.5 rounded-xl bg-[var(--color-dark-card)] border border-[var(--color-dark-border)] text-[var(--color-accent-cyan)]">
            <Home className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              FlowFlat
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-accent-emerald)]/10 text-[var(--color-accent-emerald)] border border-[var(--color-accent-emerald)]/20">
                Live
              </span>
            </h1>
            <p className="text-xs text-slate-400">Household Command Center</p>
          </div>
        </div>

        <p className="text-sm text-slate-300 mb-6">
          Tailwind v4, React 19, and Vite are running smoothly with the full
          dark theme.
        </p>

        <div className="rounded-xl bg-[var(--color-dark-card)] p-4 border border-[var(--color-dark-border)] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ShieldCheck className="w-5 h-5 text-[var(--color-accent-emerald)]" />
            <span className="text-sm font-medium text-slate-200">
              Kiosk Sync Active
            </span>
          </div>
          <Sparkles className="w-4 h-4 text-[var(--color-accent-cyan)]" />
        </div>
      </div>
    </div>
  );
}
