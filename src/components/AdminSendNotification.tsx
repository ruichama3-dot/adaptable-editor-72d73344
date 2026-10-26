import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send, Users, UserRound, Megaphone, Clock3, AlertCircle } from "lucide-react";
import { toast } from "sonner";

// The notification tables may not be present in the generated Supabase types yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type U = { id: string; email: string | null; full_name: string | null };

export function AdminSendNotification({ users }: { users: U[] }) {
  const qc = useQueryClient();
  const [target, setTarget] = useState("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const { data: recent = [], isLoading: historyLoading, error: historyError } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: async () => {
      const { data, error } = await db
        .from("notifications")
        .select("id,title,body,user_id,created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) {
        if (error.code === "42P01") throw new Error("As tabelas de notificações ainda não foram criadas no Supabase.");
        if (error.code === "42501") throw new Error("Sem permissão para consultar o histórico. Aplique a política de administrador da migração SQL.");
        throw new Error(error.message || "Não foi possível carregar o histórico.");
      }
      return (data ?? []) as Array<{ id: string; title: string; body: string; user_id: string | null; created_at: string }>;
    },
  });

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanBody = body.trim();

    if (!cleanTitle) {
      toast.error("Escreva um título para a notificação.");
      return;
    }
    if (cleanTitle.length > 120 || cleanBody.length > 1000) {
      toast.error("O título deve ter até 120 caracteres e a mensagem até 1.000.");
      return;
    }
    if (target !== "all" && !users.some((user) => user.id === target)) {
      toast.error("O destinatário selecionado já não está disponível. Atualize a página.");
      return;
    }

    setSending(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        toast.error("A sessão expirou. Entre novamente para enviar notificações.");
        return;
      }

      const { error } = await db.from("notifications").insert({
        user_id: target === "all" ? null : target,
        title: cleanTitle,
        body: cleanBody,
        kind: "admin",
        created_by: authData.user.id,
      });

      if (error) {
        console.error("[AdminSendNotification] insert failed:", error);
        if (error.code === "42P01" || /relation .*notifications.* does not exist/i.test(error.message ?? "")) {
          toast.error("A base de dados ainda não tem as tabelas de notificações. Aplique a migração SQL-NOTIFICACOES.sql no Supabase.");
        } else if (error.code === "42501" || /row-level security|permission denied/i.test(error.message ?? "")) {
          toast.error("O Supabase recusou o envio. Confirme se a sua conta tem o papel de administrador e se as políticas RLS estão aplicadas.");
        } else {
          toast.error("Falha ao enviar: " + (error.message || "erro desconhecido"));
        }
        return;
      }

      toast.success(target === "all" ? "Notificação enviada a todos os utilizadores." : "Notificação enviada ao utilizador.");
      setTitle("");
      setBody("");
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["admin-notifications"] });
    } catch (error) {
      console.error("[AdminSendNotification] unexpected error:", error);
      toast.error("Ocorreu um erro inesperado ao enviar. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={send} className="shadow-soft mt-4 grid gap-5 rounded-2xl border border-border bg-card p-5 sm:max-w-2xl sm:p-6">
      <div>
        <div className="flex items-center gap-2 text-base font-semibold">
          <Megaphone className="h-5 w-5 text-primary" />
          Enviar notificação
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Envie um aviso a toda a comunidade ou uma mensagem dirigida a um utilizador específico.
        </p>
      </div>

      <div className="grid gap-1.5">
        <label className="text-sm font-medium" htmlFor="n-target">Destinatário</label>
        <select
          id="n-target"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          disabled={sending}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">Todos os utilizadores ({users.length})</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {(u.full_name || "Sem nome") + (u.email ? " — " + u.email : "")}
            </option>
          ))}
        </select>
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          {target === "all" ? <Users className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}
          {target === "all" ? "A mensagem aparecerá na área de notificações de todos os utilizadores." : "A mensagem será visível apenas para o destinatário escolhido."}
        </p>
      </div>

      <div className="grid gap-1.5">
        <label className="text-sm font-medium" htmlFor="n-title">Título</label>
        <Input
          id="n-title"
          value={title}
          maxLength={120}
          required
          disabled={sending}
          placeholder="Ex.: Novidade na RuJe IA"
          onChange={(e) => setTitle(e.target.value)}
        />
        <p className="text-muted-foreground text-right text-xs">{title.length}/120</p>
      </div>

      <div className="grid gap-1.5">
        <label className="text-sm font-medium" htmlFor="n-body">Mensagem</label>
        <Textarea
          id="n-body"
          rows={5}
          value={body}
          maxLength={1000}
          disabled={sending}
          placeholder="Escreva aqui o aviso ou a informação que pretende partilhar."
          onChange={(e) => setBody(e.target.value)}
        />
        <p className="text-muted-foreground text-right text-xs">{body.length}/1000</p>
      </div>

      <Button type="submit" disabled={sending || !title.trim()} className="w-full sm:w-fit">
        <Send className="h-4 w-4" /> {sending ? "A enviar..." : target === "all" ? "Enviar para todos" : "Enviar notificação"}
      </Button>
    </form>

    <section className="shadow-soft mt-5 grid gap-3 rounded-2xl border border-border bg-card p-5 sm:max-w-2xl sm:p-6">
      <div className="flex items-center gap-2">
        <Clock3 className="h-5 w-5 text-primary" />
        <div>
          <h3 className="font-semibold">Últimas notificações</h3>
          <p className="text-muted-foreground text-xs">As 10 mensagens mais recentes enviadas a partir deste painel.</p>
        </div>
      </div>
      {historyError ? (
        <p className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {historyError instanceof Error ? historyError.message : "Não foi possível carregar o histórico."}
        </p>
      ) : historyLoading ? (
        <p className="text-muted-foreground text-sm">A carregar histórico…</p>
      ) : recent.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed border-border p-4 text-center text-sm">Ainda não há notificações enviadas.</p>
      ) : (
        <div className="divide-y divide-border">
          {recent.map((n) => {
            const recipient = n.user_id ? users.find((u) => u.id === n.user_id) : null;
            return (
              <article key={n.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
                    {n.user_id ? "Individual" : "Todos"}
                  </span>
                </div>
                {n.body && <p className="text-muted-foreground mt-1 whitespace-pre-line text-sm">{n.body}</p>}
                <p className="text-muted-foreground mt-2 text-xs">
                  {n.user_id ? "Para: " + (recipient?.full_name || recipient?.email || "Utilizador") : "Para todos os utilizadores"}
                  {" · "}{new Date(n.created_at).toLocaleString("pt-PT")}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
