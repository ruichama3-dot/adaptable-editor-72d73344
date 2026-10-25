import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth-guard";
import { z } from "zod";
import { FREE_DAILY_LIMIT } from "@/lib/plans";
import { resolveAccess } from "@/lib/access";

const GenerateInput = z.object({ workId: z.string().uuid() });

const WORK_TYPE_GUIDANCE: Record<string, string> = {
  "trabalho escolar": "Linguagem adequada à classe; introdução, desenvolvimento por tópicos, conclusão e referências apropriadas ao nível.",
  "trabalho científico": "Problema, objetivos, justificativa, fundamentação teórica, metodologia, análise crítica e conclusão.",
  "monografia": "Elementos pré-textuais conforme as normas, introdução, problema, objetivos, justificativa, fundamentação teórica em capítulos, metodologia, análise de resultados apenas com dados reais, conclusão, recomendações e referências. Não inventar trabalho de campo.",
  "projeto de pesquisa": "Proposta de investigação: tema delimitado, problema, pergunta, objetivos, justificativa, fundamentação, metodologia proposta, cronograma/orçamento quando necessários, resultados esperados e referências. Não apresentar resultados como obtidos.",
  "relatório": "Contexto, objetivos, local/instituição e período quando disponíveis, atividades efetivamente informadas, procedimentos, análise, conclusão e recomendações. Não inventar atividades realizadas.",
  "artigo científico": "Título, resumo, palavras-chave, introdução, metodologia quando aplicável, discussão, resultados apenas com dados reais, conclusão e referências. Evitar capa e capítulos de monografia salvo pedido expresso.",
  "seminário": "Conteúdo preparado para exposição oral: introdução, objetivos, tópicos claros, exemplos pertinentes, síntese, conclusão e referências; evitar monografia extensa.",
  "revisão bibliográfica": "Questão/objetivo, método bibliográfico quando conhecido, secções temáticas, síntese crítica de fontes verificáveis, lacunas, conclusão e referências. Não inventar artigos ou autores.",
  "estudo de caso": "Contexto do caso baseado nos dados fornecidos, problema, objetivos, enquadramento teórico, metodologia, análise, discussão, conclusões e recomendações. Assinalar dados em falta.",
  "dissertação": "Estrutura ajustada ao grau e às normas: introdução, problema, objetivos, revisão crítica, metodologia, resultados apenas com dados válidos, discussão, conclusão e referências. Não simular investigação.",
  "tcc": "Estrutura de trabalho de conclusão de curso adaptada ao curso e às normas: introdução, problema, objetivos, justificativa, fundamentação, metodologia, análise, conclusão e referências. Não inventar resultados.",
};

function workTypeGuidance(type: string) {
  return WORK_TYPE_GUIDANCE[type.trim().toLocaleLowerCase("pt")] ?? WORK_TYPE_GUIDANCE["trabalho científico"];
}

