import { createFileRoute } from "@tanstack/react-router";
import { PLANS } from "@/lib/plans";

export const Route = createFileRoute("/_plan-check")({
  component: PlanCheck,
});

function PlanCheck() {
  return (
    <div className="mx-auto flex max-w-5xl flex-wrap gap-4 p-6">
      {PLANS.map((p) => (
        <div key={p.id} className="w-full rounded-2xl border-2 border-border bg-card p-6 sm:w-[calc(50%-0.5rem)] lg:w-[calc(25%-0.75rem)]">
          {p.highlight && (
            <span className="w-fit rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground">
              Recomendado para começar
            </span>
          )}
          <p className="mt-2 font-bold">{p.name}</p>
          <p className="mt-2 text-3xl font-extrabold">
            {p.price} <span className="text-base font-semibold">MT</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{p.days} dias de acesso</p>
          <p className="mt-3 text-sm">{p.dailyLimit} trabalhos por dia</p>
        </div>
      ))}
    </div>
  );
}
