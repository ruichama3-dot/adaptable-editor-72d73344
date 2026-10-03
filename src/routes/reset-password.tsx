import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova palavra-passe | RuJe IA" },
      { name: "description", content: "Defina uma nova palavra-passe para a sua conta RuJe IA." },
      { property: "og:title", content: "Nova palavra-passe | RuJe IA" },
      { property: "og:description", content: "Defina uma nova palavra-passe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");

  useEffect(() => {
    let done = false;
    const finish = (ok: boolean) => { if (!done) { done = true; setReady(ok ? "ok" : "invalid"); } };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) finish(true);
    });
    (async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) return finish(true);
      } else if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
        if (!error) return finish(true);
      }
      const hashErr = new URLSearchParams(window.location.hash.slice(1)).get("error");
      if (hashErr) return finish(false);
      setTimeout(async () => {
        const { data } = await supabase.auth.getSession();
        finish(!!data.session);
      }, 1500);
    })();
    return () => sub.subscription.unsubscribe();
  }, []);

  if (ready !== "ok") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
        <Logo size="lg" />
        <div className="shadow-soft mt-8 w-full max-w-md rounded-2xl border border-border bg-card p-6">
          {ready === "checking" ? (
            <p className="text-muted-foreground">A validar o link…</p>
          ) : (
            <>
              <h1 className="text-xl font-bold">Link inválido ou expirado</h1>
              <p className="mt-2 text-sm text-muted-foreground">Peça um novo link de redefinição e abra-o no mesmo navegador.</p>
              <Button className="mt-5 w-full" onClick={() => navigate({ to: "/auth" })}>Pedir novo link</Button>
            </>
          )}
        </div>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirm"))) { toast.error("As palavras-passe não coincidem."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Palavra-passe actualizada.");
    navigate({ to: "/painel" });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5">
      <Logo size="lg" />
      <form onSubmit={onSubmit} className="shadow-soft mt-8 w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-6">
        <h1 className="text-xl font-bold">Definir nova palavra-passe</h1>
        <div className="space-y-1.5">
          <Label htmlFor="p">Nova palavra-passe</Label>
          <Input id="p" name="password" type="password" required minLength={6} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c">Confirmar</Label>
          <Input id="c" name="confirm" type="password" required minLength={6} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          Guardar
        </Button>
      </form>
    </div>
  );
}
