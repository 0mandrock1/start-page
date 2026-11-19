(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const trigger = $('clipboardRadar');
  const panel = $('clipboardRadarPanel');
  const closeButton = $('clipboardRadarClose');
  const status = $('clipboardRadarStatus');
  const pasteWrap = $('clipboardRadarPaste');
  const pasteInput = $('clipboardRadarInput');
  const resultWrap = $('clipboardRadarResult');
  const typeLabel = $('clipboardRadarType');
  const preview = $('clipboardRadarPreview');
  const copyButton = $('clipboardRadarCopy');
  const actionButton = $('clipboardRadarAction');

  let current = null;
  let requestId = 0;
  let copyTimer = 0;
  let stateVersion = 0;

  const UUID = /^[{(]?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[})]?$/i;
  const ERROR = /\b(?:error|exception|traceback|stack trace|sqlstate|fatal|uncaught|failed|failure|panic|segmentation fault)\b|HTTP\s+[45]\d\d/i;
  const URL_HINT = /^(?:https?:\/\/|www\.)|^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#]|$)/i;

  function classifyClipboard(raw) {
    const text = String(raw || '').trim();
    if (!text) return null;

    if (UUID.test(text)) {
      return {
        kind: 'UUID',
        description: 'Ідентифікатор',
        display: text,
        copyValue: text.replace(/^[{(]|[})]$/g, '').toLowerCase(),
        actionText: 'знайти',
        actionUrl: 'https://duckduckgo.com/?q=' + encodeURIComponent(text)
      };
    }

    if (URL_HINT.test(text) && !/\s/.test(text)) {
      try {
        const candidate = /^https?:\/\//i.test(text) ? text : 'https://' + text;
        const url = new URL(candidate);
        if (['https:', 'http:'].includes(url.protocol) && url.hostname) {
          return {
            kind: 'URL',
            description: 'Вебадреса',
            display: text,
            copyValue: url.href,
            actionText: 'відкрити',
            actionUrl: url.href
          };
        }
      } catch {}
    }

    if (text.length <= 262144 && /^[\[{]/.test(text)) {
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object') {
          const formatted = JSON.stringify(parsed, null, 2);
          return {
            kind: 'JSON',
            description: Array.isArray(parsed) ? 'Масив JSON' : 'Об’єкт JSON',
            display: formatted,
            copyValue: formatted
          };
        }
      } catch {}
    }

    if (ERROR.test(text)) {
      const errorLine = text.split(/\r?\n/).find(line => ERROR.test(line)) || text.split(/\r?\n/)[0];
      return {
        kind: 'ERROR',
        description: 'Помилка або stack trace',
        display: text,
        copyValue: text,
        actionText: 'пошук помилки',
        actionUrl: 'https://duckduckgo.com/?q=' + encodeURIComponent(errorLine.trim().slice(0, 180))
      };
    }

    return {
      kind: 'TEXT',
      description: 'Звичайний текст',
      display: text,
      copyValue: text
    };
  }

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.dataset.error = String(isError);
  }

  function resetCopyFeedback() {
    clearTimeout(copyTimer);
    copyButton.classList.remove('is-copied');
    copyButton.textContent = 'копіювати';
    copyButton.setAttribute('aria-label', 'Копіювати');
  }

  function clearData() {
    stateVersion += 1; // ігноруємо асинхронні результати старого вмісту
    current = null;
    pasteInput.value = '';
    preview.textContent = '';
    typeLabel.textContent = '';
    resultWrap.hidden = true;
    pasteWrap.hidden = true;
    actionButton.hidden = true;
    actionButton.removeAttribute('data-url');
    resetCopyFeedback();
  }

  function closePanel(restoreFocus = false) {
    requestId += 1;
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    clearData();
    if (restoreFocus) trigger.focus();
  }

  function renderClipboard(text) {
    clearData();
    const detected = classifyClipboard(text);
    if (!detected) {
      setStatus('Буфер порожній.', true);
      console.debug('[start-page] clipboard radar empty');
      return;
    }
    current = detected;
    typeLabel.textContent = detected.kind + ' // ' + detected.description;
    preview.textContent = detected.display.length > 320
      ? detected.display.slice(0, 320) + '\n…'
      : detected.display;
    resultWrap.hidden = false;
    if (detected.actionUrl) {
      actionButton.hidden = false;
      actionButton.textContent = detected.actionText;
      actionButton.dataset.url = detected.actionUrl;
    }
    setStatus('Розпізнано локально · ' + text.length + ' символів');
    console.debug('[start-page] clipboard radar classified', {
      kind: detected.kind, length: text.length
    });
  }

  trigger.addEventListener('click', async () => {
    if (!panel.hidden) {
      closePanel();
      return;
    }

    const request = ++requestId;
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    clearData();
    setStatus('Зчитування буфера…');
    try {
      if (!navigator.clipboard?.readText) throw new Error('Clipboard API unavailable');
      const text = await navigator.clipboard.readText();
      if (request !== requestId) return;
      renderClipboard(text);
    } catch (error) {
      if (request !== requestId) return;
      setStatus('Автоматичне читання недоступне. Можна вставити вручну.', true);
      pasteWrap.hidden = false;
      pasteInput.focus();
      console.debug('[start-page] clipboard radar fallback to paste', {
        reason: error?.name || 'unavailable'
      });
    }
  });

  pasteInput.addEventListener('input', () => {
    if (pasteInput.value) renderClipboard(pasteInput.value);
  });

  copyButton.addEventListener('click', async () => {
    if (!current) return;
    const content = current.copyValue;
    const version = stateVersion;
    resetCopyFeedback();
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(content);
      // Clipboard content might have changed while the promise was pending.
      if (version !== stateVersion || !current || current.copyValue !== content || panel.hidden) return;
      copyButton.classList.add('is-copied');
      copyButton.textContent = '✓ скопійовано';
      copyButton.setAttribute('aria-label', 'Скопійовано');
      setStatus('Скопійовано до буфера');
      console.debug('[start-page] clipboard radar copied', {
        kind: current.kind, length: content.length
      });
      copyTimer = setTimeout(resetCopyFeedback, 1800);
    } catch (error) {
      setStatus('Не вдалося скопіювати. Перевір дозвіл браузера.', true);
      console.debug('[start-page] clipboard radar copy denied', {
        reason: error?.name || 'unavailable'
      });
    }
  });

  actionButton.addEventListener('click', () => {
    if (!current?.actionUrl) return;
    const destination = current.actionUrl;
    console.debug('[start-page] clipboard radar action', { kind: current.kind });
    const newTab = window.open(destination, '_blank', 'noopener');
    // 'noopener' can return null even on success. Never report false failure.
    void newTab;
  });

  closeButton.addEventListener('click', () => closePanel(true));
  document.addEventListener('pointerdown', (event) => {
    if (!panel.hidden && !event.target.closest('#clipboardRadarWrap')) closePanel();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault();
      closePanel(true);
    }
  });
})();
