import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Tables added after type generation; use an untyped handle.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Notif = { id: string; title: string; body: string; link: string | null; created_at: string };

export function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["notifications"],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      const [{ data: list }, { data: reads }] = await Promise.all([
        db.from("notifications").select("id,title,body,link,created_at").order("created_at", { ascending: false }).limit(30),
        db.from("notification_reads").select("notification_id").eq("user_id", uid),
      ]);
      const readSet = new Set<string>((reads ?? []).map((r: { notification_id: string }) => r.notification_id));
      return { uid, items: (list ?? []) as Notif[], readSet };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("notifications-bell")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () =>
        qc.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const items = data?.items ?? [];
  const unread = items.filter((n) => !data?.readSet.has(n.id));

  async function markAllRead() {
    if (!data?.uid || unread.length === 0) return;
    await db.from("notification_reads").upsert(
      unread.map((n) => ({ notification_id: n.id, user_id: data.uid })),
      { onConflict: "notification_id,user_id", ignoreDuplicates: true },
    );
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) void markAllRead(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative shrink-0" aria-label="Notificações">
          <Bell className="h-4 w-4" />
          {unread.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,22rem)] p-0">
        <div className="border-b border-border px-4 py-3 font-semibold">Notificações</div>
        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">Sem notificações por agora.</p>
          ) : (
            items.map((n) => {
              const isNew = unread.some((u) => u.id === n.id);
              const inner = (
                <div className={`border-b border-border px-4 py-3 last:border-0 ${isNew ? "bg-primary/5" : ""}`}>
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="text-muted-foreground mt-0.5 whitespace-pre-line text-sm">{n.body}</p>}
                  <p className="text-muted-foreground mt-1 text-xs">{new Date(n.created_at).toLocaleString("pt-PT")}</p>
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
