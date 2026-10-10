import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { saveLang, saveTheme, usePreferences, type Lang, type Theme } from "@/lib/preferences";
import { Sun, Moon, Languages, User, KeyRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/definicoes")({
  head: () => ({
    meta: [
      { title: "Definições | RuJe IA" },
      { name: "description", content: "Altere tema, idioma, dados pessoais e palavra-passe na RuJe IA." },
      { property: "og:title", content: "Definições | RuJe IA" },
      { property: "og:description", content: "Personalize a sua conta RuJe IA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Definicoes,
});

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      type="button"
      variant={active ? "brand" : "glass"}
      onClick={onClick}
      className={cn("w-full sm:w-auto")}
      aria-pressed={active}
    >
      {children}
    </Button>
  );
}

function Definicoes() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const { theme, lang } = usePreferences();
  const [savingPass, setSavingPass] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  async function onProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: String(f.get("full_name")),
      phone: String(f.get("phone")),
      institution: String(f.get("institution")),
      course: String(f.get("course")),
    });
    if (error) { toast.error("Não foi possível guardar os dados."); return; }
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Dados actualizados.");
  }

  async function onPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const p1 = String(f.get("p1"));
    const p2 = String(f.get("p2"));
    if (p1.length < 6) { toast.error("A palavra-passe deve ter pelo menos 6 caracteres."); return; }
    if (p1 !== p2) { toast.error("As palavras-passe não coincidem."); return; }
    setSavingPass(true);
    const { error } = await supabase.auth.updateUser({ password: p1 });
    setSavingPass(false);
    if (error) { toast.error("Não foi possível alterar a palavra-passe. Tente novamente."); return; }
    form.reset();
    toast.success("Palavra-passe alterada.");
  }

  const card = "shadow-soft rounded-2xl border border-border bg-card p-5 sm:p-6";

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-5 sm:py-8">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Definições</h1>

      <section className={card}>
        <h2 className="flex items-center gap-2 font-bold"><Sun className="h-4 w-4 text-primary" /> Tema</h2>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {(["claro", "escuro"] as Theme[]).map((v) => (
            <Choice key={v} active={theme === v} onClick={() => saveTheme(v)}>
              {v === "claro" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {v === "claro" ? "Claro" : "Escuro"}
            </Choice>
          ))}
        </div>
      </section>

      <section className={card}>
        <h2 className="flex items-center gap-2 font-bold"><Languages className="h-4 w-4 text-primary" /> Idioma</h2>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {([["pt", "Português"], ["en", "English"]] as [Lang, string][]).map(([v, label]) => (
            <Choice key={v} active={lang === v} onClick={() => saveLang(v)}>{label}</Choice>
          ))}
        </div>
        <p className="text-muted-foreground mt-3 text-xs">O idioma escolhido aplica-se ao menu da conta.</p>
      </section>

      <form onSubmit={onProfile} className={cn(card, "space-y-4")}>
        <h2 className="flex items-center gap-2 font-bold"><User className="h-4 w-4 text-primary" /> Dados pessoais</h2>
        <div className="space-y-1.5">
          <Label>E-mail</Label>
          <Input value={user.email ?? ""} disabled />
        </div>
        {[
          ["full_name", "Nome completo"],
          ["phone", "Telefone"],
          ["institution", "Instituição"],
          ["course", "Curso"],
        ].map(([name, label]) => {
          const value = (profile as Record<string, string | null> | null | undefined)?.[name as string] ?? "";
          return (
            <div key={name} className="space-y-1.5">
              <Label htmlFor={name}>{label}</Label>
              <Input id={name} name={name} defaultValue={value} key={value} />
            </div>
          );
        })}
        <Button type="submit" variant="brand" className="w-full sm:w-auto">Guardar dados</Button>
      </form>

      <form onSubmit={onPassword} className={cn(card, "space-y-4")}>
        <h2 className="flex items-center gap-2 font-bold"><KeyRound className="h-4 w-4 text-primary" /> Palavra-passe</h2>
        <div className="space-y-1.5">
          <Label htmlFor="p1">Nova palavra-passe</Label>
          <Input id="p1" name="p1" type="password" minLength={6} required autoComplete="new-password" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p2">Confirmar palavra-passe</Label>
          <Input id="p2" name="p2" type="password" minLength={6} required autoComplete="new-password" />
        </div>
        <Button type="submit" variant="brand" disabled={savingPass} className="w-full sm:w-auto">
          {savingPass ? "A guardar…" : "Alterar palavra-passe"}
        </Button>
      </form>
    </main>
  );
}
