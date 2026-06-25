import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Dice5, Trophy, Gift, Settings2, Receipt } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useForceDarkTheme } from "@/hooks/useForceDarkTheme";

export const Route = createFileRoute("/transacciones")({
  head: () => ({
    meta: [
      { title: "Historial de Transacciones — BETSPACE Casino" },
      { name: "description", content: "Todos tus movimientos: depósitos, retiros, apuestas, ganancias y bonos." },
    ],
  }),
  component: TransaccionesPage,
});

type Tx = {
  id: string;
  type: "deposit" | "withdrawal" | "bet" | "win" | "bonus" | "adjustment";
  amount: number;
  game: string | null;
  balance_after: number | null;
  created_at: string;
};

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.floor(Math.abs(n)));
}

const TYPE_META: Record<Tx["type"], { label: string; icon: React.ReactNode; tone: string; sign: "+" | "-" | "" }> = {
  deposit: { label: "Depósito", icon: <ArrowDownLeft className="h-4 w-4" />, tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30", sign: "+" },
  withdrawal: { label: "Retiro", icon: <ArrowUpRight className="h-4 w-4" />, tone: "text-amber-300 bg-amber-500/10 border-amber-500/30", sign: "-" },
  bet: { label: "Apuesta", icon: <Dice5 className="h-4 w-4" />, tone: "text-purple-200 bg-purple-500/10 border-purple-500/30", sign: "-" },
  win: { label: "Ganancia", icon: <Trophy className="h-4 w-4" />, tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30", sign: "+" },
  bonus: { label: "Bono", icon: <Gift className="h-4 w-4" />, tone: "text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/30", sign: "+" },
  adjustment: { label: "Ajuste", icon: <Settings2 className="h-4 w-4" />, tone: "text-purple-200 bg-purple-500/10 border-purple-500/30", sign: "" },
};

function TransaccionesPage() {
  useForceDarkTheme();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const txQ = useQuery({
    queryKey: ["transacciones", user?.id ?? null],
    enabled: !!user,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, type, amount, game, balance_after, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Tx[];
    },
  });

  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-[#060210] text-white">
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-purple-200/80">Inicia sesión para ver tu historial.</p>
          <Link to="/home" className="rounded-md bg-purple-600 px-4 py-2 text-xs font-bold uppercase tracking-wider">Ir al inicio</Link>
        </div>
      </div>
    );
  }

  const rows = txQ.data ?? [];

  // group by day
  const groups: Array<{ day: string; items: Tx[] }> = [];
  for (const t of rows) {
    const d = new Date(t.created_at);
    const key = d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
    const last = groups[groups.length - 1];
    if (last && last.day === key) last.items.push(t);
    else groups.push({ day: key, items: [t] });
  }

  return (
    <div className="min-h-screen bg-[#060210] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-3 pb-10 pt-4 sm:max-w-lg sm:px-4">
        <header
          className="-mx-3 -mt-4 flex items-center justify-between border-b border-purple-500/20 bg-[#060210] px-3 pb-3"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.4rem)" }}
        >
          <button
            onClick={() => navigate({ to: "/perfil" })}
            aria-label="Atrás"
            className="rounded-md p-2 text-purple-100 hover:bg-white/5"
          >
            <ArrowLeft className="h-7 w-7" strokeWidth={3} />
          </button>
          <h1 className="font-display text-base font-bold uppercase tracking-widest">Historial</h1>
          <div className="h-7 w-11" />
        </header>

        {txQ.isLoading ? (
          <div className="mt-12 text-center text-xs text-purple-200/60">Cargando movimientos…</div>
        ) : rows.length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-purple-500/30 bg-purple-500/10">
              <Receipt className="h-6 w-6 text-purple-200" />
            </div>
            <div className="text-sm font-semibold">Aún no tienes movimientos</div>
            <div className="max-w-[260px] text-xs text-purple-200/70">
              Cuando deposites, juegues o retires, tus operaciones aparecerán aquí.
            </div>
            <Link
              to="/pay"
              className="mt-2 rounded-md bg-purple-600 px-4 py-2 text-[11px] font-bold uppercase tracking-wider hover:bg-purple-500"
            >
              Hacer mi primer depósito
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {groups.map((g) => (
              <section key={g.day}>
                <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-widest text-purple-200/60">
                  {g.day}
                </div>
                <div className="space-y-1.5">
                  {g.items.map((t) => {
                    const meta = TYPE_META[t.type];
                    const amount = Number(t.amount) || 0;
                    const sign = meta.sign || (amount >= 0 ? "+" : "-");
                    const positive = sign === "+";
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between rounded-xl border border-purple-500/20 bg-[#0c0620]/80 px-3 py-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", meta.tone)}>
                            {meta.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white">
                              {meta.label}
                              {t.game ? (
                                <span className="ml-1 text-[10px] font-normal uppercase tracking-wider text-purple-200/60">
                                  · {t.game}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-[10px] text-purple-200/60">
                              {new Date(t.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={cn(
                              "font-display text-sm font-bold tabular-nums",
                              positive ? "text-emerald-300" : "text-rose-300",
                            )}
                          >
                            {sign}${formatCOP(amount)}
                          </div>
                          {t.balance_after != null && (
                            <div className="text-[10px] text-purple-200/50">
                              Saldo ${formatCOP(Number(t.balance_after))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}