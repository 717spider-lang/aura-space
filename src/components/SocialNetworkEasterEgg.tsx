"use client";

import React, { useMemo, useRef, useState } from "react";
import { RotateCcw, Sparkles } from "lucide-react";

/**
 * Укажи точный путь к файлу в папке public/, например "/social-network-poster.jpg".
 * Если оставить null, компонент сам попробует подхватить имена из POSTER_CANDIDATES.
 */
export const SOCIAL_NETWORK_POSTER_SRC: string | null =
  "/social-network-poster.jpg";

const POSTER_CANDIDATES = [
  "/social-network-poster.jpg",
  "/social-network.jpg",
  "/poster.jpg",
  "/social-network-poster.png",
  "/social-network-poster.webp",
  "/social-network.png",
  "/social-network.webp",
  "/poster.png",
];

const MAX_PULL_VALUE = 100000;
const PULL_GAIN_PER_PX = 320;

export function hasEasterEggForPost(postId: string): boolean {
  let hash = 2166136261;
  for (let i = 0; i < postId.length; i++) {
    hash ^= postId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 3 === 0;
}

function PosterArtwork({ className = "" }: { className?: string }) {
  const sources = useMemo(() => {
    if (SOCIAL_NETWORK_POSTER_SRC) {
      return [SOCIAL_NETWORK_POSTER_SRC, ...POSTER_CANDIDATES];
    }
    return POSTER_CANDIDATES;
  }, []);

  const [sourceIndex, setSourceIndex] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  const currentSrc = sources[sourceIndex];

  function handleError() {
    if (sourceIndex + 1 < sources.length) {
      setSourceIndex((i) => i + 1);
    } else {
      setExhausted(true);
    }
  }

  if (exhausted || !currentSrc) {
    return (
      <div
        aria-hidden="true"
        className={`bg-gradient-to-br from-[#0B0617] via-[#170C2E] to-[#290B2C] ${className}`}
      />
    );
  }

  return (
    <img
      src={currentSrc}
      alt="Постер"
      onError={handleError}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}

/**
 * Подслой, который открывается под отклеивающимся уголком самого поста.
 */
export function PostPeelUnderlay({
  pullValue,
  onReset,
}: {
  pullValue: number;
  onReset?: () => void;
}) {
  const ratio = Math.max(0, Math.min(1, pullValue / MAX_PULL_VALUE));
  const isFullyPulled = pullValue >= MAX_PULL_VALUE;

  if (isFullyPulled) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-pink-400/45 bg-gradient-to-br from-[#1B0D33] via-[#120924] to-[#260B29] p-5 shadow-[0_0_25px_rgba(255,42,133,0.18)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#FF70B8]">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>Aura Space</span>
          </div>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              title="Вернуть пост"
              className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-purple-200 hover:bg-white/10 hover:text-white"
            >
              <RotateCcw className="h-3 w-3" />
              Вернуть пост
            </button>
          )}
        </div>

        <div className="mt-3 grid gap-4 sm:grid-cols-[120px_1fr] sm:items-center">
          <div className="overflow-hidden rounded-lg border border-pink-400/35 bg-[#07050E] shadow-lg">
            <PosterArtwork className="aspect-[2/3] w-full object-cover" />
          </div>

          <div className="space-y-2.5 text-xs leading-relaxed text-purple-100/90">
            <p className="text-sm font-bold text-white">
              Отдельная благодарность режиссёру Дэвиду Финчеру, также актёрам,
              сыгравшим Эдуардо Саверина и Марка Цукерберга (Эндрю Гарфилду и
              Джесси Айзенбергу), а также самим Эдуардо Саверину и Марку
              Цукербергу за историю, характер и вдохновение для Aura Space.
            </p>
            <p>
              Спасибо всем актёрам и всему составу за атмосферу, драйв и
              идеи, с которыми мы собираем своё пространство.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl bg-[#090414]"
    >
      <div
        className="h-full w-full transition-opacity duration-75"
        style={{
          opacity: Math.min(1, 0.2 + ratio * 0.8),
        }}
      >
        <PosterArtwork className="h-full w-full object-cover" />
      </div>
    </div>
  );
}

/**
 * Смятый уголок в правом нижнем углу самого поста, за который тянем до 100000.
 */
export function PostCornerPeelHandle({
  pullValue,
  onPullChange,
}: {
  pullValue: number;
  onPullChange: React.Dispatch<React.SetStateAction<number>>;
}) {
  const [dragging, setDragging] = useState(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const ratio = Math.max(0, Math.min(1, pullValue / MAX_PULL_VALUE));
  const creaseSizePx = Math.round(34 + ratio * 150);

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    lastPointRef.current = { x: e.clientX, y: e.clientY };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging || !lastPointRef.current) return;
    const dx = Math.max(0, lastPointRef.current.x - e.clientX);
    const dy = Math.max(0, lastPointRef.current.y - e.clientY);
    lastPointRef.current = { x: e.clientX, y: e.clientY };

    const stepPx = Math.max(dx, Math.hypot(dx, dy));
    if (stepPx <= 0) return;

    onPullChange((prev) =>
      Math.min(MAX_PULL_VALUE, prev + Math.round(stepPx * PULL_GAIN_PER_PX))
    );
  }

  function handlePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging) return;
    setDragging(false);
    lastPointRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      aria-label="Потянуть уголок поста"
      style={{
        width: `${creaseSizePx}px`,
        height: `${creaseSizePx}px`,
        clipPath: "polygon(100% 0, 0 100%, 100% 100%)",
        transform: `translate(${-Math.round(ratio * 36)}px, ${-Math.round(ratio * 16)}px) rotate(${-Math.round(ratio * 9)}deg)`,
      }}
      className="z-20 absolute bottom-0 right-0 flex touch-none cursor-grab items-end justify-end border-t border-l border-white/25 bg-gradient-to-tl from-[#26113B] via-[#6D28D9]/85 to-[#EC4899]/75 p-2.5 text-[11px] font-black text-white shadow-[-8px_-8px_20px_rgba(0,0,0,0.65)] transition-[width,height] duration-75 active:cursor-grabbing"
    >
      <span className="rounded bg-black/45 px-1.5 py-0.5 leading-none">
        {pullValue}
      </span>
    </button>
  );
}