function buildPrompt(w: Record<string, unknown>) {
  const opt = (w['options'] ?? {}) as Record<string, boolean>;
  const f = (k: string) => (w[k] ? String(w[k]) : "—");
  const isGroup = String(w['work_mode'] ?? "individual") === "grupo";
  const manualRefs = String(w['references_mode'] ?? "automatica") === "manual";

  return `És um assistente académico especialista. Escreve um trabalho académico COMPLETO em ${f("language")}, do tipo "${f("work_type")}", nível ${f("academic_level")}, seguindo rigorosamente as normas ${f("norms")}. A estrutura deve corresponder ao formato selecionado e não a um modelo genérico. Usa a amostra da RuJe IA apenas para regras visuais quando forem adequadas; não forces capa, índice ou capítulos de monografia em artigos, relatórios ou seminários.

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

INSTRUÇÕES ESPECÍFICAS DO FORMATO SELECIONADO:\n${workTypeGuidance(f("work_type"))}\n\nESTRUTURA BASE FLEXÍVEL: aplica apenas os elementos adequados ao tipo selecionado; não forces uma estrutura única.
${opt['cover'] === false ? "" : `CAPA E FOLHA DE ROSTO: inclui apenas quando forem adequadas ao formato. Usa dados fornecidos e omite campos vazios; não acrescentes páginas pré-textuais a artigos curtos ou seminários quando não forem apropriadas.\n`}${opt['index'] === false ? "" : "ÍNDICE: inclui apenas quando o documento for suficientemente extenso e adequado; lista somente títulos escritos.\n"}
ORGANIZAÇÃO DO CORPO: segue a estrutura específica indicada acima. Não imponhas automaticamente introdução + objetivos + metodologia + capítulos + conclusão a todos os tipos. Cria secções, páginas novas, anexos ou recomendações apenas quando fizerem sentido. Usa títulos <h1>, subtítulos <h2>/<h3> e separadores de página entre blocos completos quando o documento for extenso.

REFERÊNCIAS BIBLIOGRÁFICAS:
${manualRefs
  ? `- O utilizador escolheu REFERÊNCIAS MANUAIS. Usa EXACTAMENTE e apenas as referências indicadas abaixo, formatando-as segundo as normas ${f("norms")}, e cita-as no corpo do texto:\n${f("manual_references")}`
  : `- Usa apenas referências verificáveis e reais que conheças com confiança. Não inventes autores, títulos, editoras, anos ou DOI. Se não conseguires verificar referências, declara essa limitação e prioriza fontes fornecidas pelo utilizador ou pesquisa externa disponível. Formata as referências segundo as normas ${f("norms")}${opt['citations'] === false ? "" : ", com citações no corpo do texto (Autor, ano)"}.`}

REGRAS DE SAÍDA:
- Devolve APENAS HTML simples do corpo do documento: <h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>, <table>, <tr>, <td>, <strong>, <em>. Sem markdown, sem \`\`\`, sem <html>, <head> ou <body>, sem comentários.
- Cada secção principal usa <h1>; subtítulos usam <h2>/<h3>. Parágrafos completos de 4 a 7 linhas, justificados, sem frases soltas.
- SEPARAÇÃO EM PÁGINAS OBRIGATÓRIA: separa cada página com exactamente <hr class="page-break">, sempre ENTRE blocos completos, nunca dentro de parágrafos, listas ou tabelas. Capa, folha de rosto e índice são uma página cada; a introdução, a conclusão e a bibliografia começam em página nova. Cerca de 250 a 320 palavras por página no desenvolvimento, até aproximadamente ${f("pages")} páginas no total. Não escrevas números de página.
- Na capa e folha de rosto usa <div class="sample-cover"> com <p> para cada linha e espaços entre blocos com <p>&nbsp;</p>, como na amostra impressa; na folha de rosto a tabela de membros e docente fica fora do div centrado ou com class="rosto". Omite os campos vazios, sem inventar nomes ou imprimir "—".
- Na introdução contextualiza o tema, apresenta a questão central e anuncia os capítulos. Organiza o desenvolvimento com argumentação progressiva e transições naturais. O índice deve listar apenas títulos efetivamente escritos e nunca páginas fictícias. Mantém uma bibliografia específica ao assunto; não inventes obras, datas ou autores de que não tenhas certeza.
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



const GenerateIllustrationInput = z.object({
  prompt: z.string().trim().min(5).max(800),
});

export const generateIllustration = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => GenerateIllustrationInput.parse(d))
  .handler(async ({ data, context }) => {
    const access = await resolveAccess(context.supabase, context.userId);
    if (!access.isAdmin && !access.hasAccess) {
      throw new Error("Precisa de um plano activo para gerar imagens.");
    }

    const { geminiKey } = readKeys();
    if (!geminiKey) {
      throw new Error("A geração de imagens requer uma GEMINI_API_KEY válida nas variáveis de ambiente da Vercel.");
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Cria uma ilustração original, adequada a um documento académico. Não incluas texto, letras, marcas de água nem logótipos. Pedido: " + data.prompt }] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
        }),
      },
    );

    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 250);
      console.error("[IA imagens] Falha Gemini:", response.status, detail);
      if (response.status === 400 || response.status === 403) {
        throw new Error("O modelo de geração de imagens não está disponível para esta chave ou projeto Google. Verifique o acesso à API Gemini.");
      }
      if (response.status === 429) throw new Error("Limite de geração de imagens atingido. Tente novamente mais tarde.");
      throw new Error("Não foi possível gerar a imagem neste momento.");
    }

    const result = await response.json() as {
      candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string }; text?: string }[] } }[];
    };
    const image = result.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
    if (!image?.data || !image.mimeType?.startsWith("image/")) {
      throw new Error("A IA não devolveu uma imagem. Tente reformular a descrição.");
    }
    return { dataUrl: `data:${image.mimeType};base64,${image.data}`, mimeType: image.mimeType };
  });
