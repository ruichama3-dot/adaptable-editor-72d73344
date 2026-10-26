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
  const includeImages = opt["includeImages"] === true;
  const outputFormat = opt["outputFormat"] === "powerpoint" ? "powerpoint" : "normal";
  const formatInstruction = outputFormat === "powerpoint"
    ? "FORMATO POWERPOINT: gera apenas o conteúdo para uma apresentação profissional com até 30 diapositivos, conforme a extensão do tema. NÃO incluas índice, capa extensa, folha de rosto, numeração de páginas nem parágrafos longos. O primeiro diapositivo é uma capa simples com o título e, se fornecidos, estudante/instituição. Os restantes resumem o desenvolvimento do tema em sequência lógica, com títulos objetivos e 3 a 5 pontos breves por diapositivo. Termina com síntese/conclusão; inclui referências apenas de forma compacta quando forem relevantes. Cada diapositivo deve ter conteúdo conciso, claro e próprio para exposição oral."
    : "FORMATO NORMAL: segue de perto a amostra oficial RuJe IA 'Escola Clássica da Economia' no estilo e organização, sem copiar o conteúdo: capa centrada, folha de rosto, índice, introdução, desenvolvimento com títulos e subtítulos hierárquicos, conclusão e bibliografia. Usa <div class=\"sample-cover\"> nas páginas de capa/rosto, <hr class=\"page-break\"> entre páginas, e inicia introdução, conclusão e bibliografia em página nova. Usa apenas dados fornecidos; o índice deve refletir títulos reais. Mantém a estrutura específica do tipo escolhido, mas conserva o mesmo padrão visual da amostra.";
  const imageInstruction = includeImages
    ? "O utilizador pediu imagens: NÃO cries uma secção geral de imagens nem as coloques no índice. As imagens serão inseridas automaticamente no desenvolvimento, junto da secção cujo conteúdo ilustram. Não inventes imagens nem atribuições."
    : "O utilizador pediu um documento sem imagens: não incluas imagens nem figuras.";

  return `És um assistente académico especialista em trabalhos usados em Moçambique. ${formatInstruction} ${imageInstruction} Escreve um resultado completo em ${f("language")}, do tipo "${f("work_type")}", nível ${f("academic_level")}, seguindo rigorosamente as normas ${f("norms")}. Não transformes automaticamente todos os tipos de trabalho em monografias.

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
${opt['cover'] === false ? "" : `CAPA E FOLHA DE ROSTO: inclui apenas quando forem adequadas ao formato. Usa dados fornecidos e omite campos vazios; não acrescentes páginas pré-textuais a artigos curtos ou seminários quando não forem apropriadas.\n`}${outputFormat === "powerpoint" ? "" : (opt['index'] === false ? "" : "ÍNDICE: inclui apenas quando o documento for suficientemente extenso e adequado; lista somente títulos escritos.\n")}
ORGANIZAÇÃO DO CORPO: segue a estrutura específica indicada acima. Não imponhas automaticamente introdução + objetivos + metodologia + capítulos + conclusão a todos os tipos. Cria secções, páginas novas, anexos ou recomendações apenas quando fizerem sentido. Usa títulos <h1>, subtítulos <h2>/<h3> e separadores de página entre blocos completos quando o documento for extenso.

REFERÊNCIAS BIBLIOGRÁFICAS:
${manualRefs
  ? `- O utilizador escolheu REFERÊNCIAS MANUAIS. Usa EXACTAMENTE e apenas as referências indicadas abaixo, formatando-as segundo as normas ${f("norms")}, e cita-as no corpo do texto:\n${f("manual_references")}`
  : `- Usa apenas referências verificáveis e reais que conheças com confiança. Não inventes autores, títulos, editoras, anos ou DOI. Se não conseguires verificar referências, declara essa limitação e prioriza fontes fornecidas pelo utilizador ou pesquisa externa disponível. Formata as referências segundo as normas ${f("norms")}${opt['citations'] === false ? "" : ", com citações no corpo do texto (Autor, ano)"}.`}

REGRAS DE SAÍDA:
- Devolve APENAS HTML simples do corpo do documento: <h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>, <table>, <tr>, <td>, <strong>, <em>. Sem markdown, sem \`\`\`, sem <html>, <head> ou <body>, sem comentários.
- No formato normal, cada secção principal usa <h1>, subtítulos usam <h2>/<h3> e os parágrafos são completos, justificados e académicos. No PowerPoint, produz até 30 diapositivos, cada um com título claro e 3 a 5 pontos curtos, sem índice nem parágrafos longos.
- PAGINAÇÃO: se outputFormat for normal, separa páginas com exactamente <hr class="page-break"> entre blocos completos; capa, folha de rosto e índice ficam em páginas separadas, e introdução, conclusão e bibliografia começam em página nova. Se outputFormat for powerpoint, não uses separadores de página, índice, folha de rosto extensa ou conteúdo de paginação; organiza somente os pontos essenciais para até 30 diapositivos.
- No formato normal, usa capa e folha de rosto no estilo da amostra com <div class="sample-cover">, quando adequadas. Omite campos vazios e não inventes nomes. No PowerPoint, não cries páginas de capa/rosto extensas.
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
    throw new Error(
      "O serviço de IA ainda não está configurado. O administrador deve adicionar uma GEMINI_API_KEY ou LOVABLE_API_KEY válida em Vercel → Project Settings → Environment Variables e voltar a publicar.",
    );
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


function escapeImageHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function findAcademicImages(topic: string, limit = 1): Promise<string> {
  try {
    const params = new URLSearchParams({
      action: "query", generator: "search", gsrsearch: topic, gsrnamespace: "6",
      gsrlimit: String(limit), prop: "imageinfo", iiprop: "url|extmetadata",
      iiurlwidth: "900", format: "json",
    });
    const response = await fetch("https://commons.wikimedia.org/w/api.php?" + params.toString(), {
      headers: { "User-Agent": "RuJeIA/1.0 (academic document image attribution)" },
    });
    if (!response.ok) return "";
    const data = await response.json() as {
      query?: { pages?: Record<string, { title?: string; imageinfo?: Array<{ thumburl?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }> }> };
    };
    const plain = (value?: string) => (value ?? "").replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&").trim();
    return Object.values(data.query?.pages ?? {}).flatMap((page) => {
      const info = page.imageinfo?.[0];
      if (!info?.thumburl || !info.descriptionurl) return [];
      const title = (page.title ?? "Imagem").replace(/^File:/, "");
      const author = plain(info.extmetadata?.Artist?.value) || "Autor não indicado";
      const license = plain(info.extmetadata?.LicenseShortName?.value) || "Consultar licença na fonte";
      return ['<figure class="academic-image"><img src="' + escapeImageHtml(info.thumburl) + '" alt="' + escapeImageHtml(title) + '" style="max-width:100%;height:auto"><figcaption><small>Figura: ' + escapeImageHtml(title) + '. Fonte: <a href="' + escapeImageHtml(info.descriptionurl) + '">' + escapeImageHtml(info.descriptionurl) + '</a>. Autor: ' + escapeImageHtml(author) + '. Licença: ' + escapeImageHtml(license) + '.</small></figcaption></figure>'];
    }).join("\n");
  } catch (error) {
    console.warn("[IA imagens] A pesquisa falhou; o trabalho será gerado sem imagens.", error);
    return "";
  }
}

function buildAutomaticIndex(html: string): string {
  let pages = html.split(/<hr\b[^>]*class=["']page-break["'][^>]*>/i);
  const headingPattern = /<h([1-3])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;
  const cleanText = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
  const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const headings: Array<{ level: number; title: string; page: number; id: string }> = [];
  let indexPage = -1;
  pages.forEach((page, pageIndex) => {
    const firstHeading = page.match(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i);
    if (firstHeading && /^(índice|indice|sumário|sumario|table of contents)$/i.test(cleanText(firstHeading[1]))) indexPage = pageIndex;
    let match: RegExpExecArray | null;
    headingPattern.lastIndex = 0;
    while ((match = headingPattern.exec(page))) {
      const title = cleanText(match[3]);
      if (!title || /^(índice|indice|sumário|sumario|table of contents)$/i.test(title)) continue;
      headings.push({ level: Number(match[1]), title, page: pageIndex + 1, id: "ruje-sec-" + (headings.length + 1) });
    }
  });
  if (!headings.length) return html;
  let headingNumber = 0;
  pages = pages.map((page) => page.replace(headingPattern, (full, level: string, attrs: string, inner: string) => {
    const title = cleanText(inner);
    if (!title || /^(índice|indice|sumário|sumario|table of contents)$/i.test(title)) return full;
    headingNumber += 1;
    return "<h" + level + attrs + ' id="ruje-sec-' + headingNumber + '">' + inner + "</h" + level + ">";
  }));
  if (indexPage >= 0) {
    const indexHeading = pages[indexPage].match(/<h[1-3]\b[^>]*>[\s\S]*?<\/h[1-3]>/i)?.[0] ?? "<h1>Índice</h1>";
    const rows = headings.map((item) => '<li style="margin:0.35em 0;padding-left:' + ((item.level - 1) * 1.2) + 'em"><a href="#' + item.id + '" style="color:inherit;text-decoration:none">' + esc(item.title) + '</a><span style="float:right">' + item.page + "</span></li>").join("");
    pages[indexPage] = indexHeading + '<ol class="ruje-automatic-index" style="list-style:none;padding:0">' + rows + "</ol>";
  }
  return pages.join('<hr class="page-break">');
}

async function insertRelevantImages(html: string, theme: string): Promise<{ html: string; count: number }> {
  const chunks = html.split(/(?=<h[1-3]\b)/i);
  const output: string[] = [];
  let count = 0;
  for (const chunk of chunks) {
    const heading = chunk.match(/^<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i);
    if (!heading || count >= 3) {
      output.push(chunk);
      continue;
    }
    const title = heading[1].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (/^(índice|indice|introdução|introducao|conclusão|conclusao|bibliografia|referências|referencias|resumo|abstract|palavras-chave)/i.test(title)) {
      output.push(chunk);
      continue;
    }
    const pageBreakAt = chunk.indexOf('<hr class="page-break">');
    const section = pageBreakAt >= 0 ? chunk.slice(0, pageBreakAt) : chunk;
    const firstParagraph = /<p\b[^>]*>[\s\S]*?<\/p>/i.exec(section);
    if (!firstParagraph || section.length < heading[0].length + 40) {
      output.push(chunk);
      continue;
    }
    const images = await findAcademicImages(theme + " " + title, 1);
    if (!images) {
      output.push(chunk);
      continue;
    }
    const insertAt = firstParagraph.index + firstParagraph[0].length;
    output.push(chunk.slice(0, insertAt) + "\n" + images + "\n" + chunk.slice(insertAt));
    count++;
  }
  return { html: output.join(""), count };
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

    const workOptions = (work.options ?? {}) as Record<string, unknown>;
    const includeImages = workOptions.includeImages === true;
    const outputFormat = workOptions.outputFormat === "powerpoint" ? "powerpoint" : "normal";
    const rawContent = await callAI(buildPrompt(work as Record<string, unknown>));

    let html = rawContent
      .replace(/^\`\`\`(?:html)?/i, "")
      .replace(/\`\`\`$/i, "")
      .trim();
    if (!html) throw new Error(BUSY_MSG);

    if (outputFormat === "normal") html = buildAutomaticIndex(html);

    let imagesAdded = 0;
    if (includeImages && outputFormat === "normal") {
      const inserted = await insertRelevantImages(html, String(work.theme ?? work.title ?? "educação"));
      html = inserted.html;
      imagesAdded = inserted.count;
    }

    const { error: upErr } = await context.supabase
      .from("works")
      .update({ content: html })
      .eq("id", data.workId);
    if (upErr) throw new Error(upErr.message);

    return { content: html, imagesAdded, outputFormat };
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
