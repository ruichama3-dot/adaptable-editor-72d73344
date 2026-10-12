import { describe, expect, it } from "vitest";
import { PLANS, planById } from "./plans";

describe("regras dos planos", () => {
  it("o Plano 1 dia custa 30 MT, dura 1 dia e permite 2 trabalhos por dia", () => {
    const p = planById("teste");
    expect(p).toBeDefined();
    expect(p?.name).toBe("Plano 1 dia");
    expect(p?.price).toBe(30);
    expect(p?.days).toBe(1);
    expect(p?.dailyLimit).toBe(2);
  });

  it("o Plano 1 dia é o primeiro e o recomendado para começar", () => {
    expect(PLANS[0].id).toBe("teste");
    expect(PLANS[0].highlight).toBe(true);
    expect(PLANS.filter((x) => x.highlight)).toHaveLength(1);
  });

  it("os limites diários crescem com a duração do plano", () => {
    const weekly = planById("semanal");
    const fortnightly = planById("quinzenal");
    const monthly = planById("mensal");
    expect(weekly?.dailyLimit).toBe(2);
    expect(fortnightly?.dailyLimit).toBe(4);
    expect(monthly?.dailyLimit).toBe(10);
    expect((weekly?.dailyLimit ?? 0) + 1).toBe(fortnightly?.dailyLimit);
    expect((fortnightly?.dailyLimit ?? 0) + 1).toBe(monthly?.dailyLimit);
  });

  it("não há limites diários repetidos entre os planos", () => {
    const limits = PLANS.map((p) => p.dailyLimit);
    expect(new Set(limits).size).toBe(limits.length);
  });
});
