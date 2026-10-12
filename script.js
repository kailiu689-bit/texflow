const sourceText = document.querySelector("#sourceText");
const preview = document.querySelector("#preview");
const charCount = document.querySelector("#charCount");
const paragraphCount = document.querySelector("#paragraphCount");
const inputState = document.querySelector("#inputState");
const previewState = document.querySelector("#previewState");
const formatButton = document.querySelector("#formatButton");
const insertBoxButton = document.querySelector("#insertBoxButton");
const copyButton = document.querySelector("#copyButton");
const loadDemo = document.querySelector("#loadDemo");
const highlightToggle = document.querySelector("#highlightToggle");
const fileInput = document.querySelector("#fileInput");
const fileStatus = document.querySelector("#fileStatus");
const resultPane = document.querySelector("#resultPane");
const fullscreenButton = document.querySelector("#fullscreenButton");
const exportButton = document.querySelector("#exportButton");
const exportMdButton = document.querySelector("#exportMdButton");
const formatToolbar = document.querySelector(".format-toolbar");
const textColorSelect = document.querySelector("#textColorSelect");
const highlightColorSelect = document.querySelector("#highlightColorSelect");
const tocButton = document.querySelector("#tocButton");
const tocPopover = document.querySelector("#tocPopover");
const taskMask = document.querySelector("#taskMask");
const themeChips = document.querySelectorAll("[data-theme]");
const paletteDots = document.querySelectorAll("[data-palette]");
const fontFamilySelect = document.querySelector("#fontFamilySelect");
const fontSizeSelect = document.querySelector("#fontSizeSelect");
const lineHeightSelect = document.querySelector("#lineHeightSelect");
const headingStyleSelect = document.querySelector("#headingStyleSelect");
const boxStyleSelect = document.querySelector("#boxStyleSelect");
const bodyStyleSelect = document.querySelector("#bodyStyleSelect");
const imageStyleSelect = document.querySelector("#imageStyleSelect");
const dividerStyleSelect = document.querySelector("#dividerStyleSelect");
const paragraphGapSelect = document.querySelector("#paragraphGapSelect");
const pagePaddingSelect = document.querySelector("#pagePaddingSelect");

const demoText = `项目复盘：为什么排版影响转化

很多团队把内容生产看成写完就结束，但读者真正接触到的是最终版式。段落太长、标题层级不清、重点没有被标记时，再好的观点也会被埋掉。

1. 先建立结构
长文本要先拆成可扫描的段落。每一段只承载一个意思，读者才容易顺着逻辑往下走。

2. 再突出重点
结论、风险、行动建议应该被放到更明显的位置。这样团队成员不需要反复阅读，也能抓到下一步动作。

最后建议：把排版流程产品化，让每一次发布都稳定达到及格线以上。`;

let activeStyle = "wechat";
let formattedBlocks = [];
let pdfLibraryPromise;
let extractedAssets = [];
let importedBlocks = null;
let activeTheme = "long";
let activePalette = "#004038";
let headingIndex = 0;
let calloutIndex = 0;
let previewDirty = false;

const fontFamilies = {
  serif: '"Songti SC", "Noto Serif CJK SC", serif',
  song: '"Songti SC", "STSong", serif',
  hei: '"Hiragino Sans GB", "Noto Sans SC", sans-serif',
  kai: '"Kaiti SC", "STKaiti", serif',
};

const themePresets = {
  long: { heading: "bar", box: "gov", body: "formal", image: "frame", divider: "dots", palette: "#004038" },
  gov: { heading: "bar", box: "brief", body: "formal", image: "frame", divider: "solid", palette: "#2f69ff" },
  minimal: { heading: "plain", box: "none", body: "compact", image: "clean", divider: "solid", palette: "#151a1e" },
  digital: { heading: "numbered", box: "numbered", body: "card", image: "full", divider: "ribbon", palette: "#2f69ff" },
  block: { heading: "bar", box: "media", body: "card", image: "stack", divider: "solid", palette: "#00544c" },
  contrast: { heading: "stamp", box: "court", body: "compact", image: "frame", divider: "ribbon", palette: "#151a1e" },
};

function getPdfLibrary() {
  if (!pdfLibraryPromise) {
    pdfLibraryPromise = import("./vendor/pdf.mjs").then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "./vendor/pdf.worker.mjs";
      return pdfjsLib;
    });
  }

  return pdfLibraryPromise;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function stripMarkdownMarkers(text) {
  return text
    .replace(/^#{1,6}\s*/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .trim();
}

function textToSafeParagraphs(text) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function sanitizeStyleAttribute(styleText) {
  const allowedStyleProperties = new Set([
    "background",
    "background-color",
    "border",
    "border-bottom",
    "border-color",
    "border-left",
    "border-radius",
    "border-right",
    "border-style",
    "border-top",
    "border-width",
    "color",
    "display",
    "font-size",
    "font-style",
    "font-weight",
    "height",
    "line-height",
    "margin",
    "margin-bottom",
    "margin-left",
    "margin-right",
    "margin-top",
    "max-width",
    "padding",
    "padding-bottom",
    "padding-left",
    "padding-right",
    "padding-top",
    "text-align",
    "text-decoration",
    "width",
  ]);

  return styleText
    .split(";")
    .map((rule) => rule.trim())
    .filter(Boolean)
    .map((rule) => {
      const separatorIndex = rule.indexOf(":");
      if (separatorIndex === -1) return "";
      const property = rule.slice(0, separatorIndex).trim().toLowerCase();
      const value = rule.slice(separatorIndex + 1).trim();
      const normalizedValue = value.replace(/[\u0000-\u001f\u007f\s]+/g, "").toLowerCase();
      if (!allowedStyleProperties.has(property)) return "";
      if (
        /expression\s*\(|behavior\s*:|-moz-binding|-o-link|u\s*r\s*l\s*\(/i.test(value) ||
        normalizedValue.includes("javascript:") ||
        normalizedValue.includes("vbscript:") ||
        normalizedValue.includes("data:text")
      ) {
        return "";
      }
      return `${property}:${value}`;
    })
    .filter(Boolean)
    .join(";");
}

function isSafePastedUrl(value, attributeName) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const normalized = trimmed.replace(/[\u0000-\u001f\u007f\s]+/g, "").toLowerCase();
  if (/^(javascript|vbscript|file|data:text):/.test(normalized)) return false;

  if (attributeName === "src") {
    return (
      /^https?:\/\//i.test(trimmed) ||
      /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(trimmed) ||
      /^\/(?!\/)/.test(trimmed) ||
      /^\.\.?\//.test(trimmed)
    );
  }

  return /^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed) || /^tel:/i.test(trimmed) || /^#/.test(trimmed) || /^\/(?!\/)/.test(trimmed) || /^\.\.?\//.test(trimmed);
}

function sanitizePastedHtml(html) {
  const holder = document.createElement("div");
  holder.innerHTML = html;
  const allowedTags = new Set([
    "A",
    "ASIDE",
    "B",
    "BR",
    "DIV",
    "EM",
    "FIGURE",
    "H1",
    "H2",
    "H3",
    "H4",
    "HR",
    "I",
    "IMG",
    "LI",
    "OL",
    "P",
    "S",
    "SPAN",
    "STRONG",
    "TABLE",
    "TBODY",
    "TD",
    "TH",
    "TR",
    "U",
    "UL",
  ]);
  const allowedAttributes = new Set(["href", "src", "alt", "title", "style", "colspan", "rowspan"]);

  holder.querySelectorAll("script, style, iframe, object, embed, link, meta").forEach((node) => node.remove());

  Array.from(holder.querySelectorAll("*")).forEach((node) => {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...Array.from(node.childNodes));
      return;
    }

    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on") || !allowedAttributes.has(name)) {
        node.removeAttribute(attribute.name);
        return;
      }
      if ((name === "href" || name === "src") && !isSafePastedUrl(value, name)) {
        node.removeAttribute(attribute.name);
      }
      if (name === "style") {
        node.setAttribute("style", sanitizeStyleAttribute(value));
      }
    });
  });

  return holder.innerHTML;
}

