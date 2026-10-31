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
  summary: z.string().max(1500).default(""),
  linkedin: z.string().max(200).default(""),
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

    const key = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (!key) {
      throw new Error("A inteligência artificial do currículo não está configurada. Contacta o suporte da RuJe IA para activar o serviço.");
    }

    const prompt = `Actua como consultor sénior de carreira, especialista em recrutamento, ATS (sistemas de triagem de currículos) e redacção de CVs para Moçambique, países lusófonos e candidaturas internacionais.

OBJECTIVO: transformar as notas do candidato num currículo realmente profissional, completo, convincente e bem escrito — não te limites a corrigir ortografia ou reorganizar frases. Analisa o contexto, identifica competências demonstradas, clarifica responsabilidades e aprofunda a apresentação de cada informação, mantendo rigor absoluto.

REGRAS OBRIGATÓRIAS:
1. Usa português profissional, natural e consistente. Evita frases genéricas, clichés, exageros e repetições.
2. Melhora o título profissional, cria um perfil profissional de 4 a 6 frases com proposta de valor, áreas de domínio, pontos fortes e contexto real do candidato.
3. Desenvolve o objectivo profissional em 2 a 3 frases, orientado ao tipo de função e ao contributo que o candidato pode oferecer.
4. Reescreve a experiência em tópicos claros, com verbos de acção e linguagem de recrutamento. Explica melhor as tarefas e competências que estejam efectivamente implícitas nos dados, sem inventar resultados ou responsabilidades.
5. Organiza a formação académica, competências, idiomas e cursos de forma clara e fácil de ler. Distingue competências técnicas e interpessoais quando os dados permitirem.
6. Se a experiência profissional estiver vazia, não inventes empregos. Valoriza apenas projectos, trabalhos independentes, actividades ou experiência prática que o candidato tenha realmente indicado. Se não houver informação, deixa a secção vazia.
7. Não inventes empresas, empregadores, cargos, datas, duração, instituições, graus, notas, certificados, ferramentas, níveis de idiomas, números, prémios, resultados ou conquistas.
8. Não transformes uma competência numa experiência de trabalho. Não atribuas domínio avançado sem evidência. Não alteres nomes, contactos ou factos.
9. Usa frases específicas e informativas. Mantém o conteúdo suficientemente desenvolvido para um CV competitivo, mas conciso e sem texto de enchimento.
10. Devolve APENAS um objecto JSON válido com as chaves exactas: "professionalTitle", "profile", "objective", "experience", "education", "skills", "languages", "courses". Todos os valores devem ser strings. Nas secções experience, education, skills, languages e courses usa linhas separadas com o prefixo "• " quando forem itens. Não uses markdown fences nem comentários. Se uma secção não tiver dados, devolve string vazia.

DADOS REAIS DO CANDIDATO (trata-os como fonte factual; não inventes o que falta):
${JSON.stringify(data)}`;

    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.35, maxOutputTokens: 6500, responseMimeType: "application/json" } }),
        signal: AbortSignal.timeout(45000),
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 500);
        console.error("[RuJe IA currículo] Gemini falhou:", response.status, detail);
        if (response.status === 429) {
          throw new Error("A inteligência artificial está temporariamente ocupada. Aguarda um minuto e tenta novamente.");
        }
        if (response.status === 400) {
          throw new Error("Os dados enviados não foram aceites pela inteligência artificial. Revê os campos do currículo e tenta novamente.");
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error("A chave da inteligência artificial é inválida ou não tem autorização. Contacta o suporte da RuJe IA.");
        }
        if (response.status === 404) {
          throw new Error("O modelo de inteligência artificial configurado não está disponível. Contacta o suporte da RuJe IA.");
        }
        throw new Error("O serviço de inteligência artificial está temporariamente indisponível. Tenta novamente dentro de instantes.");
      }
      const payload = await response.json() as {
        candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
        promptFeedback?: { blockReason?: string };
      };
      const candidate = payload.candidates?.[0];
      const raw = candidate?.content?.parts?.map(p => p.text ?? "").join("").trim() ?? "";
      if (!raw) {
        console.error("[RuJe IA currículo] Gemini sem conteúdo:", payload.promptFeedback?.blockReason ?? candidate?.finishReason ?? "sem detalhe");
        throw new Error("A inteligência artificial não conseguiu produzir o currículo com estes dados. Revê as informações e tenta novamente.");
      }
      const parsed = JSON.parse(raw.replace(/^\s*\x60{3}(?:json)?\s*/i, "").replace(/\s*\x60{3}\s*$/, "")) as Record<string, unknown>;
      const requiredFields = ["professionalTitle", "profile", "objective", "experience", "education", "skills", "languages", "courses"];
      if (requiredFields.some((field) => typeof parsed[field] !== "string")) throw new Error("A resposta da IA veio incompleta. Tenta novamente.");
      const clean = (v: unknown) => typeof v === "string" ? v.trim().slice(0, 5000) : "";
      const fallbackSkills = [data.skills.join(", "), data.otherSkills].filter(Boolean).join("\n");
      const fallbackLanguages = data.languages.join(", ");
      return {
        professionalTitle: clean(parsed.professionalTitle) || data.profession,
        profile: clean(parsed.profile),
        objective: clean(parsed.objective) || data.objective,
        experience: clean(parsed.experience) || data.experience,
        education: clean(parsed.education) || data.education,
        skills: clean(parsed.skills) || fallbackSkills,
        languages: clean(parsed.languages) || fallbackLanguages,
        courses: clean(parsed.courses) || data.courses,
      };
    } catch (error) {
      console.error("[RuJe IA currículo] Falha na melhoria automática:", error);
      if (error instanceof Error && error.message && !/^(Unexpected token|Expected property name|JSON\.parse)/i.test(error.message)) {
        if (error.name === "AbortError" || error.name === "TimeoutError") {
          throw new Error("A inteligência artificial demorou demasiado tempo a responder. Verifica a ligação e tenta novamente.");
        }
        if (error instanceof SyntaxError) {
          throw new Error("A inteligência artificial devolveu uma resposta inválida. Tenta novamente.");
        }
        throw error;
      }
      throw new Error("A IA não conseguiu concluir a melhoria do currículo. Verifica a ligação e tenta novamente.");
    }
  });
