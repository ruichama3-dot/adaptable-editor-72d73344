import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth-guard";
import { z } from "zod";
import { FREE_DAILY_LIMIT } from "@/lib/plans";
import { resolveAccess } from "@/lib/access";

const GenerateInput = z.object({ workId: z.string().uuid() });

function buildPrompt(w: Record<string, unknown>) {
  const opt = (w['options'] ?? {}) as Record<string, boolean>;
  const f = (k: string) => (w[k] ? String(w[k]) : "—");
  const isGroup = String(w['work_mode'] ?? "individual") === "grupo";
  const manualRefs = String(w['references_mode'] ?? "automatica") === "manual";

  return `És um assistente académico especialista. Escreve um trabalho académico COMPLETO em ${f("language")}, do tipo "${f("work_type")}", nível ${f("academic_level")}, seguindo rigorosamente as normas ${f("norms")}.

DADOS:
- Tema: ${f("theme")}
- Título: ${f("title")}
- Modalidade: ${isGroup ? "TRABALHO EM GRUPO" : "TRABALHO INDIVIDUAL"}
${isGroup ? `- Elementos do grupo (lista numerada na folha de rosto): ${f("group_members")}` : `- Estudante: ${f("student_name")} (nº ${f("student_number")})`}
- Curso: ${f("course")} | Turma: ${f("class_group")} | Classe/Ano: ${f("grade_year")}
- Instituição: ${f("institution")} | Faculdade: ${f("faculty")} | Departamento: ${f("department")}
- Disciplina: ${f("subject")} | Docente: ${f("teacher")}
- Local: ${f("city")}, ${f("country")} | Data de entrega: ${f("due_date")}
- Extensão alvo: aproximadamente ${f("pages")} páginas (escreve texto extenso e denso, sem repetições).

ESTRUTURA OBRIGATÓRIA (modelo académico moçambicano), por esta ordem, cada item em página própria quando indicado:
${opt['cover'] === false ? "" : `1. CAPA (página única, tudo centrado): nome da instituição em maiúsculas; ${isGroup ? '"TRABALHO EM GRUPO"' : '"TRABALHO INDIVIDUAL"'} em destaque; "Cadeira: <disciplina>"; "Tema: <tema>"; e no fim "<cidade>, <ano>".
2. FOLHA DE ROSTO (página única): instituição em maiúsculas centrada; ${isGroup ? '"TRABALHO EM GRUPO"' : '"TRABALHO INDIVIDUAL"'} centrado; depois uma <table class=\"rosto\"> de duas colunas: à esquerda ${isGroup ? '"Elementos do grupo:" com um nome por linha' : '"Discente:" com o nome e número do estudante'}, à direita "Docente:" com o nome do docente; depois centrado "Cadeira: <disciplina>", "Tema: <tema>", curso e turma se existirem; no fim "<cidade>, <ano>".
`}${opt['index'] === false ? "" : "3. ÍNDICE (página única): título <h1>Índice</h1> e uma lista <ul> com todos os títulos e subtítulos do trabalho, sem números de página.\n"}4. Introdução (página nova)
5. Objetivos: Objetivo Geral e Objetivos Específicos
6. Metodologia
7. Desenvolvimento / Fundamentação Teórica, dividido em vários subtítulos <h2> e <h3> claros e específicos ao tema
8. Conclusão (página nova)
9. Referências Bibliográficas (página nova, título "Bibliografia"), em ordem alfabética

REFERÊNCIAS BIBLIOGRÁFICAS:
${manualRefs
  ? `- O utilizador escolheu REFERÊNCIAS MANUAIS. Usa EXACTAMENTE e apenas as referências indicadas abaixo, formatando-as segundo as normas ${f("norms")}, e cita-as no corpo do texto:\n${f("manual_references")}`
  : `- Gera referências bibliográficas reais e credíveis segundo as normas ${f("norms")}${opt['citations'] === false ? "" : ", com citações no corpo do texto (Autor, ano)"}.`}

REGRAS DE SAÍDA:
- Devolve APENAS HTML simples do corpo do documento: <h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>, <table>, <tr>, <td>, <strong>, <em>. Sem markdown, sem \`\`\`, sem <html>, <head> ou <body>, sem comentários.
- Cada secção principal usa <h1>; subtítulos usam <h2>/<h3>. Parágrafos completos de 4 a 7 linhas, justificados, sem frases soltas.
- SEPARAÇÃO EM PÁGINAS OBRIGATÓRIA: separa cada página com exactamente <hr class="page-break">, sempre ENTRE blocos completos, nunca dentro de parágrafos, listas ou tabelas. Capa, folha de rosto e índice são uma página cada; a introdução, a conclusão e a bibliografia começam em página nova. Cerca de 250 a 320 palavras por página no desenvolvimento, até aproximadamente ${f("pages")} páginas no total. Não escrevas números de página.
- Na capa e folha de rosto usa <p style="text-align:center"> e deixa espaço com parágrafos vazios <p>&nbsp;</p> entre os blocos, como num trabalho impresso.
- Revê ortografia e gramática: o texto final não pode ter erros, repetições nem marcadores de exemplo.
- Linguagem académica formal, rigorosa e original. Nada de texto de exemplo tipo "insira aqui".`;
}

