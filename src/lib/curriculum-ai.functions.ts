import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth-guard";
import { z } from "zod";

const Input = z.object({
  fullName: z.string().trim().min(2).max(120),
  profession: z.string().trim().min(2).max(160),
  education: z.string().trim().min(2).max(500),
  experience: z.string().max(3000).default(""),
  skills: z.array(z.string().max(80)).max(30).default([]),
  otherSkills: z.string().max(1000).default(""),
  languages: z.array(z.string().max(80)).max(15).default([]),
  objective: z.string().max(1000).default(""),
  location: z.string().max(120).default(""),
  email: z.string().max(160).default(""),
  phone: z.string().max(40).default(""),
  courses: z.string().max(1500).default(""),
  photoIncluded: z.boolean().default(false),
});

export const improveCurriculumWithAI = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(Input)
  .handler(async ({ data, context }) => {
    const { data: payments, error } = await context.supabase
      .from("payment_requests")
      .select("id, status, amount, plan")
      .eq("user_id", context.userId)
      .eq("plan", "Currículo profissional");
    if (error) throw new Error("Não foi possível confirmar o acesso ao serviço. Tenta novamente.");
    const paid = (payments ?? []).some((p) => Number(p.amount) === 125 && /^(aprovado|aprovada|approved|pago|paid)$/i.test(String(p.status ?? "").trim()));
    if (!paid) throw new Error("O serviço fica disponível depois da aprovação do pagamento de 125 MT.");

    const fallback = () => ({
      professionalTitle: data.profession,
      profile: "",
      objective: data.objective,
      experience: data.experience,
      education: data.education,
      skills: [...data.skills, data.otherSkills].filter(Boolean).join("\n"),
      languages: data.languages.join("\n"),
      courses: data.courses,
    });

    const key = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (!key) {
      console.warn("[RuJe IA currículo] Chave Gemini indisponível; será usado o conteúdo original.");
      return fallback();
    }

    const prompt = `És especialista em recrutamento e redacção de currículos profissionais para candidatos em Moçambique e mercados internacionais lusófonos. Melhora e organiza APENAS os dados fornecidos. Não inventes empresas, cargos, datas, diplomas, certificados, resultados, competências ou níveis linguísticos. Se houver pouca experiência, valoriza honestamente formação, projectos e competências transferíveis. Escreve português profissional, claro e directo. Devolve APENAS JSON válido com as chaves "professionalTitle", "profile", "objective", "experience", "education", "skills", "languages", "courses". experience, education, skills, languages e courses devem ser strings formatadas em linhas curtas com separadores de linha. Se não houver dados, devolve string vazia. Não incluas comentários nem markdown.
DADOS DO CANDIDATO:
${JSON.stringify(data)}`;

    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.25, maxOutputTokens: 5000, responseMimeType: "application/json" } }),
      });
      if (!response.ok) {
        console.error("[RuJe IA currículo] Gemini falhou:", response.status, (await response.text()).slice(0, 250));
        return fallback();
      }
      const payload = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const raw = payload.candidates?.[0]?.content?.parts?.map(p => p.text ?? "").join("").trim() ?? "";
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const clean = (v: unknown) => typeof v === "string" ? v.slice(0, 5000) : "";
      return {
        professionalTitle: clean(parsed.professionalTitle) || data.profession,
        profile: clean(parsed.profile),
        objective: clean(parsed.objective) || data.objective,
        experience: clean(parsed.experience) || data.experience,
        education: clean(parsed.education) || data.education,
        skills: clean(parsed.skills) || fallback().skills,
        languages: clean(parsed.languages) || fallback().languages,
        courses: clean(parsed.courses) || data.courses,
      };
    } catch (error) {
      console.error("[RuJe IA currículo] Falha na melhoria automática; será usado o conteúdo original:", error);
      return fallback();
    }
  });
