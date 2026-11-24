'use client';

import React from 'react';

interface CreditsFooterProps {
  projectName?: string;
  version?: string;
}

export function CreditsFooter({
  projectName = 'AURA SPACE',
  version = 'v0.1 · orbit build',
}: CreditsFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-white/10 bg-black/60 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* Верхняя строка: название, версия, год */}
        <div className="flex flex-col items-start justify-between gap-4 border-b border-white/10 pb-8 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold tracking-[0.25em] text-violet-400 uppercase">
              Credits
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-wider text-white">
              {projectName}
            </h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {version}
            </span>
            <span>© {year}</span>
          </div>
        </div>

        {/* Команда проекта */}
        <div className="grid grid-cols-1 gap-6 py-8 sm:grid-cols-3">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <p className="text-[11px] tracking-widest text-violet-400/90 uppercase">
              Программист и основатель
            </p>
            <p className="mt-1.5 text-base font-semibold text-zinc-100">
              Артём Лотников
            </p>
          </div>

          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <p className="text-[11px] tracking-widest text-pink-400/90 uppercase">
              Основатель и дизайнер
            </p>
            <p className="mt-1.5 text-base font-semibold text-zinc-100">
              Захар Лазебный
            </p>
          </div>

          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <p className="text-[11px] tracking-widest text-indigo-400/90 uppercase">
              Программист
            </p>
            <p className="mt-1.5 text-base font-semibold text-zinc-100">
              Deadlock
            </p>
          </div>
        </div>

        {/* Нижняя строчка */}
        <div className="flex flex-col items-center justify-between gap-2 border-t border-white/5 pt-6 text-center text-xs text-zinc-500 sm:flex-row sm:text-left">
          <span>Сделано с нуля в тёмном эфире.</span>
          <span className="font-mono text-[11px] text-zinc-600">
            end of feed · scroll up to orbit
          </span>
        </div>
      </div>
    </footer>
  );
}