function sanitizeLine(text) {
  return stripMarkdownMarkers(text).replace(/\s+/g, " ").trim();
}

function splitSentences(text) {
  return text
    .replace(/([。！？!?；;])\s*/g, "$1\n")
    .split(/\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function isHeading(line) {
  return (
    /^#{1,6}\s+/.test(line) ||
    /^(\d+\.|[一二三四五六七八九十]+[、.．]|第[一二三四五六七八九十\d]+[章节])/.test(line) ||
    (/[:：]$/.test(line) && line.length <= 28) ||
    (/[:：]/.test(line) && line.length <= 36 && !/[。！？!?；;]/.test(line)) ||
    (line.length <= 18 && !/[。！？!?]/.test(line))
  );
}

function shouldHighlight(sentence) {
  return /结论|建议|重点|风险|必须|应该|核心|关键|下一步|最后|因此|争议|问题|答案|提醒|注意|焦点/.test(sentence);
}

function getPaletteTint(color = activePalette) {
  const tints = {
    "#004038": "#d9e6e4",
    "#00544c": "#d9e8e6",
    "#2f69ff": "#dce6ff",
    "#151a1e": "#dedfe0",
    "#ad4f43": "#f0e2df",
    "#d4472f": "#f6dfda",
  };
  return tints[color.toLowerCase()] || "#e7eefc";
}

function shouldAutoBox(block, index, blocks) {
  if (boxStyleSelect.value === "none" || block.type !== "paragraph") return false;
  const text = block.text || "";
  const firstParagraphIndex = blocks.findIndex((item) => item.type === "paragraph");

  if (index === firstParagraphIndex && text.length >= 42 && text.length <= 160) return true;
  if (/^(核心|关键|焦点|争议|提醒|注意|建议|下一步)/.test(text) && text.length <= 140) return true;
  return false;
}

function getAutoBoxTitle(text, index, blocks) {
  const firstParagraphIndex = blocks.findIndex((item) => item.type === "paragraph");
  if (index === firstParagraphIndex) return "导语";
  if (/核心|关键|争议|问题|答案|焦点/.test(text)) return "重点";
  if (/建议|下一步|提醒|注意/.test(text)) return "提示";
  return "重点";
}

function isCalloutLine(line) {
  return /^【?(摘要|导语|编者按|核心提示|温馨提示|活动概况|提示|说明)】?[：:｜|]/.test(line);
}

function parseCalloutLine(line) {
  const match = line.match(/^【?(摘要|导语|编者按|核心提示|温馨提示|活动概况|提示|说明)】?[：:｜|]\s*(.+)$/);
  if (!match) return null;
  return { type: "callout", title: match[1], text: sanitizeLine(match[2]) };
}

function formatText(rawText) {
  const lines = rawText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks = [];
  let boxBuffer = null;

  function flushBoxBuffer() {
    if (!boxBuffer) return;
    const text = boxBuffer.lines.map(sanitizeLine).filter(Boolean).join("");
    if (text) {
      blocks.push({ type: "callout", title: boxBuffer.title, text });
    }
    boxBuffer = null;
  }

  lines.forEach((line) => {
    const cleanLine = sanitizeLine(line);
    if (!cleanLine) return;

    if (/^【文本框[:：]?/.test(line)) {
      flushBoxBuffer();
      const title = line.match(/^【文本框[:：]?\s*(.*?)】/)?.[1]?.trim() || "重点";
      boxBuffer = { title, lines: [] };
      return;
    }

    if (/^【\/文本框】$/.test(line)) {
      flushBoxBuffer();
      return;
    }

    if (boxBuffer) {
      boxBuffer.lines.push(line);
      return;
    }

    const callout = parseCalloutLine(cleanLine);
    if (callout) {
      blocks.push(callout);
      return;
    }

    if (isHeading(line) || isHeading(cleanLine)) {
      blocks.push({
        type: "heading",
        text: cleanLine.replace(/^(\d+\.|[一二三四五六七八九十]+[、.．])\s*/, ""),
      });
      return;
    }

    const sentences = splitSentences(cleanLine).map(stripMarkdownMarkers).filter(Boolean);
    for (let index = 0; index < sentences.length; index += 2) {
      blocks.push({ type: "paragraph", text: sentences.slice(index, index + 2).join("") });
    }
  });

  flushBoxBuffer();

  return blocks;
}

function renderPreview(blocks) {
  previewDirty = false;
  headingIndex = 0;
  calloutIndex = 0;
  applyPreviewClasses();

  if (!blocks.length) {
    preview.classList.add("empty");
    preview.innerHTML = extractedAssets.length
      ? renderAssetGallery()
      : "<p>排版后的内容会出现在这里。</p>";
    renderToc(blocks);
    return;
  }

  preview.classList.remove("empty");
  preview.innerHTML = renderMixedContent(blocks);
  renderToc(blocks);
}

function applyPreviewClasses() {
  preview.className = `preview result-panel active ${activeStyle} theme-${activeTheme} platform-wechat heading-${headingStyleSelect.value} box-${boxStyleSelect.value} body-${bodyStyleSelect.value} image-${imageStyleSelect.value} divider-${dividerStyleSelect.value}`;

  preview.classList.toggle("highlight-off", !highlightToggle.checked);
}

function renderTextBlock(block) {
  if (block.type === "image") {
    return renderAssetFigure(block.asset);
  }

  if (block.type === "divider") {
    return `<hr class="section-divider" />`;
  }

  if (block.type === "callout") {
    return renderCallout(block);
  }

  const cleanText = block.type === "heading" ? stripMarkdownMarkers(block.text) : block.text;
  const safeText = escapeHtml(cleanText);

  if (block.type === "heading") {
    headingIndex += 1;
    return `<h2 data-index="${String(headingIndex).padStart(2, "0")}">${safeText}</h2>`;
  }

  const highlighted = highlightToggle.checked && shouldHighlight(block.text)
    ? `<strong data-texflow-highlight="true">${safeText}</strong>`
    : safeText;

  return `<p>${highlighted}</p>`;
}

function renderCallout(block) {
  calloutIndex += 1;
  const title = stripMarkdownMarkers(block.title || "重点");
  const text = escapeHtml(stripMarkdownMarkers(block.text));
  if (boxStyleSelect.value === "none") {
    return `<p><strong>${escapeHtml(title)}：</strong>${text}</p>`;
  }
  return `
    <aside class="text-box" data-index="${calloutIndex}">
      <span>${escapeHtml(title)}</span>
      <p>${text}</p>
    </aside>
  `;
}

function renderAssetFigure(asset) {
  return `
    <figure class="inline-asset">
      <img src="${asset.src}" alt="${escapeHtml(asset.alt)}" />
    </figure>
  `;
}

function renderMixedContent(blocks) {
  const mixedBlocks = withDividers(withAutoBoxes(blocks));

  if (mixedBlocks.some((block) => block.type === "image")) {
    return mixedBlocks.map(renderTextBlock).join("");
  }

  if (!extractedAssets.length) {
    return mixedBlocks.map(renderTextBlock).join("");
  }

  const output = [];
  const insertEvery = Math.max(1, Math.ceil(mixedBlocks.length / extractedAssets.length));
  let assetIndex = 0;

  mixedBlocks.forEach((block, index) => {
    output.push(renderTextBlock(block));

    const shouldInsertAsset = (index + 1) % insertEvery === 0 && assetIndex < extractedAssets.length;
    if (shouldInsertAsset) {
      output.push(renderAssetFigure(extractedAssets[assetIndex]));
      assetIndex += 1;
    }
  });

  while (assetIndex < extractedAssets.length) {
    output.push(renderAssetFigure(extractedAssets[assetIndex]));
    assetIndex += 1;
  }

  return output.join("");
}

function withDividers(blocks) {
  if (dividerStyleSelect.value === "none") return blocks;
  const output = [];
  let headingCount = 0;

  blocks.forEach((block, index) => {
    if (block.type === "heading") {
      headingCount += 1;
      if (headingCount > 1 && index > 0) {
        output.push({ type: "divider" });
      }
    }
    output.push(block);
  });

  return output;
}

function withAutoBoxes(blocks) {
  let autoBoxCount = 0;
  const output = [];

  blocks.forEach((block, index) => {
    if (autoBoxCount < 2 && shouldAutoBox(block, index, blocks)) {
      autoBoxCount += 1;
      output.push({
        type: "callout",
        title: getAutoBoxTitle(block.text, index, blocks),
        text: block.text,
        auto: true,
      });
      return;
    }

    output.push(block);
  });

  return output;
}

function renderAssetGallery() {
  if (!extractedAssets.length) return "";

  return `
    <section class="asset-gallery" aria-label="附件图片">
      ${extractedAssets
        .map(
          (asset) => `
            <figure>
              <img src="${asset.src}" alt="${escapeHtml(asset.alt)}" />
            </figure>
          `,
        )
        .join("")}
    </section>
  `;
}

function renderToc(blocks) {
  const headings = previewDirty
    ? Array.from(preview.querySelectorAll("h2"), (node) => ({ text: node.textContent }))
    : blocks.filter((block) => block.type === "heading");

  tocPopover.innerHTML = headings.length
    ? headings.map((item, index) => `<button type="button" data-scroll-heading="${index}">${escapeHtml(item.text)}</button>`).join("")
    : "<p>暂无目录</p>";
}

function updateStats() {
  const text = sourceText.value.trim();
  const paragraphs = text ? text.split(/\n+/).filter(Boolean).length : 0;
  charCount.textContent = `${text.length} 字`;
  paragraphCount.textContent = `${paragraphs} 段`;
  inputState.textContent = text || importedBlocks ? "已输入" : "待输入";
}

function refresh() {
  updateStats();
  formattedBlocks = importedBlocks || formatText(sourceText.value);
  renderPreview(formattedBlocks);
  previewState.textContent = formattedBlocks.length || extractedAssets.length ? "已排版" : "待排版";
  document.dispatchEvent(new Event("texflow-change"));
}

function setFileStatus(message, isError = false) {
  fileStatus.textContent = message;
  fileStatus.classList.toggle("error", isError);
}

function markPreviewEdited(message = "已应用编辑格式。") {
  previewDirty = true;
  previewState.textContent = "已编辑";
  setFileStatus(message);
  renderToc(formattedBlocks);
  document.dispatchEvent(new Event("texflow-change"));
}

function focusPreviewForCommand() {
  preview.focus({ preventScroll: true });
}

function runFormatCommand(command, value = null) {
  const selectedHeading = getSelectedPreviewHeading();
  focusPreviewForCommand();
  document.execCommand(command, false, value);
  const headingAlignment = {
    justifyLeft: "left",
    justifyCenter: "center",
    justifyRight: "right",
  }[command];
  if (selectedHeading && headingAlignment) {
    selectedHeading.dataset.headingAlign = headingAlignment;
  }
  markPreviewEdited();
}

function getSelectedPreviewHeading() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return null;
  const node = selection.getRangeAt(0).commonAncestorContainer;
  const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  const heading = element?.closest?.("h2");
  return heading && preview.contains(heading) ? heading : null;
}

function renderHeadingLineHtml(alignment = "center") {
  const margin = alignment === "left" ? "12px auto 0 0" : alignment === "right" ? "12px 0 0 auto" : "12px auto 0";
  return `<span data-texflow-heading-line="true" style="display:block;width:38px;margin:${margin};border-top:3px solid #d4472f;border-radius:999px;"></span>`;
}

function getPreviewSelectionRange() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return null;

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
    ? range.commonAncestorContainer.parentElement
    : range.commonAncestorContainer;

  return preview.contains(container) ? range : null;
}

