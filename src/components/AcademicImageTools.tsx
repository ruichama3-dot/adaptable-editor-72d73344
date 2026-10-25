import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateIllustration } from "@/lib/works.functions";

type ImageItem = { title: string; url: string; page: string; author: string; license: string };

export function AcademicImageTools({ onInsert }: { onInsert: (html: string) => void }) {
  const [mode, setMode] = useState<"search" | "generate" | null>(null);
  const [query, setQuery] = useState("");
  const [prompt, setPrompt] = useState("");
  const [results, setResults] = useState<ImageItem[]>([]);
  const [busy, setBusy] = useState(false);
  const generate = useServerFn(generateIllustration);
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  async function search() {
    if (!query.trim()) { toast.error("Escreva o que pretende pesquisar."); return; }
    setBusy(true);
    try {
      const params = new URLSearchParams({ action: "query", generator: "search", gsrsearch: query.trim(), gsrnamespace: "6", gsrlimit: "8", gsrwhat: "text", prop: "imageinfo|info", iiprop: "url|extmetadata", iiurlwidth: "700", inprop: "url", format: "json", origin: "*" });
      const response = await fetch("https://commons.wikimedia.org/w/api.php?" + params.toString());
      if (!response.ok) throw new Error("A pesquisa está temporariamente indisponível.");
      const json = await response.json() as { query?: { pages?: Record<string, { title?: string; imageinfo?: { thumburl?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }[] }> } };
      const plain = (value?: string) => (value ?? "").replace(/<[^>]*>/g, "").replace(/&quot;/g, '"' ).replace(/&#039;/g, "'").replace(/&amp;/g, "&").trim();
      const items = Object.values(json.query?.pages ?? {}).flatMap((page) => {
        const info = page.imageinfo?.[0];
        if (!info?.thumburl || !info.descriptionurl) return [];
        return [{ title: (page.title ?? "Imagem").replace(/^File:/, ""), url: info.thumburl, page: info.descriptionurl, author: plain(info.extmetadata?.Artist?.value) || "Autor não indicado", license: plain(info.extmetadata?.LicenseShortName?.value) || "Consultar licença na fonte" }];
      });
      setResults(items);
      if (!items.length) toast.info("Não foram encontradas imagens. Tente outros termos.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Falha na pesquisa."); }
    finally { setBusy(false); }
  }

  async function create() {
    if (prompt.trim().length < 5) { toast.error("Descreva a imagem com pelo menos 5 caracteres."); return; }
    setBusy(true);
    try {
      const result = await generate({ data: { prompt: prompt.trim() } });
      onInsert("<p><img src=\"" + result.dataUrl + "\" alt=\"" + escape(prompt) + "\" style=\"max-width:100%;height:auto\"></p><p><small>Ilustração gerada por IA na RuJe IA. Descrição: " + escape(prompt) + "</small></p>");
      setMode(null); setPrompt("");
      toast.success("Ilustração inserida. Guarde o documento.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível gerar a imagem."); }
    finally { setBusy(false); }
  }

  function insert(item: ImageItem) {
    onInsert("<p><img src=\"" + escape(item.url) + "\" alt=\"" + escape(item.title) + "\" style=\"max-width:100%;height:auto\"></p><p><small>Fonte: <a href=\"" + escape(item.page) + "\">" + escape(item.title) + "</a>. Autor: " + escape(item.author) + ". Licença: " + escape(item.license) + ".</small></p>");
    setMode(null); toast.success("Imagem e atribuição inseridas. Guarde o documento.");
  }

  return <div className="print:hidden">
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => { setMode(mode === "search" ? null : "search"); setResults([]); }}><Search className="mr-1 h-4 w-4" /> Pesquisar imagens</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => setMode(mode === "generate" ? null : "generate")}><Sparkles className="mr-1 h-4 w-4" /> Gerar imagem com IA</Button>
    </div>
    {mode && <section className="mt-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{mode === "search" ? "Wikimedia Commons — pesquisa de imagens" : "Gerar ilustração com IA"}</h3><Button type="button" size="icon" variant="ghost" onClick={() => setMode(null)} aria-label="Fechar"><X className="h-4 w-4" /></Button></div>
      {mode === "search" ? <><p className="text-muted-foreground mt-1 text-sm">Verifique a licença na fonte antes de reutilizar. A atribuição será adicionada ao documento.</p><form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); void search(); }}><input className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: sistema solar, agricultura em Moçambique" /><Button type="submit" disabled={busy}>{busy ? "A pesquisar…" : "Pesquisar"}</Button></form>
        {results.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2">{results.map((item) => <article key={item.page} className="rounded-lg border border-border p-3"><img src={item.url} alt={item.title} loading="lazy" className="h-36 w-full rounded bg-muted object-contain" /><p className="mt-2 text-sm font-semibold">{item.title}</p><p className="text-muted-foreground text-xs">Autor: {item.author}</p><p className="text-muted-foreground text-xs">Licença: {item.license}</p><div className="mt-2 flex gap-3"><Button size="sm" onClick={() => insert(item)}>Inserir</Button><a href={item.page} target="_blank" rel="noreferrer" className="text-primary self-center text-sm underline">Fonte/licença</a></div></article>)}</div>}</>
        : <><p className="text-muted-foreground mt-1 text-sm">A disponibilidade depende do acesso da chave Gemini ao modelo de imagens.</p><textarea className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" rows={3} maxLength={800} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Descreva a ilustração pretendida…" /><Button className="mt-2" disabled={busy} onClick={() => void create()}><Sparkles className="mr-1 h-4 w-4" />{busy ? "A gerar…" : "Gerar e inserir"}</Button></>}
    </section>}
  </div>;
}
