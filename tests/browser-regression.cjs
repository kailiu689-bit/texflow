const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const artifacts = path.join(__dirname, '.artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  const target = fs.existsSync(file) && fs.statSync(file).isDirectory() ? path.join(file, 'index.html') : file;
  if (!target.startsWith(root + path.sep) || !fs.existsSync(target)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.mjs': 'application/javascript' })[path.extname(target)] || 'application/octet-stream');
  fs.createReadStream(target).pipe(res);
});
const sample = '# 第一节\n这是一段足够长的普通正文，用来验证排版与编辑功能。\n这是第二段独立的正文，操作之后应该仍然完整保留。';
let browser, baseURL, passed = 0, failed = 0;
async function check(name, fn) {
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(baseURL);
    await page.waitForFunction(() => typeof draftReady !== 'undefined' && draftReady);
    await fn(page, context);
    assert.deepEqual(errors, [], '页面运行错误');
    passed++; console.log(`PASS ${name}`);
  } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error.message}`);
    await page.screenshot({ path: path.join(artifacts, name + '.png'), fullPage: true });
  } finally { await context.close(); }
}
(async () => {
  if (!process.env.TEXFLOW_TEST_URL) await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseURL = process.env.TEXFLOW_TEST_URL || `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }) });
  await check('alignment-normalization', async (page) => {
    const actual = await page.evaluate(() => {
      const holder = document.createElement('div');
      holder.innerHTML = sanitizeWechatHtml('<p style="text-align:start">A</p><p style="text-align:end">B</p><p dir="rtl" style="text-align:start">C</p><p style="text-align:center">D</p>');
      return Array.from(holder.children, (node) => node.style.textAlign);
    });
    assert.deepEqual(actual, ['left', 'right', 'right', 'center']);
  });
  await check('heading-decoration-safe-line-height', async (page) => {
    await page.locator('#sourceText').fill('# 单价更便宜，顾客为什么不买？\n这是一段用于检查微信复制结构的正文。');
    for (const theme of ['long', 'gov', 'minimal', 'digital', 'block', 'contrast']) {
      await page.locator(`[data-theme="${theme}"]`).click();
      for (const alignment of ['left', 'center', 'right']) {
        const result = await page.evaluate(async (alignment) => {
          preview.querySelector('h2').dataset.headingAlign = alignment;
          const html = (await buildRichHtmlOutput()).html;
          const holder = document.createElement('div'); holder.innerHTML = html;
          const line = holder.querySelector('h2 > span:last-child');
          return { html, text: line.textContent, width: line.style.width, border: line.style.borderTopWidth };
        }, alignment);
        assert.doesNotMatch(result.html, /(?:line-height|font-size):\s*0(?:px)?\s*[;"']/);
        assert.equal(result.text, '');
        assert.equal(result.width, '38px');
        assert.equal(result.border, '3px');
      }
    }
  });
  await check('enlarged-text-safe-line-height', async (page) => {
    await page.locator('#sourceText').fill(sample);
    const result = await page.evaluate(async () => {
      const paragraph = preview.querySelector('p');
      paragraph.style.lineHeight = '8px';
      paragraph.innerHTML = '<span style="font-size:36px">局部放大的文字应能正常换行，不会与下一行重叠。</span>';
      markPreviewEdited();
      const html = (await buildRichHtmlOutput()).html;
      const holder = document.createElement('div'); holder.style.width = '375px'; holder.innerHTML = html;
      document.body.appendChild(holder);
      const styles = Array.from(holder.querySelectorAll('h2,p,span'), (node) => {
        const computed = getComputedStyle(node);
        return { text: node.textContent.trim(), fontSize: parseFloat(computed.fontSize), lineHeight: parseFloat(computed.lineHeight), value: node.style.lineHeight };
      }).filter((node) => node.text);
      holder.remove();
      return styles;
    });
    assert.ok(result.length > 0);
    for (const node of result) {
      assert.ok(node.lineHeight >= node.fontSize * 1.25, `字号 ${node.fontSize}，行高 ${node.lineHeight}`);
      assert.doesNotMatch(node.value, /px$/, '文字行高应随字号变化');
    }
  });
  await check('preserve-edit-on-settings', async (page) => {
    await page.locator('#sourceText').fill(sample);
    await page.locator('#preview > p').first().fill('这段手动修改必须一直保留。');
    const before = await page.locator('#preview').innerText();
    for (const theme of ['gov', 'minimal', 'digital', 'block', 'contrast', 'long']) {
      await page.locator(`[data-theme="${theme}"]`).click();
      assert.equal(await page.locator('#preview').innerText(), before);
    }
    await page.locator('summary').filter({ hasText: '字体设置' }).click();
    await page.locator('#fontSizeSelect').selectOption('20');
    await page.locator('#lineHeightSelect').selectOption('2.3');
    await page.locator('#paragraphGapSelect').selectOption('24');
    await page.locator('#pagePaddingSelect').selectOption('32');
    const computed = await page.evaluate(() => ({ fontSize: getComputedStyle(preview).fontSize, padding: getComputedStyle(preview).paddingLeft, gap: getComputedStyle(preview.querySelector('p')).marginBottom }));
    assert.deepEqual(computed, { fontSize: '20px', padding: '32px', gap: '24px' });
    assert.equal(await page.locator('#preview').innerText(), before);
  });
  await check('edited-divider-toggle', async (page) => {
    await page.locator('#sourceText').fill(sample + '\n# 第二节\n这是第二节中需要保留的正文，不应随分隔样式修改而丢失。');
    await page.locator('#preview > p').first().fill('手动修改后切换分隔线。');
    await page.locator('summary').filter({ hasText: '模块样式' }).click();
    await page.locator('#dividerStyleSelect').selectOption('none');
    assert.equal(await page.locator('#preview .section-divider').count(), 0);
    await page.locator('#dividerStyleSelect').selectOption('dots');
    assert.equal(await page.locator('#preview .section-divider').count(), 1);
    assert.match(await page.locator('#preview').innerText(), /手动修改后切换分隔线/);
  });
  await check('source-change-explicit-rebuild', async (page) => {
    await page.locator('#sourceText').fill(sample);
    await page.locator('#preview > p').first().fill('保留右侧编辑。');
    await page.locator('#sourceText').fill('# 新原文\n新的正文应该等到按下排版按钮之后才替换右侧内容。');
    assert.match(await page.locator('#preview').innerText(), /保留右侧编辑/);
    await page.locator('#formatButton').click();
    assert.match(await page.locator('#preview').innerText(), /新原文/);
    await page.waitForTimeout(1200);
    await page.locator('#undoButton').click();
    assert.match(await page.locator('#preview').innerText(), /保留右侧编辑/);
  });
  await check('undo-redo-and-branch', async (page) => {
    await page.locator('#sourceText').fill(sample);
    const before = await page.locator('#preview').innerText();
    await page.locator('#preview > p').first().fill('修改后的正文。');
    await page.locator('#undoButton').click();
    assert.equal(await page.locator('#preview').innerText(), before);
    await page.locator('#redoButton').click();
    assert.match(await page.locator('#preview').innerText(), /修改后的正文/);
    await page.locator('#undoButton').click();
    await page.locator('#preview > p').first().fill('新的修改分支。');
    assert.equal(await page.locator('#redoButton').isDisabled(), true);
  });
  await check('heading-image-and-block-movement', async (page) => {
    await page.locator('#sourceText').fill(sample);
    await page.locator('#preview > p').first().click();
    await page.locator('[data-action="heading"]').click();
    assert.equal(await page.locator('#preview > h2').count(), 2);
    await page.locator('[data-action="paragraph"]').click();
    assert.equal(await page.locator('#preview > h2').count(), 1);
    await page.locator('#previewImageInput').setInputFiles(path.join(__dirname, 'fixtures/sample.png'));
    await page.waitForFunction(() => preview.querySelector('img'));
    const before = await page.locator('#preview').innerHTML();
    await page.locator('[data-action="moveUp"]').click();
    assert.notEqual(await page.locator('#preview').innerHTML(), before);
    await page.locator('[data-action="deleteBlock"]').click();
    assert.equal(await page.locator('#preview img').count(), 0);
    await page.locator('#undoButton').click();
    assert.equal(await page.locator('#preview img').count(), 1);
  });
  await check('draft-roundtrip-with-image', async (page) => {
    await page.locator('#sourceText').fill(sample);
    await page.locator('#preview > p').first().fill('手动编辑和图片必须恢复。');
    await page.locator('#previewImageInput').setInputFiles(path.join(__dirname, 'fixtures/sample.png'));
    await page.waitForFunction(() => preview.querySelector('img'));
    await page.locator('[data-theme="gov"]').click();
    await page.locator('#saveDraftButton').click();
    await page.waitForFunction(() => draftStatus.textContent.startsWith('已存本机'));
    const before = await page.locator('#preview').innerText();
    await page.reload();
    await page.waitForFunction(() => draftStatus.textContent === '已恢复本机草稿');
    assert.equal(await page.locator('#preview').innerText(), before);
    assert.equal(await page.locator('#preview img').count(), 1);
    assert.equal(await page.locator('[data-theme="gov"]').getAttribute('class'), 'theme-chip active');
  });
  await check('immediate-navigation-draft', async (page) => {
    await page.locator('#sourceText').fill(sample);
    await page.reload();
    await page.waitForFunction(() => typeof draftReady !== 'undefined' && draftReady);
    assert.equal(await page.locator('#sourceText').inputValue(), sample);
    await page.locator('#preview > p').first().fill('立刻刷新也要保留手动编辑。');
    await page.reload();
    await page.waitForFunction(() => typeof draftReady !== 'undefined' && draftReady);
    assert.match(await page.locator('#preview').innerText(), /立刻刷新也要保留手动编辑/);
  });
  await check('save-failure-feedback', async (page) => {
    await page.locator('#sourceText').fill(sample);
    await page.evaluate(() => { accessDraft = async () => { throw new Error('QuotaExceededError'); }; });
    await page.locator('#saveDraftButton').click();
    await page.waitForFunction(() => draftStatus.textContent === '草稿未保存');
    assert.match(await page.locator('#preview').innerText(), /普通正文/);
    assert.match(await page.locator('#fileStatus').innerText(), /导出文章备份/);
  });
  await check('docx-image-order-and-failed-import', async (page) => {
    await page.waitForFunction(() => window.mammoth, { timeout: 20000 });
    await page.locator('#fileInput').setInputFiles(path.join(__dirname, 'fixtures/article.docx'));
    await page.waitForFunction(() => preview.querySelector('img'));
    const order = await page.evaluate(() => Array.from(preview.children, (node) => node.querySelector('img') ? 'IMAGE' : node.textContent));
    const imageIndex = order.indexOf('IMAGE');
    assert.match(order[imageIndex - 1], /图片之前/);
    assert.match(order[imageIndex + 1], /图片之后/);
    const before = await page.locator('#preview').innerHTML();
    await page.locator('#fileInput').setInputFiles({ name: 'broken.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('broken') });
    await page.waitForFunction(() => fileStatus.classList.contains('error'));
    assert.equal(await page.locator('#preview').innerHTML(), before);
  });
  await check('clipboard-all-copy-paths', async (page) => {
    await page.locator('#sourceText').fill(sample);
    await page.locator('#preview > p').first().fill('编辑后的正文也必须复制成功。');
    await page.evaluate(() => { preview.querySelector('p').style.textAlign = 'start'; });
    await page.locator('#copyButton').click();
    await page.waitForFunction(() => copyButton.textContent === '已复制');
    const html = await page.evaluate(async () => { const items = await navigator.clipboard.read(); return (await items[0].getType('text/html')).text(); });
    assert.match(html, /编辑后的正文/);
    assert.doesNotMatch(html, /text-align:\s*(start|end|inherit|unset)/);
    assert.match(html, /font-size:\s*16px/);
    await page.evaluate(async () => { await copyPreviewSegment(createCopySegments()[0]); });
    const segment = await page.evaluate(async () => { const items = await navigator.clipboard.read(); return (await items[0].getType('text/html')).text(); });
    assert.doesNotMatch(segment, /text-align:\s*(start|end|inherit|unset)/);
    await page.evaluate(async () => { const output = await buildRichHtmlOutput(); await fallbackCopyHtml(output.html, preview.innerText); });
    const fallback = await page.evaluate(async () => { const items = await navigator.clipboard.read(); return (await items[0].getType('text/html')).text(); });
    assert.doesNotMatch(fallback, /text-align:\s*(start|end|inherit|unset)/);
    for (const output of [html, segment, fallback]) {
      assert.doesNotMatch(output, /(?:line-height|font-size):\s*0(?:px)?\s*[;"']/);
      assert.doesNotMatch(output, /line-height:\s*[\d.]+px/);
    }
  });
  await check('callout-format-and-highlight', async (page) => {
    await page.locator('#sourceText').fill('【文本框：提示】\n文本框里的内容需要保留。\n【/文本框】');
    await page.evaluate(() => { preview.querySelector('aside p').innerHTML = '<strong style="color:red">保留加粗颜色</strong><br>保留换行'; markPreviewEdited(); });
    const html = await page.evaluate(async () => (await buildRichHtmlOutput()).html);
    assert.match(html, /<strong[^>]*color:\s*(red|rgb\(255, 0, 0\))/);
    assert.match(html, /<br(?:\s|>)/);
    await page.locator('[data-theme="minimal"]').click();
    assert.doesNotMatch(await page.evaluate(async () => (await buildRichHtmlOutput()).html), /<table/);
  });
  await check('phone-preview-responsive-export', async (page) => {
    await page.locator('#sourceText').fill(sample);
    await page.locator('#phonePreviewButton').click();
    assert.equal(await page.locator('#preview').evaluate((node) => node.getBoundingClientRect().width), 375);
    const html = await page.evaluate(async () => (await buildRichHtmlOutput()).html);
    const frozen = await page.evaluate((html) => {
      const holder = document.createElement('div'); holder.innerHTML = html;
      return Array.from(holder.querySelectorAll('section,p,figure,table'), (node) => node.style.width).filter((width) => width.endsWith('px'));
    }, html);
    assert.deepEqual(frozen, []);
    await page.screenshot({ path: path.join(artifacts, 'desktop.png'), fullPage: true });
  });
  await check('mobile-no-horizontal-overflow', async (page) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.locator('#sourceText').fill(sample);
    for (const width of [375, 768, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `横向溢出 ${width}`);
      assert.equal(await page.evaluate(() => {
        const toolbar = document.querySelector('.format-toolbar');
        return Array.from(toolbar.querySelectorAll('button')).every((button) => button.getBoundingClientRect().bottom <= toolbar.getBoundingClientRect().bottom + 1);
      }), true, `编辑工具栏被裁切 ${width}`);
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await page.waitForFunction(() => typeof draftReady !== 'undefined' && draftReady);
    await page.locator('.preview-pane').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(artifacts, 'mobile.png') });
  });
  await check('pdf-import-and-worker', async (page) => {
    await page.locator('#fileInput').setInputFiles(path.join(__dirname, 'fixtures/article.pdf'));
    await page.waitForFunction(() => preview.querySelector('img'), { timeout: 20000 });
    assert.match(await page.locator('#sourceText').inputValue(), /Texflow PDF import test/);
    assert.equal(await page.locator('#preview img').count(), 1);
    const output = await page.evaluate(async () => buildRichHtmlOutput());
    assert.equal(output.metrics.fallbackImages, 0);
    assert.equal(output.metrics.imageCount, 1);
  });
  await check('image-compression-and-html-dimensions', async (page) => {
    await page.locator('#previewImageInput').setInputFiles(path.join(__dirname, 'fixtures/sample.png'));
    await page.waitForFunction(() => preview.querySelector('img'));
    const output = await page.evaluate(async () => buildRichHtmlOutput());
    assert.equal(output.metrics.imageCount, 1);
    assert.equal(output.metrics.fallbackImages, 0);
    assert.ok(output.metrics.totalImageBytes > 0 && output.metrics.totalImageBytes <= 360 * 1024);
    assert.match(output.html, /height:\s*auto/);
    assert.match(output.html, /data:image\/jpeg;base64/);
  });
  await check('word-and-markdown-export', async (page) => {
    await page.locator('#sourceText').fill(sample);
    await page.locator('#preview > p').first().fill('导出必须保留手动编辑。');
    const html = await page.evaluate(async () => buildWordHtml(copyImageOptions));
    assert.match(html, /导出必须保留手动编辑/);
    assert.doesNotMatch(html, /text-align:\s*start/);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#exportMdButton').click();
    const download = await downloadPromise;
    const file = await download.path();
    assert.match(fs.readFileSync(file, 'utf8'), /导出必须保留手动编辑/);
    assert.match(fs.readFileSync(file, 'utf8'), /## 第一节/);
    const wordDownloadPromise = page.waitForEvent('download');
    await page.locator('#exportButton').click();
    const wordDownload = await wordDownloadPromise;
    assert.match(wordDownload.suggestedFilename(), /\.docx$/);
    const wordFile = await wordDownload.path();
    assert.equal(fs.readFileSync(wordFile).subarray(0, 2).toString(), 'PK');
  });
  console.log(`RESULT ${passed} passed, ${failed} failed`);
  fs.writeFileSync(path.join(artifacts, 'result.json'), JSON.stringify({ passed, failed, baseURL }, null, 2));
  process.exitCode = failed ? 1 : 0;
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); server.close(); });