function placeCaretInside(node) {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function getClosestPreviewBlock(node) {
  const element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  return element?.closest?.("p,h2,aside,figure,hr");
}

function insertPreviewTextBox() {
  const range = getPreviewSelectionRange();
  const selectedText = range?.toString().trim() || "在这里输入文本框内容";
  const textBox = document.createElement("aside");
  const title = document.createElement("span");
  const body = document.createElement("p");

  textBox.className = "text-box";
  textBox.dataset.index = String(preview.querySelectorAll(".text-box").length + 1);
  title.textContent = "重点";
  body.textContent = selectedText;
  textBox.append(title, body);

  if (range) {
    const anchorBlock = getClosestPreviewBlock(range.commonAncestorContainer);
    range.deleteContents();
    if (anchorBlock && anchorBlock.parentElement === preview) {
      anchorBlock.after(textBox);
      if (!anchorBlock.textContent.trim()) anchorBlock.remove();
    } else {
      range.insertNode(textBox);
    }
  } else {
    preview.appendChild(textBox);
  }

  placeCaretInside(body);
  markPreviewEdited("已在预览中插入文本框。");
}

function buildMarkdownOutput(headingPrefix = "##") {
  if (previewDirty) {
    return Array.from(preview.children, (node) => {
      if (node.matches("h2")) return `${headingPrefix ? `${headingPrefix} ` : ""}${node.innerText.trim()}`;
      if (node.matches("hr")) return "";
      if (node.querySelector("img")) return `【图片位置：${node.querySelector("img").alt || "文档图片"}，请在公众号后台插入原图】`;
      return node.innerText.trim();
    }).filter(Boolean).join("\n\n");
  }

  const prefix = headingPrefix ? `${headingPrefix} ` : "";
  const blocksForCopy = withDividers(withAutoBoxes(formattedBlocks)).filter((block) => block.type !== "divider");
  const blockToText = (block) => {
    if (block.type === "image") return `【图片位置：${block.asset.alt || "文档图片"}，请在公众号后台插入原图】`;
    if (block.type === "heading") return `${prefix}${stripMarkdownMarkers(block.text)}`;
    if (block.type === "callout") return `${stripMarkdownMarkers(block.title || "重点")}：${stripMarkdownMarkers(block.text)}`;
    return stripMarkdownMarkers(block.text || "");
  };

  if (blocksForCopy.some((block) => block.type === "image")) {
    return blocksForCopy.map(blockToText).join("\n\n");
  }

  if (!extractedAssets.length) {
    return blocksForCopy.map(blockToText).join("\n\n");
  }

  const output = [];
  const insertEvery = Math.max(1, Math.ceil(blocksForCopy.length / extractedAssets.length));
  let assetIndex = 0;

  blocksForCopy.forEach((block, index) => {
    output.push(blockToText(block));

    if ((index + 1) % insertEvery === 0 && assetIndex < extractedAssets.length) {
      const asset = extractedAssets[assetIndex];
      output.push(`【${getImageNotice(asset)}】`);
      assetIndex += 1;
    }
  });

  while (assetIndex < extractedAssets.length) {
    const asset = extractedAssets[assetIndex];
    output.push(`【${getImageNotice(asset)}】`);
    assetIndex += 1;
  }

  return output.join("\n\n");
}

function getImageNotice(asset) {
  const label = stripMarkdownMarkers(asset.alt || "文档图片");
  return `图片位置：${label}，请在公众号后台插入原图`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", reject, { once: true });
    image.src = src;
  });
}

