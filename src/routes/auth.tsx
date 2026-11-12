import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BellRing } from "lucide-react";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ modo: z.enum(["entrar", "registo"]).optional() }),
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow, noarchive" },
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

function signupErrorMessage(message: string) {
  const m = message.toLowerCase();
  if (m.includes("weak") || m.includes("pwned")) return "Essa palavra-passe é demasiado comum. Escolha outra com pelo menos 6 caracteres.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Já existe uma conta com este e-mail. Entre em vez de criar conta.";
  if (m.includes("invalid email")) return "Verifique o endereço de e-mail indicado.";
  return message;
}

type Purpose = "trabalho_academico" | "comprar_exames" | "criar_curriculo";

function AuthPage() {
  const { modo } = Route.useSearch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [notificationStep, setNotificationStep] = useState(false);
  const [purpose, setPurpose] = useState<Purpose | "">("");
  const [studyLevel, setStudyLevel] = useState("");
  const [studyArea, setStudyArea] = useState("");
  const [institution, setInstitution] = useState("");
  const [yearClass, setYearClass] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/painel", replace: true });
    });
  }, [navigate]);

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
      toast.error("E-mail ou palavra-passe incorrectos. Verifique os dados e tente novamente.");
      return;
    }
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
        data: { full_name: String(form.get("full_name")), phone: String(form.get("phone")) },
      },
    });
    setLoading(false);
    if (error) { toast.error(signupErrorMessage(error.message)); return; }
    if (!data.session) {
      toast.error("O registo ainda está a exigir confirmação por e-mail. Verifique a opção Confirm email no Supabase.");
      return;
    }
    toast.success("Conta criada com sucesso! Vamos configurar as tuas notificações e personalizar o perfil.");
    setNotificationStep(true);
    setOnboarding(true);
  }

  async function requestBrowserNotifications() {
    if (!("Notification" in window)) {
      toast.error("Este navegador não suporta notificações do sistema. Continuarás a receber avisos dentro da RuJe IA.");
      setNotificationStep(false);
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        toast.success("Notificações activadas! Vais receber avisos importantes da RuJe IA.");
      } else if (permission === "denied") {
        toast.info("As notificações do navegador foram recusadas. Continuarás a receber avisos dentro da plataforma.");
      } else {
        toast.info("Podes activar as notificações mais tarde nas definições do navegador.");
      }
    } catch {
      toast.error("Não foi possível pedir autorização ao navegador. Os avisos internos continuam activos.");
    } finally {
      setNotificationStep(false);
    }
  }

  async function chooseCurriculum() {
    setPurpose("criar_curriculo");
    setLoading(true);
    const userId = (await supabase.auth.getUser()).data.user?.id;
    const { error: profileError } = await supabase.from("profiles").update({
      onboarding_completed: true,
      primary_goal: "criar_curriculo",
    }).eq("id", userId ?? "");
    if (profileError) {
      setLoading(false);
      toast.error("Não foi possível guardar a sua preferência. Tente novamente.");
      return;
    }
    const { error } = await supabase.auth.updateUser({
      data: { onboarding_completed: true, primary_goal: "criar_curriculo" },
    });
    setLoading(false);
    if (error) {
      toast.error("A preferência foi guardada no perfil, mas não foi possível actualizar os metadados.");
      return;
    }
    navigate({ to: "/painel", replace: true });
  }

  async function finishOnboarding() {
    if (!purpose) { toast.error("Seleccione o que veio fazer na RuJe IA."); return; }
    if (purpose === "trabalho_academico" && (!studyLevel || !studyArea.trim())) {
      toast.error("Indique o seu nível de estudos e a sua área ou curso.");
      return;
    }
    if (purpose === "comprar_exames" && !yearClass) {
      toast.error("Indique a classe ou nível de exame que procura.");
      return;
    }

    setLoading(true);
    const profileUpdate = await supabase.from("profiles").update({
      onboarding_completed: true,
      primary_goal: purpose,
      study_level: studyLevel || null,
      course: studyArea.trim() || null,
      institution: institution.trim() || null,
      exam_class: yearClass || null,
    }).eq("id", (await supabase.auth.getUser()).data.user?.id ?? "");
    if (profileUpdate.error) {
      setLoading(false);
      toast.error("Não foi possível guardar os dados do perfil. Tente novamente.");
      return;
    }
    const { error } = await supabase.auth.updateUser({
      data: {
        onboarding_completed: true,
        primary_goal: purpose,
        study_level: studyLevel || null,
        study_area: studyArea.trim() || null,
        institution: institution.trim() || null,
        exam_class: yearClass || null,
      },
    });
    setLoading(false);
    if (error) {
      toast.error("Os dados foram guardados no perfil, mas não foi possível actualizar os metadados da conta.");
      return;
    }
    toast.success("Perfil actualizado. Bem-vindo à RuJe IA!");
    navigate({ to: "/painel", replace: true });
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

  const choiceClass = (active: boolean) =>
    `w-full rounded-xl border p-4 text-left transition-colors ${active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"}`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <Link to="/" className="mb-8"><Logo size="lg" /></Link>
      <div className="shadow-soft w-full max-w-md rounded-2xl border border-border bg-card p-6">
        {onboarding ? (
          <div className="space-y-5">
            {notificationStep && (
              <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><BellRing className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <h2 className="font-bold">Activa as notificações da RuJe IA</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">Recebe avisos personalizados sobre pagamentos, trabalhos criados, exames, currículo e actualizações importantes da plataforma.</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Button type="button" onClick={requestBrowserNotifications} className="w-full"><BellRing className="h-4 w-4" /> Activar notificações</Button>
                  <Button type="button" variant="outline" onClick={() => setNotificationStep(false)} className="w-full">Continuar sem activar</Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">A autorização é pedida pelo navegador. Se recusares, os avisos continuarão disponíveis no sino dentro da tua conta.</p>
              </section>
            )}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Configuração do perfil · 1 de 2</p>
              <h1 className="text-2xl font-bold">O que veio fazer na RuJe IA?</h1>
              <p className="text-sm text-muted-foreground">Escolha uma opção para adaptarmos a sua experiência.</p>
            </div>
            <div className="space-y-3">
              <button type="button" className={choiceClass(purpose === "trabalho_academico")} onClick={() => setPurpose("trabalho_academico")}>
                <span className="font-semibold">1. Fazer trabalho académico</span>
                <span className="mt-1 block text-sm text-muted-foreground">Monografia, TCC, relatório, pesquisa e outros trabalhos.</span>
              </button>
              <button type="button" className={choiceClass(purpose === "comprar_exames")} onClick={() => setPurpose("comprar_exames")}>
                <span className="font-semibold">2. Comprar exames</span>
                <span className="mt-1 block text-sm text-muted-foreground">Preparar-se para provas e exames anteriores.</span>
              </button>
              <button type="button" className={choiceClass(purpose === "criar_curriculo")} onClick={chooseCurriculum}>
                <span className="font-semibold">3. Criar currículo</span>
                <span className="mt-1 block text-sm text-muted-foreground">Preparar um CV profissional para candidaturas.</span>
              </button>
            </div>

            {purpose === "trabalho_academico" && (
              <div className="space-y-4 rounded-xl bg-muted/40 p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="study-level">Qual é o seu nível de estudos?</Label>
                  <select id="study-level" value={studyLevel} onChange={e => setStudyLevel(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Seleccione o nível</option>
                    <option>Ensino secundário</option><option>Ensino técnico-profissional</option><option>Licenciatura</option><option>Mestrado</option><option>Doutoramento</option><option>Outro</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="study-area">Qual é a sua área, curso ou ciência?</Label>
                  <Input id="study-area" value={studyArea} onChange={e => setStudyArea(e.target.value)} placeholder="Ex.: Direito, Biologia, Informática..." />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="institution">Instituição de ensino (opcional)</Label>
                  <Input id="institution" value={institution} onChange={e => setInstitution(e.target.value)} placeholder="Nome da escola ou universidade" />
                </div>
              </div>
            )}

            {purpose === "comprar_exames" && (
              <div className="space-y-1.5 rounded-xl bg-muted/40 p-4">
                <Label htmlFor="exam-class">Que classe ou nível procura?</Label>
                <select id="exam-class" value={yearClass} onChange={e => setYearClass(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Seleccione</option><option>10ª classe</option><option>12ª classe</option><option>Ensino técnico-profissional</option><option>Outro</option>
                </select>
              </div>
            )}

            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => navigate({ to: "/painel", replace: true })}>Fazer depois</Button>
              <Button type="button" className="flex-1" onClick={finishOnboarding} disabled={loading || !purpose}>
                {loading ? "A guardar..." : "Concluir"}
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">Pode actualizar estas informações no seu perfil mais tarde.</p>
          </div>
        ) : (
          <Tabs defaultValue={modo === "registo" ? "registo" : "entrar"}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="entrar">Entrar</TabsTrigger>
              <TabsTrigger value="registo">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="entrar">
              <form onSubmit={handleLogin} className="mt-5 space-y-4">
                <div className="space-y-1.5"><Label htmlFor="l-email">E-mail</Label><Input id="l-email" name="email" type="email" autoComplete="email" required placeholder="voce@email.com" /></div>
                <div className="space-y-1.5"><Label htmlFor="l-pass">Palavra-passe</Label><Input id="l-pass" name="password" type="password" required /></div>
                <Button type="submit" className="w-full" disabled={loading}>Entrar</Button>
                <button type="button" onClick={handleReset} className="text-muted-foreground w-full text-sm underline">Esqueci a minha palavra-passe</button>
              </form>
            </TabsContent>
            <TabsContent value="registo">
              <form onSubmit={handleSignup} className="mt-5 space-y-4">
                <div className="space-y-1.5"><Label htmlFor="s-name">Nome completo</Label><Input id="s-name" name="full_name" required /></div>
                <div className="space-y-1.5"><Label htmlFor="s-email">E-mail</Label><Input id="s-email" name="email" type="email" autoComplete="email" required placeholder="exemplo@gmail.com" /></div>
                <div className="space-y-1.5"><Label htmlFor="s-phone">Número de telefone</Label><Input id="s-phone" name="phone" type="tel" placeholder="+258 84 000 0000" required /></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label htmlFor="s-pass">Palavra-passe</Label><Input id="s-pass" name="password" type="password" required minLength={6} /><p className="text-muted-foreground text-xs">Pelo menos 6 caracteres.</p></div>
                  <div className="space-y-1.5"><Label htmlFor="s-confirm">Confirmar</Label><Input id="s-confirm" name="confirm" type="password" required minLength={6} /></div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "A criar conta..." : "Criar conta"}</Button>
              </form>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
