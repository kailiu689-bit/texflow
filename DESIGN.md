# TeXflow Design Spec

## 1. Product Positioning

TeXflow is a WeChat Official Account article formatting workstation.

The product should help a non-technical editor turn raw text, Word/PDF material, and images into a clean article layout that can be copied into the WeChat backend or exported as a DOCX file.

The current product must stay focused on one job:

> Make government-style WeChat article layout fast, editable, and copy-friendly.

Do not add Xiaohongshu, magazine, visualization, knowledge-card, account binding, or direct WeChat sync into the static MVP.

## 2. Primary Users

- Government/public institution editors.
- Court, bureau, school, community, and official account operators.
- Users who already have Word/PDF drafts and need a polished WeChat layout.
- Users who care more about stable copying and formal layout than visual novelty.

## 3. Core Workflow

The page should support this path:

1. Paste text or upload a document.
2. Choose one of six official-account themes.
3. Adjust font, size, line height, title style, textbox style, image style, and divider style if needed.
4. Insert or edit textboxes.
5. Preview and directly edit the formatted result.
6. Copy to WeChat backend or export DOCX.

Everything visible on the page should serve this workflow.

## 4. Explicitly Out Of Scope

For the static version, do not expose:

- WeChat account sync.
- AppID/AppSecret forms.
- Login/account systems.
- Xiaohongshu formatting.
- Magazine mode.
- Knowledge-card mode.
- Visualization/timeline mode.
- AI-agent style project builders.
- Pricing or marketing pages.

Direct WeChat sync requires a backend because AppSecret cannot be safely used in browser-only code. If added later, it should be a separate backend project or a clearly marked server-enabled edition.

## 5. Information Architecture

The MVP screen should be a single workstation, not a landing page.

Recommended page structure:

- Top bar: brand name and minimal status only.
- Action toolbar: upload, insert textbox, format, copy, export, focus preview.
- Design controls: theme, color, font, size, line height, module mix.
- Workspace: left input, right editable preview.
- Status strip: file parse state, copy warning, character count, paragraph count.

Avoid hidden feature panels that are not part of WeChat formatting.

## 6. Theme Set

Keep exactly six themes:

1. Long Rectangle / `long`
2. Government / `gov`
3. Minimal / `minimal`
4. Digital / `digital`
5. Block / `block`
6. Diagonal / `contrast`

Theme buttons should not imply paid/VIP features. No VIP badges.

Each theme must differ in more than background color. It should change at least:

- Heading style.
- Textbox style.
- Paragraph rhythm.
- Divider style.
- Image framing.

## 7. Theme Direction

### Long Rectangle

Purpose: steady long-form government explainer.

- Wider textboxes with rectangular proportions.
- Centered or calmly framed headings.
- Generous vertical spacing.
- Suitable for policy interpretation and event reports.

### Government

Purpose: formal public-sector announcement.

- Blue-oriented accent.
- Structured heading bars.
- Brief-style textboxes.
- Clean image frames.
- Stable, serious, official.

### Minimal

Purpose: text-heavy drafts and legal/policy explanations.

- Almost no decoration.
- Plain headings with thin separators.
- Compact paragraphs.
- Textboxes optional or very quiet.
- Highest copy stability.

### Digital

Purpose: numbered analysis and step-by-step content.

- Numbered headings.
- Numbered textboxes.
- Grid or data-like rhythm.
- Strong section indexing.
- Useful for "three points", "five measures", and process explanations.

### Block

Purpose: modular article with frequent summaries.

- Card-like paragraph blocks.
- Media/text mixed textboxes.
- Strong section blocks.
- Suitable for cases, activity recaps, and illustrated stories.

### Diagonal

Purpose: stronger editorial emphasis.

- High-contrast title treatment.
- Red/blue court-style textboxes.
- Slightly angular or stamp-like heading language.
- Useful for law, court, discipline, and warning topics.

