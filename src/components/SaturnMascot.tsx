"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { RotateCcw, Sparkles } from "lucide-react";

export type SaturnState = number | "slow1" | "blackhole";

interface SaturnMascotProps {
  state: SaturnState;
  onRevive: () => void;
}

const MASCOT_SRC = "/images/saturn-mascot.gif";
const BLACKHOLE_SRC = "/images/saturn-blackhole.gif";

function getFloatDuration(state: SaturnState): number {
  if (state === "slow1") return 6.0;
  if (typeof state !== "number" || state <= 1) return 3.6;
  if (state === 2) return 2.8;
  if (state === 3) return 2.1;
  if (state === 4) return 1.5;
  return Math.max(0.85, 1.35 - (state - 5) * 0.04);
}

function getStatusBadge(state: SaturnState): string {
  if (state === "blackhole") return "2д тишины • Чёрная дыра";
  if (state === "slow1") return "1д тишины • Замедление";
  if (state === 1) return "День 1 • Старт";
  if (state === 2) return "День 2 • Разгон";
  if (state === 3) return "День 3 • Бодрый ход";
  if (state === 4) return "День 4 • Высокий темп";
  return `День ${state}🔥 • Гипер-орбита`;
}

function getStatusText(state: SaturnState): string {
  if (state === "blackhole") {
    return "Два дня без общения — Дрейфа затянуло в чёрную дыру.";
  }
  if (state === "slow1") {
    return "День тишины: Дрейф замедляется и тускнеет. Напиши, чтобы удержать серию.";
  }
  if (state < 5) {
    return `Серия ${state} дн. — каждый новый день общения разгоняет Дрейфа сильнее.`;
  }
  return `Серия ${state} дн.! Пройдена отметка в 5 дней — Дрейф на максимальном драйве.`;
}

export function SaturnMascot({ state, onRevive }: SaturnMascotProps) {
  const [imgError, setImgError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const isBlackHole = state === "blackhole";
  const isSlow = state === "slow1";
  const isHyper = typeof state === "number" && state >= 5;
  const floatDuration = getFloatDuration(state);

  const activeSrc = isBlackHole ? BLACKHOLE_SRC : MASCOT_SRC;

  function retryImage() {
    setImgError(false);
    setReloadTick((t) => t + 1);
  }

  return (
    <div className="rounded-2xl border border-fuchsia-500/25 bg-[#140D2B]/90 p-5 shadow-xl shadow-purple-950/60">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-extrabold uppercase tracking-wider text-pink-300">
          Маскот • Дрейф
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            isBlackHole
              ? "bg-rose-500/20 text-rose-200"
              : isSlow
              ? "bg-purple-500/20 text-purple-200"
              : "bg-[#FF2A85]/20 text-pink-200"
          }`}
        >
          {getStatusBadge(state)}
        </span>
      </div>

      {/* Сцена с маскотом и анимацией чёрной дыры */}
      <div className="relative my-4 flex h-60 items-center justify-center overflow-hidden rounded-xl border border-purple-500/20 bg-[#080412]">
        <div
          className={`pointer-events-none absolute h-40 w-40 rounded-full blur-2xl transition-all duration-500 ${
            isBlackHole
              ? "bg-[#FF2A85]/35"
              : isSlow
              ? "bg-purple-900/25"
              : isHyper
              ? "bg-[#FF2A85]/45"
              : "bg-[#9D4EDD]/30"
          }`}
        />

        {isBlackHole ? (
          <div
            key={`bh-${reloadTick}`}
            className="relative z-10 flex h-48 w-48 items-center justify-center"
          >
            {!imgError ? (
              <img
                src={reloadTick ? `${activeSrc}?v=${reloadTick}` : activeSrc}
                alt="Дрейф затягивается в чёрную дыру"
                onError={() => setImgError(true)}
                className="max-h-full max-w-full object-contain drop-shadow-[0_0_22px_rgba(255,42,133,0.7)]"
              />
            ) : (
              <div className="rounded-xl border border-dashed border-pink-400/50 bg-[#180E36] p-3 text-center text-xs text-purple-100">
                Файл не найден по пути:
                <div className="mt-1 break-all font-mono text-[11px] text-[#FF70B8]">
                  public{activeSrc}
                </div>
                <button
                  type="button"
                  onClick={retryImage}
                  className="mt-2 rounded-lg bg-[#FF2A85]/25 px-2.5 py-1 text-[11px] font-bold text-pink-200 hover:bg-[#FF2A85]/40"
                >
                  Проверить снова
                </button>
              </div>
            )}
          </div>
        ) : (
          <motion.div
            key={`mascot-${state}-${floatDuration}`}
            initial={{ scale: 0.95, rotate: 0, opacity: 0.95 }}
            animate={{
              y: isSlow ? [-2, 2, -2] : [-6, 6, -6],
              rotate: isSlow ? [-1.5, 1.5, -1.5] : [-4, 4, -4],
              scale: isHyper ? [1, 1.05, 1] : [1, 1.02, 1],
              opacity: isSlow ? 0.6 : 1,
            }}
            transition={{
              duration: floatDuration,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="relative z-10 flex h-44 w-44 items-center justify-center"
          >
            {!imgError ? (
              <img
                key={reloadTick}
                src={reloadTick ? `${activeSrc}?v=${reloadTick}` : activeSrc}
                alt="Маскот Дрейф"
                onError={() => setImgError(true)}
                className={`max-h-full max-w-full object-contain transition duration-300 ${
                  isSlow
                    ? "grayscale-[45%] brightness-75"
                    : isHyper
                    ? "drop-shadow-[0_0_18px_rgba(255,42,133,0.65)]"
                    : "drop-shadow-[0_0_12px_rgba(157,78,221,0.5)]"
                }`}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-pink-400/50 bg-[#180E36] p-3 text-center text-xs text-purple-100">
                Файл не найден по пути:
                <div className="mt-1 break-all font-mono text-[11px] text-[#FF70B8]">
                  public{activeSrc}
                </div>
                <button
                  type="button"
                  onClick={retryImage}
                  className="mt-2 rounded-lg bg-[#FF2A85]/25 px-2.5 py-1 text-[11px] font-bold text-pink-200 hover:bg-[#FF2A85]/40"
                >
                  Проверить снова
                </button>
              </div>
            )}
          </motion.div>
        )}

        {isBlackHole && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            onClick={onRevive}
            className="absolute bottom-3 z-20 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#9D4EDD] to-[#FF2A85] px-3.5 py-1.5 text-xs font-bold text-white shadow-lg hover:brightness-110"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Возродить Дрейфа
          </motion.button>
        )}

        {!isBlackHole && isHyper && (
          <div className="pointer-events-none absolute right-2.5 top-2.5 z-20 flex items-center gap-1 rounded-full bg-[#FF2A85]/25 px-2 py-0.5 text-[10px] font-bold text-pink-200">
            <Sparkles className="h-3 w-3 text-[#FF70B8]" />
            {state} ДН.
          </div>
        )}
      </div>

      <p className="text-xs leading-relaxed text-purple-200/80">
        {getStatusText(state)}
      </p>
    </div>
  );
}