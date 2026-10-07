import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type U = { id: string; email: string | null; full_name: string | null };

export function AdminSendNotification({ users }: { users: U[] }) {
  const qc = useQueryClient();
  const [target, setTarget] = useState("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast.error("Escreva um título."); return; }
    setSending(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await db.from("notifications").insert({
      user_id: target === "all" ? null : target,
      title: title.trim(),
      body: body.trim(),
      kind: "admin",
      created_by: u.user?.id,
    });
    setSending(false);
    if (error) { toast.error("Não foi possível enviar a notificação."); return; }
    toast.success(target === "all" ? "Notificação enviada a todos." : "Notificação enviada.");
    setTitle("");
    setBody("");
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <form onSubmit={send} className="shadow-soft mt-4 grid gap-4 rounded-2xl border border-border bg-card p-5 sm:max-w-2xl">
      <div className="grid gap-1.5">
        <label className="text-sm font-medium" htmlFor="n-target">Destinatário</label>
        <select
          id="n-target"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">Todos os utilizadores</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name || "Sem nome"} — {u.email ?? ""}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label className="text-sm font-medium" htmlFor="n-title">Título</label>
        <Input id="n-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <label className="text-sm font-medium" htmlFor="n-body">Mensagem</label>
        <Textarea id="n-body" rows={4} value={body} maxLength={1000} onChange={(e) => setBody(e.target.value)} />
      </div>
      <Button type="submit" disabled={sending} className="w-full sm:w-fit">
        <Send className="h-4 w-4" /> {sending ? "A enviar..." : "Enviar notificação"}
      </Button>
    </form>
  );
}
