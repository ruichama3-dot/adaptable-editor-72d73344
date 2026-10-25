import { splitPages } from "@/lib/doc-pages";

type Slide = { title: string; paragraphs: string[] };

function xmlEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function documentSlides(html: string): Slide[] {
  const slides: Slide[] = [];
  for (const page of splitPages(html)) {
    const node = document.createElement("div");
    node.innerHTML = page;
    const elements = Array.from(node.querySelectorAll("h1,h2,h3,p,li,td"));
    let sectionTitle = "";
    let bullets: string[] = [];
    const flush = () => {
      for (let i = 0; i < bullets.length; i += 5) {
        const chunk = bullets.slice(i, i + 5);
        if (sectionTitle || chunk.length) slides.push({ title: sectionTitle || "RuJe IA — Apresentação", paragraphs: chunk });
      }
      bullets = [];
    };
    for (const element of elements) {
      const text = (element.textContent ?? "").replace(/\\s+/g, " ").trim();
      if (!text) continue;
      if (/^H[1-3]$/.test(element.tagName)) {
        flush();
        sectionTitle = text.slice(0, 100);
      } else {
        const words = text.split(/\\s+/);
        let line = "";
        for (const word of words) {
          if ((line + " " + word).trim().length > 100 && line) { bullets.push(line); line = word; }
          else line = (line + " " + word).trim();
        }
        if (line) bullets.push(line);
      }
    }
    flush();
  }
  return slides.length ? slides : [{ title: "Apresentação RuJe IA", paragraphs: ["Adicione conteúdo ao documento para gerar uma apresentação."] }];
}

function crc32(bytes: Uint8Array) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}

function zipStore(files: { name: string; text: string }[]): Blob {
  const encoder = new TextEncoder();
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const u16 = (v: number) => [v & 255, (v >>> 8) & 255];
  const u32 = (v: number) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.text);
    const crc = crc32(data);
    const header = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0),
      ...name, ...data,
    ]);
    local.push(header);
    const directory = new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0),
      ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name,
    ]);
    central.push(directory);
    offset += header.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
    ...u32(centralSize), ...u32(offset), ...u16(0),
  ]);
  return new Blob([...local, ...central, end], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}

function slideXml(slide: Slide, index: number) {
  const title = xmlEscape(slide.title);
  const body = slide.paragraphs.map((line) => `<a:p><a:pPr lvl="0"><a:buChar char="•"/></a:pPr><a:r><a:rPr lang="pt-PT" sz="1900"/><a:t xml:space="preserve">${xmlEscape(line)}</a:t></a:r><a:endParaRPr lang="pt-PT"/></a:p>`).join("");
  const shape = (id: number, name: string, x: number, y: number, cx: number, cy: number, text: string) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720"/><a:lstStyle/>${text}</p:txBody></p:sp>`;
  const titleBody = `<a:p><a:pPr algn="l"/><a:r><a:rPr lang="pt-PT" sz="3000" b="1" dirty="0"/><a:t>${title}</a:t></a:r><a:endParaRPr lang="pt-PT"/></a:p>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shape(2, `Title ${index}`, 500000, 250000, 8200000, 850000, titleBody)}${shape(3, `Content ${index}`, 550000, 1250000, 8100000, 3850000, body)}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}
export async function downloadPowerPoint(title: string, html: string) {
  const slides = documentSlides(html);
  const files: { name: string; text: string }[] = [
    { name: "[Content_Types].xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("")}</Types>` },
    { name: "_rels/.rels", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>` },
    { name: "ppt/presentation.xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join("")}</p:sldIdLst><p:sldSz cx="9144000" cy="5143500" type="wide"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>` },
    { name: "ppt/_rels/presentation.xml.rels", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${slides.map((_, i) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join("")}</Relationships>` },
    { name: "ppt/slideMasters/slideMaster1.xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap accent1="4472C4" accent2="ED7D31" accent3="A5A5A5" accent4="FFC000" accent5="5B9BD5" accent6="70AD47" bg1="lt1" bg2="lt2" tx1="dk1" tx2="dk2" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>` },
    { name: "ppt/slideMasters/_rels/slideMaster1.xml.rels", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>` },
    { name: "ppt/slideLayouts/slideLayout1.xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>` },
    { name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>` },
    { name: "ppt/theme/theme1.xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="RuJe IA"><a:themeElements><a:clrScheme name="RuJe"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="173F35"/></a:dk2><a:lt2><a:srgbClr val="F7F9F8"/></a:lt2><a:accent1><a:srgbClr val="1F6B52"/></a:accent1><a:accent2><a:srgbClr val="70AD47"/></a:accent2><a:accent3><a:srgbClr val="4472C4"/></a:accent3><a:accent4><a:srgbClr val="ED7D31"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="A5A5A5"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="RuJe"><a:majorFont><a:latin typeface="Aptos Display"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme><a:fmtScheme name="RuJe"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>` },
    ...slides.map((slide, i) => ({ name: `ppt/slides/slide${i + 1}.xml`, text: slideXml(slide, i + 1) })),
    ...slides.map((_, i) => ({ name: `ppt/slides/_rels/slide${i + 1}.xml.rels`, text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>` })),
  ];
  const blob = zipStore(files);
  const safe = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").trim().slice(0, 90) || "apresentacao-ruje-ia";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safe}.pptx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