function startOfTodayISO() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Modelos reais da API pública do Google Gemini, por ordem de preferência. */
const GEMINI_MODELS = [
  "gemini-3.6-flash",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-2.5-pro",
];

/** Todas as chaves candidatas, lidas apenas do servidor (nunca VITE_*). */
function readKeys() {
  const env = (n: string) => process.env[n]?.trim() ?? "";
  const all = [
    env("GEMINI_API_KEY"),
    env("GOOGLE_API_KEY"),
    env("GOOGLE_GENERATIVE_AI_API_KEY"),
    env("LOVABLE_API_KEY"),
  ].filter(Boolean);

  // Chaves da Google aceites: "AIza" (AI Studio) e "AQ." (tokens de acesso Gemini).
  const geminiKey = all.find((k) => k.startsWith("AIza") || k.startsWith("AQ.")) ?? "";
  // Chaves do gateway Lovable começam por "sk_".
  const gatewayKey = all.find((k) => k.startsWith("sk_")) ?? "";
  return { geminiKey, gatewayKey };
}


async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const errors: string[] = [];

  for (const model of GEMINI_MODELS) {
   for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
             generationConfig: { temperature: 0.7, maxOutputTokens: 16384 },
          }),
        },
      );

      if (!res.ok) {
        const errText = (await res.text().catch(() => "")).slice(0, 300);
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          throw new Error(
            "CONFIG_KEY_INVALID",
          );
        }
        errors.push(`${model}: ${res.status} ${errText}`);
        if (res.status === 429 || res.status >= 500) continue;
        break;
      }

      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (text.trim()) return text;
      errors.push(`${model}: resposta vazia`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === "CONFIG_KEY_INVALID") {
        console.error("[IA] Chave inválida ou sem permissões.");
        return "";
      }
      errors.push(`${model}: ${message}`);
    }
   }
  }

  console.error("[IA] Falha em todos os modelos principais:", errors.join(" | "));
  return "";
}

async function callLovableGateway(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: "google/gemini-3-flash",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = (await res.text().catch(() => "")).slice(0, 300);
    console.error("[IA] Falha no gateway:", res.status, errText);
    return "";
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

const BUSY_MSG =
  "O nosso sistema está com muita procura neste momento. O seu trabalho não foi descontado — tente novamente dentro de alguns minutos.";

async function callAI(prompt: string): Promise<string> {
  const { geminiKey, gatewayKey } = readKeys();

  if (!geminiKey && !gatewayKey) {
    console.error("[IA] Nenhuma chave de IA configurada no servidor.");
    throw new Error(BUSY_MSG);
  }

  // Duas rondas completas antes de desistir.
  for (let round = 0; round < 2; round++) {
    if (round > 0) await new Promise((r) => setTimeout(r, 3000));
    if (geminiKey) {
      const text = await callGemini(prompt, geminiKey);
      if (text.trim()) return text;
    }
    if (gatewayKey) {
      const text = await callLovableGateway(prompt, gatewayKey).catch(() => "");
      if (text.trim()) return text;
    }
  }

  throw new Error(BUSY_MSG);
}


export const generateWork = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => GenerateInput.parse(d))
  .handler(async ({ data, context }) => {
    // Acesso: administrador (ilimitado), subscrição activa ou pagamento aprovado.
    const access = await resolveAccess(context.supabase, context.userId);

    if (!access.isAdmin) {
      if (!access.hasAccess) {
        throw new Error(
          "Precisa de um plano activo para criar trabalhos. Escolha um plano na página Planos.",
        );
      }

      const limit = access.dailyLimit ?? FREE_DAILY_LIMIT;

      const { count } = await context.supabase
        .from("works")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .neq("content", "")
        .gte("created_at", startOfTodayISO());

      if (limit > 0 && (count ?? 0) >= limit) {
        throw new Error(
          `Atingiu o limite de ${limit} trabalhos por dia do seu plano. Tente novamente amanhã.`,
        );
      }
    }

    const { data: work, error } = await context.supabase
      .from("works")
      .select("*")
      .eq("id", data.workId)
      .single();
    if (error || !work) throw new Error("Trabalho não encontrado.");

    const rawContent = await callAI(buildPrompt(work as Record<string, unknown>));

    const html = rawContent
      .replace(/^```(?:html)?/i, "")
      .replace(/```$/i, "")
      .trim();
    if (!html) throw new Error(BUSY_MSG);

    const { error: upErr } = await context.supabase
      .from("works")
      .update({ content: html })
      .eq("id", data.workId);
    if (upErr) throw new Error(upErr.message);

    return { content: html };
  });

