// ==UserScript==
// @name         INCORE — Масова перевірка ЮР осіб
// @namespace    https://incore.universalna.com/
// @version      1.4.0
// @description  Перевіряє список ЮО за ЄДРПОУ: чи є в INCORE та чи є поліси (НАШ / НЕ НАШ)
// @author       Oleg Volokhovskyi
// @match        https://incore.universalna.com/*
// @grant        GM_addStyle
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/Mangotid/oscpv-userscripts/main/INCORE/incore-yur-checker.user.js
// @downloadURL  https://raw.githubusercontent.com/Mangotid/oscpv-userscripts/main/INCORE/incore-yur-checker.user.js
// ==/UserScript==

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────
  let shouldStop = false;
  let results = [];

  // ── Antiforgery token ──────────────────────────────────────────────────────
  function getTokenFromDOM() {
    // 1. Hidden inputs
    const selectors = [
      'input[name="__RequestVerificationToken"]',
      'input[name="RequestVerificationToken"]',
      'meta[name="RequestVerificationToken"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) { const v = el.value || el.content; if (v) return v; }
    }
    // 2. Global JS variable (some ASP.NET setups)
    if (window.__RequestVerificationToken) return window.__RequestVerificationToken;
    // 3. jQuery ajaxSetup headers (INCORE uses jQuery heavily)
    try {
      const jq = window.jQuery || window.$;
      if (jq && jq.ajaxSettings && jq.ajaxSettings.headers) {
        const h = jq.ajaxSettings.headers;
        const v = h['RequestVerificationToken'] || h['requestverificationtoken'];
        if (v) return v;
      }
    } catch (_) {}
    // 4. Any hidden input anywhere in the page
    for (const inp of document.querySelectorAll('input[type="hidden"]')) {
      if (/requestverification/i.test(inp.name) && inp.value) return inp.value;
    }
    return null;
  }

  async function fetchToken() {
    let token = getTokenFromDOM();
    if (token) { console.log('[IC] Token from DOM'); return token; }
    // Fallback: fetch the dictionary page which has a form with the token
    try {
      const res = await fetch('/Dictionaries/JuridicalPersons', { credentials: 'include' });
      const html = await res.text();
      const patterns = [
        /name="__RequestVerificationToken"[^>]+value="([^"]+)"/i,
        /name="RequestVerificationToken"[^>]+value="([^"]+)"/i,
        /<meta[^>]+name="RequestVerificationToken"[^>]+content="([^"]+)"/i,
        /RequestVerificationToken['"]\s*:\s*['"]([^'"]+)['"]/i,
      ];
      for (const re of patterns) {
        const m = html.match(re);
        if (m && m[1]) { console.log('[IC] Token from page fetch'); return m[1]; }
      }
      console.warn('[IC] Token not found in fetched page HTML');
    } catch (e) {
      console.warn('[IC] Token fetch error:', e);
    }
    return null;
  }

  // ── API ────────────────────────────────────────────────────────────────────
  const PAGE_ID = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });

  function apiHeaders(token) {
    const h = {
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'x-page-id': PAGE_ID,
    };
    if (token) h['requestverificationtoken'] = token;
    return h;
  }

  // Forcibly re-fetch a fresh antiforgery token from the server (ignores DOM cache).
  async function refreshToken() {
    try {
      const res = await fetch('/Dictionaries/JuridicalPersons', { credentials: 'include' });
      const html = await res.text();
      const patterns = [
        /name="__RequestVerificationToken"[^>]+value="([^"]+)"/i,
        /name="RequestVerificationToken"[^>]+value="([^"]+)"/i,
        /<meta[^>]+name="RequestVerificationToken"[^>]+content="([^"]+)"/i,
        /RequestVerificationToken['"]\s*:\s*['"]([^'"]+)['"]/i,
      ];
      for (const re of patterns) {
        const m = html.match(re);
        if (m && m[1]) { console.log('[IC] Token refreshed'); return m[1]; }
      }
    } catch (e) {
      console.warn('[IC] Token refresh error:', e);
    }
    return null;
  }

  async function apiFetch(url, body, token) {
    const res = await fetch(url, {
      method: 'POST',
      headers: apiHeaders(token),
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.text()).slice(0, 300); } catch (_) {}
      console.error(`[IC] ${url} → HTTP ${res.status}`, detail);
      throw new Error(`HTTP_${res.status}`);
    }
    return res.json();
  }

  // One fetch attempt with automatic token-refresh retry on 400/500.
  async function apiFetchWithRetry(url, body, tokenHolder) {
    try {
      return await apiFetch(url, body, tokenHolder.value);
    } catch (e) {
      if (/HTTP_[45]/.test(e.message)) {
        console.warn('[IC] Got ' + e.message + ', refreshing token and retrying…');
        const fresh = await refreshToken();
        if (fresh) {
          tokenHolder.value = fresh;
          return await apiFetch(url, body, fresh);
        }
      }
      throw e;
    }
  }

  async function searchByEdrpou(edrpou, tokenHolder) {
    return apiFetchWithRetry('/Grid/GetDictionaryJuridicalPersons?lang=uk-UA', {
      _search: true,
      nd: Date.now(),
      rows: 10,
      page: 1,
      sidx: 'id',
      sord: 'desc',
      storeFiltersInSession: 0,
      enabled: true,
      menuIdentifier: 35,
      jsComponentId: 'JuridicalPersons',
      culture: 'uk-UA',
      IdentificationCodeEDRPOU: edrpou,
    }, tokenHolder);
  }

  // Must be called before getObjectProducts — establishes server-side session state for the entity.
  async function getEntity(gid, tokenHolder) {
    return apiFetchWithRetry('/Entity/GetEntity?lang=uk-UA', {
      gid,
      entityType: 'Face',
      loadEntityCostValues: false,
    }, tokenHolder);
  }

  async function getObjectProducts(entityGid, tokenHolder) {
    return apiFetchWithRetry('/Grid/GetObjectProducts?lang=uk-UA', {
      _search: false,
      nd: Date.now(),
      rows: 10,
      page: 1,
      sidx: 'id',
      sord: 'desc',
      storeFiltersInSession: 0,
      enabled: true,
      entityGid,
      culture: 'uk-UA',
    }, tokenHolder);
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ── Processing ─────────────────────────────────────────────────────────────
  // tokenHolder = { value: '<token>' } — mutated in-place on auto-refresh
  async function checkOne(edrpou, tokenHolder) {
    const result = { edrpou, name: '', status: 'error', statusText: 'Помилка' };

    // Step 1 — пошук по ЄДРПОУ
    const searchData = await searchByEdrpou(edrpou, tokenHolder);

    if (!searchData.IsSuccess) {
      result.statusText = searchData.ErrorMessage || 'Помилка API';
      return result;
    }

    // rows is the authoritative source; records field can be 0 even when rows exist
    const rows = searchData.rows || [];
    if (rows.length === 0) {
      result.status = 'not_found';
      result.statusText = 'НЕМАЄ в INCORE';
      return result;
    }

    const row = rows[0];
    const gid = row.id;

    await sleep(300);

    // Step 2 — відкриваємо картку (встановлює серверний стан; також беремо назву)
    const entityData = await getEntity(gid, tokenHolder);
    result.name = entityData?.Arguments?.entity?.Face?.Name
               || entityData?.Arguments?.entity?.Name
               || (row.cell && row.cell[2]) || '';

    await sleep(300);

    // Step 3 — поліси
    const productsData = await getObjectProducts(gid, tokenHolder);

    if (productsData.records > 0 || (productsData.rows && productsData.rows.length > 0)) {
      result.status = 'ours';
      result.statusText = 'Є — НАШ';
    } else {
      result.status = 'not_ours';
      result.statusText = 'Є — НЕ НАШ';
    }

    return result;
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  GM_addStyle(`
    #ic-root {
      position: fixed;
      right: 20px;
      bottom: 80px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
    }

    #ic-toggle {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #1c4f8e;
      color: #fff;
      border: none;
      cursor: pointer;
      font-size: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 12px rgba(0,0,0,.35);
      margin-left: auto;
      transition: background .2s;
    }
    #ic-toggle:hover { background: #163d70; }

    #ic-panel {
      display: none;
      width: 580px;
      max-height: 82vh;
      background: #fff;
      border-radius: 10px;
      box-shadow: 0 6px 28px rgba(0,0,0,.28);
      overflow: hidden;
      flex-direction: column;
      margin-bottom: 10px;
    }
    #ic-panel.open { display: flex; }

    .ic-hdr {
      background: #1c4f8e;
      color: #fff;
      padding: 11px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: move;
      user-select: none;
      flex-shrink: 0;
    }
    .ic-hdr h3 { margin: 0; font-size: 14px; font-weight: 700; }

    .ic-x {
      background: none; border: none; color: #fff;
      font-size: 20px; cursor: pointer; opacity: .75; padding: 0; line-height: 1;
    }
    .ic-x:hover { opacity: 1; }

    .ic-body {
      padding: 13px;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    #ic-textarea {
      width: 100%;
      height: 88px;
      border: 1px solid #ccc;
      border-radius: 5px;
      padding: 7px 9px;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 12px;
      resize: vertical;
      box-sizing: border-box;
      line-height: 1.5;
    }
    #ic-textarea:focus { outline: 2px solid #1c4f8e; border-color: transparent; }

    .ic-hint { font-size: 11px; color: #888; margin-top: -6px; }

    .ic-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

    .ic-btn {
      padding: 7px 16px;
      border-radius: 5px;
      border: none;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      transition: background .15s, opacity .15s;
    }
    .ic-btn:disabled { opacity: .45; cursor: default; }

    .ic-btn-run  { background: #1c4f8e; color: #fff; }
    .ic-btn-run:not(:disabled):hover  { background: #163d70; }

    .ic-btn-stop { background: #c00;    color: #fff; }
    .ic-btn-stop:not(:disabled):hover  { background: #900; }

    .ic-btn-csv  { background: #2e7d32; color: #fff; }
    .ic-btn-csv:not(:disabled):hover   { background: #1b5e20; }

    .ic-btn-clr  { background: #ededed; color: #333; }
    .ic-btn-clr:hover { background: #ddd; }

    .ic-prog { display: none; }
    .ic-prog.on { display: block; }
    .ic-prog-txt { font-size: 12px; color: #555; margin-bottom: 4px; }
    .ic-prog-bg  { height: 6px; background: #e4e4e4; border-radius: 3px; overflow: hidden; }
    .ic-prog-bar { height: 100%; background: #1c4f8e; border-radius: 3px; width: 0; transition: width .3s; }

    .ic-res-hdr { display: flex; align-items: center; justify-content: space-between; }
    .ic-res-title { font-weight: 700; font-size: 13px; color: #333; }

    table.ic-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      display: none;
    }
    table.ic-table.on { display: table; }
    table.ic-table th {
      background: #f5f5f5;
      padding: 6px 8px;
      text-align: left;
      border-bottom: 2px solid #ddd;
      font-weight: 700;
      color: #444;
    }
    table.ic-table td {
      padding: 5px 8px;
      border-bottom: 1px solid #eee;
      vertical-align: middle;
    }
    table.ic-table tr:hover td { background: #fafafa; }
    table.ic-table td:first-child { color: #999; text-align: right; width: 28px; }
    table.ic-table td:nth-child(2) { font-family: monospace; white-space: nowrap; }
    table.ic-table td:nth-child(3) { max-width: 220px; word-break: break-word; }

    .ic-badge {
      display: inline-block;
      padding: 2px 9px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 11px;
      color: #fff;
      white-space: nowrap;
    }
    .ic-ours     { background: #2e7d32; }
    .ic-not_ours { background: #c47900; }
    .ic-not_found{ background: #c00; }
    .ic-error    { background: #888; }

    .ic-sum {
      display: none;
      gap: 14px;
      flex-wrap: wrap;
      font-size: 12px;
      color: #555;
      padding-top: 2px;
    }
    .ic-sum.on { display: flex; }
    .ic-sum-item { display: flex; align-items: center; gap: 5px; }
    .ic-sum-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
  `);

  // ── DOM ────────────────────────────────────────────────────────────────────
  const root = document.createElement('div');
  root.id = 'ic-root';
  root.innerHTML = `
    <div id="ic-panel">
      <div class="ic-hdr">
        <h3>🏢 Масова перевірка ЮО за ЄДРПОУ</h3>
        <button class="ic-x" id="ic-x">✕</button>
      </div>
      <div class="ic-body">
        <div>
          <label style="display:block;font-weight:700;margin-bottom:5px;color:#333">
            Список ЄДРПОУ для перевірки:
          </label>
          <textarea id="ic-textarea" placeholder="31982734&#10;36459905&#10;12345678&#10;..."></textarea>
          <div class="ic-hint">Один код на рядок, або розділені комою / крапкою з комою</div>
        </div>

        <div class="ic-actions">
          <button class="ic-btn ic-btn-run" id="ic-run">▶ Перевірити</button>
          <button class="ic-btn ic-btn-stop" id="ic-stop" style="display:none">⏹ Зупинити</button>
          <button class="ic-btn ic-btn-csv" id="ic-csv" disabled>⬇ Зберегти CSV</button>
          <button class="ic-btn ic-btn-clr" id="ic-clr">🗑 Очистити</button>
        </div>

        <div class="ic-prog" id="ic-prog">
          <div class="ic-prog-txt" id="ic-prog-txt">Завантаження…</div>
          <div class="ic-prog-bg"><div class="ic-prog-bar" id="ic-prog-bar"></div></div>
        </div>

        <div class="ic-res-hdr">
          <span class="ic-res-title" id="ic-res-title"></span>
        </div>

        <table class="ic-table" id="ic-table">
          <thead>
            <tr>
              <th>#</th>
              <th>ЄДРПОУ</th>
              <th>Назва компанії</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody id="ic-tbody"></tbody>
        </table>

        <div class="ic-sum" id="ic-sum"></div>
      </div>
    </div>
    <button id="ic-toggle" title="Перевірка ЮО">🏢</button>
  `;
  document.body.appendChild(root);

  // ── Element refs ───────────────────────────────────────────────────────────
  const panel    = root.querySelector('#ic-panel');
  const toggle   = root.querySelector('#ic-toggle');
  const xBtn     = root.querySelector('#ic-x');
  const runBtn   = root.querySelector('#ic-run');
  const stopBtn  = root.querySelector('#ic-stop');
  const csvBtn   = root.querySelector('#ic-csv');
  const clrBtn   = root.querySelector('#ic-clr');
  const textarea = root.querySelector('#ic-textarea');
  const prog     = root.querySelector('#ic-prog');
  const progTxt  = root.querySelector('#ic-prog-txt');
  const progBar  = root.querySelector('#ic-prog-bar');
  const resTitle = root.querySelector('#ic-res-title');
  const table    = root.querySelector('#ic-table');
  const tbody    = root.querySelector('#ic-tbody');
  const sumEl    = root.querySelector('#ic-sum');

  // ── Toggle ─────────────────────────────────────────────────────────────────
  toggle.addEventListener('click', () => panel.classList.toggle('open'));
  xBtn.addEventListener('click',   () => panel.classList.remove('open'));

  // ── Drag ───────────────────────────────────────────────────────────────────
  let dragging = false, ox = 0, oy = 0;
  const hdr = root.querySelector('.ic-hdr');

  hdr.addEventListener('mousedown', e => {
    if (e.target === xBtn) return;
    dragging = true;
    const r = root.getBoundingClientRect();
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    root.style.left   = (e.clientX - ox) + 'px';
    root.style.top    = (e.clientY - oy) + 'px';
    root.style.right  = 'auto';
    root.style.bottom = 'auto';
  });
  document.addEventListener('mouseup', () => { dragging = false; });

  // ── Clear ──────────────────────────────────────────────────────────────────
  clrBtn.addEventListener('click', () => {
    textarea.value = '';
    results = [];
    tbody.innerHTML = '';
    table.classList.remove('on');
    sumEl.classList.remove('on');
    resTitle.textContent = '';
    prog.classList.remove('on');
    csvBtn.disabled = true;
  });

  // ── Export CSV ─────────────────────────────────────────────────────────────
  csvBtn.addEventListener('click', () => {
    if (!results.length) return;
    const rows = [['ЄДРПОУ', 'Назва', 'Статус']];
    for (const r of results) {
      rows.push([r.edrpou, '"' + r.name.replace(/"/g, '""') + '"', r.statusText]);
    }
    const csv = '﻿' + rows.map(r => r.join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    Object.assign(document.createElement('a'), {
      href: url,
      download: `incore_yur_check_${new Date().toISOString().slice(0, 10)}.csv`,
    }).click();
    URL.revokeObjectURL(url);
  });

  // ── Stop ───────────────────────────────────────────────────────────────────
  stopBtn.addEventListener('click', () => {
    shouldStop = true;
    stopBtn.disabled = true;
  });

  // ── Run ────────────────────────────────────────────────────────────────────
  runBtn.addEventListener('click', async () => {
    const raw = textarea.value.trim();
    if (!raw) return;

    const codes = [...new Set(
      raw.split(/[\n,;]+/).map(s => s.trim()).filter(s => /^\d{6,10}$/.test(s))
    )];

    if (!codes.length) {
      alert('Не знайдено коректних кодів ЄДРПОУ (6–10 цифр).');
      return;
    }

    const initialToken = await fetchToken();
    if (!initialToken) {
      alert('Не вдалося отримати токен безпеки.\nПереконайтесь, що ви авторизовані в INCORE і спробуйте ще раз.');
      return;
    }
    // Mutable holder — refreshed automatically on 4xx/5xx and every TOKEN_REFRESH_EVERY steps
    const tokenHolder = { value: initialToken };
    const TOKEN_REFRESH_EVERY = 20;

    // Reset
    results = [];
    shouldStop = false;
    tbody.innerHTML = '';
    table.classList.add('on');
    sumEl.classList.remove('on');
    prog.classList.add('on');
    resTitle.textContent = `Результати (0 / ${codes.length})`;
    csvBtn.disabled = true;
    runBtn.disabled = true;
    stopBtn.style.display = '';
    stopBtn.disabled = false;

    const total = codes.length;

    for (let i = 0; i < total; i++) {
      if (shouldStop) break;

      const code = codes[i];
      progTxt.textContent = `${i + 1} / ${total} — перевіряємо: ${code}`;
      progBar.style.width = `${((i + 1) / total) * 100}%`;

      // Proactively refresh token every TOKEN_REFRESH_EVERY iterations
      if (i > 0 && i % TOKEN_REFRESH_EVERY === 0) {
        const fresh = await refreshToken();
        if (fresh) tokenHolder.value = fresh;
        console.log(`[IC] Proactive token refresh at step ${i + 1}`);
      }

      let r;
      try {
        r = await checkOne(code, tokenHolder);
      } catch (e) {
        r = { edrpou: code, name: '', status: 'error', statusText: `Помилка: ${e.message}` };
      }

      results.push(r);
      resTitle.textContent = `Результати (${results.length} / ${total})`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${r.edrpou}</td>
        <td>${r.name || '—'}</td>
        <td><span class="ic-badge ic-${r.status}">${r.statusText}</span></td>
      `;
      tbody.appendChild(tr);
      tr.scrollIntoView({ block: 'nearest' });

      if (i < total - 1 && !shouldStop) await sleep(450);
    }

    // Done
    runBtn.disabled = false;
    stopBtn.style.display = 'none';
    csvBtn.disabled = results.length === 0;

    const done = results.length;
    progTxt.textContent = shouldStop
      ? `⏹ Зупинено після ${done} з ${total}`
      : `✓ Завершено — перевірено ${done} кодів`;

    // Summary
    const cnt = { ours: 0, not_ours: 0, not_found: 0, error: 0 };
    for (const r of results) cnt[r.status] = (cnt[r.status] || 0) + 1;

    const dotColors = { ours: '#2e7d32', not_ours: '#c47900', not_found: '#c00', error: '#888' };
    const labels    = { ours: 'НАШ', not_ours: 'НЕ НАШ', not_found: 'НЕМАЄ', error: 'Помилка' };

    sumEl.innerHTML = Object.entries(cnt)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `
        <span class="ic-sum-item">
          <span class="ic-sum-dot" style="background:${dotColors[k]}"></span>
          <strong>${v}</strong>&nbsp;${labels[k]}
        </span>`)
      .join('');
    sumEl.classList.add('on');
  });

})();
