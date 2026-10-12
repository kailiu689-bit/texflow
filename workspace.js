// Editing state, local draft persistence and workspace controls.
const undoButton = document.querySelector("#undoButton");
const redoButton = document.querySelector("#redoButton");
const draftStatus = document.querySelector("#draftStatus");
const previewImageInput = document.querySelector("#previewImageInput");
const workspaceControls = [fontFamilySelect, fontSizeSelect, lineHeightSelect, headingStyleSelect, boxStyleSelect, bodyStyleSelect, imageStyleSelect, dividerStyleSelect, paragraphGapSelect, pagePaddingSelect];
let selectedPreviewBlock = null;
let savedPreviewRange = null;
let restoringWorkspace = false;
let workspaceRevision = 0;
let workspaceHistory = [];
let workspaceHistoryIndex = -1;
let draftDatabaseHandle;
let draftReady = false;

function captureWorkspace() {
  return {
    version: 1,
    source: sourceText.value,
    sourcePending: inputState.textContent === "原文已改",
    html: preview.innerHTML,
    dirty: previewDirty,
    empty: preview.classList.contains("empty"),
    blocks: formattedBlocks,
    importedBlocks,
    assets: extractedAssets,
    theme: activeTheme,
    palette: activePalette,
    highlight: highlightToggle.checked,
    settings: Object.fromEntries(workspaceControls.map((control) => [control.id, control.value])),
  };
}

function restoreWorkspace(state) {
  restoringWorkspace = true;
  selectedPreviewBlock?.classList.remove("selected-block");
  selectedPreviewBlock = null;
  savedPreviewRange = null;
  sourceText.value = state.source;
  formattedBlocks = state.blocks;
  importedBlocks = state.importedBlocks;
  extractedAssets = state.assets;
  activeTheme = state.theme;
  activePalette = state.palette;
  highlightToggle.checked = state.highlight;
  workspaceControls.forEach((control) => { control.value = state.settings[control.id] || control.value; });
  // Update settings without regenerating the saved article.
  previewDirty = true;
  applyDesignSettings();
  preview.innerHTML = state.html;
  previewDirty = state.dirty;
  preview.classList.toggle("empty", state.empty);
  preview.querySelectorAll(".selected-block").forEach((node) => node.classList.remove("selected-block"));
  themeChips.forEach((button) => button.classList.toggle("active", button.dataset.theme === activeTheme));
  paletteDots.forEach((button) => button.classList.toggle("active", button.dataset.palette === activePalette));
  updateStats();
  if (state.sourcePending) inputState.textContent = "原文已改";
  previewState.textContent = state.empty ? "待排版" : state.dirty ? "已编辑" : "已排版";
  renderToc(formattedBlocks);
  updateBlockTools();
  restoringWorkspace = false;
}

function recordWorkspace() {
  const state = captureWorkspace();
  const serialized = JSON.stringify(state);
  if (workspaceHistoryIndex >= 0 && JSON.stringify(workspaceHistory[workspaceHistoryIndex]) === serialized) return;
  workspaceHistory.splice(workspaceHistoryIndex + 1);
  workspaceHistory.push(state);
  let totalSize = workspaceHistory.reduce((sum, item) => sum + JSON.stringify(item).length, 0);
  while (workspaceHistory.length > 1 && (workspaceHistory.length > 30 || totalSize > 16 * 1024 * 1024)) {
    totalSize -= JSON.stringify(workspaceHistory.shift()).length;
  }
  workspaceHistoryIndex = workspaceHistory.length - 1;
  updateHistoryTools();
}

function updateHistoryTools() {
  undoButton.disabled = workspaceHistoryIndex < 1;
  redoButton.disabled = workspaceHistoryIndex >= workspaceHistory.length - 1;
}

function travelWorkspace(direction) {
  const index = workspaceHistoryIndex + direction;
  if (index < 0 || index >= workspaceHistory.length) return;
  workspaceHistoryIndex = index;
  restoreWorkspace(workspaceHistory[index]);
  updateHistoryTools();
  workspaceRevision += 1;
  scheduleDraftSave();
  setFileStatus(direction < 0 ? "已撤销，可重做恢复。" : "已重做。");
}