## 8. Textbox System

Textboxes are essential for government WeChat articles and must remain a first-class feature.

Textboxes should support:

- Intro / guide text.
- Key point.
- Reminder.
- Numbered item.
- Quote/excerpt.
- Case summary.
- Image + text block.

Textbox rules:

- They must render in preview.
- They must be editable in the right preview.
- They must copy to WeChat with visible borders/background as much as possible.
- Copy HTML should prefer simple inline styles and table-based structure when needed.
- Avoid CSS pseudo-elements for copy-critical decoration.
- Avoid captions under images unless the user explicitly adds them.

## 9. WeChat Copy Compatibility

Copy stability is more important than fancy CSS.

Copy output should:

- Use inline styles.
- Avoid external CSS classes.
- Avoid scripts, pseudo-elements, complex transforms, fixed positioning, and unsupported gradients where possible.
- Use simple block elements, paragraphs, images, and tables for textboxes.
- Strip app-only attributes before copying.
- Preserve manually edited preview content.

Images:

- Keep images in the article at their approximate document position.
- Compress images before rich copy when possible.
- Warn the user when image count or image size may make WeChat backend white-screen.
- Recommend segmented copy for heavy image articles.

## 10. Word Export

Preferred format: DOCX.

Rules:

- Export should include edited preview content.
- Export should include textboxes and image layout as much as possible.
- Keep output under 15 MB when possible.
- Compress images before export.
- If DOCX generation fails, only then fallback to DOC.

## 11. Visual Language

The application UI itself should feel like a focused workbench, not a marketing site.

Use the Refero "Workable" style as the main visual reference:

- Clean canvas.
- Purposeful accents.
- Deep teal / forest green primary color.
- Warm porcelain background.
- Lightweight cards.
- Rounded but controlled component corners.
- Functional color, not decorative color.
- Subtle visual interest without heavy ornamentation.

Desired tone:

- Quiet.
- Formal.
- Dense but clear.
- Built for repeated editorial work.
- Government/editorial rather than playful SaaS.
- Modern and calm, with a little warmth.

Avoid:

- Oversized hero sections.
- Decorative landing-page blocks.
- Purple gradient AI styling.
- Too many cards inside cards.
- Unused tabs and dead features.
- Visible features that are not actually supported.
- Heavy shadows and extreme elevation.
- Arbitrary accent colors that do not map to a function.

## 11.1 Visual Tokens

Adopt a Workable-inspired token system, adjusted for Chinese government-account editing.

### Core colors

| Role | Token | Value | Usage |
| --- | --- | --- | --- |
| Page background | `--canvas` | `#fff5ee` | Overall warm app background. |
| Surface | `--surface` | `#ffffff` | Editor panes, cards, form controls. |
| Primary text | `--ink` | `#0f161e` | Body text, strong headings, button text. |
| Muted text | `--muted` | `#333942` | Secondary labels, helper text. |
| Deep teal | `--primary` | `#004038` | Primary actions, active controls, strong borders. |
| Forest | `--primary-deep` | `#012620` | Dark UI blocks, high-emphasis headers. |
| Sage | `--primary-soft` | `#00544c` | Secondary accents and borders. |
| Soft peach | `--tint-peach` | `#fde8ce` | Gentle highlighted panels. |
| Sky haze | `--tint-blue` | `#bee9f4` | Informational panels and textbox backgrounds. |
| Spring accent | `--accent` | `#7edcaf` | Success/active micro accents. |
| Warning red | `--danger` | `#d4472f` | Error state only. |

### Shape and spacing

- Base spacing unit: `8px`.
- Small control gap: `8px`.
- Section gap: `32px`.
- Pane/card padding: `24px` to `32px`.
- Button radius: `12px` to `16px`.
- Card radius: `16px`.
- Editor pane radius: `16px`.
- Avoid random radius values unless a theme intentionally needs sharper geometry.

### Typography