function dataUrlSize(dataUrl) {
  const base64 = dataUrl.split(",")[1] || "";
  return Math.ceil((base64.length * 3) / 4);
}

async function compressImageForWechat(asset, options = {}) {
  if (!asset.src?.startsWith("data:image/")) {
    return { src: asset.src, bytes: 0 };
  }

  const image = await loadImage(asset.src);
  const targetBytes = options.targetBytes || 460 * 1024;
  const minQuality = options.minQuality || 0.42;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  for (const maxWidth of [options.maxWidth || 760, 600, 480, 360]) {
    const scale = Math.min(1, maxWidth / image.naturalWidth);
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (let quality = options.quality || 0.76; quality >= minQuality - 0.001; quality -= 0.08) {
      const output = canvas.toDataURL("image/jpeg", quality);
      const bytes = dataUrlSize(output);
      if (bytes <= targetBytes) return { src: output, bytes };
    }
  }
  throw new Error("图片压缩后仍过大，请缩小图片后重试。");
}

const copyImageOptions = {
  maxWidth: 720,
  targetBytes: 360 * 1024,
  quality: 0.74,
  minQuality: 0.36,
};

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function getCopyRisk(metrics) {
  metrics = {
    textLength: 0,
    imageCount: 0,
    totalImageBytes: 0,
    calloutCount: 0,
    blockCount: 0,
    ...metrics,
  };

  const veryLongText = metrics.textLength >= 9000;
  const longText = metrics.textLength >= 5200;
  const manyImages = metrics.imageCount >= 7;
  const severalImages = metrics.imageCount >= 5;
  const hugeImages = metrics.totalImageBytes >= 8 * 1024 * 1024;
  const largeImages = metrics.totalImageBytes >= 4.5 * 1024 * 1024;
  const manyCallouts = metrics.calloutCount >= 7;
  const severalCallouts = metrics.calloutCount >= 5;
  const complexMediumArticle =
    metrics.textLength >= 3600 &&
    (metrics.imageCount >= 4 || metrics.totalImageBytes >= 3.5 * 1024 * 1024 || metrics.calloutCount >= 4);

  if (
    veryLongText ||
    manyImages ||
    hugeImages ||
    manyCallouts ||
    (longText && (metrics.imageCount >= 4 || metrics.calloutCount >= 4 || metrics.totalImageBytes >= 3.5 * 1024 * 1024))
  ) {
    return {
      level: "high",
      message: `高风险：约 ${metrics.textLength} 字、${metrics.imageCount} 张图、图片约 ${formatBytes(metrics.totalImageBytes)}、${metrics.calloutCount} 个文本框，建议分段复制。`,
    };
  }

  if (longText || severalImages || largeImages || severalCallouts || complexMediumArticle) {
    return {
      level: "medium",
      message: `中风险：约 ${metrics.textLength} 字、${metrics.imageCount} 张图、图片约 ${formatBytes(metrics.totalImageBytes)}、${metrics.calloutCount} 个文本框，分段复制更稳。`,
    };
  }

  return {
    level: "low",
    message: metrics.imageCount
      ? `低风险：${metrics.imageCount} 张图，约 ${formatBytes(metrics.totalImageBytes)}。`
      : "",
  };
}

async function buildRichHtmlOutput() {
  return buildEditedPreviewHtmlOutput();
}

async function buildEditedPreviewHtmlOutput(nodes = Array.from(preview.children), imageOptions = copyImageOptions) {
  const clone = document.createElement("div");
  for (const node of nodes) {
    if (window.getComputedStyle(node).display === "none") continue;
    const copy = node.cloneNode(true);
    inlineComputedStyles(copy, node);
    copy.querySelectorAll("h2").forEach((heading) => heading.appendChild(createHeadingLine(heading)));
    if (copy.matches("h2")) copy.appendChild(createHeadingLine(copy));
    clone.appendChild(copy);
  }
  const metrics = { imageCount: 0, totalImageBytes: 0, fallbackImages: 0 };
  const images = Array.from(clone.querySelectorAll("img"));
  for (let offset = 0; offset < images.length; offset += 3) {
    await Promise.all(images.slice(offset, offset + 3).map(async (image) => {
      try {
        const compressed = await compressImageForWechat({ src: image.src }, imageOptions);
        image.src = compressed.src;
        image.style.cssText += ";display:block;max-width:100%;width:100%;height:auto;";
        metrics.imageCount += 1;
        metrics.totalImageBytes += compressed.bytes || 0;
      } catch (error) {
        metrics.fallbackImages += 1;
        image.replaceWith(document.createTextNode(`【图片读取失败：${image.alt || "请在公众号后台补图"}】`));
      }
    }));
  }
  const fontFamily = fontFamilies[fontFamilySelect.value] || fontFamilies.serif;
  const wrapperStyle = `font-family:${fontFamily};font-size:${fontSizeSelect.value}px;line-height:${lineHeightSelect.value};padding:0 ${pagePaddingSelect.value}px;color:#1f2328;background:#ffffff;max-width:100%;text-align:left;`;
  return { html: sanitizeWechatHtml(`<section style='${wrapperStyle}'>${clone.innerHTML}</section>`), metrics };
}

function createHeadingLine(heading) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = renderHeadingLineHtml(heading.dataset.headingAlign || heading.style.textAlign);
  return wrapper.firstElementChild;
}

function normalizeWechatAlignment(value, direction = "ltr") {
  const align = value.trim().toLowerCase();
  if (["left", "center", "right", "justify"].includes(align)) return align;
  if (align === "end") return direction === "rtl" ? "left" : "right";
  return direction === "rtl" ? "right" : "left";
}

