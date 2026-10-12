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

  it("o Plano 1 dia é o primeiro e o único recomendado para começar", () => {
    expect(PLANS[0]?.id).toBe("teste");
    expect(PLANS[0]?.highlight).toBe(true);
    expect(PLANS.filter((x) => x.highlight)).toHaveLength(1);
  });

  it("ninguém paga mais de 30 MT para experimentar a plataforma", () => {
    const cheapest = Math.min(...PLANS.map((p) => p.price));
    expect(cheapest).toBe(30);
  });

  it("planos mais longos nunca dão menos trabalhos por dia", () => {
    const ordered = [...PLANS].sort((a, b) => a.days - b.days);
    const limits = ordered.map((p) => p.dailyLimit);
    for (let i = 1; i < limits.length; i++) {
      expect(limits[i] ?? 0).toBeGreaterThanOrEqual(limits[i - 1] ?? 0);
    }
  });

  it("todos os planos têm limite diário positivo, preço e duração", () => {
    for (const p of PLANS) {
      expect(p.dailyLimit).toBeGreaterThan(0);
      expect(p.price).toBeGreaterThan(0);
      expect(p.days).toBeGreaterThan(0);
    }
  });
});
