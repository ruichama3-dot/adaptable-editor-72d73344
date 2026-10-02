import { splitPages } from "@/lib/doc-pages";

/** A real OOXML document so Word, Google Docs and mobile editors can modify it. */
export async function createWordDocument(html: string): Promise<Blob> {
  const {
    AlignmentType, BorderStyle, Document, HeadingLevel, ImageRun, LevelFormat,
    Packer, PageBreak, Paragraph, Table, TableCell, TableRow, TextRun, WidthType,
  } = await import("docx");

  type Child = InstanceType<typeof Paragraph> | InstanceType<typeof Table>;
  type Run = InstanceType<typeof TextRun> | InstanceType<typeof ImageRun>;
  const contentWidth = 9026; // A4, 2 cm on each side, in twentieths of a point
  const border = { style: BorderStyle.SINGLE, size: 4, color: "C8C8C8" };
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

  async function runs(node: Node, bold = false, italics = false): Promise<Run[]> {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.replace(/\s+/g, " ") ?? "";
      return text ? [new TextRun({ text, bold, italics })] : [];
    }
    if (!(node instanceof Element)) return [];
    const tag = node.tagName.toLowerCase();
    if (tag === "br") return [new TextRun({ break: 1 })];
    if (tag === "img") {
      const src = node.getAttribute("src");
      if (!src) return [];
      try {
        const response = await fetch(src);
        if (!response.ok) return [];
        const type = response.headers.get("content-type")?.split(";")[0];
        if (type !== "image/png" && type !== "image/jpeg" && type !== "image/gif" && type !== "image/bmp") return [];
        const bytes = await response.arrayBuffer();
        const image = node as HTMLImageElement;
        const ratio = image.naturalWidth && image.naturalHeight ? image.naturalHeight / image.naturalWidth : 0.75;
        const width = Math.min(image.naturalWidth || 500, 480);
        return [new ImageRun({ type: type === "image/jpeg" ? "jpg" : type.split("/")[1] as "png" | "gif" | "bmp", data: bytes, transformation: { width, height: Math.round(width * ratio) }, altText: { title: image.alt || "Imagem", description: image.alt || "Imagem do trabalho", name: "Imagem" } })];
      } catch { return []; }
    }
    const result: Run[] = [];
    for (const child of node.childNodes) result.push(...await runs(child, bold || ["strong", "b"].includes(tag), italics || ["em", "i"].includes(tag)));
    return result;
  }

  async function paragraph(element: Element, options: { centered?: boolean; list?: "bullets" | "numbers"; level?: number } = {}) {
    const tag = element.tagName.toLowerCase();
    const heading = tag === "h1" ? HeadingLevel.HEADING_1 : tag === "h2" ? HeadingLevel.HEADING_2 : tag === "h3" ? HeadingLevel.HEADING_3 : undefined;
    const centered = options.centered || element.getAttribute("style")?.includes("text-align:center");
    const children = await runs(element);
    return new Paragraph({
      heading,
      children: children.length ? children : [new TextRun(" ")],
      alignment: centered ? AlignmentType.CENTER : heading ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
      spacing: { after: heading ? 200 : 140, line: 360 },
      keepNext: Boolean(heading),
      numbering: options.list ? { reference: options.list, level: options.level ?? 0 } : undefined,
    });
  }

  async function table(element: Element): Promise<InstanceType<typeof Table>> {
    const rows = Array.from(element.querySelectorAll("tr"));
    const columns = Math.max(1, ...rows.map((row) => row.children.length));
    const columnWidths = Array.from({ length: columns }, () => Math.floor(contentWidth / columns));
    columnWidths[columns - 1] += contentWidth - columnWidths.reduce((sum, value) => sum + value, 0);
    const isTitlePage = element.classList.contains("rosto");
    return new Table({
      width: { size: contentWidth, type: WidthType.DXA }, columnWidths,
      borders: Object.fromEntries(["top", "bottom", "left", "right", "insideHorizontal", "insideVertical"].map((side) => [side, isTitlePage ? noBorder : border])),
      rows: await Promise.all(rows.map(async (row) => new TableRow({ children: await Promise.all(Array.from(row.children).map(async (cell, index) => new TableCell({
        width: { size: columnWidths[index] ?? columnWidths[0], type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [await paragraph(cell, { centered: isTitlePage && index === columns - 1 })],
      }))) }))),
    });
  }

  async function blocks(parent: Element, centered = false): Promise<Child[]> {
    const result: Child[] = [];
    for (const element of Array.from(parent.children)) {
      const tag = element.tagName.toLowerCase();
      if (tag === "table") result.push(await table(element));
      else if (tag === "ul" || tag === "ol") {
        for (const item of Array.from(element.children)) result.push(await paragraph(item, { list: tag === "ul" ? "bullets" : "numbers" }));
      } else if (tag === "div" || tag === "section") result.push(...await blocks(element, centered || element.classList.contains("sample-cover")));
      else if (tag === "br") result.push(new Paragraph({ children: [new TextRun(" ")] }));
      else result.push(await paragraph(element, { centered }));
    }
    return result;
  }

  const children: Child[] = [];
  for (const [index, page] of splitPages(html).entries()) {
    if (index) children.push(new Paragraph({ children: [new PageBreak()] }));
    const container = document.createElement("div");
    container.innerHTML = page;
    children.push(...await blocks(container));
  }

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Times New Roman", size: 24 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 32, bold: true, font: "Times New Roman" }, paragraph: { spacing: { before: 240, after: 180 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 28, bold: true, font: "Times New Roman" }, paragraph: { spacing: { before: 180, after: 140 }, outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 26, bold: true, font: "Times New Roman" }, paragraph: { spacing: { before: 140, after: 100 }, outlineLevel: 2 } },
      ],
    },
    numbering: { config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ] },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children: children.length ? children : [new Paragraph("")] }],
  });
  return Packer.toBlob(doc);
}