function sanitizeWechatHtml(html) {
  const holder = document.createElement("div");
  holder.innerHTML = html;

  holder.querySelectorAll('[data-texflow-highlight="true"]').forEach((node) => {
    if (!highlightToggle.checked) {
      node.removeAttribute("data-texflow-highlight");
      return;
    }
    node.style.color = activePalette;
    node.style.background = "none";
    node.style.backgroundColor = getPaletteTint();
    node.style.fontWeight = "700";
    node.style.textDecoration = "underline";
    node.style.textDecorationColor = activePalette;
    node.removeAttribute("data-texflow-highlight");
  });

  holder.querySelectorAll("aside").forEach((node) => {
    const titleNode = node.querySelector(":scope > span");
    const title = titleNode?.innerHTML || "重点";
    const bodyNodes = Array.from(node.children).filter((child) => child !== titleNode);
    const text = bodyNodes.map((child) => child.matches("p") ? child.innerHTML : child.outerHTML).join("<br><br>");
    const index = node.getAttribute("data-index") || "1";
    const wrapper = document.createElement("div");
    wrapper.innerHTML = renderWechatBoxHtml(title, text, index, Number(fontSizeSelect.value), Number(lineHeightSelect.value), "#1f2328");
    const replacement = wrapper.firstElementChild;
    if (boxStyleSelect.value === "none") {
      const plain = document.createElement("div");
      plain.innerHTML = `<p><strong>${title}</strong></p><p>${text}</p>`;
      node.replaceWith(plain);
    } else {
      const body = replacement.querySelector("td > p:last-child");
      if (bodyNodes[0]?.style.textAlign) body.style.textAlign = bodyNodes[0].style.textAlign;
      node.replaceWith(replacement);
    }
  });

  holder.querySelectorAll("[data-texflow-copy], [data-texflow-heading-line], [contenteditable], script, style").forEach((node) => {
    if (node.matches("script, style")) {
      node.remove();
      return;
    }
    node.removeAttribute("data-texflow-copy");
    node.removeAttribute("data-texflow-heading-line");
    node.removeAttribute("contenteditable");
  });

  holder.querySelectorAll("*").forEach((node) => {
    node.removeAttribute("class");
    node.removeAttribute("id");
    node.removeAttribute("spellcheck");
    for (const attribute of Array.from(node.attributes)) {
      if (attribute.name.startsWith("on") || attribute.name.startsWith("data-")) node.removeAttribute(attribute.name);
    }
    for (const property of ["text-align", "text-align-last"]) {
      if (node.style.getPropertyValue(property)) {
        const direction = node.closest('[dir="rtl"]') ? "rtl" : node.style.direction || "ltr";
        node.style.setProperty(property, normalizeWechatAlignment(node.style.getPropertyValue(property), direction));
      }
    }
    if (node.hasAttribute("align")) {
      node.setAttribute("align", normalizeWechatAlignment(node.getAttribute("align")));
    }
  });

  return holder.innerHTML;
}

function renderWechatBoxHtml(title, text, index, fontSize, lineHeight, bodyColor, boxStyle = boxStyleSelect.value) {
  const palette = activePalette;
  const borderColor = boxStyle === "court" || boxStyle === "quote" ? "#c84b43" : palette;
  const softBackground =
    boxStyle === "youth" ? "#f6fdff" : boxStyle === "brief" || boxStyle === "media" ? "#f8fafc" : "#f4fbff";
  const radius = boxStyle === "court" || boxStyle === "quote" ? "4px" : boxStyle === "youth" ? "18px" : "10px";
  const numberBadge =
    boxStyle === "numbered"
      ? `<span style="display:inline-block;margin-right:10px;padding:4px 10px;border-radius:999px;background:${palette};color:#ffffff;font-weight:700;">${index}</span>`
      : "";

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:separate;border-spacing:0;margin:22px 0;">
      <tbody>
        <tr>
          <td style="border:1px solid #b9ddf3;border-left:6px solid ${borderColor};border-right:${boxStyle === "court" ? `6px solid ${palette}` : "1px solid #b9ddf3"};border-top:${boxStyle === "gov" ? `6px solid ${palette}` : "1px solid #b9ddf3"};border-radius:${radius};background:${softBackground};padding:18px 20px;">
            <p style="margin:0 0 8px;font-weight:700;color:${palette};font-size:${Math.max(fontSize, 16)}px;line-height:1.6;">${numberBadge}${title}</p>
            <p style="margin:0;font-size:${fontSize}px;line-height:${lineHeight};color:${bodyColor};">${text}</p>
          </td>
        </tr>
      </tbody>
    </table>
  `;
}

async function fallbackCopyHtml(html, text) {
  const holder = document.createElement("div");
  holder.contentEditable = "true";
  holder.style.cssText = "position:fixed;left:-9999px;top:0;";
  holder.innerHTML = html;
  document.body.appendChild(holder);
  const selection = window.getSelection();
  const savedRange = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
  const range = document.createRange();
  range.selectNodeContents(holder);
  selection?.removeAllRanges();
  selection?.addRange(range);
  const onCopy = (event) => {
    if (!event.clipboardData) return;
    event.clipboardData.setData("text/html", html);
    event.clipboardData.setData("text/plain", text);
    event.preventDefault();
  };
  document.addEventListener("copy", onCopy);
  try {
    if (!document.execCommand("copy")) throw new Error("浏览器未允许复制，请允许剪贴板权限后重试。");
  } finally {
    document.removeEventListener("copy", onCopy);
    holder.remove();
    selection?.removeAllRanges();
    if (savedRange && preview.contains(savedRange.commonAncestorContainer)) selection?.addRange(savedRange);
  }
}

async function writeRichClipboard(outputPromise, text) {
  if (window.ClipboardItem && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        "text/plain": new Blob([text], { type: "text/plain" }),
        "text/html": outputPromise.then((output) => new Blob([output.html], { type: "text/html" })),
      })]);
      return;
    } catch (error) {
      // Reuse the already generated output for browsers requiring the copy-event path.
    }
  }
  const output = await outputPromise;
  await fallbackCopyHtml(output.html, text);
}

function getPreviewCopyNodes() {
  return Array.from(preview.children).filter((node) => !node.matches(".task-mask"));
}

function getNodeCopyWeight(node) {
  const textLength = node.innerText?.trim().length || 0;
  const imageCount = node.querySelectorAll("img").length;
  const calloutCount = node.matches(".text-box") || node.querySelector(".text-box") ? 1 : 0;
  return {
    textLength,
    imageCount,
    calloutCount,
    weight: Math.max(1, Math.ceil(textLength / 900)) + imageCount * 3 + calloutCount * 2,
  };
}

function analyzeCopyContent() {
  const nodes = getPreviewCopyNodes();
  const images = Array.from(preview.querySelectorAll("img"));
  const totalImageBytes = images
    .map((image) => (image.src?.startsWith("data:image/") ? dataUrlSize(image.src) : 0))
    .reduce((sum, bytes) => sum + bytes, 0);

  return {
    textLength: preview.innerText.trim().length,
    imageCount: images.length,
    totalImageBytes,
    calloutCount: preview.querySelectorAll(".text-box, aside").length,
    blockCount: nodes.length,
    edited: previewDirty,
  };
}

function createCopySegments() {
  const nodes = getPreviewCopyNodes();
  if (!nodes.length) return [];

  const metrics = analyzeCopyContent();
  const targetCount = metrics.blockCount > 1 ? 2 : 1;

  const totalWeight = nodes.reduce((sum, node) => sum + getNodeCopyWeight(node).weight, 0);
  const targetWeight = Math.max(1, Math.ceil(totalWeight / targetCount));
  const segments = [];
  let current = [];
  let currentWeight = 0;

  nodes.forEach((node, index) => {
    const nodeWeight = getNodeCopyWeight(node).weight;
    const remainingNodes = nodes.length - index;
    const remainingSlots = targetCount - segments.length - 1;
    const shouldSplit = current.length && currentWeight + nodeWeight > targetWeight && remainingSlots > 0 && remainingNodes > remainingSlots;

    if (shouldSplit) {
      segments.push(current);
      current = [];
      currentWeight = 0;
    }

    current.push(node);
    currentWeight += nodeWeight;
  });

  if (current.length) segments.push(current);
  if (segments.length > 2) {
    const merged = [segments[0], segments.slice(1).flat()];
    segments.splice(0, segments.length, ...merged);
  }

  return segments.slice(0, 2).map((segmentNodes, index) => {
    const textLength = segmentNodes.reduce((sum, node) => sum + (node.innerText?.trim().length || 0), 0);
    const imageCount = segmentNodes.reduce((sum, node) => sum + node.querySelectorAll("img").length, 0);
    const calloutCount = segmentNodes.reduce(
      (sum, node) => sum + (node.matches(".text-box") || node.querySelector(".text-box") ? 1 : 0),
      0,
    );
    return {
      index,
      nodes: segmentNodes,
      textLength,
      imageCount,
      calloutCount,
    };
  });
}

async function copyDomNodesAsSelection(nodes, textFallback) {
  await writeRichClipboard(buildEditedPreviewHtmlOutput(nodes), textFallback);
}

async function copyPlainText() {
  const text = buildMarkdownOutput("").trim();
  if (!text) { setFileStatus("没有可复制的文字内容。", true); return false; }
  try {
    await navigator.clipboard.writeText(text);
    setFileStatus("已复制纯文字版。");
    return true;
  } catch (error) {
    setFileStatus("文字复制失败，请允许剪贴板权限后重试。", true);
    return false;
  }
}

async function copyPreviewSegment(segment) {
  const text = segment.nodes.map((node) => node.innerText || "").join("\n\n").trim();
  try {
    await copyDomNodesAsSelection(segment.nodes, text);
    setFileStatus(`已复制第 ${segment.index + 1} 段，已规范化对齐，可到公众号后台粘贴。`);
    return true;
  } catch (error) {
    setFileStatus(error.message || "分段复制失败，请重试。", true);
    return false;
  }
}

function closeCopyPlanPanel() {
  document.querySelector(".copy-plan-backdrop")?.remove();
}

function openCopyPlanPanel(metrics, risk, segments) {
  closeCopyPlanPanel();
  const backdrop = document.createElement("div");
  backdrop.className = "copy-plan-backdrop";
  const segmentButtons = segments
    .map(
      (segment) => `
        <button type="button" data-copy-segment="${segment.index}">
          <span>复制第 ${segment.index + 1} 段</span>
          <small>${segment.textLength} 字 / ${segment.imageCount} 图 / ${segment.calloutCount} 框</small>
        </button>
      `,
    )
    .join("");

  backdrop.innerHTML = `
    <section class="copy-plan-dialog" role="dialog" aria-modal="true" aria-label="复制前检测">
      <div class="copy-plan-head">
        <div>
          <strong>复制前检测</strong>
          <p>${risk.message}</p>
        </div>
        <button type="button" data-close-copy-plan>关闭</button>
      </div>
      <div class="copy-plan-stats">
        <span>${metrics.textLength} 字</span>
        <span>${metrics.imageCount} 张图</span>
        <span>${metrics.calloutCount} 个文本框</span>
        <span>最多 ${segments.length} 次</span>
      </div>
      <div class="copy-plan-actions">
        <button type="button" data-copy-full>复制整篇</button>
        <button type="button" data-copy-plain>只复制文字版</button>
      </div>
      <div class="copy-segment-list">
        ${segmentButtons}
      </div>
    </section>
  `;
  document.body.appendChild(backdrop);

  backdrop.addEventListener("click", async (event) => {
    if (event.target === backdrop || event.target.closest("[data-close-copy-plan]")) {
      closeCopyPlanPanel();
      return;
    }

    if (event.target.closest("[data-copy-plain]")) {
      if (await copyPlainText()) closeCopyPlanPanel();
      return;
    }

    if (event.target.closest("[data-copy-full]")) {
      closeCopyPlanPanel();
      await copyFullOutput({ skipPlan: true });
      return;
    }

    const segmentButton = event.target.closest("[data-copy-segment]");
    if (segmentButton) {
      const segment = segments[Number(segmentButton.dataset.copySegment)];
      if (!(await copyPreviewSegment(segment))) return;
      segmentButton.classList.add("copied");
      segmentButton.querySelector("span").textContent = `已复制第 ${segment.index + 1} 段`;
    }
  });
}

function inlineComputedStyles(root, original = preview) {
  const properties = ["display", "box-sizing", "font-family", "font-size", "font-weight", "line-height", "color", "background-color", "text-align", "margin", "padding", "border", "border-left", "border-right", "border-top", "border-bottom", "border-radius", "text-decoration", "font-style", "letter-spacing"];
  const copies = [root, ...root.querySelectorAll("*")];
  const originals = [original, ...original.querySelectorAll("*")];
  copies.forEach((element, index) => {
    const source = originals[index];
    if (!source) return;
    const computed = window.getComputedStyle(source);
    for (const property of properties) {
      const value = computed.getPropertyValue(property);
      if (value) element.style.setProperty(property, property === "text-align" ? normalizeWechatAlignment(value, computed.direction) : value);
    }
    const fontSize = parseFloat(computed.fontSize);
    const lineHeight = parseFloat(computed.lineHeight);
    if (element.textContent.trim() && fontSize > 0 && Number.isFinite(lineHeight)) {
      element.style.lineHeight = String(Math.max(1.25, lineHeight / fontSize));
    }
    element.style.removeProperty("width");
    element.style.removeProperty("min-width");
    element.style.removeProperty("height");
    element.style.removeProperty("max-height");
    element.style.removeProperty("overflow");
    element.style.maxWidth = "100%";
    if (element.matches("img")) element.style.height = "auto";
  });
}

async function getEditableHtmlForExport(imageOptions) {
  return (await buildEditedPreviewHtmlOutput(Array.from(preview.children), imageOptions)).html;
}

async function buildWordHtml(imageOptions) {
  const title = "公众号排版稿";
  const bodyHtml = await getEditableHtmlForExport(imageOptions);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
  </head>
  <body>
    <section style="max-width:760px;margin:0 auto;font-family:Songti SC,SimSun,serif;font-size:16px;line-height:2;color:#1f2328;">
      ${bodyHtml}
    </section>
  </body>
</html>`;
}

