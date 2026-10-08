import { createFileRoute } from "@tanstack/react-router";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, ArrowRight, CreditCard, Eye, ShieldCheck, Trash2, Users, Crown } from "lucide-react";

export const Route = createFileRoute("/btn-preview")({
  component: BtnPreview,
});

function BtnPreview() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-5 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-extrabold capitalize sm:text-3xl">Olá, Jeremias 👋</h1>
          <p className="text-muted-foreground mt-1">Pronto para criar o próximo trabalho?</p>
        </div>
        <Button variant="brand" size="lg" className="w-full sm:w-auto">
          <Plus className="h-4 w-4" /> Criar Novo Trabalho
        </Button>
      </div>

      <nav
        aria-label="Acessos rápidos"
        className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/60 p-2.5"
      >
        <Button variant="glass" size="sm" className="w-full grow px-3 sm:w-auto sm:grow-0">
          <CreditCard className="h-4 w-4" /> Planos
        </Button>
        <Button variant="glass" size="sm" className="w-full grow px-3 sm:w-auto sm:grow-0">
          <Eye className="h-4 w-4" /> Amostra
        </Button>
        <Button variant="glass" size="sm" className="w-full grow px-3 sm:w-auto sm:grow-0">
          <ShieldCheck className="h-4 w-4" /> Painel admin
        </Button>
      </nav>

      <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-primary/25 bg-secondary/50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex min-w-0 items-start gap-2 font-semibold break-words">
          <Crown className="mt-1 h-4 w-4 shrink-0 text-primary" />
          Semanal · 5 trabalhos/dia até 02/10/2026
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="glass">
            <ShieldCheck className="h-4 w-4" /> Painel admin
          </Button>
          <Button variant="brand">
            Renovar plano <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="shadow-soft rounded-2xl border border-border bg-card p-5">
          <span className="bg-brand rounded-full px-2.5 py-1 text-[11px] font-bold text-primary-foreground">
            AMOSTRA
          </span>
          <p className="mt-3 font-semibold">Importância da gestão de recursos humanos</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button variant="glass" className="w-full sm:w-auto">
              <Eye className="h-4 w-4" /> Ver trabalho
            </Button>
            <Button variant="brand" className="w-full sm:w-auto">
              <Plus className="h-4 w-4" /> Fazer igual
            </Button>
          </div>
        </div>
        <div className="shadow-soft rounded-2xl border border-border bg-card p-5">
          <p className="text-muted-foreground text-sm">Comunidade WhatsApp</p>
          <Button variant="brand" className="mt-4 w-full sm:w-auto">
            <Users className="h-4 w-4" /> Entrar na comunidade
          </Button>
          <Button variant="danger" className="mt-2 w-full sm:w-auto">
            <Trash2 className="h-4 w-4" /> Apagar histórico
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {["Gestão de recursos humanos", "Marketing digital em Moçambique"].map((t) => (
          <div
            key={t}
            className="shadow-soft flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
          >
            <div className="min-w-0">
              <p className="font-semibold break-words">{t}</p>
              <p className="text-muted-foreground mt-0.5 text-sm">Monografia · Individual · RH</p>
              <p className="text-muted-foreground mt-1 text-xs">Criado: 20/09/2026 · Editado: 25/09/2026 · 3 downloads</p>
            </div>
            <span className={cn(buttonVariants({ variant: "brand", size: "sm" }), "w-full shrink-0 sm:w-auto sm:px-5")}>
              Abrir trabalho <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
