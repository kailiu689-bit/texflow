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

const copyFontFamilies = {
  serif: "Songti SC,Noto Serif CJK SC,serif",
  song: "Songti SC,STSong,serif",
  hei: "Hiragino Sans GB,Noto Sans SC,sans-serif",
  kai: "Kaiti SC,STKaiti,serif",
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
    pdfLibraryPromise = import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs").then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
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
      if ((name === "href" || name === "src") && /^(javascript|data:text|vbscript):/i.test(value)) {
        node.removeAttribute(attribute.name);
      }
      if (name === "style") {
        node.setAttribute("style", value.replace(/expression\s*\(|url\s*\(\s*javascript:/gi, ""));
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
    (line.length <= 18 && !/[。！？!?]/.test(line))
  );
}

function shouldHighlight(sentence) {
  return /结论|建议|重点|风险|必须|应该|核心|关键|下一步|最后|因此|争议|问题|答案|提醒|注意|焦点/.test(sentence);
}

function shouldAutoBox(block, index, blocks) {
  if (boxStyleSelect.value === "none" || block.type !== "paragraph") return false;
  const text = block.text || "";

  if (index <= 2 && text.length >= 42 && text.length <= 160) return true;
  if (/^(这场|本案|核心|关键|焦点|争议|提醒|注意)/.test(text) && text.length <= 140) return true;
  return false;
}

function getAutoBoxTitle(text, index) {
  if (/争议|问题|答案|焦点/.test(text)) return "重点";
  if (/建议|下一步|提醒|注意/.test(text)) return "提示";
  return "导语";
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
  preview.className = `preview result-panel active ${activeStyle} theme-${activeTheme} platform-wechat heading-${headingStyleSelect.value} box-${boxStyleSelect.value} body-${bodyStyleSelect.value} image-${imageStyleSelect.value} divider-${dividerStyleSelect.value}`;

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

  const highlighted = highlightToggle.checked && shouldHighlight(block.text) ? `<strong>${safeText}</strong>` : safeText;

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
  return blocks.map((block, index) => {
    if (autoBoxCount >= 2 || !shouldAutoBox(block, index, blocks)) return block;
    autoBoxCount += 1;
    return {
      type: "callout",
      title: getAutoBoxTitle(block.text, index),
      text: block.text,
      auto: true,
    };
  });
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
  const headings = blocks
    .map((block) => block)
    .filter((block) => block.type === "heading");

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
}

function setFileStatus(message, isError = false) {
  fileStatus.textContent = message;
  fileStatus.classList.toggle("error", isError);
}

function markPreviewEdited(message = "已应用编辑格式。") {
  previewDirty = true;
  previewState.textContent = "已编辑";
  setFileStatus(message);
}

function focusPreviewForCommand() {
  preview.focus({ preventScroll: true });
}

function runFormatCommand(command, value = null) {
  focusPreviewForCommand();
  document.execCommand(command, false, value);
  markPreviewEdited();
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
    return preview.innerText.trim();
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
  const maxWidth = options.maxWidth || 760;
  const targetBytes = options.targetBytes || 460 * 1024;
  const minQuality = options.minQuality || 0.42;
  const scale = Math.min(1, maxWidth / image.naturalWidth);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = width;
  canvas.height = height;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  let quality = options.quality || 0.76;
  let output = canvas.toDataURL("image/jpeg", quality);
  while (dataUrlSize(output) > targetBytes && quality > minQuality) {
    quality -= 0.08;
    output = canvas.toDataURL("image/jpeg", quality);
  }

  return { src: output, bytes: dataUrlSize(output) };
}

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

function getCopyStyles() {
  const fontSize = Number(fontSizeSelect.value || 16);
  const lineHeight = Number(lineHeightSelect.value || 2);
  const fontFamily = copyFontFamilies[fontFamilySelect.value] || copyFontFamilies.serif;
  const headingColor = activePalette;
  const headingStyles = {
    bar: `padding:10px 14px;border-left:5px solid ${activePalette};background:#f1f6ff;color:${headingColor}`,
    center: `padding:0;text-align:center;border-left:0;color:${activePalette}`,
    stamp: `display:inline-block;padding:8px 14px;border-left:0;background:#12203a;color:#ffffff;border-bottom:4px solid ${activePalette}`,
    numbered: `padding:10px 12px;border-left:0;background:#eef4ff;color:#102a7a;font-family:Avenir Next,Hiragino Sans GB,sans-serif`,
    plain: "padding-left:0;border-left:0;border-bottom:1px solid #dfe5f2;padding-bottom:10px",
  };
  const boxStyles = {
    gov: `border:1px solid #b9ddf3;background:#f4fbff;border-radius:12px;padding:18px 20px;border-top:6px solid ${activePalette}`,
    court: `border:1px solid #d7e3f2;background:#fffefe;border-radius:4px;padding:18px 20px;border-left:6px solid #c84b43;border-right:6px solid ${activePalette}`,
    youth: "border:1px solid #cfefff;background:#f6fdff;border-radius:22px;padding:20px 22px",
    brief: `border:1px solid #e1e7ef;background:#f8fafc;border-radius:8px;padding:16px 18px;border-left:4px solid ${activePalette}`,
    numbered: `border:0;background:#ffffff;border-left:2px solid ${activePalette};padding:18px 20px 18px 34px`,
    quote: `border:2px solid #ef3933;background:#ffffff;padding:22px 24px`,
    gradient: `border:2px solid ${activePalette};background:#ffffff;padding:22px 24px`,
    media: `border:1px solid #dfe5f2;background:#ffffff;border-radius:14px;padding:18px 20px;box-shadow:0 10px 28px rgba(15,23,42,0.08)`,
    none: "",
  };
  const bodyStyles = {
    formal: "letter-spacing:0;margin-bottom:18px",
    compact: "margin-bottom:12px",
    soft: "margin-bottom:18px;color:#24332c",
    card: `margin-bottom:14px;padding:12px 14px;background:#f8fafc;border-left:3px solid ${activePalette}`,
  };
  const imageStyles = {
    clean: "border-radius:8px",
    frame: "border-radius:8px;border:8px solid #f1f6ff;box-shadow:0 0 0 1px #d7e3f2",
    full: "border-radius:0;width:100%",
    stack: "border-radius:12px;border:1px solid #dfe5f2;background:#ffffff;padding:8px",
  };

  return {
    fontSize,
    lineHeight,
    fontFamily,
    headingColor,
    bodyColor: "#1f2328",
    heading: headingStyles[headingStyleSelect.value] || headingStyles.bar,
    box: boxStyles[boxStyleSelect.value] || boxStyles.gov,
    paragraph: bodyStyles[bodyStyleSelect.value] || bodyStyles.formal,
    image: imageStyles[imageStyleSelect.value] || imageStyles.clean,
  };
}

async function buildRichHtmlOutput() {
  if (previewDirty) {
    return buildEditedPreviewHtmlOutput();
  }

  const { fontSize, lineHeight, fontFamily, headingColor, bodyColor, heading, box, paragraph, image } = getCopyStyles();
  const containerStyle = [
    `font-family:${fontFamily}`,
    `font-size:${fontSize}px`,
    `line-height:${lineHeight}`,
    `color:${bodyColor}`,
    "background:#ffffff",
  ].join(";");

  let copyHeadingIndex = 0;
  let copyCalloutIndex = 0;
  const metrics = {
    imageCount: 0,
    totalImageBytes: 0,
    fallbackImages: 0,
  };
  const blocksHtmlParts = [];
  for (const block of withDividers(withAutoBoxes(formattedBlocks))) {
      if (block.type === "image") {
        try {
          const alt = escapeHtml(block.asset.alt || "文档图片");
          const compressed = await compressImageForWechat(block.asset);
          metrics.imageCount += 1;
          metrics.totalImageBytes += compressed.bytes || 0;
          blocksHtmlParts.push(`
            <div style="margin:24px 0;text-align:center;">
              <img src="${compressed.src}" alt="${alt}" style="display:block;max-width:100%;height:auto;margin:0 auto;${image}" />
            </div>
          `);
        } catch (error) {
          metrics.fallbackImages += 1;
          const notice = escapeHtml(getImageNotice(block.asset));
          blocksHtmlParts.push(`
            <div style="margin:24px 0;padding:18px 20px;border:1px dashed #b8c4d6;border-radius:8px;background:#f8fafc;text-align:center;color:#6b7280;font-size:${Math.max(14, fontSize - 1)}px;line-height:1.8;">
              ${notice}
            </div>
          `);
        }
        continue;
      }

      if (block.type === "divider") {
        blocksHtmlParts.push(`<div style="height:1px;background:#e2e8f0;margin:28px auto;width:70%;"></div>`);
        continue;
      }

      if (block.type === "callout") {
        copyCalloutIndex += 1;
        const calloutTitle = escapeHtml(stripMarkdownMarkers(block.title || "重点"));
        const calloutText = escapeHtml(stripMarkdownMarkers(block.text));
        if (boxStyleSelect.value === "none") {
          blocksHtmlParts.push(`<p style="margin:0 0 18px;font-size:${fontSize}px;line-height:${lineHeight};font-weight:700;color:${bodyColor};">${calloutTitle}：${calloutText}</p>`);
          continue;
        }
        const numberBadge =
          boxStyleSelect.value === "numbered"
            ? `<span style="display:inline-block;margin-right:10px;padding:5px 10px;border-radius:999px;background:${activePalette};color:#ffffff;font-weight:700;">${copyCalloutIndex}</span>`
            : "";
        blocksHtmlParts.push(renderWechatBoxHtml(`${numberBadge}${calloutTitle}`, calloutText, copyCalloutIndex, fontSize, lineHeight, bodyColor));
        continue;
      }

      if (block.type === "heading") {
        copyHeadingIndex += 1;
        const headingText = escapeHtml(stripMarkdownMarkers(block.text));
        const titleStyle = [
          "margin:30px 0 16px",
          "text-align:center",
          `font-size:${fontSize + 8}px`,
          "font-weight:700",
          `line-height:${Math.max(1.5, lineHeight - 0.3)}`,
          `color:${headingColor}`,
          heading,
        ].join(";");

        const afterLine = `<div style="width:38px;height:3px;background:${headingColor};margin:12px auto 0;border-radius:999px;"></div>`;

        const indexBadge =
          headingStyleSelect.value === "numbered"
            ? `<span style="font-size:13px;margin-right:8px;color:${activePalette};">#${String(copyHeadingIndex).padStart(2, "0")}</span>`
            : "";
        blocksHtmlParts.push(`<div style="margin:0;"><p style="${titleStyle}">${indexBadge}${headingText}</p>${afterLine}</div>`);
        continue;
      }

      const paragraphText = escapeHtml(stripMarkdownMarkers(block.text));
      const highlighted = highlightToggle.checked && shouldHighlight(block.text);
      const weight = highlighted ? 700 : 400;
      const highlightStyle = highlighted
        ? `color:${activePalette};text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:4px;`
        : "";
      blocksHtmlParts.push(`<p style="margin:0 0 18px;font-size:${fontSize}px;line-height:${lineHeight};font-weight:${weight};color:${bodyColor};${paragraph};${highlightStyle}">${paragraphText}</p>`);
  }
  const blocksHtml = blocksHtmlParts.join("");

  return {
    html: `<div style="${containerStyle}">${blocksHtml}</div>`,
    metrics,
  };
}

async function buildEditedPreviewHtmlOutput() {
  const clone = preview.cloneNode(true);
  clone.removeAttribute("contenteditable");
  inlineComputedStyles(clone);

  const metrics = {
    imageCount: 0,
    totalImageBytes: 0,
    fallbackImages: 0,
  };

  const images = Array.from(clone.querySelectorAll("img"));
  for (const image of images) {
    if (!image.src) continue;
    try {
      const compressed = await compressImageForWechat({ src: image.src });
      image.src = compressed.src;
      image.setAttribute("style", `${image.getAttribute("style") || ""};display:block;max-width:100%;height:auto;`);
      metrics.imageCount += 1;
      metrics.totalImageBytes += compressed.bytes || 0;
    } catch (error) {
      metrics.fallbackImages += 1;
    }
  }

  return {
    html: sanitizeWechatHtml(clone.innerHTML),
    metrics,
  };
}

function sanitizeWechatHtml(html) {
  const holder = document.createElement("div");
  holder.innerHTML = html;

  holder.querySelectorAll("aside").forEach((node) => {
    const title = escapeHtml(node.querySelector("span")?.innerText.trim() || "重点");
    const text = escapeHtml(node.querySelector("p")?.innerText.trim() || "");
    const index = node.getAttribute("data-index") || "1";
    const wrapper = document.createElement("div");
    wrapper.innerHTML = renderWechatBoxHtml(title, text, index, 16, 2, "#1f2328");
    const replacement = wrapper.firstElementChild;
    node.replaceWith(replacement);
  });

  holder.querySelectorAll("[data-texflow-copy], [contenteditable], script, style").forEach((node) => {
    if (node.matches("script, style")) {
      node.remove();
      return;
    }
    node.removeAttribute("data-texflow-copy");
    node.removeAttribute("contenteditable");
  });

  holder.querySelectorAll("*").forEach((node) => {
    node.removeAttribute("class");
    node.removeAttribute("id");
    node.removeAttribute("spellcheck");
    const style = node.getAttribute("style");
    if (style) {
      node.setAttribute("style", style.replaceAll('"', "").replace(/\s+/g, " ").trim());
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
  holder.className = preview.className;
  holder.style.position = "fixed";
  holder.style.left = "-9999px";
  holder.style.top = "0";
  holder.innerHTML = html;
  document.body.appendChild(holder);

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(holder);
  selection?.removeAllRanges();
  selection?.addRange(range);

  const copied = document.execCommand("copy");
  selection?.removeAllRanges();
  holder.remove();

  if (!copied) {
    await navigator.clipboard.writeText(text);
  }
}

async function copyEditedPreviewSelection(text) {
  const clone = preview.cloneNode(true);
  clone.removeAttribute("id");
  clone.removeAttribute("contenteditable");
  clone.style.position = "fixed";
  clone.style.left = "-9999px";
  clone.style.top = "0";
  clone.style.width = `${Math.max(360, preview.clientWidth)}px`;
  clone.style.maxHeight = "none";
  clone.style.overflow = "visible";
  clone.style.background = "#ffffff";
  clone.style.pointerEvents = "none";
  document.body.appendChild(clone);

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(clone);
  selection?.removeAllRanges();
  selection?.addRange(range);

  const copied = document.execCommand("copy");
  selection?.removeAllRanges();
  clone.remove();

  if (!copied) {
    const fallbackOutput = await buildEditedPreviewHtmlOutput();
    await fallbackCopyHtml(fallbackOutput.html, text);
    return fallbackOutput.metrics;
  }

  return {
    imageCount: preview.querySelectorAll("img").length,
    totalImageBytes: Array.from(preview.querySelectorAll("img"))
      .map((image) => (image.src?.startsWith("data:image/") ? dataUrlSize(image.src) : 0))
      .reduce((sum, bytes) => sum + bytes, 0),
    fallbackImages: 0,
  };
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
  const holder = document.createElement("div");
  holder.contentEditable = "true";
  holder.className = preview.className;
  holder.style.position = "fixed";
  holder.style.left = "-9999px";
  holder.style.top = "0";
  holder.style.width = `${Math.max(360, preview.clientWidth)}px`;
  holder.style.maxHeight = "none";
  holder.style.overflow = "visible";
  holder.style.background = "#ffffff";
  holder.style.pointerEvents = "none";
  nodes.forEach((node) => holder.appendChild(node.cloneNode(true)));
  document.body.appendChild(holder);

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(holder);
  selection?.removeAllRanges();
  selection?.addRange(range);

  const copied = document.execCommand("copy");
  selection?.removeAllRanges();
  holder.remove();

  if (!copied) {
    await navigator.clipboard.writeText(textFallback);
  }
}

function copyPlainText() {
  const text = buildMarkdownOutput("").trim();
  if (!text) {
    setFileStatus("没有可复制的文字内容。", true);
    return;
  }
  navigator.clipboard.writeText(text);
  setFileStatus("已复制纯文字版。");
}

async function copyPreviewSegment(segment) {
  const text = segment.nodes.map((node) => node.innerText || "").join("\n\n").trim();
  await copyDomNodesAsSelection(segment.nodes, text);
  setFileStatus(`已复制第 ${segment.index + 1} 段，请到公众号后台粘贴。`);
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
      copyPlainText();
      closeCopyPlanPanel();
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
      await copyPreviewSegment(segment);
      segmentButton.classList.add("copied");
      segmentButton.querySelector("span").textContent = `已复制第 ${segment.index + 1} 段`;
    }
  });
}

function inlineComputedStyles(root) {
  const properties = [
    "display",
    "font-family",
    "font-size",
    "font-weight",
    "line-height",
    "color",
    "background-color",
    "background",
    "text-align",
    "margin",
    "padding",
    "border",
    "border-left",
    "border-right",
    "border-top",
    "border-bottom",
    "border-radius",
    "width",
    "max-width",
    "height",
    "text-decoration",
    "font-style",
  ];

  root.querySelectorAll("*").forEach((element) => {
    const computed = window.getComputedStyle(element);
    const style = properties
      .map((property) => `${property}:${computed.getPropertyValue(property)}`)
      .join(";");
    element.setAttribute("style", `${element.getAttribute("style") || ""};${style}`);
  });
}

async function getEditableHtmlForExport(imageOptions) {
  const clone = preview.cloneNode(true);
  clone.removeAttribute("contenteditable");
  inlineComputedStyles(clone);

  const images = Array.from(clone.querySelectorAll("img"));
  for (const image of images) {
    if (!image.src) continue;
    try {
      const compressed = await compressImageForWechat({ src: image.src }, imageOptions);
      image.src = compressed.src;
      image.setAttribute("style", `${image.getAttribute("style") || ""};max-width:100%;height:auto;`);
    } catch (error) {
      image.replaceWith(document.createTextNode("【图片导出失败，请在 Word 中补图】"));
    }
  }

  return clone.innerHTML;
}

async function buildWordHtml(imageOptions) {
  const title = "公众号排版稿";
  const bodyHtml = previewDirty
    ? await getEditableHtmlForExport(imageOptions)
    : (await buildRichHtmlOutput()).html;

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

  try {
    const hasImages = formattedBlocks.some((block) => block.type === "image") || extractedAssets.length > 0;
    if (hasImages) {
      setFileStatus("正在压缩图片并生成公众号富文本，请稍等...");
    }
    if (previewDirty) {
      copyOutput.lastMetrics = await copyEditedPreviewSelection(text);
      copyButton.textContent = "已复制";
      const risk = getCopyRisk(copyOutput.lastMetrics || { imageCount: 0, totalImageBytes: 0 });
      setFileStatus(risk.message || "已按当前预览格式复制，可直接粘贴到公众号后台。");
      window.setTimeout(() => {
        copyButton.textContent = "复制到公众号";
      }, 1400);
      return;
    }
    const richOutput = await buildRichHtmlOutput();
    if (window.ClipboardItem && navigator.clipboard?.write) {
      const item = new ClipboardItem({
        "text/plain": new Blob([text], { type: "text/plain" }),
        "text/html": new Blob([richOutput.html], { type: "text/html" }),
      });
      await navigator.clipboard.write([item]);
    } else {
      await fallbackCopyHtml(richOutput.html, text);
    }
    copyOutput.lastMetrics = richOutput.metrics;
  } catch (error) {
    const fallbackOutput = await buildRichHtmlOutput();
    await fallbackCopyHtml(fallbackOutput.html, text);
    copyOutput.lastMetrics = fallbackOutput.metrics;
  }

  copyButton.textContent = "已复制";
  const hasImages = formattedBlocks.some((block) => block.type === "image") || extractedAssets.length > 0;
  const risk = getCopyRisk(copyOutput.lastMetrics || { imageCount: 0, totalImageBytes: 0 });
  setFileStatus(
    hasImages
      ? risk.message || "已复制含压缩图片的公众号富文本。"
      : "已复制公众号富文本，可直接粘贴到后台。",
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

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      pushText(node.textContent || "");
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

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

    const childNodes = Array.from(node.childNodes);
    if (!childNodes.length) return;

    childNodes.forEach(walk);
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
  importedBlocks = null;
  refresh();
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
highlightToggle.addEventListener("change", () => renderPreview(formattedBlocks));
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
formatButton.addEventListener("click", refresh);
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
  renderPreview(formattedBlocks);
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

[fontFamilySelect, fontSizeSelect, lineHeightSelect, headingStyleSelect, boxStyleSelect, bodyStyleSelect, imageStyleSelect, dividerStyleSelect].forEach((control) => {
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
    setFileStatus(error.message || "附件解析失败，请换一个文件再试。", true);
  }

  fileInput.value = "";
});

copyButton.addEventListener("click", copyOutput);

refresh();
applyDesignSettings();
