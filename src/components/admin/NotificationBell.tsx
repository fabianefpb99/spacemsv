import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Wallet, UserPlus, Flame, CheckCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  listAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from "@/lib/admin/notifications.functions";

type Tab = "all" | "recharge_request" | "new_user" | "game_red_alert";

const TAB_LABELS: Record<Tab, string> = {
  all: "Todas",
  recharge_request: "Recargas",
  new_user: "Usuarios",
  game_red_alert: "Juegos",
};

function sectionForNotification(type: string): string {
  switch (type) {
    case "recharge_request":
      return "recargas";
    case "new_user":
      return "usuarios";
    case "game_red_alert":
      return "dashboard";
    default:
      return "dashboard";
  }
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

function useRelativeTime(iso: string) {
  const [text, setText] = useState(() => relativeTime(iso));
  useEffect(() => {
    setText(relativeTime(iso));
    const id = setInterval(() => setText(relativeTime(iso)), 60000);
    return () => clearInterval(id);
  }, [iso]);
  return text;
}

function typeIcon(t: string) {
  switch (t) {
    case "recharge_request":
      return <Wallet className="h-4 w-4 text-emerald-300" />;
    case "new_user":
      return <UserPlus className="h-4 w-4 text-sky-300" />;
    case "game_red_alert":
      return <Flame className="h-4 w-4 text-rose-300" />;
    default:
      return <Bell className="h-4 w-4 text-purple-200" />;
  }
}

export function NotificationBell() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();

  // Only render for admins
  if (!user || isAdmin.data !== true) return null;

  return <BellInner userId={user.id} />;
}

function BellInner({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listAdminNotifications);
  const markFn = useServerFn(markAdminNotificationRead);
  const markAllFn = useServerFn(markAllAdminNotificationsRead);
  const [tab, setTab] = useState<Tab>("all");
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: () => listFn(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("admin-notifications-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_notifications" },
        () => qc.invalidateQueries({ queryKey: ["admin-notifications"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const items = q.data ?? [];
  const filtered = useMemo(
    () => (tab === "all" ? items : items.filter((n) => n.type === tab)),
    [items, tab],
  );
  const unread = items.filter((n) => !n.read).length;

  const markMut = useMutation({
    mutationFn: (id: string) => markFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-notifications"] }),
  });
  const markAllMut = useMutation({
    mutationFn: () => markAllFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-notifications"] }),
  });

  // void userId to avoid lint warning (used implicitly via auth context)
  void userId;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notificaciones"
          className="relative rounded-md p-1.5 text-purple-200/80 hover:bg-white/5"
        >
          <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white shadow-[0_0_8px_rgba(244,63,94,0.7)]">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="z-50 w-[min(22rem,calc(100vw-1rem))] border-purple-500/40 bg-[#0c0620] p-0 text-white"
      >
        <div className="flex items-center justify-between border-b border-purple-500/20 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-purple-300" />
            <span className="text-sm font-semibold">Notificaciones</span>
            {unread > 0 && (
              <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                {unread} sin leer
              </span>
            )}
          </div>
          {unread > 0 && (
            <button
              onClick={() => markAllMut.mutate()}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-purple-200 hover:bg-white/5"
            >
              <CheckCheck className="h-3 w-3" />
              Marcar todas
            </button>
          )}
        </div>

        <div className="flex border-b border-purple-500/20 px-1.5 pt-1.5">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => {
            const count =
              t === "all"
                ? items.length
                : items.filter((n) => n.type === t).length;
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-t-md px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider transition ${
                  active
                    ? "bg-purple-600/20 text-white"
                    : "text-purple-200/60 hover:text-purple-100"
                }`}
              >
                {TAB_LABELS[t]} {count > 0 && <span className="ml-0.5 opacity-70">({count})</span>}
              </button>
            );
          })}
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {q.isLoading ? (
            <div className="px-3 py-6 text-center text-xs text-purple-200/60">Cargando…</div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-purple-200/50">
              No hay notificaciones aquí.
            </div>
          ) : (
            <ul className="divide-y divide-purple-500/10">
              {filtered.map((n) => (
                <li
                  key={n.id}
                  className={`group relative px-3 py-2.5 transition hover:bg-white/[0.03] ${
                    !n.read ? "bg-purple-500/[0.04]" : ""
                  }`}
                >
                  <Link
                    to="/adminpanel"
                    search={{ section: sectionForNotification(n.type) }}
                    onClick={() => {
                      if (!n.read) markMut.mutate(n.id);
                      setOpen(false);
                    }}
                    className="flex items-start gap-2.5"
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-purple-500/30 bg-purple-900/30">
                      {typeIcon(n.type)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-semibold text-white">{n.title}</span>
                        {!n.read && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                        )}
                      </div>
                      {n.body && (
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-purple-200/70">
                          {n.body}
                        </p>
                      )}
                      <span className="mt-1 block text-[10px] text-purple-300/60">
                        {relativeTime(n.created_at)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}