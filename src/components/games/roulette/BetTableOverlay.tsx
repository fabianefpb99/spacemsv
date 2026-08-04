import { memo, useCallback, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { type BetType, betId, colorOfNumber, multiplierFor } from "@/lib/games/roulette-table";

const ROWS = Array.from({ length: 12 }, (_, i) => i + 1);
const COLS = [1, 2, 3];

function formatChip(n: number) {
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`;
  if (n >= 1000) return `${Math.round(n / 100) / 10}K`.replace(".0K", "K");
  return String(n);
}

/** Paleta por denominación: el color de la ficha en el tapete refleja su valor. */
const CHIP_TIERS: { min: number; ring: string; face: string; text: string }[] = [
  { min: 50_000, ring: "#fef3c7", face: "linear-gradient(180deg,#fcd34d,#b45309)", text: "#2a1500" },
  { min: 25_000, ring: "#f5d0fe", face: "linear-gradient(180deg,#e879f9,#86198f)", text: "#fdf4ff" },
  { min: 10_000, ring: "#e9d5ff", face: "linear-gradient(180deg,#a78bfa,#5b21b6)", text: "#f5f3ff" },
  { min: 5_000, ring: "#bbf7d0", face: "linear-gradient(180deg,#4ade80,#15803d)", text: "#052e16" },
  { min: 2_000, ring: "#fecdd3", face: "linear-gradient(180deg,#fb7185,#9f1239)", text: "#fff1f2" },
  { min: 1_000, ring: "#bae6fd", face: "linear-gradient(180deg,#38bdf8,#0369a1)", text: "#f0f9ff" },
  { min: 0, ring: "#e2e8f0", face: "linear-gradient(180deg,#e5e7eb,#94a3b8)", text: "#0f172a" },
];

function ChipBadge({ amount, size = 18 }: { amount: number; size?: number }) {
  const tier = CHIP_TIERS.find((t) => amount >= t.min) ?? CHIP_TIERS[CHIP_TIERS.length - 1];
  return (
    <span
      className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-black shadow-[0_1px_5px_rgba(0,0,0,0.8)]"
      style={{
        width: size,
        height: size,
        fontSize: size <= 14 ? 6.5 : 7.5,
        background: tier.face,
        color: tier.text,
        border: `1px solid ${tier.ring}`,
      }}
    >
      {formatChip(amount)}
    </span>
  );
}

type ZoneProps = {
  type: BetType;
  betKey: string;
  amount: number;
  disabled: boolean;
  onPlace: (type: BetType, key: string) => void;
  onClearCell: (type: BetType, key: string) => void;
  className?: string;
  style?: React.CSSProperties;
  title: string;
  children?: React.ReactNode;
  chipSize?: number;
};

const Zone = memo(function Zone({
  type,
  betKey,
  amount,
  disabled,
  onPlace,
  onClearCell,
  className,
  style,
  title,
  children,
  chipSize,
}: ZoneProps) {
  const timerRef = useRef<number | null>(null);
  const longRef = useRef(false);

  const down = useCallback(() => {
    longRef.current = false;
    timerRef.current = window.setTimeout(() => {
      longRef.current = true;
      onClearCell(type, betKey);
    }, 420);
  }, [onClearCell, type, betKey]);

  const up = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      aria-label={title}
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={up}
      onContextMenu={(e) => {
        e.preventDefault();
        onClearCell(type, betKey);
      }}
      onClick={() => {
        if (longRef.current) {
          longRef.current = false;
          return;
        }
        onPlace(type, betKey);
      }}
      className={`relative select-none disabled:opacity-70 ${className ?? ""}`}
      style={style}
    >
      {children}
      {amount > 0 && <ChipBadge amount={amount} size={chipSize} />}
    </button>
  );
});

/** Celda exterior (izquierda) al estilo del boceto: contorno fino, fondo azul-noche. */
const OUTSIDE_CELL =
  "flex flex-1 items-center justify-center border border-purple-300/25 bg-[#101033]/80 font-display text-[12px] font-bold tracking-wide text-white/90 transition-colors active:bg-purple-500/25";

export function BetTableOverlay({
  bets,
  greenWeight,
  disabled = false,
  highlight,
  onPlace,
  onClearCell,
  onClose,
}: {
  bets: Map<string, number>;
  greenWeight: number;
  disabled?: boolean;
  highlight?: number | null;
  onPlace: (type: BetType, key: string) => void;
  onClearCell: (type: BetType, key: string) => void;
  onClose: () => void;
}) {
  const amountOf = useCallback(
    (type: BetType, key: string) => bets.get(betId(type, key)) ?? 0,
    [bets],
  );
  const z = { disabled, onPlace, onClearCell };

  const pct = (v: number) => `${v * 100}%`;

  return (
    <div className="pointer-events-auto relative mx-auto flex h-full w-full max-w-[380px] flex-col">
      {/* Marco del tapete */}
      <div className="relative flex min-h-0 flex-1 flex-col rounded-[22px] border border-purple-400/40 bg-[#120a2a]/72 p-2.5 shadow-[0_0_40px_rgba(139,92,246,0.35),inset_0_0_30px_rgba(139,92,246,0.12)] backdrop-blur-[2px]">
        {/* Minimizar */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Minimizar tapete"
          className="absolute -top-2.5 right-3 z-30 flex h-7 w-7 items-center justify-center rounded-full border border-purple-300/50 bg-[#1a0f38] text-purple-100 shadow-[0_0_12px_rgba(139,92,246,0.5)]"
        >
          <ChevronDown className="h-4 w-4" />
        </button>

        <div className="flex min-h-0 flex-1 flex-col">
          {/* 0 alineado sobre la columna de números */}
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: "1.02fr 1.85fr 1.02fr" }}
          >
            <div />
            <Zone
              {...z}
              type="straight"
              betKey="0"
              amount={amountOf("straight", "0")}
              title={`Pleno 0 · ${multiplierFor("straight", "0", greenWeight)}x`}
              className={`flex h-8 items-center justify-center rounded-t-md border font-display text-[15px] font-black text-white ${
                highlight === 0
                  ? "border-amber-300 bg-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.9)]"
                  : "border-emerald-300/40 bg-gradient-to-b from-emerald-600 to-emerald-800"
              }`}
            >
              0
            </Zone>
            <div />
          </div>

          {/* Cuerpo: exteriores | números | docenas */}
          <div
            className="mt-1.5 grid min-h-0 flex-1 gap-1.5"
            style={{ gridTemplateColumns: "1.02fr 1.85fr 1.02fr", gridTemplateRows: "minmax(0, 1fr)" }}
          >
            {/* Exteriores */}
            <div className="flex flex-col">
              <Zone
                {...z}
                type="low"
                betKey=""
                amount={amountOf("low", "")}
                title="1 – 18 · 2x"
                className={`${OUTSIDE_CELL} rounded-t-md`}
              >
                1-18
              </Zone>
              <Zone {...z} type="even" betKey="" amount={amountOf("even", "")} title="Par · 2x" className={`${OUTSIDE_CELL} border-t-0`}>
                PAR
              </Zone>
              <Zone {...z} type="red" betKey="" amount={amountOf("red", "")} title="Rojo · 2x" className={`${OUTSIDE_CELL} border-t-0`}>
                <span className="block h-5 w-3.5 rotate-45 rounded-[2px] bg-gradient-to-br from-rose-500 to-red-700 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
              </Zone>
              <Zone {...z} type="black" betKey="" amount={amountOf("black", "")} title="Negro · 2x" className={`${OUTSIDE_CELL} border-t-0`}>
                <span className="block h-5 w-3.5 rotate-45 rounded-[2px] border border-white/70 bg-gradient-to-br from-zinc-800 to-black" />
              </Zone>
              <Zone {...z} type="odd" betKey="" amount={amountOf("odd", "")} title="Impar · 2x" className={`${OUTSIDE_CELL} border-t-0`}>
                IMPAR
              </Zone>
              <Zone
                {...z}
                type="high"
                betKey=""
                amount={amountOf("high", "")}
                title="19 – 36 · 2x"
                className={`${OUTSIDE_CELL} rounded-b-md border-t-0`}
              >
                19-36
              </Zone>
            </div>

            {/* Números */}
            <div className="flex flex-col">
              <div className="relative flex-1">
                <div
                  className="grid h-full"
                  style={{ gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(12, 1fr)" }}
                >
                  {ROWS.map((r) =>
                    COLS.map((c) => {
                      const n = 3 * (r - 1) + c;
                      const color = colorOfNumber(n);
                      const win = highlight === n;
                      return (
                        <Zone
                          key={n}
                          {...z}
                          type="straight"
                          betKey={String(n)}
                          amount={amountOf("straight", String(n))}
                          title={`Pleno ${n} · 36x`}
                          className={`flex items-center justify-center border border-white/45 text-[13px] font-black text-white ${
                            win
                              ? "bg-amber-400 text-black shadow-[0_0_16px_rgba(251,191,36,0.9)]"
                              : color === "red"
                                ? "bg-gradient-to-b from-red-600 to-red-800"
                                : "bg-gradient-to-b from-zinc-900 to-black"
                          }`}
                        >
                          {n}
                        </Zone>
                      );
                    }),
                  )}
                </div>

                {/* Zonas finas: splits, esquinas, calles y líneas */}
                <div className="pointer-events-none absolute inset-0 z-10">
                  {ROWS.map((r) => (
                    <div key={`layer-${r}`} className="contents">
                      {/* splits horizontales */}
                      {[1, 2].map((c) => {
                        const n = 3 * (r - 1) + c;
                        return (
                          <Zone
                            key={`sh-${n}`}
                            {...z}
                            type="split"
                            betKey={`${n}-${n + 1}`}
                            amount={amountOf("split", `${n}-${n + 1}`)}
                            chipSize={13}
                            title={`Split ${n}/${n + 1} · 18x`}
                            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-[3px] bg-white/[0.07] transition-colors active:bg-amber-300/60"
                            style={{ left: pct(c / 3), top: pct((r - 0.5) / 12), width: 20, height: 20, zIndex: 2 }}
                          />
                        );
                      })}
                      {/* splits verticales + esquinas + calle + línea */}
                      {r < 12 && (
                        <>
                          {COLS.map((c) => {
                            const n = 3 * (r - 1) + c;
                            return (
                              <Zone
                                key={`sv-${n}`}
                                {...z}
                                type="split"
                                betKey={`${n}-${n + 3}`}
                                amount={amountOf("split", `${n}-${n + 3}`)}
                                chipSize={13}
                                title={`Split ${n}/${n + 3} · 18x`}
                                className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-[3px] bg-white/[0.07] transition-colors active:bg-amber-300/60"
                                style={{ left: pct((c - 0.5) / 3), top: pct(r / 12), width: 30, height: 16, zIndex: 2 }}
                              />
                            );
                          })}
                          {[1, 2].map((c) => {
                            const n = 3 * (r - 1) + c;
                            return (
                              <Zone
                                key={`co-${n}`}
                                {...z}
                                type="corner"
                                betKey={String(n)}
                                amount={amountOf("corner", String(n))}
                                chipSize={13}
                                title={`Esquina ${n}/${n + 1}/${n + 3}/${n + 4} · 9x`}
                                className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.14] ring-1 ring-white/25 transition-colors active:bg-amber-300/70"
                                style={{ left: pct(c / 3), top: pct(r / 12), width: 32, height: 26, zIndex: 5 }}
                              />
                            );
                          })}
                          <Zone
                            key={`li-${r}`}
                            {...z}
                            type="line"
                            betKey={String(r)}
                            amount={amountOf("line", String(r))}
                            chipSize={13}
                            title={`Línea ${3 * r - 2}–${3 * r + 3} · 6x`}
                            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.07] transition-colors active:bg-amber-300/60"
                            style={{ left: "100%", top: pct(r / 12), width: 24, height: 16, zIndex: 3 }}
                          />
                        </>
                      )}
                      <Zone
                        key={`st-${r}`}
                        {...z}
                        type="street"
                        betKey={String(r)}
                        amount={amountOf("street", String(r))}
                        chipSize={13}
                        title={`Calle ${3 * r - 2}/${3 * r - 1}/${3 * r} · 12x`}
                        className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-[3px] bg-white/[0.07] transition-colors active:bg-amber-300/60"
                        style={{ left: "100%", top: pct((r - 0.5) / 12), width: 20, height: 24, zIndex: 1 }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* 2:1 — columnas */}
              <div className="grid grid-cols-3">
                {COLS.map((c) => (
                  <Zone
                    key={`col-${c}`}
                    {...z}
                    type="column"
                    betKey={String(c)}
                    amount={amountOf("column", String(c))}
                    title={`${c}ª columna · 3x`}
                    className={`flex h-7 items-center justify-center border border-purple-300/25 bg-[#101033]/80 text-[11px] font-black tracking-wide text-white/90 active:bg-purple-500/25 ${
                      c === 1 ? "rounded-bl-md" : c === 3 ? "rounded-br-md" : ""
                    }`}
                  >
                    2:1
                  </Zone>
                ))}
              </div>
            </div>

            {/* Docenas */}
            <div className="flex flex-col gap-1.5">
              {[1, 2, 3].map((d) => (
                <Zone
                  key={`dz-${d}`}
                  {...z}
                  type="dozen"
                  betKey={String(d)}
                  amount={amountOf("dozen", String(d))}
                  title={`${d}ª docena · 3x`}
                  className="flex flex-1 flex-col items-center justify-center rounded-md border border-purple-300/25 bg-[#101033]/80 text-white/90 active:bg-purple-500/25"
                >
                  <span className="font-display text-[15px] font-black leading-none">
                    {d}
                    <sup className="text-[9px]">a</sup>
                  </span>
                  <span className="mt-0.5 text-[10px] font-semibold tracking-wide">DOCENA</span>
                </Zone>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