function createWordBlob(html) {
  if (window.htmlDocx?.asBlob) {
    return {
      blob: window.htmlDocx.asBlob(html),
      extension: "docx",
    };
  }

  return {
    blob: new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" }),
    extension: "doc",
  };
}

async function buildWordBlobUnderLimit() {
  const limit = 15 * 1024 * 1024;
  const plans = [
    { maxWidth: 760, targetBytes: 360 * 1024, quality: 0.74, minQuality: 0.38 },
    { maxWidth: 680, targetBytes: 240 * 1024, quality: 0.68, minQuality: 0.32 },
    { maxWidth: 560, targetBytes: 150 * 1024, quality: 0.62, minQuality: 0.26 },
  ];

  let lastBlob = null;
  let lastExtension = "docx";
  for (const plan of plans) {
    const html = await buildWordHtml(plan);
    const { blob, extension } = createWordBlob(html);
    lastBlob = blob;
    lastExtension = extension;
    if (blob.size < limit) {
      return { blob, extension, withinLimit: true };
    }
  }

  return { blob: lastBlob, extension: lastExtension, withinLimit: false };
}

async function exportWordDocument() {
  const text = previewDirty ? preview.innerText.trim() : buildMarkdownOutput("#").trim();
  if (!text) {
    setFileStatus("没有可导出的内容。", true);
    return;
  }

  setFileStatus("正在生成小于 15MB 的 Word 文档...");
  const { blob, extension, withinLimit } = await buildWordBlobUnderLimit();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `公众号排版稿.${extension}`;
  link.click();
  URL.revokeObjectURL(url);

  setFileStatus(
    withinLimit
      ? `已导出 ${extension.toUpperCase()} Word 文档，大小约 ${formatBytes(blob.size)}。`
      : `已导出 ${extension.toUpperCase()} Word 文档，但图片过多，大小约 ${formatBytes(blob.size)}，建议删减图片后再导出。`,
    !withinLimit,
  );
}

