import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SignupQuiz } from "@/components/SignupQuiz";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ modo: z.enum(["entrar", "registo"]).optional() }),
  head: () => ({
    meta: [
      { title: "Entrar ou criar conta | RuJe IA" },
      { name: "description", content: "Aceda à sua conta RuJe IA e crie trabalhos académicos com IA." },
      { property: "og:title", content: "Entrar ou criar conta | RuJe IA" },
      { property: "og:description", content: "Aceda à sua conta RuJe IA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

/** Traduz os erros do serviço de contas para linguagem simples. */
function signupErrorMessage(message: string) {
  const m = message.toLowerCase();
  if (m.includes("weak") || m.includes("pwned")) {
    return "Essa palavra-passe é demasiado comum. Escolha outra com pelo menos 6 caracteres.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "Já existe uma conta com este e-mail. Entre em vez de criar conta.";
  }
  if (m.includes("invalid email")) return "Verifique o endereço de e-mail indicado.";
  return message;
}

function AuthPage() {
  const { modo } = Route.useSearch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const authCallbackUrl = () => `${window.location.origin}/auth/callback?next=/painel`;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/painel", replace: true });
    });
  }, [navigate]);

  async function handleGoogleLogin() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: authCallbackUrl(), queryParams: { prompt: "select_account" } },
    });
    if (error) {
      setLoading(false);
      toast.error("Não foi possível iniciar a entrada com Google. Tente novamente ou use o e-mail.");
    }
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
    });
    setLoading(false);
    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("not confirmed") || message.includes("email_not_confirmed")) {
        const email = String(form.get("email")).trim();
        setConfirmationEmail(email);
        toast.error("O seu e-mail ainda não foi confirmado. Pode reenviar o link agora.");
      } else {
        toast.error("E-mail ou palavra-passe incorrectos.");
      }
      return;
    }
    await supabase.auth.getUser();
    navigate({ to: "/painel", replace: true });
  }

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirm"))) { toast.error("As palavras-passe não coincidem."); return; }
    if (password.length < 6) { toast.error("A palavra-passe deve ter pelo menos 6 caracteres."); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: String(form.get("email")).trim(),
      password,
      options: {
        emailRedirectTo: authCallbackUrl(),
        data: { full_name: String(form.get("full_name")), phone: String(form.get("phone")) },
      },
    });
    setLoading(false);
    if (error) { toast.error(signupErrorMessage(error.message)); return; }
    if (!data.session) {
      setConfirmationEmail(String(form.get("email")).trim());
      toast.success("Conta criada. Falta confirmar o endereço de e-mail.");
      return;
    }
    toast.success("Conta criada com sucesso!");
    setShowQuiz(true);
  }


  async function handleResendConfirmation() {
    if (!confirmationEmail || resending) return;
    setResending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: confirmationEmail, options: { emailRedirectTo: authCallbackUrl() } });
    setResending(false);
    if (error) { toast.error("Não foi possível reenviar agora. Aguarde um pouco e tente novamente."); return; }
    toast.success("Novo link de confirmação enviado. Verifique também a pasta de spam.");
  }

  async function handleReset() {
    const email = window.prompt("Indique o seu e-mail para recuperar a palavra-passe:");
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Enviámos um link de recuperação para o seu e-mail.");
  }

  if (confirmationEmail) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-5 py-10">
        <Link to="/" className="mb-8"><Logo size="lg" /></Link>
        <div className="shadow-soft w-full max-w-md rounded-2xl border border-border bg-card p-7 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><span className="text-2xl">✉</span></div>
          <h1 className="mt-5 text-2xl font-extrabold">Confirme o seu e-mail</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">A conta foi criada para <strong className="text-foreground">{confirmationEmail}</strong>, mas o acesso ao painel só fica disponível depois de confirmar o endereço. Abra o link enviado para a sua caixa de entrada e, depois, entre na RuJe IA.</p>
          <Button className="mt-6 w-full" onClick={handleResendConfirmation} disabled={resending}>{resending ? "A enviar…" : "Reenviar link de confirmação"}</Button>
          <Button variant="outline" className="mt-3 w-full" onClick={() => setConfirmationEmail(null)}>Voltar para entrar</Button>
          <p className="mt-4 text-xs text-muted-foreground">Verifique a Caixa de entrada e Spam. Abra o link no mesmo navegador onde pretende utilizar a RuJe IA. Se o link expirar, solicite outro.</p>
        </div>
      </div>
    );
  }

  if (showQuiz) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-5 py-10">
        <Link to="/" className="mb-8">
          <Logo size="lg" />
        </Link>
        <SignupQuiz onFinish={() => navigate({ to: "/escolher-servico" })} onGoPanel={() => navigate({ to: "/painel", replace: true })} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <Link to="/" className="mb-8">
        <Logo size="lg" />
      </Link>
      <div className="shadow-soft w-full max-w-md rounded-2xl border border-border bg-card p-6">
        <div className="mb-5 space-y-3">
          <Button type="button" variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={loading}>
            <span className="mr-2 grid h-5 w-5 place-items-center rounded-full border text-sm font-bold">G</span>
            Continuar com Google
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" /><span>ou use o seu e-mail</span><span className="h-px flex-1 bg-border" /></div>
        </div>
        <Tabs defaultValue={modo === "registo" ? "registo" : "entrar"}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="entrar">Entrar</TabsTrigger>
            <TabsTrigger value="registo">Criar conta</TabsTrigger>
          </TabsList>

          <TabsContent value="entrar">
            <form onSubmit={handleLogin} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="l-email">E-mail</Label>
                <Input id="l-email" name="email" type="email" autoComplete="email" required placeholder="voce@email.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-pass">Palavra-passe</Label>
                <Input id="l-pass" name="password" type="password" required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                Entrar
              </Button>
              <button type="button" onClick={handleReset} className="text-muted-foreground w-full text-sm underline">
                Esqueci a minha palavra-passe
              </button>
            </form>
          </TabsContent>

          <TabsContent value="registo">
            <form onSubmit={handleSignup} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="s-name">Nome completo</Label>
                <Input id="s-name" name="full_name" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-email">E-mail</Label>
                <Input id="s-email" name="email" type="email" autoComplete="email" required placeholder="exemplo@gmail.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-phone">Número de telefone</Label>
                <Input id="s-phone" name="phone" type="tel" placeholder="+258 84 000 0000" required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="s-pass">Palavra-passe</Label>
                  <Input id="s-pass" name="password" type="password" required minLength={6} />
                  <p className="text-muted-foreground text-xs">Pelo menos 6 caracteres; números e símbolos não são obrigatórios.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-confirm">Confirmar</Label>
                  <Input id="s-confirm" name="confirm" type="password" required minLength={6} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                Criar conta
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
