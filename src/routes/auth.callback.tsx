import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "error">("checking");
  const [message, setMessage] = useState("A validar a sua conta com segurança…");

  useEffect(() => {
    let active = true;
    const finish = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type");
      const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");

      if (providerError) {
        if (active) {
          setMessage("O link não foi aceite ou já expirou. Solicite um novo e abra-o novamente.");
          setStatus("error");
        }
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (active) {
            setMessage("Não foi possível validar este link. Pode estar expirado ou já ter sido utilizado. Solicite um novo.");
            setStatus("error");
          }
          return;
        }
      } else if (tokenHash && (type === "signup" || type === "email")) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type === "email" ? "email" : "signup" });
        if (error) {
          if (active) {
            setMessage("Não foi possível confirmar este e-mail. Solicite um novo link de confirmação.");
            setStatus("error");
          }
          return;
        }
      }

      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        if (active) {
          setMessage("Não foi possível concluir a autenticação. Volte a entrar ou solicite um novo link.");
          setStatus("error");
        }
        return;
      }

      const requestedNext = url.searchParams.get("next") || "/painel";
      const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/painel";
      if (active) navigate({ to: next, replace: true });
    };

    void finish().catch(() => {
      if (active) {
        setMessage("Ocorreu um erro ao validar o acesso. Tente novamente.");
        setStatus("error");
      }
    });
    return () => { active = false; };
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-10 text-center">
      <Link to="/" className="mb-8"><Logo size="lg" /></Link>
      <div className="shadow-soft w-full max-w-md rounded-2xl border border-border bg-card p-7">
        {status === "checking" ? (
          <>
            <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
            <h1 className="text-xl font-extrabold">A confirmar o acesso</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-xl text-destructive">!</div>
            <h1 className="text-xl font-extrabold">Não foi possível confirmar</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>
            <Button asChild className="mt-6 w-full"><Link to="/auth" search={{ modo: "entrar" }}>Voltar para entrar</Link></Button>
            <p className="mt-4 text-xs text-muted-foreground">Se utilizou o Google, tente novamente com o mesmo endereço de e-mail.</p>
          </>
        )}
      </div>
    </div>
  );
}
