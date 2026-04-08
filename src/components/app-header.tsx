"use client";

import Image from "next/image";

type AppHeaderProps = {
  subtitle: string;
  onLogout: () => void | Promise<void>;
  showOnlineBadge?: boolean;
};

export function AppHeader({ subtitle, onLogout, showOnlineBadge = true }: AppHeaderProps) {
  return (
    <header className="overflow-hidden rounded-3xl bg-gradient-to-r from-[#0f2348] via-[#1c4e87] to-[#4f8fc7] p-[1px] shadow-lg">
      <div className="flex flex-col gap-4 rounded-[calc(1.5rem-1px)] bg-white/95 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Image src="/logo.PNG" alt="Garden Poker" width={56} height={56} className="h-14 w-14 rounded-xl object-contain" />
          <div>
            <h1 className="text-2xl font-semibold text-[#10254f]">Painel Garden Poker</h1>
            <p className="text-sm text-slate-600">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {showOnlineBadge ? (
            <span className="rounded-full bg-[#e9ddbd] px-3 py-1 text-xs font-semibold text-[#17346b]">Online</span>
          ) : null}
          <button
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            onClick={() => void onLogout()}
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