The application chrome should use a clean sans-serif stack:

`"Avenir Next", "Hiragino Sans GB", "Noto Sans SC", sans-serif`

Article preview should remain configurable and optimized for WeChat reading:

- Songti/serif for formal article bodies.
- Hei/sans for modern official notices.
- Kaiti only as an optional warm style, not default UI.

No negative letter spacing. Do not scale font size with viewport width inside controls.

## 11.2 UI Style Application

Use the Workable reference for the app shell, not necessarily for the article content itself.

Apply it to:

- Top bar.
- Toolbar.
- Design controls.
- Theme chips.
- Status messages.
- Input and preview pane containers.
- Export/copy actions.

Do not force it onto every WeChat article theme. The six article themes keep their own publishing styles.

App shell rules:

- Prefer flat surfaces with crisp borders.
- Use teal for active state and primary actions.
- Use peach/blue tints only to group panels or show helpful context.
- Keep shadows very subtle or remove them.
- Keep cards lightweight; do not nest card inside card inside card.
- Use color to clarify state: active, warning, success, disabled.

## 12. Layout Rules

Desktop:

- Keep the editor as the first meaningful viewport.
- Use a two-column workspace: source left, preview right.
- Keep toolbar compact.
- Keep design controls grouped but not overwhelming.
- Preview should have stable width similar to WeChat article width.

Mobile:

- Stack controls.
- Input and preview should become vertical.
- Buttons should not overflow.
- Preview text must remain readable.

## 13. Component Rules

### Toolbar

Required actions:

- Upload attachment.
- Insert textbox.
- One-click format.
- Copy to WeChat.
- Export.
- Focus preview.

Do not include WeChat sync in the static version.

### Theme Controls

Show exactly six theme chips.

Theme chips should be plain options, no VIP labels.

### Module Mixer

Allow mixing:

- Heading style.
- Textbox style.
- Body style.
- Image style.
- Divider style.

Changing any module should immediately refresh preview.

### Preview

The preview is editable and is the source of truth for copy/export once edited.

Visible focus state is required, but it should not look like an accidental cursor or broken overlay.

## 14. Accessibility

Minimum expectations:

- Buttons and form controls have accessible labels.
- Focus states are visible.
- Color contrast is sufficient for body text.
- Controls work with keyboard navigation.
- Status messages use `aria-live`.
- No text overlaps controls on narrow screens.

## 15. Error And Status Messages

Messages should be direct and useful.

Examples:

- "已复制公众号富文本，可直接粘贴到后台。"
- "建议分段复制：图片较多，公众号后台可能白屏。"
- "附件解析失败，请换一个文件再试。"
- "当前静态版不支持公众号同步。"

Do not show technical stack details unless needed for debugging.

## 16. Implementation Priorities

Priority 1:

- Remove dead/non-MVP UI.
- Keep static deployment reliable.
- Make copy-to-WeChat stable.
- Preserve textboxes when copied.

Priority 2:

- Make the six themes visually and structurally distinct.
- Improve textbox library.
- Improve image placement and copy warnings.

Priority 3:

- Improve DOCX export fidelity.
- Add better document parsing feedback.
- Add segmented-copy helper for image-heavy articles.

Priority 4:

- Consider a separate backend edition for WeChat draft sync.

## 17. Acceptance Criteria

A release is acceptable when:

- The static ZIP deploys successfully through Netlify Drop.
- The page opens directly to the WeChat formatting workstation.
- No unsupported sync/account features are visible.
- All six themes are selectable.
- Textboxes appear in preview and copy to WeChat with visible structure.
- Edited preview content is used for copy and DOCX export.
- Articles with images either copy successfully or show a clear segmented-copy warning.
- DOCX export works and aims to stay below 15 MB.

## 18. Design Principle

When uncertain, choose the option that makes a government-account editor faster and safer.

Beautiful is useful here only when it survives WeChat copy, Word export, and repeated real work.
