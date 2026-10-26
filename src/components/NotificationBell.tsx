import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Notification tables may not yet be included in generated database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Notif = { id: string; title: string; body: string; link: string | null; created_at: string };

function readableDbError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return null;
  if (error.code === "42P01" || /relation .*notifications.* does not exist/i.test(error.message ?? "")) {
    return "As tabelas de notificações ainda não estão criadas no Supabase.";
  }
  if (error.code === "42501" || /row-level security|permission denied/i.test(error.message ?? "")) {
    return "A base de dados não permitiu consultar as notificações. Confirme as políticas de acesso.";
  }
  return "Não foi possível carregar as notificações. Tente novamente.";
}

export function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["notifications"],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("A sessão expirou. Entre novamente.");
      const uid = authData.user.id;
      const [{ data: list, error: listError }, { data: reads, error: readsError }] = await Promise.all([
        db.from("notifications").select("id,title,body,link,created_at").order("created_at", { ascending: false }).limit(30),
        db.from("notification_reads").select("notification_id").eq("user_id", uid),
      ]);
      if (listError) throw new Error(readableDbError(listError));
      if (readsError) throw new Error(readableDbError(readsError));
      const readSet = new Set<string>((reads ?? []).map((r: { notification_id: string }) => r.notification_id));
      return { uid, items: (list ?? []) as Notif[], readSet };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("notifications-bell")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        void qc.invalidateQueries({ queryKey: ["notifications"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc]);

  const items = data?.items ?? [];
  const unread = items.filter((n) => !data?.readSet.has(n.id));

  async function markAllRead() {
    if (!data?.uid || unread.length === 0) return;
    setReadError(null);
    const { error: updateError } = await db.from("notification_reads").upsert(
      unread.map((n) => ({ notification_id: n.id, user_id: data.uid })),
      { onConflict: "notification_id,user_id", ignoreDuplicates: true },
    );
    if (updateError) {
      setReadError(readableDbError(updateError));
      return;
    }
    await qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  function openNotifications(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) void markAllRead();
  }

  const queryError = isError ? (error instanceof Error ? error.message : "Não foi possível carregar as notificações.") : null;

  return (
    <Popover open={open} onOpenChange={openNotifications}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative shrink-0" aria-label={unread.length ? "Notificações não lidas" : "Notificações"}>
          <Bell className="h-4 w-4" />
          {unread.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,22rem)] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="font-semibold">Notificações</p>
            <p className="text-muted-foreground text-xs">{unread.length ? unread.length + " por ler" : "Tudo em dia"}</p>
          </div>
          {unread.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => void markAllRead()} aria-label="Marcar todas como lidas">
              <CheckCheck className="mr-1 h-4 w-4" /> Lidas
            </Button>
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {(queryError || readError) ? (
            <div className="p-5 text-sm">
              <p className="flex items-start gap-2 text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{queryError || readError}</p>
              {queryError && <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>Tentar novamente</Button>}
            </div>
          ) : isLoading ? (
            <p className="text-muted-foreground p-6 text-center text-sm">A carregar notificações…</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">Sem notificações por agora.</p>
          ) : (
            items.map((n) => {
              const isNew = unread.some((u) => u.id === n.id);
              const inner = (
                <div className={`border-b border-border px-4 py-3 last:border-0 ${isNew ? "bg-primary/5" : ""}`}>
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isNew ? "bg-primary" : "bg-transparent"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{n.title}</p>
                      {n.body && <p className="text-muted-foreground mt-0.5 whitespace-pre-line text-sm">{n.body}</p>}
                      <p className="text-muted-foreground mt-1 text-xs">{new Date(n.created_at).toLocaleString("pt-PT")}</p>
                    </div>
                  </div>
                </div>
              );
              return n.link ? (
                <Link key={n.id} to={n.link} onClick={() => setOpen(false)} className="block hover:bg-secondary/60">
                  {inner}
                </Link>
              ) : (
                <div key={n.id}>{inner}</div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
