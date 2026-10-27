/**
 * Browser half of dsh-exec-feed-copy.
 *
 * 目标：在文档预览里打开《E00xx_视频生成执行稿.md》时，点击分段（VID-…）
 * text 块右上方的「复制」按钮，剪贴板得到的是
 *
 *     总控提示词 + 空行 + 该分段提示词
 *
 * 按钮本身的外观完全不变（图标/文案保持宿主原样），点击反馈也只复刻
 * 宿主原生的「已复制」瞬时状态；总控块及其它普通代码块保持原生行为。
 *
 * 实现方式（纯 DOM，不依赖宿主内部模块）：
 * - 文档预览的 Markdown 容器带 [data-document-markdown]；每个代码块是
 *   div.md-code-block，横幅 [data-code-block-banner] 内的 button 触发复制。
 * - 在 document 捕获阶段拦截点击：若命中「位于 VID 标题小节内的代码块」
 *   且文中存在「总控标题小节内的第一个代码块」，则 stopPropagation 阻断
 *   原生 handler，改写剪贴板并复刻原生 copied 反馈。
 * - 不做任何常驻 DOM 改写（无 MutationObserver、不改按钮文案/图标）。
 */
window.__ModuleLoader__.load({
  id: 'dsh-exec-feed-copy',
  factory: () => {
    'use strict';

    /** 总控与分段之间的分隔：一个空行。 */
    const SEPARATOR = '\n\n';
    /** 复刻宿主 copied 反馈的停留时长（宿主为 1s，留少量余量）。 */
    const FEEDBACK_MS = 1100;

    function blockText(block) {
      const pre = block.querySelector('pre');
      return pre ? pre.textContent : '';
    }

    function isHeading(el) {
      return /^H[1-6]$/.test(el.tagName);
    }

    /**
     * 按文档顺序扫描容器，标出：
     * - controlText：第一个「总控」标题小节内代码块的文本；
     * - segBlocks：所有位于 VID-… 标题小节内的代码块。
     */
    function analyze(container) {
      let controlText = null;
      const segBlocks = new Set();
      let heading = '';
      const nodes = container.querySelectorAll('h1,h2,h3,h4,h5,h6,.md-code-block');
      for (const el of nodes) {
        if (isHeading(el)) {
          heading = el.textContent || '';
          continue;
        }
        if (controlText === null && /总控/.test(heading)) {
          controlText = blockText(el);
        }
        if (/VID-/i.test(heading)) segBlocks.add(el);
      }
      return { controlText: controlText || '', segBlocks };
    }

    /**
     * 找到承载 Markdown 的容器：优先文档预览的 [data-document-markdown]；
     * 否则向上找一个「同时包含 总控 标题与 VID- 标题、且含 ≥2 个代码块」
     * 的最小祖先（覆盖其它使用同一渲染原语的预览面）。
     */
    function findContainer(block) {
      const direct = block.closest('[data-document-markdown]');
      if (direct) return direct;
      let el = block.parentElement;
      while (el && el !== document.body && el !== document.documentElement) {
        if (el.querySelectorAll('.md-code-block').length >= 2) {
          const texts = Array.from(
            el.querySelectorAll('h1,h2,h3,h4,h5,h6'),
            (h) => h.textContent || ''
          );
          if (texts.some((t) => /总控/.test(t)) && texts.some((t) => /VID-/i.test(t))) {
            return el;
          }
        }
        el = el.parentElement;
      }
      return null;
    }

    async function copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch { /* fall through */ }
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
      } catch {
        return false;
      }
    }

    let feedbackTimer = 0;

    /**
     * 复刻宿主原生 copied 反馈：按钮短暂显示「已复制/Copied」后原样恢复。
     * 通过 innerHTML 整体保存/恢复，图标等子节点不会被破坏；按钮的 class、
     * 尺寸与宿主样式完全不动。
     */
    function feedback(btn) {
      if (btn.dataset.dshEfcBusy === '1') return;
      btn.dataset.dshEfcBusy = '1';
      const original = btn.innerHTML;
      const label = /^Copy$/i.test(btn.textContent.trim()) ? 'Copied' : '已复制';
      btn.textContent = label;
      clearTimeout(feedbackTimer);
      feedbackTimer = setTimeout(() => {
        btn.innerHTML = original;
        delete btn.dataset.dshEfcBusy;
      }, FEEDBACK_MS);
    }

    function onClick(event) {
      const target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      const btn = target.closest('button');
      if (!btn) return;
      const block = btn.closest('.md-code-block');
      if (!block) return;
      const container = findContainer(block);
      if (!container) return;
      const { controlText, segBlocks } = analyze(container);
      if (!controlText || !segBlocks.has(block)) return;
      const segText = blockText(block);
      if (!segText) return;
      event.preventDefault();
      event.stopPropagation();
      copyText(controlText + SEPARATOR + segText).then((ok) => { if (ok) feedback(btn); });
    }

    function start() {
      if (typeof document === 'undefined') return () => {};
      document.addEventListener('click', onClick, true);
      return () => document.removeEventListener('click', onClick, true);
    }

    const module = { exports: {} };
    module.exports.apply = (ctx) => {
      try { ctx?.effect?.(() => start(), 'exec-feed-copy: document copy hook'); }
      catch { start(); }
    };
    module.exports.inject = [];
    return module.exports;
  },
});
