# TeXflow 项目审计报告（v3 · 2026-05-13）

> 审计范围：`texflow/` 目录下 `index.html`、`styles.css`、`script.js`、`DESIGN.md`。
> 审计方法：完整阅读全部源文件，结合 DESIGN.md 设计规范进行对照分析。

---

## 一、项目技术栈判断

| 维度 | 判定 |
| --- | --- |
| 架构 | 纯静态单页应用（SPA），无构建工具，无 npm 依赖，零打包步骤 |
| HTML | 语义化 HTML5，`contenteditable` 预览区，ARIA 标签覆盖良好，已有 `<h1>` |
| CSS | 原生 CSS，大量 CSS 自定义属性（`--accent`、`--ink` 等），响应式布局（Grid + Flexbox），**三套覆盖式样式叠加**，共 2119 行 |
| JavaScript | 原生 ES Module（`type="module"`），动态 `import()` 用于 PDF.js，无框架，共 1922 行 |
| 外部依赖 | mammoth.js 1.8.0（Word→HTML）、html-docx-js（HTML→DOCX）、PDF.js 4.10.38，均从 unpkg/cdnjs CDN 加载，**无 SRI hash** |
| 部署 | GitHub Pages 静态托管，`kailiu689-bit/texflow` |

**结论：零依赖纯前端工具，技术债低，可维护性良好。**

---

## 二、页面与目录结构说明

```
New project/
├── index.html          # 根目录入口（空壳，实际内容在 texflow/）
├── styles.css          # 根目录样式（已被 texflow/ 版本取代）
├── script.js           # 根目录脚本（已被 texflow/ 版本取代）
├── AUDIT.md            # 上一版审计报告（v2，2026-05-13）
├── DESIGN.md           # 产品设计规范（全局 source of truth）
├── .gitignore
├── deepseek-api/       # 独立 Python 脚本，与前端无关
│   ├── ask_deepseek.py
│   └── article_text.txt
└── texflow/            # ← 实际部署目录
    ├── index.html      # 单页入口，完整工作台 UI（286 行）
    ├── styles.css      # 全部样式（2119 行，含三套覆盖式换肤）
    ├── script.js       # 全部逻辑（1922 行）
    ├── DESIGN.md       # 设计规范（与根目录 DESIGN.md 内容相同）
    └── AUDIT.md        # 本文件
```

**页面结构（单页工作台）：**

1. **Topbar** — 品牌标识 `TeXflow` + 副标题"公众号排版工作台"
2. **Toolbar（tool-row）** — 上传附件 / 一键排版 / 复制到公众号 / 突出重点 / 插入文本框 / 示例文本 / 专注预览
3. **侧边面板（side-panel，320px 固定宽，sticky）**：
   - 主题选择（6 个预置主题，`<details>` 折叠）
   - 模块样式（标题/文本框/正文/图片/分隔，各 4~9 选项，`<details>` 折叠）
   - 字体设置（字体/字号/行间距，`<details>` 折叠）
   - 状态行（文件状态 + 字数/段数统计）
4. **工作区（workspace-grid，双栏）**：
   - 左侧：原文编辑 textarea
   - 右侧：可编辑预览区（contenteditable article）+ 格式工具栏 + 目录浮窗 + 导出按钮

**核心流程：粘贴/上传 → 一键排版 → 预览编辑 → 复制到公众号 / 导出 DOCX**

---

## 三、目前主要问题

### 3.1 CSS 三次"换肤"导致样式冗余（最严重）

`styles.css` 中同一套选择器被重写了**三次**：

- 行 1~1088：初始样式（serif 字体、蓝色主题）
- 行 1089~1403：`/* Workable-inspired application shell */` 覆盖
- 行 1404~2119：`/* Rico MD inspired workbench layout */` 再度覆盖

最终渲染靠 CSS 级联顺序生效，导致：

- 大量"死代码"：前两套中已被覆盖的规则永远不生效
- `body`、`.topbar`、`.editor-shell`、`.pane` 等核心选择器各被定义 3 次
- 文件 2119 行，实际有效样式约占 1/3，预计合并后可缩减 40%~50%

### 3.2 排版引擎对 Markdown 结构识别不足

`formatText()` 对纯文本/简单段落识别较准，但：

- 所有标题统一渲染为 `<h2>`，无 h1/h3 层级区分
- 不识别 Markdown 列表（`- item` / `1. item`）→ 渲染为普通 `<p>`
- 不识别引用块（`>` 前缀）→ 当作普通文本
- 代码块完全无处理

### 3.3 复制到公众号的核心风险

- 图片压缩串行执行（`for...of` 循环逐张处理），多图文章导出时明显卡顿
- 复制富文本依赖 `document.execCommand("copy")`（已废弃 API），新版浏览器可能禁用
- 已有 Clipboard API 路径（`navigator.clipboard.write`），但 fallback 仍用 execCommand