const draftDatabase = new Promise((resolve, reject) => {
  const request = indexedDB.open("texflow-workspace", 1);
  request.onupgradeneeded = () => request.result.createObjectStore("drafts");
  request.onsuccess = () => { draftDatabaseHandle = request.result; resolve(request.result); };
  request.onerror = () => reject(request.error);
  request.onblocked = () => reject(new Error("草稿数据库被其他页面占用，请关闭旧页面后重试。"));
});

function accessDraft(mode, state) {
  if (!draftDatabaseHandle) return draftDatabase.then(() => accessDraft(mode, state));
  const database = draftDatabaseHandle;
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("drafts", mode);
    const store = transaction.objectStore("drafts");
    const request = mode === "readonly" ? store.get("current") : store.put(state, "current");
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error("草稿保存被中断。"));
  });
}

function scheduleDraftSave() {
  draftStatus.textContent = "有修改 · 正在保存";
  if (draftReady) saveWorkspaceDraft();
}

async function saveWorkspaceDraft() {
  if (!draftReady) return;
  const state = { ...captureWorkspace(), savedAt: Date.now() };
  const revision = workspaceRevision;
  try {
    // Create the transaction synchronously so navigation cannot skip a queued save.
    await accessDraft("readwrite", state);
    if (revision === workspaceRevision) draftStatus.textContent = `已存本机 · ${new Date(state.savedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
  } catch (error) {
    draftStatus.textContent = "草稿未保存";
    setFileStatus("本机草稿保存失败，请先导出文章备份，再检查浏览器存储空间。", true);
  }
}

async function initializeWorkspaceDraft() {
  try {
    const state = await accessDraft("readonly");
    if (state && workspaceRevision === 0) {
      if (state.version !== 1 || typeof state.html !== "string" || !Array.isArray(state.blocks) || !state.settings) throw new Error("草稿格式不完整");
      restoreWorkspace(state);
      workspaceHistory = [];
      workspaceHistoryIndex = -1;
      recordWorkspace();
      draftStatus.textContent = "已恢复本机草稿";
      setFileStatus("已恢复上次的文章、图片和排版设置。");
    }
  } catch (error) {
    draftStatus.textContent = "草稿恢复不可用";
    setFileStatus("无法读取本机草稿。仍可编辑，请使用导出保存文章。", true);
  } finally {
    draftReady = true;
    if (workspaceRevision > 0) scheduleDraftSave();
  }
}

function findTopLevelBlock(node) {
  let element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  while (element && element.parentElement !== preview) element = element.parentElement;
  return element && preview.contains(element) ? element : null;
}

function updateBlockTools() {
  if (!selectedPreviewBlock?.isConnected) selectedPreviewBlock = null;
  formatToolbar.querySelectorAll(".block-tool").forEach((button) => {
    button.disabled = !selectedPreviewBlock ||
      (button.dataset.action === "moveUp" && !selectedPreviewBlock.previousElementSibling) ||
      (button.dataset.action === "moveDown" && !selectedPreviewBlock.nextElementSibling);
  });
}

function selectPreviewBlock(block) {
  selectedPreviewBlock?.classList.remove("selected-block");
  selectedPreviewBlock = block;
  block?.classList.add("selected-block");
  updateBlockTools();
}

function restorePreviewRange() {
  if (!savedPreviewRange || !preview.contains(savedPreviewRange.commonAncestorContainer)) return;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(savedPreviewRange);
}

function changePreviewBlock(action) {
  restorePreviewRange();
  const range = getPreviewSelectionRange();
  const block = selectedPreviewBlock || findTopLevelBlock(range?.commonAncestorContainer);
  if (!block) {
    setFileStatus("请先点选预览中的段落、标题或图片。");
    return;
  }
  if (["heading", "paragraph"].includes(action)) {
    if (block.matches("figure,aside,hr") || block.querySelector("img")) {
      setFileStatus("请点选文字段落，再转换标题或正文。");
      return;
    }
    const replacement = document.createElement(action === "heading" ? "h2" : "p");
    replacement.innerHTML = block.innerHTML;
    block.replaceWith(replacement);
    selectPreviewBlock(replacement);
    placeCaretInside(replacement);
  } else if (action === "moveUp" && block.previousElementSibling) {
    block.previousElementSibling.before(block);
  } else if (action === "moveDown" && block.nextElementSibling) {
    block.nextElementSibling.after(block);
  } else if (action === "deleteBlock") {
    const next = block.nextElementSibling || block.previousElementSibling;
    block.remove();
    selectPreviewBlock(next);
  }
  preview.classList.toggle("empty", !preview.children.length);
  markPreviewEdited("已调整文章内容，支持撤销。");
  updateBlockTools();
}

preview.addEventListener("click", (event) => selectPreviewBlock(findTopLevelBlock(event.target)));
document.addEventListener("selectionchange", () => {
  const range = getPreviewSelectionRange();
  if (range) savedPreviewRange = range.cloneRange();
});
formatToolbar.addEventListener("mousedown", (event) => {
  if (event.target.closest("select")) {
    const range = getPreviewSelectionRange();
    if (range) savedPreviewRange = range.cloneRange();
  }
});
for (const select of [textColorSelect, highlightColorSelect]) select.addEventListener("change", restorePreviewRange, true);
formatToolbar.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "image") previewImageInput.click();
  if (["heading", "paragraph", "moveUp", "moveDown", "deleteBlock"].includes(action)) changePreviewBlock(action);
});
previewImageInput.addEventListener("change", async () => {
  let anchor = selectedPreviewBlock;
  try {
    const assets = await Promise.all(Array.from(previewImageInput.files, async (file) => ({ src: await readFileAsDataUrl(file), alt: file.name })));
    if (!assets.length) return;
    if (preview.classList.contains("empty")) preview.innerHTML = "";
    for (const asset of assets) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = renderAssetFigure(asset);
      const figure = wrapper.firstElementChild;
      if (anchor?.isConnected) anchor.after(figure);
      else preview.appendChild(figure);
      anchor = figure;
    }
    preview.classList.remove("empty");
    selectPreviewBlock(anchor);
    markPreviewEdited("已在选中内容后插入图片，可上移、下移或撤销。");
  } catch (error) {
    setFileStatus("图片读取失败，原有文章已保留。", true);
  } finally {
    previewImageInput.value = "";
  }
});
undoButton.addEventListener("click", () => travelWorkspace(-1));
redoButton.addEventListener("click", () => travelWorkspace(1));
document.addEventListener("keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey) || !["z", "y"].includes(event.key.toLowerCase())) return;
  if (!event.target.closest("#sourceText,#preview")) return;
  event.preventDefault();
  travelWorkspace(event.key.toLowerCase() === "y" || event.shiftKey ? 1 : -1);
});
document.querySelector("#saveDraftButton").addEventListener("click", saveWorkspaceDraft);
document.querySelector("#phonePreviewButton").addEventListener("click", (event) => {
  const enabled = resultPane.classList.toggle("phone-preview");
  event.currentTarget.setAttribute("aria-pressed", String(enabled));
  event.currentTarget.textContent = enabled ? "宽屏预览" : "手机预览";
});
const themeNotes = { long: "标题条 · 稳重图文", gov: "蓝色 · 正式发布", minimal: "留白 · 清爽阅读", digital: "编号 · 信息清晰", block: "卡片 · 分段叙事", contrast: "色块 · 鲜明重点" };
themeChips.forEach((button) => {
  const note = document.createElement("small");
  note.textContent = themeNotes[button.dataset.theme];
  button.appendChild(note);
});
paletteDots.forEach((button) => button.setAttribute("aria-label", `配色 ${button.dataset.palette}`));
if (window.matchMedia("(max-width: 820px)").matches) {
  document.querySelectorAll(".settings-group").forEach((group) => group.removeAttribute("open"));
}
recordWorkspace();
document.addEventListener("texflow-change", () => {
  if (restoringWorkspace) return;
  workspaceRevision += 1;
  recordWorkspace();
  updateBlockTools();
  scheduleDraftSave();
});
window.addEventListener("pagehide", () => { if (workspaceRevision > 0) saveWorkspaceDraft(); });
document.addEventListener("visibilitychange", () => { if (document.hidden && workspaceRevision > 0) saveWorkspaceDraft(); });
initializeWorkspaceDraft();