function exportMarkdownDocument() {
  const markdown = buildMarkdownOutput("##").trim();
  if (!markdown) {
    setFileStatus("没有可导出的 Markdown 内容。", true);
    return;
  }

  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "公众号排版稿.md";
  link.click();
  URL.revokeObjectURL(url);
  setFileStatus(`已导出 Markdown 文件，大小约 ${formatBytes(blob.size)}。`);
}

async function copyFullOutput() {
  const text = buildMarkdownOutput("");

  if (!text.trim()) {
    setFileStatus("没有可复制的内容。", true);
    return;
  }

  const outputPromise = buildRichHtmlOutput();
  try {
    setFileStatus("正在整理公众号兼容格式并复制…");
    await writeRichClipboard(outputPromise, text);
    copyOutput.lastMetrics = (await outputPromise).metrics;
  } catch (error) {
    setFileStatus(error.message || "复制失败，请重试。", true);
    return;
  }

  copyButton.textContent = "已复制";
  const hasImages = preview.querySelectorAll("img").length > 0;
  const risk = getCopyRisk(copyOutput.lastMetrics || { imageCount: 0, totalImageBytes: 0 });
  setFileStatus(
    copyOutput.lastMetrics?.fallbackImages
      ? `已复制，但 ${copyOutput.lastMetrics.fallbackImages} 张图片读取失败，已标明补图位置。`
      : hasImages
      ? risk.message || "已复制含压缩图片的公众号富文本。"
      : "已复制公众号兼容格式，对齐属性已规范化。",
  );
  window.setTimeout(() => {
    copyButton.textContent = "复制到公众号";
  }, 1400);
}

async function copyOutput() {
  const text = buildMarkdownOutput("");
  if (!text.trim()) {
    setFileStatus("没有可复制的内容。", true);
    return;
  }

  const metrics = analyzeCopyContent();
  const risk = getCopyRisk(metrics);
  if (risk.level === "medium" || risk.level === "high") {
    openCopyPlanPanel(metrics, risk, createCopySegments());
    return;
  }

  await copyFullOutput();
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsArrayBuffer(file);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(file);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function isZipBasedOfficeFile(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer.slice(0, 4));
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

async function extractDocxArrayBuffer(arrayBuffer) {
  if (!window.mammoth) {
    throw new Error("Word 解析库还没有加载完成，请稍后重试。");
  }

  const result = await window.mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
        "p[style-name='heading 1'] => h2:fresh",
        "p[style-name='heading 2'] => h3:fresh",
        "p[style-name='heading 3'] => h3:fresh",
        "p[style-name='heading 4'] => h4:fresh",
        "p[style-name='heading 5'] => h4:fresh",
        "p[style-name='heading 6'] => h4:fresh",
      ],
      convertImage: window.mammoth.images.imgElement(async (image) => {
        const base64 = await image.read("base64");
        return { src: `data:${image.contentType};base64,${base64}` };
      }),
    },
  );
  const container = document.createElement("div");
  container.innerHTML = result.value;

  const parsed = parseDocxHtml(container);
  importedBlocks = parsed.blocks;
  extractedAssets = parsed.assets;
  return parsed.text;
}

async function extractDocxText(file) {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  return extractDocxArrayBuffer(arrayBuffer);
}

async function extractOfficeText(file) {
  const arrayBuffer = await readFileAsArrayBuffer(file);

  if (!isZipBasedOfficeFile(arrayBuffer)) {
    throw new Error("这个 .doc/.wps 是旧版二进制格式，浏览器静态页无法稳定解析。请用 WPS/Word 另存为 .docx 后上传。");
  }

  return extractDocxArrayBuffer(arrayBuffer);
}

function parseDocxHtml(container) {
  const blocks = [];
  const assets = [];
  let imageCount = 0;

  function pushText(text) {
    const cleanText = text.replace(/\s+/g, " ").trim();
    if (!cleanText) return;
    blocks.push(...formatText(cleanText));
  }

  function pushHeading(text) {
    const cleanText = sanitizeLine(text);
    if (cleanText) blocks.push({ type: "heading", text: cleanText });
  }

  function pushImage(node) {
    if (node.tagName === "IMG") {
      imageCount += 1;
      const asset = {
        src: node.src,
        alt: node.alt || `文档图片 ${imageCount}`,
      };
      assets.push(asset);
      blocks.push({ type: "image", asset });
      return;
    }
  }

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      pushText(node.textContent || "");
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    if (node.tagName === "IMG") {
      pushImage(node);
      return;
    }

    const images = Array.from(node.children).filter((child) => child.tagName === "IMG");
    if (images.length && !node.textContent.trim()) {
      images.forEach(pushImage);
      return;
    }

    const text = node.textContent || "";
    if (/^H[1-6]$/.test(node.tagName)) {
      pushHeading(text);
      return;
    }

    if (["P", "LI", "BLOCKQUOTE"].includes(node.tagName)) {
      const cleanText = text.replace(/\s+/g, " ").trim();
      if (isHeading(cleanText)) {
        pushHeading(cleanText.replace(/^(\d+\.|[一二三四五六七八九十]+[、.．])\s*/, ""));
      } else {
        pushText(cleanText);
      }
      Array.from(node.querySelectorAll("img")).forEach(pushImage);
      return;
    }

    Array.from(node.childNodes).forEach(walk);
  }

  Array.from(container.childNodes).forEach(walk);

  return {
    blocks,
    assets,
    text: blocks
      .filter((block) => block.type !== "image")
      .map((block) => block.text)
      .join("\n\n"),
  };
}

async function extractPdfText(file) {
  const pdfjsLib = await getPdfLibrary();
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  const pageImages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    pages.push(pageText);

    const viewport = page.getViewport({ scale: 1.35 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport }).promise;
    pageImages.push({
      src: canvas.toDataURL("image/png"),
      alt: `PDF 第 ${pageNumber} 页`,
    });
  }

  extractedAssets = pageImages;
  importedBlocks = pageImages.map((asset) => ({ type: "image", asset }));
  const extractedText = pages.join("\n\n").trim();
  if (extractedText) {
    importedBlocks.push({ type: "heading", text: "PDF 可复制文字" }, ...formatText(extractedText));
  }
  return extractedText;
}

async function extractFileText(file) {
  extractedAssets = [];
  importedBlocks = null;

  if (/\.docx$/i.test(file.name)) {
    return extractDocxText(file);
  }

  if (/\.(doc|wps)$/i.test(file.name)) {
    return extractOfficeText(file);
  }

  if (/\.pdf$/i.test(file.name)) {
    return extractPdfText(file);
  }

  if (file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(file.name)) {
    const asset = {
      src: await readFileAsDataUrl(file),
      alt: file.name,
    };
    extractedAssets = [asset];
    importedBlocks = [{ type: "image", asset }];
    return "";
  }

  return readFileAsText(file);
}