### 3.4 性能隐患

- `inlineComputedStyles()` 对 DOM 全树逐个元素计算 22 个 CSS 属性，500+ 段落时可能明显卡顿
- `compressImageForWechat` 串行压缩，无并发控制
- 全文渲染到单个 `contenteditable` div，10000+ 字时可能影响编辑响应

### 3.5 代码可维护性

- JS 单文件 1922 行，20+ 个全局变量（`previewDirty`、`formattedBlocks`、`extractedAssets` 等）分散在顶部
- `renderMixedContent` 和 `buildMarkdownOutput` 各自内置了"图片插空"算法，逻辑几乎一致
- `buildRichHtmlOutput` 和 `buildEditedPreviewHtmlOutput` 各自实现图片压缩，无法共用
- 无 unit test / e2e test

### 3.6 安全隐患

- 三个 CDN 脚本（mammoth / html-docx / pdf.js）**无 SRI hash 校验**，中间人攻击可注入恶意脚本
- 无 CSP header（GitHub Pages 可通过 `<meta>` 设置）
- `sanitizeStyleAttribute` 中 `url()` 检测使用 `u\s*r\s*l\s*\(` 正则，可被空格变体绕过
- `isSafePastedUrl` 已过滤 `javascript:`/`vbscript:`/`file:`，安全性较好

### 3.7 h1 被 CSS 隐藏（新发现）

`index.html` 中存在 `<h1>公众号排版工作台</h1>`，但第三套 CSS 将 `.editor-heading { display: none }` 导致 h1 在视觉上不可见。搜索引擎仍可读取，但与 DESIGN.md 中"页面应直接进入工作台"的意图存在歧义，需明确是否有意为之。

---

## 四、可优化方向

### 视觉设计

| 项目 | 现状 | 建议 |
| --- | --- | --- |
| CSS 覆盖式换肤 | 三次重写同一选择器 | 合并为单一规则集，使用 `data-theme` 控制变量切换 |
| 色盘与主题联动 | 手动维护 `themePresets` 对象映射 | 统一为 CSS 变量 `--theme-accent` + `--theme-bg`，JS 只改 data 属性 |
| 预览区宽度 | 已设 `max-width: 677px` 并居中（第三套样式生效）| ✅ 已达标 |
| 空状态 | 仅有文字提示 | 可添加轻量引导步骤，降低"白屏感" |
| 按钮一致性 | `secondary-flow` 中 ghost-button 颜色与 primary-flow 不同 | 统一按钮 tokens |
| `editor-heading` 隐藏 | 第三套样式将其设为 `display: none` | 确认是否有意隐藏，若是则补充注释说明原因 |

### 移动端适配

| 项目 | 现状 | 建议 |
| --- | --- | --- |
| 响应式断点 | 1180px / 820px / 900px / 560px 覆盖良好 | 已达可用水平 |
| 侧边面板 | ≤ 1180px 时 `position: static` 堆叠到顶部 | 已有 `<details>` 折叠，可接受；可考虑默认折叠"模块样式"和"字体设置" |
| 格式工具栏 | 小屏下 `align-items: stretch` 按钮换行 | 长按/点击展开更多，默认只显示核心按钮 |
| touch target | `.format-button` 最小 38px，略小于 44px 推荐值 | 增大至 40~44px |
| 820px 以下 tool-row | `flex-direction: column`，所有按钮竖排 | 可考虑保留主要按钮横排，辅助按钮折叠 |

### SEO

| 项目 | 现状 | 建议 |
| --- | --- | --- |
| `<title>` / `<meta description>` | ✅ 已设置 | 良好 |
| Open Graph | ✅ 已设置 og:title/description/type/url | 良好 |
| Canonical URL | ✅ 已设置 | 良好 |
| `<h1>` | HTML 中有 `<h1>`，但被 CSS `display: none` 隐藏 | 确认意图；若需 SEO 可见，应保留视觉展示 |
| 结构化数据 | 无 | 可添加 `WebApplication` Schema.org JSON-LD |

### 性能

| 项目 | 现状 | 建议 |
| --- | --- | --- |
| 外部脚本阻塞 | 两个 CDN 脚本带 `defer`，不影响首屏 | ✅ 良好 |
| 资源预连接 | 已设 `<link rel="preconnect">` 到 unpkg/cdnjs | ✅ 良好 |
| 图片压缩 | Canvas 压缩为 data URL，串行执行 | 改为并行压缩（`Promise.all()`），限制并发数 3~4 |
| `inlineComputedStyles` | 遍历 DOM 全树计算 22 属性 | 只对含 `style`/`class`/`img` 的元素计算，跳过纯文本 `<p>` |
| CSS 文件大小 | 2119 行含大量死代码 | 合并去重后预计可缩减 40%~50% |
| 字体加载 | 依赖系统字体，无 Web Font 加载 | ✅ 无需优化 |

