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

    // Usa exactamente as mesmas fontes e regras de chave da geração de trabalhos académicos.
    const env = (name: string) => process.env[name]?.trim() ?? "";
    const allKeys = [
      env("GEMINI_API_KEY"),
      env("GOOGLE_API_KEY"),
      env("GOOGLE_GENERATIVE_AI_API_KEY"),
      env("LOVABLE_API_KEY"),
    ].filter(Boolean);
    const geminiKey = allKeys.find((value) => value.startsWith("AIza") || value.startsWith("AQ.")) ?? "";
    const gatewayKey = allKeys.find((value) => value.startsWith("sk_")) ?? "";
    if (!geminiKey && !gatewayKey) {
      throw new Error("O serviço de IA ainda não está configurado. Contacta o suporte da RuJe IA.");
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
      let raw = "";
      const errors: string[] = [];

      // Mantém a mesma ordem de modelos usada pela geração de trabalhos da RuJe IA.
      if (geminiKey) {
        for (const model of ["gemini-3.8-flash", "gemini-3.1-pro-preview"]) {
          try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.35, maxOutputTokens: 6500, responseMimeType: "application/json" },
              }),
              signal: AbortSignal.timeout(45000),
            });
            if (!response.ok) {
              const detail = (await response.text()).slice(0, 300);
              console.error(`[RuJe IA currículo] Gemini ${model} falhou:`, response.status, detail);
              errors.push(`${model}: HTTP ${response.status}`);
              if (response.status === 401 || response.status === 403) break;
              if (response.status === 429 || response.status >= 500 || response.status === 404) continue;
              break;
            }
            const payload = await response.json() as {
              candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
              promptFeedback?: { blockReason?: string };
            };
            raw = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
            if (raw) break;
            errors.push(`${model}: resposta vazia`);
          } catch (modelError) {
            errors.push(`${model}: ${modelError instanceof Error ? modelError.message : String(modelError)}`);
          }
        }
      }

      // Se a mesma configuração da plataforma usa a chave do gateway Lovable, utiliza-a também.
      if (!raw && gatewayKey) {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Lovable-API-Key": gatewayKey },
          body: JSON.stringify({
            model: "google/gemini-3.8-flash",
            messages: [
              { role: "system", content: "Devolve apenas JSON válido, sem markdown ou comentários." },
              { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.35,
            max_tokens: 6500,
          }),
          signal: AbortSignal.timeout(45000),
        });
        if (!response.ok) {
          const detail = (await response.text()).slice(0, 300);
          console.error("[RuJe IA currículo] Gateway falhou:", response.status, detail);
          throw new Error("O serviço de inteligência artificial está temporariamente indisponível. Tenta novamente dentro de instantes.");
        }
        const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
        raw = payload.choices?.[0]?.message?.content?.trim() ?? "";
      }

      if (!raw) {
        console.error("[RuJe IA currículo] Todos os modelos falharam:", errors.join(" | "));
        throw new Error("Não foi possível contactar os modelos de inteligência artificial da RuJe IA. Tenta novamente dentro de instantes.");
      }
      const parsed = JSON.parse(raw.replace(/^\\s*\\x60{3}(?:json)?\\s*/i, "").replace(/\\s*\\x60{3}\\s*$/, "")) as Record<string, unknown>;
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