sourceText.addEventListener("input", () => {
  if (previewDirty || importedBlocks?.some((block) => block.type === "image")) {
    updateStats();
    inputState.textContent = "原文已改";
    setFileStatus("已保留右侧编辑内容。要使用新原文，请点“一键排版”；可用撤销恢复。");
    document.dispatchEvent(new Event("texflow-change"));
  } else {
    importedBlocks = null;
    refresh();
  }
});
preview.addEventListener("input", () => {
  markPreviewEdited("已进入右侧编辑模式，复制时会使用你修改后的内容。");
});
preview.addEventListener("paste", (event) => {
  event.preventDefault();
  const html = event.clipboardData?.getData("text/html") || "";
  const text = event.clipboardData?.getData("text/plain") || "";
  const safeHtml = html ? sanitizePastedHtml(html) : textToSafeParagraphs(text);
  document.execCommand("insertHTML", false, safeHtml);
  markPreviewEdited("已粘贴并清理外部格式。");
});
highlightToggle.addEventListener("change", applyDesignSettings);
insertBoxButton.addEventListener("click", () => {
  const start = sourceText.selectionStart;
  const end = sourceText.selectionEnd;
  const selectedText = sourceText.value.slice(start, end).trim() || "在这里输入需要放进文本框的内容";
  const boxText = `【文本框：重点】\n${selectedText}\n【/文本框】`;
  sourceText.setRangeText(boxText, start, end, "end");
  sourceText.focus();
  importedBlocks = null;
  refresh();
  setFileStatus("已插入文本框，排版后会显示为政务信息框。");
});
formatButton.addEventListener("click", () => {
  if (inputState.textContent === "原文已改") importedBlocks = null;
  refresh();
});
formatButton.addEventListener("click", () => {
  taskMask.hidden = false;
  window.setTimeout(() => {
    taskMask.hidden = true;
  }, 1100);
});
loadDemo.addEventListener("click", () => {
  extractedAssets = [];
  importedBlocks = null;
  sourceText.value = demoText;
  refresh();
  setFileStatus("已载入示例文本。");
  document.querySelector("#editor").scrollIntoView({ behavior: "smooth" });
});

function applyDesignSettings() {
  const fontSize = fontSizeSelect.value;
  const lineHeight = lineHeightSelect.value;
  const fontFamily = fontFamilies[fontFamilySelect.value] || fontFamilies.serif;

  resultPane.style.setProperty("--preview-font-size", `${fontSize}px`);
  resultPane.style.setProperty("--preview-line-height", lineHeight);
  resultPane.style.setProperty("--preview-font-family", fontFamily);
  resultPane.style.setProperty("--theme-accent", activePalette);
  resultPane.style.setProperty("--paragraph-gap", `${paragraphGapSelect.value}px`);
  resultPane.style.setProperty("--page-padding", `${pagePaddingSelect.value}px`);
  if (previewDirty) {
    applyPreviewClasses();
    preview.querySelectorAll(".section-divider").forEach((node) => node.remove());
    if (dividerStyleSelect.value !== "none") {
      Array.from(preview.querySelectorAll(":scope > h2")).slice(1).forEach((heading) => {
        const divider = document.createElement("hr");
        divider.className = "section-divider";
        heading.before(divider);
      });
    }
    renderToc(formattedBlocks);
  } else {
    renderPreview(formattedBlocks);
  }
  document.dispatchEvent(new Event("texflow-change"));
}

function applyThemePreset(themeName) {
  const preset = themePresets[themeName];
  if (!preset) return;

  headingStyleSelect.value = preset.heading;
  boxStyleSelect.value = preset.box;
  bodyStyleSelect.value = preset.body;
  imageStyleSelect.value = preset.image;
  dividerStyleSelect.value = preset.divider;
  activePalette = preset.palette;

  paletteDots.forEach((item) => {
    item.classList.toggle("active", item.dataset.palette === activePalette);
  });

  applyDesignSettings();
}

themeChips.forEach((button) => {
  button.addEventListener("click", () => {
    themeChips.forEach((item) => item.classList.toggle("active", item === button));
    activeTheme = button.dataset.theme;
    applyThemePreset(activeTheme);
  });
});

paletteDots.forEach((button) => {
  button.addEventListener("click", () => {
    paletteDots.forEach((item) => item.classList.toggle("active", item === button));
    activePalette = button.dataset.palette;
    applyDesignSettings();
  });
});

[fontFamilySelect, fontSizeSelect, lineHeightSelect, headingStyleSelect, boxStyleSelect, bodyStyleSelect, imageStyleSelect, dividerStyleSelect, paragraphGapSelect, pagePaddingSelect].forEach((control) => {
  control.addEventListener("change", applyDesignSettings);
});

tocButton.addEventListener("click", () => {
  tocPopover.classList.toggle("open");
});

tocPopover.addEventListener("click", (event) => {
  const button = event.target.closest("[data-scroll-heading]");
  if (!button) return;

  const headingIndex = Number(button.dataset.scrollHeading);
  const heading = preview.querySelectorAll("h2")[headingIndex];
  if (heading) heading.scrollIntoView({ behavior: "smooth", block: "start" });
  tocPopover.classList.remove("open");
});

fullscreenButton.addEventListener("click", async () => {
  if (!document.fullscreenElement) {
    await resultPane.requestFullscreen();
    fullscreenButton.textContent = "退出全屏";
    return;
  }

  await document.exitFullscreen();
  fullscreenButton.textContent = "全屏";
});

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) fullscreenButton.textContent = "全屏";
});

exportButton.addEventListener("click", async () => {
  try {
    await exportWordDocument();
  } catch (error) {
    setFileStatus(error.message || "Word 导出失败，请稍后再试。", true);
  }
});

exportMdButton.addEventListener("click", () => {
  try {
    exportMarkdownDocument();
  } catch (error) {
    setFileStatus(error.message || "Markdown 导出失败，请稍后再试。", true);
  }
});

formatToolbar.addEventListener("mousedown", (event) => {
  if (event.target.closest("[data-command], [data-action]")) {
    event.preventDefault();
  }
});

formatToolbar.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (actionButton?.dataset.action === "insertTextBox") {
    insertPreviewTextBox();
    return;
  }

  const button = event.target.closest("[data-command]");
  if (!button) return;

  runFormatCommand(button.dataset.command);
});

textColorSelect.addEventListener("change", () => {
  if (!textColorSelect.value) return;
  runFormatCommand("foreColor", textColorSelect.value);
  textColorSelect.value = "";
});

highlightColorSelect.addEventListener("change", () => {
  if (!highlightColorSelect.value) return;
  runFormatCommand("backColor", highlightColorSelect.value);
  highlightColorSelect.value = "";
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  const allowedExtensions = /\.(txt|md|markdown|tex|csv)$/i;
  const readableDocumentExtensions = /\.(pdf|docx|doc|wps)$/i;
  const readableImageExtensions = /\.(png|jpe?g|webp)$/i;
  const isReadableText = file.type.startsWith("text/") || allowedExtensions.test(file.name);
  const isReadableDocument = readableDocumentExtensions.test(file.name);
  const isReadableImage = file.type.startsWith("image/") || readableImageExtensions.test(file.name);

  if (!isReadableText && !isReadableDocument && !isReadableImage) {
    setFileStatus("当前支持 TXT、Markdown、TeX、CSV、DOCX、PDF、DOC/WPS（新版内核）、PNG、JPG、WEBP。", true);
    fileInput.value = "";
    return;
  }

  const previousArticle = { extractedAssets, importedBlocks };
  try {
    setFileStatus(`正在解析：${file.name}`);
    const text = await extractFileText(file);
    sourceText.value = text || "";
    refresh();
    const assetText = extractedAssets.length ? `，提取 ${extractedAssets.length} 张图片/页面` : "";
    setFileStatus(
      text
        ? `已导入：${file.name}${assetText}`
        : `已读取：${file.name}${assetText}，但没有提取到可排版文字。`,
      !text && !extractedAssets.length,
    );
  } catch (error) {
    extractedAssets = previousArticle.extractedAssets;
    importedBlocks = previousArticle.importedBlocks;
    setFileStatus(error.message || "附件解析失败，请换一个文件再试。", true);
  }

  fileInput.value = "";
});

copyButton.addEventListener("click", copyOutput);

refresh();
applyDesignSettings();