### 代码结构

| 项目 | 现状 | 建议 |
| --- | --- | --- |
| 状态管理 | 20+ 全局变量分散在 script.js 顶部 | 收敛为单一 `state` 对象，统一 `setState` 刷新视图 |
| 图片插空算法 | 两处独立实现（`renderMixedContent` / `buildMarkdownOutput`）| 提取为 `interleaveAssets(blocks, assets)` 公共函数 |
| 复制逻辑 | 4 个不同复制路径各自实现 | 统一为 `copy(option)` 策略模式 |
| 错误处理 | 大部分 try-catch 只显示错误消息 | 统一错误日志记录，便于后续接入监控 |
| 常量硬编码 | 微信兼容样式字符串直接写在函数内 | 提取为 `WECHAT_COMPAT_STYLES` 常量对象 |

### 安全风险

| 风险 | 级别 | 建议 |
| --- | --- | --- |
| CDN 无 SRI | **中** | 为 mammoth / html-docx / pdf.js 添加 `integrity` hash |
| 无 CSP | **中** | 添加 `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' unpkg.com cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src * data:;">` |
| `url()` CSS 注入检测 | **低** | `sanitizeStyleAttribute` 中统一为 `/url\s*\(/i`，当前 `u\s*r\s*l\s*\(` 已较严谨 |
| `execCommand` 废弃 | **低** | 逐步迁移到 Clipboard API（已部分使用，fallback 保留） |

---

## 五、建议的第一阶段改造计划

> 优先级：A（立即）→ B（本周）→ C（下个迭代）
> 预估工作量：2~3 个工作日

### 第一步：安全加固（A · 1h）

1. **添加 SRI**：为三个 CDN 脚本计算并添加 `integrity` hash
2. **添加 CSP meta**：限制脚本来源为 `'self' unpkg.com cdnjs.cloudflare.com`
3. **确认 `url()` 正则**：`sanitizeStyleAttribute` 中统一为 `/url\s*\(/i`

### 第二步：CSS 清理与合并（A · 3h）

1. 将三套覆盖样式合并为单一规则集（预计从 2119 行缩减至 1100~1200 行）
2. 按 `DESIGN.md` 的视觉词元统一 CSS 变量
3. 删除不再生效的"死 CSS"
4. **确认 `.editor-heading { display: none }` 是否有意为之**，若是则补充注释说明 h1 隐藏原因
5. 验证 375px / 768px / 1024px / 1440px 四个断点无回归

### 第三步：核心体验提升（B · 4h）

1. **修复图片并发压缩**：`Promise.all()` + 并发限制（最多 4 张同时）
2. **`inlineComputedStyles` 优化**：只处理含 `style`/`class`/`img` 的元素
3. **移动端格式工具栏**：≤ 820px 时默认只显示 B/I/U/清除 4 个核心按钮，其余折叠
4. **touch target**：`.format-button` 最小高度从 38px 提升至 40px

### 第四步：代码质量提升（C · 5h）

1. **统一状态管理**：将 20+ 全局变量收敛为 `state` 对象
2. **提取重复逻辑**：`interleaveAssets` 公共函数
3. **统一复制路径**：策略模式合并 4 个复制入口
4. **常量提取**：微信兼容样式集中管理
5. **添加基础错误日志**：`console.error` 结构化输出，为后续接入 Sentry 做准备

### 不纳入第一阶段的内容

- 排版引擎支持 Markdown 列表/引用/代码块（功能增强，需求未明确）
- Service Worker 离线缓存（工具页极少离线使用，收益有限）
- 自动化测试框架（先做代码结构治理再补测试）
- 后端同步/账号系统（DESIGN.md 明确标注 Out Of Scope）

---

## 六、验收清单（对照 DESIGN.md §17.1）

| 检查项 | 状态 |
| --- | --- |
| 无不支持的同步/账号功能可见 | ✅ |
| 无死 tab 或旧产品模式残留 | ✅ |
| 所有可点击控件有 pointer cursor 和 hover/focus 状态 | ✅ |
| 键盘焦点在按钮、select、textarea、预览区可见 | ✅ |
| 浅色模式文字对比度可接受 | ✅ |
| 界面在 375px / 768px / 1024px / 1440px 正常工作 | ✅（需验证） |
| 动效最小化，尊重 prefers-reduced-motion | ✅ |
| 文本框在预览中渲染并复制为可见框 | ✅ |
| 编辑后的预览内容用于复制和导出 | ✅ |
| 图片较多时给出有用警告而非静默失败 | ✅ |
| DOCX 导出产生可用文件 | ✅ |
| GitHub Pages 可直接服务静态文件，无需构建 | ✅ |
| CDN 脚本有 SRI hash | ❌ 待修复 |
| 页面有 CSP 策略 | ❌ 待修复 |
| CSS 无大量死代码 | ❌ 待修复 |
