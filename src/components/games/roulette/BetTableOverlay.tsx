import { memo, useCallback, useMemo, useRef } from "react";
import { RotateCcw, Trash2, X } from "lucide-react";
import {
  type BetType,
  betId,
  colorOfNumber,
  multiplierFor,
} from "@/lib/games/roulette-table";

const CELL = 26;
const GUT = 9;
const SIDE = 15;

function formatChip(n: number) {
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`;
  if (n >= 1000) return `${Math.round(n / 100) / 10}K`.replace(".0K", "K");
  return String(n);
}

function ChipBadge({ amount, size = 18 }: { amount: number; size?: number }) {
  return (
    <span
      className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-amber-200/80 bg-gradient-to-b from-amber-300 to-amber-600 font-black text-[#2a1500] shadow-[0_1px_4px_rgba(0,0,0,0.7)]"
      style={{ width: size, height: size, fontSize: size <= 14 ? 6.5 : 7.5 }}
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
      className={`relative select-none disabled:opacity-60 ${className ?? ""}`}
      style={style}
    >
      {children}
      {amount > 0 && <ChipBadge amount={amount} size={chipSize} />}
    </button>
  );
});

export function BetTableOverlay({
  bets,
  greenWeight,
  disabled = false,
  total,
  highlight,
  onPlace,
  onClearCell,
  onUndo,
  onClearAll,
  onClose,
}: {
  bets: Map<string, number>;
  greenWeight: number;
  disabled?: boolean;
  total: number;
  highlight?: number | null;
  onPlace: (type: BetType, key: string) => void;
  onClearCell: (type: BetType, key: string) => void;
  onUndo: () => void;
  onClearAll: () => void;
  onClose: () => void;
}) {
  const amountOf = useCallback(
    (type: BetType, key: string) => bets.get(betId(type, key)) ?? 0,
    [bets],
  );

  const gridTemplateColumns = `${SIDE}px 1fr ${GUT}px 1fr ${GUT}px 1fr`;
  const gridTemplateRows = `repeat(11, ${CELL}px ${GUT}px) ${CELL}px`;

  const rows = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const cols = useMemo(() => [1, 2, 3], []);

  const zoneCommon = { disabled, onPlace, onClearCell };

  return (
    <div className="pointer-events-auto flex h-full flex-col overflow-hidden rounded-2xl border border-amber-300/30 bg-gradient-to-b from-[#0b2a1a]/97 to-[#04140c]/97 shadow-[0_10px_40px_rgba(0,0,0,0.7)]">
      {/* Cabecera */}
      <div className="flex shrink-0 items-center gap-2 border-b border-amber-300/20 bg-black/35 px-2.5 py-1.5">
        <div className="min-w-0 flex-1">
          <div className="font-display text-[11px] font-black uppercase tracking-[0.18em] text-amber-200/90">
            Tapete
          </div>
          <div className="text-[10px] text-emerald-100/70">
            {bets.size === 0
              ? "Toca para poner fichas · mantén pulsado para quitar"
              : `${bets.size} apuesta${bets.size === 1 ? "" : "s"} · $${new Intl.NumberFormat("es-CO").format(total)}`}
          </div>
        </div>
        <button
          type="button"
          onClick={onUndo}
          disabled={disabled || bets.size === 0}
          aria-label="Deshacer"
          className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-emerald-100/80 disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onClearAll}
          disabled={disabled || bets.size === 0}
          aria-label="Limpiar todo"
          className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-rose-200/80 disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar tapete"
          className="rounded-lg border border-white/15 bg-white/10 p-1.5 text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tapete */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
        {/* 0 */}
        <div style={{ display: "grid", gridTemplateColumns }} className="mb-[9px]">
          <Zone
            {...zoneCommon}
            type="straight"
            betKey="0"
            amount={amountOf("straight", "0")}
            title={`Pleno 0 · ${multiplierFor("straight", "0", greenWeight)}x`}
            style={{ gridColumn: "2 / span 5", height: CELL + 4 }}
            className={`flex items-center justify-center rounded-md border font-display text-[13px] font-black text-white transition-colors ${
              highlight === 0
                ? "border-amber-300 bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.9)]"
                : "border-emerald-300/40 bg-gradient-to-b from-emerald-600 to-emerald-800"
            }`}
          >
            <span>0</span>
            <span className="ml-1.5 text-[8px] font-bold text-emerald-100/70">
              {multiplierFor("straight", "0", greenWeight)}x
            </span>
          </Zone>
        </div>

        {/* Grid de números + zonas de borde */}
        <div style={{ display: "grid", gridTemplateColumns, gridTemplateRows }}>
          {rows.map((r) =>
            cols.map((c) => {
              const n = 3 * (r - 1) + c;
              const color = colorOfNumber(n);
              const win = highlight === n;
              return (
                <Zone
                  key={`n-${n}`}
                  {...zoneCommon}
                  type="straight"
                  betKey={String(n)}
                  amount={amountOf("straight", String(n))}
                  title={`Pleno ${n} · 36x`}
                  style={{ gridColumn: 2 * c, gridRow: 2 * r - 1 }}
                  className={`flex items-center justify-center rounded-[4px] border text-[12px] font-black text-white transition-colors ${
                    win
                      ? "border-amber-300 bg-amber-400 text-black shadow-[0_0_14px_rgba(251,191,36,0.9)]"
                      : color === "red"
                        ? "border-rose-300/30 bg-gradient-to-b from-rose-600 to-rose-800"
                        : "border-white/15 bg-gradient-to-b from-zinc-800 to-black"
                  }`}
                >
                  {n}
                </Zone>
              );
            }),
          )}

          {/* Splits horizontales (n / n+1) */}
          {rows.map((r) =>
            [1, 2].map((c) => {
              const n = 3 * (r - 1) + c;
              return (
                <Zone
                  key={`sh-${n}`}
                  {...zoneCommon}
                  type="split"
                  betKey={`${n}-${n + 1}`}
                  amount={amountOf("split", `${n}-${n + 1}`)}
                  chipSize={13}
                  title={`Split ${n}/${n + 1} · 18x`}
                  style={{ gridColumn: 2 * c + 1, gridRow: 2 * r - 1 }}
                  className="rounded-[2px] hover:bg-amber-200/20"
                />
              );
            }),
          )}

          {/* Splits verticales (n / n+3) */}
          {rows.slice(0, 11).map((r) =>
            cols.map((c) => {
              const n = 3 * (r - 1) + c;
              return (
                <Zone
                  key={`sv-${n}`}
                  {...zoneCommon}
                  type="split"
                  betKey={`${n}-${n + 3}`}
                  amount={amountOf("split", `${n}-${n + 3}`)}
                  chipSize={13}
                  title={`Split ${n}/${n + 3} · 18x`}
                  style={{ gridColumn: 2 * c, gridRow: 2 * r }}
                  className="rounded-[2px] hover:bg-amber-200/20"
                />
              );
            }),
          )}

          {/* Esquinas (4 números) */}
          {rows.slice(0, 11).map((r) =>
            [1, 2].map((c) => {
              const n = 3 * (r - 1) + c;
              return (
                <Zone
                  key={`co-${n}`}
                  {...zoneCommon}
                  type="corner"
                  betKey={String(n)}
                  amount={amountOf("corner", String(n))}
                  chipSize={13}
                  title={`Esquina ${n}/${n + 1}/${n + 3}/${n + 4} · 9x`}
                  style={{ gridColumn: 2 * c + 1, gridRow: 2 * r }}
                  className="rounded-full hover:bg-amber-200/30"
                />
              );
            }),
          )}

          {/* Calles (fila completa) */}
          {rows.map((r) => (
            <Zone
              key={`st-${r}`}
              {...zoneCommon}
              type="street"
              betKey={String(r)}
              amount={amountOf("street", String(r))}
              chipSize={13}
              title={`Calle ${3 * r - 2}/${3 * r - 1}/${3 * r} · 12x`}
              style={{ gridColumn: 1, gridRow: 2 * r - 1 }}
              className="rounded-l-[4px] border-l border-amber-200/25 hover:bg-amber-200/20"
            />
          ))}

          {/* Líneas (6 números) */}
          {rows.slice(0, 11).map((r) => (
            <Zone
              key={`li-${r}`}
              {...zoneCommon}
              type="line"
              betKey={String(r)}
              amount={amountOf("line", String(r))}
              chipSize={13}
              title={`Línea ${3 * r - 2}–${3 * r + 3} · 6x`}
              style={{ gridColumn: 1, gridRow: 2 * r }}
              className="rounded-full hover:bg-amber-200/30"
            />
          ))}
        </div>

        {/* Columnas 2:1 */}
        <div style={{ display: "grid", gridTemplateColumns }} className="mt-[9px]">
          {cols.map((c) => (
            <Zone
              key={`col-${c}`}
              {...zoneCommon}
              type="column"
              betKey={String(c)}
              amount={amountOf("column", String(c))}
              title={`${c}ª columna · 3x`}
              style={{ gridColumn: 2 * c, height: CELL }}
              className="flex items-center justify-center rounded-[4px] border border-amber-200/25 bg-black/35 text-[10px] font-black uppercase tracking-wider text-amber-100/90 hover:bg-amber-200/10"
            >
              2:1
            </Zone>
          ))}
        </div>

        {/* Docenas */}
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {[1, 2, 3].map((d) => (
            <Zone
              key={`dz-${d}`}
              {...zoneCommon}
              type="dozen"
              betKey={String(d)}
              amount={amountOf("dozen", String(d))}
              title={`${d}ª docena · 3x`}
              className="flex flex-col items-center justify-center rounded-lg border border-amber-200/25 bg-black/35 py-1.5 hover:bg-amber-200/10"
            >
              <span className="font-display text-[11px] font-black text-amber-100/90">
                {d === 1 ? "1 – 12" : d === 2 ? "13 – 24" : "25 – 36"}
              </span>
              <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-100/50">
                3x
              </span>
            </Zone>
          ))}
        </div>

        {/* Exteriores */}
        <div className="mt-1.5 grid grid-cols-6 gap-1.5 pb-1">
          <Zone
            {...zoneCommon}
            type="low"
            betKey=""
            amount={amountOf("low", "")}
            title="1 – 18 · 2x"
            className="flex items-center justify-center rounded-lg border border-amber-200/25 bg-black/35 py-2 text-[9px] font-black text-amber-100/90 hover:bg-amber-200/10"
          >
            1–18
          </Zone>
          <Zone
            {...zoneCommon}
            type="even"
            betKey=""
            amount={amountOf("even", "")}
            title="Par · 2x"
            className="flex items-center justify-center rounded-lg border border-amber-200/25 bg-black/35 py-2 text-[9px] font-black text-amber-100/90 hover:bg-amber-200/10"
          >
            PAR
          </Zone>
          <Zone
            {...zoneCommon}
            type="red"
            betKey=""
            amount={amountOf("red", "")}
            title="Rojo · 2x"
            className="flex items-center justify-center rounded-lg border border-rose-300/40 bg-gradient-to-b from-rose-600 to-rose-800 py-2 hover:brightness-110"
          >
            <span className="block h-3 w-3 rotate-45 bg-white/90" />
          </Zone>
          <Zone
            {...zoneCommon}
            type="black"
            betKey=""
            amount={amountOf("black", "")}
            title="Negro · 2x"
            className="flex items-center justify-center rounded-lg border border-white/20 bg-gradient-to-b from-zinc-800 to-black py-2 hover:brightness-125"
          >
            <span className="block h-3 w-3 rotate-45 bg-white/90" />
          </Zone>
          <Zone
            {...zoneCommon}
            type="odd"
            betKey=""
            amount={amountOf("odd", "")}
            title="Impar · 2x"
            className="flex items-center justify-center rounded-lg border border-amber-200/25 bg-black/35 py-2 text-[9px] font-black text-amber-100/90 hover:bg-amber-200/10"
          >
            IMPAR
          </Zone>
          <Zone
            {...zoneCommon}
            type="high"
            betKey=""
            amount={amountOf("high", "")}
            title="19 – 36 · 2x"
            className="flex items-center justify-center rounded-lg border border-amber-200/25 bg-black/35 py-2 text-[9px] font-black text-amber-100/90 hover:bg-amber-200/10"
          >
            19–36
          </Zone>
        </div>
      </div>
    </div>
  );
}
