// ==UserScript==
// @name         OSCPV B2B — Пошук полісів (Odoo + Universalna)
// @namespace    universalna.oscpv.b2b
// @version      1.2.0-b2b
// @description  B2B: пакетний пошук полісів ОСЦПВ для юридичних осіб за ЄДРПОУ (incore + прямий парсинг таблиці + concurrency)
// @author       custom
// @match        https://odoo.icu.int/*
// @match        https://dict.universalna.com/*
// @match        https://incore.universalna.com/*
// @require      https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        unsafeWindow
// @connect      import-tool.universalna.com
// @connect      dict.universalna.com
// @connect      incore.universalna.com
// @connect      opendata.universalnabaza.com.ua
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // =====================================================================
    //                          КОНФІГУРАЦІЯ
    // =====================================================================
    const CONFIG = {
        TABLE_URL: 'https://dict.universalna.com/table/444',
        INSERT_URL: 'https://dict.universalna.com/api/24/insert/InsuredLoss?zip=true&idtbl=444',
        RUN_URL: 'https://import-tool.universalna.com/api/task/MtsbuInsuredLoss_PROD/run',  // legacy fallback
        DELAY_AFTER_RUN: 1500,
        DELAY_BETWEEN_IPN: 1500,    // мс - пауза між ЄДРПОУ (зберіг назву для сумісності)
        ROW_WAIT_TIMEOUT: 30000,
        ROW_WAIT_INTERVAL: 500,

        // Incore - endpoint для генерації звіту (замінив застарілий import-tool)
        INCORE_REPORT_GID: '6775b281-c15d-4bba-a238-6c3832843032',
        INCORE_FORM_URL: 'https://incore.universalna.com/ReportingServicesReports/ReportsPage?ReportGID=6775b281-c15d-4bba-a238-6c3832843032',
        INCORE_GENERATE_URL: 'https://incore.universalna.com/ReportingServicesReports/ReportsPage?ReportGID=6775b281-c15d-4bba-a238-6c3832843032&handler=GenerateReport&PageNumber=1',
    };

    const SVG_ALL = `<svg viewBox="0 0 20 20" fill="none" width="16" height="16"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const SVG_TRUCK = `<svg viewBox="0 0 20 20" fill="none" width="16" height="16"><path d="M4 14V6h8v8H4zM12 8h4l2 3v3h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="15" r="2" stroke="currentColor" stroke-width="2"/><circle cx="15" cy="15" r="2" stroke="currentColor" stroke-width="2"/></svg>`;
    const SVG_AGRO = `<svg viewBox="0 0 20 20" fill="none" width="16" height="16"><path d="M4 14V8l3-2h4l2 2v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="5" cy="14" r="3" stroke="currentColor" stroke-width="2"/><circle cx="14" cy="15" r="2" stroke="currentColor" stroke-width="2"/><path d="M7 8h3v3H7z" stroke="currentColor" stroke-width="2"/></svg>`;
    const SVG_CAR = `<svg viewBox="0 0 20 20" fill="none" width="16" height="16"><path d="M3 12V8l3-3h8l3 3v4H3z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="13" r="2" stroke="currentColor" stroke-width="2"/><circle cx="14" cy="13" r="2" stroke="currentColor" stroke-width="2"/></svg>`;
    const SVG_BUS = `<svg viewBox="0 0 20 20" fill="none" width="16" height="16"><path d="M3 5h14v10H3V5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="15" r="2" stroke="currentColor" stroke-width="2"/><circle cx="14" cy="15" r="2" stroke="currentColor" stroke-width="2"/><path d="M3 10h14" stroke="currentColor" stroke-width="2"/></svg>`;
    const SVG_MOTO = `<svg viewBox="0 0 20 20" fill="none" width="16" height="16"><circle cx="5" cy="13" r="3" stroke="currentColor" stroke-width="2"/><circle cx="15" cy="13" r="3" stroke="currentColor" stroke-width="2"/><path d="M5 13l4-5h3l3 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 8l2-3h3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const SVG_TRAILER = `<svg viewBox="0 0 20 20" fill="none" width="16" height="16"><path d="M5 13V7h10v6H5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="14" r="2" stroke="currentColor" stroke-width="2"/><path d="M15 10h3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    // Категорії ТЗ для табів і фарбування pill-бейджів
    // ключ: код з vehicle_type (A1, B1, C1, тощо)
    // group: ID табу для групування
    const VEHICLE_GROUPS = [
        { id: 'all', label: 'ВСІ', icon: SVG_ALL, codes: null },
        { id: 'truck', label: 'ВАНТАЖНІ', icon: SVG_TRUCK, codes: ['C0', 'C1', 'C2'] },
        { id: 'agro', label: 'СІЛЬГОСП', icon: SVG_AGRO, codes: ['G', 'G1', 'G2', 'G3', 'H', 'H1', 'H2', 'H3'] },
        { id: 'car', label: 'ЛЕГКОВІ', icon: SVG_CAR, codes: ['B1', 'B2', 'B3', 'B4', 'B5'] },
        { id: 'bus', label: 'АВТОБУСИ', icon: SVG_BUS, codes: ['D1', 'D2'] },
        { id: 'moto', label: 'МОТО', icon: SVG_MOTO, codes: ['A1', 'A2'] },
        { id: 'trailer', label: 'ПРИЧЕПИ', icon: SVG_TRAILER, codes: ['E', 'F'] },
    ];

    // Витягуємо код категорії з рядка типу "C1 - вантажні автомобілі..."
    function getVehicleCode(vehicleType) {
        if (!vehicleType) return '';
        const m = String(vehicleType).match(/^([A-Z]\d?)\s*[-—]/);
        return m ? m[1] : '';
    }

    function getVehicleGroup(vehicleType) {
        const code = getVehicleCode(vehicleType);
        if (!code) return 'other';
        for (const g of VEHICLE_GROUPS) {
            if (g.codes && g.codes.includes(code)) return g.id;
        }
        return 'other';
    }

    // Глобальне сховище актуального токена — оновлюється при кожному запиті сайту
    let LIVE_TOKEN = null;

    // ВАЖЛИВО: ставимо перехоплювач токена ДО будь-якої логіки,
    // щоб гарантовано побачити запити які сайт робить при завантаженні
    if (location.hostname === 'dict.universalna.com') {
        installTokenSniffer();
    }

    function installTokenSniffer() {
        try {
            const origFetch = window.fetch;
            window.fetch = function (input, init) {
                try {
                    const headers = (init && init.headers) || (input && input.headers) || {};
                    let auth = null;
                    if (headers instanceof Headers) {
                        auth = headers.get('Authorization') || headers.get('authorization');
                    } else if (typeof headers === 'object') {
                        auth = headers['Authorization'] || headers['authorization'];
                    }
                    if (auth && auth.startsWith('Bearer ')) {
                        LIVE_TOKEN = auth.slice(7);
                    }
                } catch (e) { }
                const result = origFetch.apply(this, arguments);
                // Перехоплюємо SELECT/export відповіді таблиці + авто-визначення робочого URL
                try {
                    const url = typeof input === 'string' ? input : (input?.url ?? '');
                    if (url && url.includes('InsuredLoss') && !url.includes('/insert')) {
                        result.then(resp => {
                            if (!resp.ok) return;
                            const ct = resp.headers.get('content-type') || '';
                            if (ct.includes('json')) {
                                resp.clone().json().then(data => {
                                    _storeTableCache(data, url);
                                }).catch(() => { });
                            } else if (ct.includes('spreadsheet') || ct.includes('octet') || ct.includes('xlsx')) {
                                GM_setValue('dict444bb_dl_url', url.split('?')[0]);
                            }
                        }).catch(() => { });
                    }
                } catch (e) { }
                return result;
            };

            const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
            XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
                try {
                    if (name && name.toLowerCase() === 'authorization' && value && value.startsWith('Bearer ')) {
                        LIVE_TOKEN = value.slice(7);
                    }
                } catch (e) { }
                return origSetHeader.apply(this, arguments);
            };

            // Перехоплюємо також XHR-відповіді (на випадок якщо сторінка ходить через XHR)
            const origXHROpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function (method, url) {
                if (url && typeof url === 'string' && url.includes('InsuredLoss') && !url.includes('/insert')) {
                    this._oscpv_capture = true;
                }
                return origXHROpen.apply(this, arguments);
            };
            const origXHRSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.send = function () {
                if (this._oscpv_capture) {
                    this.addEventListener('load', () => {
                        if (this.status === 200) {
                            try { _storeTableCache(JSON.parse(this.responseText)); } catch (e) { }
                        }
                    });
                }
                return origXHRSend.apply(this, arguments);
            };

            console.log('[OSCPV] Token sniffer + table cache interceptor installed');
        } catch (e) {
            console.warn('[OSCPV] Could not install sniffer:', e);
        }
    }

    function _storeTableCache(data, sourceUrl) {
        try {
            const rows = Array.isArray(data) ? data :
                Array.isArray(data?.data) ? data.data :
                    Array.isArray(data?.rows) ? data.rows :
                        Array.isArray(data?.items) ? data.items : null;
            if (!rows || !rows.length) return;
            // Зберігаємо лише id + response щоб тримати розмір малим
            const minimal = rows
                .map(r => ({ id: parseInt(r.id ?? r.ID ?? 0), resp: (r.response ?? r.resp ?? r.RESPONSE ?? '').toString() }))
                .filter(r => r.id > 0)
                .sort((a, b) => a.id - b.id)
                .slice(-600);
            GM_setValue('dict444bb_api_cache', JSON.stringify({ ts: Date.now(), rows: minimal }));
            if (sourceUrl && !GM_getValue('dict444bb_dl_url', '')) {
                GM_setValue('dict444bb_dl_url', sourceUrl.split('?')[0]);
            }
        } catch (e) { }
    }

    // ─── GM_xmlhttpRequest promise wrapper ───────────────────────────────────
    function gmXHR(opts) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest(Object.assign({}, opts, {
                onload: resolve,
                onerror: () => reject(new Error('network error')),
                ontimeout: () => reject(new Error('timeout'))
            }));
        });
    }

    // Парсимо XLSX arraybuffer → [{id, resp}], за рядком заголовку або через COL-позиції
    function parseXLSXRows(buffer) {
        try {
            const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
            if (!wb.SheetNames.length) return null;
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            if (data.length < 2) return null;
            const hdr = data[0].map(h => (h || '').toString().toLowerCase().trim());
            let idCol = hdr.findIndex(h => h === 'id');
            let respCol = hdr.findIndex(h => h === 'response');
            if (idCol < 0) idCol = COL.ID;        // fallback: col 0
            if (respCol < 0) respCol = COL.RESPONSE;  // fallback: col 18
            return data.slice(1)
                .map(r => ({ id: parseInt(r[idCol] || 0) || 0, resp: (r[respCol] || '').toString().trim() }))
                .filter(r => r.id > 0);
        } catch (e) {
            console.warn('[OSCPV] parseXLSXRows:', e);
            return null;
        }
    }

    // Прямий запит таблиці через GM_xmlhttpRequest (без iframe).
    // Спершу пробує закешований URL, потім типові патерни. Підтримує JSON та XLSX.
    // Повертає [{id, resp}] або null при невдачі.
    async function fetchTableRowsDirect() {
        const token = getCurrentToken();
        if (!token) return null;

        const saved = GM_getValue('dict444bb_dl_url', '');
        const base = 'https://dict.universalna.com/api/24/';
        const candidates = [
            ...(saved ? [saved] : []),
            base + 'select/InsuredLoss',
            base + 'export/InsuredLoss',
            base + 'download/InsuredLoss',
        ].filter((u, i, a) => a.indexOf(u) === i); // deduplicate

        for (const url of candidates) {
            const full = url.includes('idtbl') ? url : url + '?idtbl=444';
            try {
                // Пробуємо JSON
                const rj = await gmXHR({
                    method: 'GET', url: full,
                    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
                    timeout: 15000
                });
                if (rj.status === 200) {
                    const ct = (rj.responseHeaders || '').toLowerCase();
                    if (!ct.includes('spreadsheet') && !ct.includes('octet')) {
                        const data = JSON.parse(rj.responseText);
                        const rows = Array.isArray(data) ? data :
                            Array.isArray(data?.data) ? data.data :
                                Array.isArray(data?.rows) ? data.rows : null;
                        if (rows?.length) {
                            GM_setValue('dict444bb_dl_url', url);
                            return rows.map(r => ({
                                id: parseInt(r.id ?? r.ID ?? 0) || 0,
                                resp: (r.response ?? r.resp ?? r.RESPONSE ?? '').toString()
                            })).filter(r => r.id > 0);
                        }
                    }
                }

                // Пробуємо XLSX (arraybuffer)
                const rx = await gmXHR({
                    method: 'GET', url: full,
                    headers: { 'Authorization': 'Bearer ' + token },
                    responseType: 'arraybuffer',
                    timeout: 20000
                });
                if (rx.status === 200 && rx.response) {
                    const rows = parseXLSXRows(rx.response);
                    if (rows?.length) {
                        GM_setValue('dict444bb_dl_url', url);
                        return rows;
                    }
                }
            } catch (e) {
                console.log('[OSCPV] fetchTableRowsDirect failed:', url, e.message);
            }
        }
        return null;
    }

    // ====== Колонки таблиці (порядок з HTML el-table_1_column_N) ======
    // 1=id, 2=label_, 3=ident_code, 4=plate_no, 5=vin,
    // 6=surname, 7=given_name, 8=middle_name, 9=start_date, 10=end_date,
    // 11=policy_type, 12=server_, 13=status, 14=processDate,
    // 15=errorCode, 16=errorMsg, 17=url, 18=request, 19=response,
    // 20=DateCreate, 21=DateModify, 22=UserCreate, 23=UserModify
    const COL = {
        ID: 0, LABEL: 1, IDENT_CODE: 2,
        STATUS: 12, RESPONSE: 18
    };

    // =====================================================================
    //                    РОУТИНГ ПО САЙТАМ
    // =====================================================================
    const host = location.hostname;

    if (host === 'odoo.icu.int') {
        initOdooSide();
    } else if (host === 'dict.universalna.com') {
        initDictSide();
    } else if (host === 'incore.universalna.com') {
        initIncoreSide();
    }


    // =====================================================================
    //                    СТОРОНА ODOO (UI + керування)
    // =====================================================================
    function initOdooSide() {
        // Чекаємо появи навігаційної панелі Odoo і вставляємо кнопку
        const tryInsertButton = () => {
            if (document.getElementById('oscpv2-fab-b2b')) return;
            if (!document.body) {
                setTimeout(tryInsertButton, 500);
                return;
            }
            createFloatingButton();
        };

        setTimeout(tryInsertButton, 1500);
        // Vue/Odoo може перерендерювати — періодично перевіряємо
        setInterval(() => {
            if (!document.getElementById('oscpv2-fab-b2b')) tryInsertButton();
        }, 3000);
    }

    function createFloatingButton() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'oscpv2-fab-b2b';
        btn.title = 'Пошук полісів ОСЦПВ для юр. осіб (B2B)';
        btn.innerHTML = `
            <svg viewBox="0 0 20 20" fill="none" width="18" height="18" aria-hidden="true">
                <path d="M10 2L3 5v5c0 4.5 3.1 8.7 7 9.8 3.9-1.1 7-5.3 7-9.8V5L10 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span style="letter-spacing:0.04em;text-transform:uppercase;font-size:12px;font-family:'Ubuntu',system-ui,sans-serif">ПОШУК ОСЦПВ</span>
            <span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:3px;background:#FF5F03;letter-spacing:0.08em">B2B</span>
        `;
        btn.style.cssText = `
            position: fixed; bottom: 88px; right: 24px;
            z-index: 2147483646;
            background: #072C2C;
            color: #fff;
            border: none; border-radius: 999px;
            padding: 12px 20px;
            cursor: pointer;
            box-shadow: 0 8px 24px rgba(7,44,44,0.35), 0 2px 6px rgba(7,44,44,0.2);
            display: flex; align-items: center; gap: 8px;
            transition: transform 180ms cubic-bezier(0.4,0,0.2,1), box-shadow 180ms cubic-bezier(0.4,0,0.2,1);
            font-family: 'Ubuntu', system-ui, sans-serif; font-weight: 600;
        `;
        btn.onmouseenter = () => {
            btn.style.transform = 'translateY(-2px)';
            btn.style.boxShadow = '0 12px 32px rgba(7,44,44,0.4), 0 4px 12px rgba(7,44,44,0.25)';
            btn.style.background = '#0A3D3D';
        };
        btn.onmouseleave = () => {
            btn.style.transform = '';
            btn.style.boxShadow = '0 8px 24px rgba(7,44,44,0.35), 0 2px 6px rgba(7,44,44,0.2)';
            btn.style.background = '#072C2C';
        };
        btn.onmousedown = () => { btn.style.transform = 'scale(0.98)'; };
        btn.onmouseup = () => { btn.style.transform = ''; };
        btn.onclick = openModal;
        document.body.appendChild(btn);
        console.log('[OSCPV B2B] FAB додано в Odoo');
    }

    let modalEl = null;
    let results = [];
    let statsFound = 0;
    let statsEmpty = 0;

    function openModal() {
        if (modalEl) {
            modalEl.style.display = 'flex';
            return;
        }
        modalEl = document.createElement('div');
        modalEl.id = 'oscpv2-modal';
        modalEl.innerHTML = `
            <div class="oscpv2-overlay"></div>
            <div class="oscpv2-dialog">

                <header class="oscpv2-header">
                    <div class="oscpv2-h-icon">
                        <svg viewBox="0 0 20 20" fill="none" width="22" height="22" aria-hidden="true">
                            <path d="M10 2L3 5v5c0 4.5 3.1 8.7 7 9.8 3.9-1.1 7-5.3 7-9.8V5L10 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <div class="oscpv2-h-title-wrap">
                        <div class="oscpv2-h-title">
                            ПОШУК ПОЛІСІВ ОСЦПВ <span class="oscpv2-badge-b2b">B2B</span>
                        </div>
                        <div class="oscpv2-subtitle">Перевірка наявності страхових полісів за ЄДРПОУ</div>
                    </div>
                    <button type="button" class="oscpv2-close" aria-label="Закрити">
                        <svg viewBox="0 0 20 20" fill="none" width="14" height="14" aria-hidden="true">
                            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </header>

                <div class="oscpv2-body">

                    <!-- LEFT — INPUT + PROGRESS -->
                    <div class="oscpv2-left">
                        <section class="oscpv2-card">
                            <div class="oscpv2-card-header">
                                <div class="oscpv2-card-title">
                                    <svg viewBox="0 0 20 20" fill="none" width="14" height="14" aria-hidden="true">
                                        <rect x="5" y="2" width="10" height="16" rx="2" stroke="currentColor" stroke-width="2"/>
                                        <path d="M8 7h4M8 11h4M8 15h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                    </svg>
                                    ДАНІ ДЛЯ ПОШУКУ
                                </div>
                            </div>

                            <div class="oscpv2-textarea-wrap">
                                <textarea class="oscpv2-field" id="oscpv2-ipns"
                                    placeholder="32145678&#10;14360570&#10;ЄДРПОУ по одному в рядку..."></textarea>
                                <span class="oscpv2-count-badge"><strong id="oscpv2-counter">0</strong> ЄДРПОУ</span>
                            </div>

                            <div class="oscpv2-grid-2">
                                <div class="oscpv2-num-field">
                                    <label>Очікування обробки</label>
                                    <input type="number" id="oscpv2-delay-run" value="${CONFIG.DELAY_AFTER_RUN}" min="1000" step="500">
                                    <span class="oscpv2-unit">мс</span>
                                </div>
                                <div class="oscpv2-num-field">
                                    <label>Пауза між ЄДРПОУ</label>
                                    <input type="number" id="oscpv2-delay-ipn" value="${CONFIG.DELAY_BETWEEN_IPN}" min="0" step="500">
                                    <span class="oscpv2-unit">мс</span>
                                </div>
                            </div>
                        </section>

                        <section class="oscpv2-card" id="oscpv2-progress-card" style="display:none">
                            <div class="oscpv2-card-header" style="margin-bottom:10px">
                                <div class="oscpv2-card-title">
                                    <svg viewBox="0 0 20 20" fill="none" width="14" height="14" aria-hidden="true">
                                        <path d="M4 4a8 8 0 0 1 12 0M16 16a8 8 0 0 1-12 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                        <path d="M3 8L4 4l4 1M17 12l-1 4-4-1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                    ПРОГРЕС
                                </div>
                                <span class="oscpv2-progress-state" id="oscpv2-progress-state">У ПРОЦЕСІ</span>
                            </div>
                            <div class="oscpv2-progress-top">
                                <span class="oscpv2-progress-label" id="oscpv2-stage">Очікування...</span>
                                <span class="oscpv2-progress-sub" id="oscpv2-progress-text">0 / 0</span>
                            </div>
                            <div class="oscpv2-progress-bar">
                                <div class="oscpv2-progress-fill" id="oscpv2-fill"></div>
                            </div>
                            <div class="oscpv2-progress-meta">
                                <span>Знайдено: <strong id="oscpv2-stat-found">0</strong> полісів · <strong id="oscpv2-stat-tz">0</strong> ТЗ</span>
                                <span id="oscpv2-stat-empty-wrap">Без полісу: <strong id="oscpv2-stat-empty">0</strong></span>
                            </div>
                        </section>
                    </div>

                    <!-- RIGHT — RESULTS -->
                    <section class="oscpv2-results-card">
                        <div class="oscpv2-results-header">
                            <div class="oscpv2-results-top">
                                <div class="oscpv2-results-summary">
                                    <span class="oscpv2-results-num" id="oscpv2-results-num">0</span>
                                    <span class="oscpv2-results-label" id="oscpv2-results-label">полісів</span>
                                </div>
                                <button type="button" class="oscpv2-btn" id="oscpv2-enrich-btn" title="Збагатити дані авто через OpenDataUA API" style="font-size:11px;padding:6px 10px" disabled>
                                    <svg viewBox="0 0 20 20" fill="none" width="13" height="13" aria-hidden="true">
                                        <path d="M4 10a6 6 0 0 1 6-6 6 6 0 0 1 4.24 1.76" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                        <path d="M14 5V2M14 5h-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path d="M16 10a6 6 0 0 1-10 4.24" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                    </svg>
                                    ЗБАГАТИТИ АВТО
                                </button>
                            </div>
                            <div class="oscpv2-tabs-wrap">
                                <div class="oscpv2-tabs" id="oscpv2-tabs" role="tablist">
                                    ${VEHICLE_GROUPS.map((g, i) => `
                                        <button type="button" class="oscpv2-tab ${i === 0 ? 'active' : ''}" data-tab="${g.id}">
                                            ${g.icon || ''}
                                            ${g.label}
                                            <span class="oscpv2-tab-count" data-tab-count="${g.id}">0</span>
                                        </button>
                                    `).join('')}
                                </div>
                            </div>
                        </div>

                        <div class="oscpv2-results-body" id="oscpv2-results-area">
                            <div class="oscpv2-empty-state">
                                <div class="oscpv2-empty-ico">
                                    <svg viewBox="0 0 64 64" fill="none" width="64" height="64" aria-hidden="true">
                                        <rect x="16" y="8" width="32" height="48" rx="4" stroke="currentColor" stroke-width="3"/>
                                        <path d="M24 22h16M24 32h16M24 42h10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                                    </svg>
                                </div>
                                <div class="oscpv2-empty-txt">Введіть ЄДРПОУ і натисніть «Старт пошуку»</div>
                            </div>
                        </div>
                    </section>

                </div>

                <!-- LOG (схований за замовчуванням) -->
                <div class="oscpv2-log-wrap" id="oscpv2-log-card" style="display:none">
                    <div class="oscpv2-log-content" id="oscpv2-log"></div>
                </div>

                <footer class="oscpv2-footer">
                    <div class="oscpv2-footer-status">
                        <span class="oscpv2-status-dot" id="oscpv2-status-dot"></span>
                        <span id="oscpv2-info">Готовий до пошуку</span>
                    </div>
                    <button type="button" class="oscpv2-btn" id="oscpv2-toggle-log" title="Показати/сховати лог">
                        <svg viewBox="0 0 20 20" fill="none" width="14" height="14" aria-hidden="true">
                            <path d="M4 5h12M4 10h12M4 15h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        ЛОГ
                    </button>
                    <button type="button" class="oscpv2-btn" id="oscpv2-export" disabled>
                        <svg viewBox="0 0 20 20" fill="none" width="14" height="14" aria-hidden="true">
                            <path d="M10 3v10M5 9l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M3 16h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        EXCEL
                    </button>
                    <button type="button" class="oscpv2-btn oscpv2-btn-primary" id="oscpv2-start">
                        <svg viewBox="0 0 20 20" fill="none" width="14" height="14" aria-hidden="true">
                            <path d="M5 4l11 6-11 6V4z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        СТАРТ ПОШУКУ
                    </button>
                </footer>

            </div>
        `;
        injectStyles();
        document.body.appendChild(modalEl);

        // Прив'язка подій
        modalEl.querySelector('.oscpv2-close').onclick = closeModal;
        modalEl.querySelector('.oscpv2-overlay').onclick = closeModal;
        modalEl.querySelector('#oscpv2-start').onclick = startBatch;
        modalEl.querySelector('#oscpv2-export').onclick = exportExcel;
        modalEl.querySelector('#oscpv2-toggle-log').onclick = toggleLog;
        modalEl.querySelector('#oscpv2-enrich-btn').onclick = enrichResultsWithCarplates;

        // Табси - перемикання
        modalEl.querySelectorAll('.oscpv2-tab').forEach(tab => {
            tab.onclick = () => switchTab(tab.dataset.tab);
        });

        // Лічильник ЄДРПОУ в textarea
        const ta = modalEl.querySelector('#oscpv2-ipns');
        ta.addEventListener('input', () => {
            const n = ta.value.split('\n').map(s => s.trim()).filter(Boolean).length;
            modalEl.querySelector('#oscpv2-counter').textContent = n;
        });

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && modalEl && modalEl.style.display !== 'none') closeModal();
        });
    }

    let activeTab = 'all';
    function switchTab(tabId) {
        activeTab = tabId;
        modalEl.querySelectorAll('.oscpv2-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tabId);
        });
        // Фільтруємо групи компаній: показуємо тільки ті де є рядки потрібного типу
        modalEl.querySelectorAll('.oscpv2-company-group').forEach(grp => {
            const rows = grp.querySelectorAll('tr[data-tab]');
            let visibleInGroup = 0;
            rows.forEach(row => {
                const matches = tabId === 'all' || row.dataset.tab === tabId;
                row.style.display = matches ? '' : 'none';
                if (matches) visibleInGroup++;
            });
            grp.style.display = visibleInGroup > 0 ? '' : 'none';
        });
    }

    function toggleLog() {
        const card = document.getElementById('oscpv2-log-card');
        const btn = document.getElementById('oscpv2-toggle-log');
        if (!card || !btn) return;
        const isVisible = card.style.display !== 'none';
        card.style.display = isVisible ? 'none' : 'block';
        btn.classList.toggle('oscpv2-btn-active', !isVisible);
    }

    function closeModal() {
        if (modalEl) modalEl.style.display = 'none';
    }



    function injectStyles() {
        if (document.getElementById('oscpv2-styles-b2b')) return;

        if (!document.getElementById('oscpv2-fonts')) {
            const link = document.createElement('link');
            link.id = 'oscpv2-fonts';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Ubuntu:wght@300;400;500;700&family=Oswald:wght@400;500;600;700&family=Ubuntu+Mono:wght@400;700&display=swap';
            document.head.appendChild(link);
        }

        const s = document.createElement('style');
        s.id = 'oscpv2-styles-b2b';
        s.textContent = `
            @keyframes oscpv2-fadeIn { from { opacity: 0 } to { opacity: 1 } }
            @keyframes oscpv2-slideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
            @keyframes oscpv2-pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
            @keyframes oscpv2-progress-pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.7 } }

            #oscpv2-modal {
                --color-primary:       #072C2C;
                --color-primary-hover: #0A3D3D;
                --color-primary-active:#051F1F;
                --color-secondary:     #FF5F03;
                --color-success:       #16A34A;
                --color-success-bg:    #DCFCE7;
                --color-success-text:  #0F6B33;
                --color-warning:       #D97706;
                --color-warning-bg:    #FEF3C7;
                --color-danger:        #DC2626;
                --color-danger-bg:     #FEE2E2;
                --color-surface:       #EDEADE;
                --color-surface-2:     #F5F3EB;
                --color-surface-3:     #FFFFFF;
                --color-text:          #111827;
                --color-text-muted:    #4B5563;
                --color-text-subtle:   #6B7280;
                --color-border:        #D6D2C4;
                --color-border-strong: #9B9785;
                --font-body:    'Ubuntu', system-ui, sans-serif;
                --font-display: 'Oswald', 'Ubuntu', sans-serif;
                --font-mono:    'Ubuntu Mono', ui-monospace, monospace;
                --radius-sm: 4px;
                --radius:    6px;
                --radius-md: 10px;
                --radius-lg: 14px;
                --shadow-sm: 0 1px 2px rgba(7,44,44,0.06);
                --shadow:    0 4px 14px rgba(7,44,44,0.08);
                --duration:  180ms;
                --ease:      cubic-bezier(0.4,0,0.2,1);
            }

            #oscpv2-modal {
                position: fixed; inset: 0; z-index: 2147483647;
                display: flex; align-items: flex-start; justify-content: center;
                padding: 36px 24px;
                font-family: var(--font-body);
                color: var(--color-text); font-size: 13px;
                animation: oscpv2-fadeIn 0.2s ease;
                overflow-y: auto;
            }
            #oscpv2-modal * { box-sizing: border-box; }
            #oscpv2-modal .oscpv2-overlay {
                position: fixed; inset: 0; z-index: 0;
                background: rgba(7,44,44,0.5); backdrop-filter: blur(2px);
            }
            #oscpv2-modal .oscpv2-dialog {
                position: relative; z-index: 1;
                background: var(--color-surface);
                border-radius: var(--radius-lg); width: 100%; max-width: 1180px;
                display: flex; flex-direction: column; overflow: hidden;
                box-shadow: 0 20px 60px rgba(7,44,44,0.18);
                animation: oscpv2-slideUp 0.25s ease;
            }

            /* HEADER */
            #oscpv2-modal .oscpv2-header {
                display: flex; align-items: center; gap: 14px;
                padding: 18px 22px;
                background: var(--color-surface-3);
                border-bottom: 3px solid var(--color-secondary);
            }
            #oscpv2-modal .oscpv2-h-icon {
                width: 44px; height: 44px;
                background: var(--color-primary); color: #fff;
                border-radius: var(--radius-md);
                display: flex; align-items: center; justify-content: center;
                flex-shrink: 0;
            }
            #oscpv2-modal .oscpv2-h-title-wrap { flex: 1; min-width: 0; }
            #oscpv2-modal .oscpv2-h-title {
                display: flex; align-items: center; gap: 10px;
                font-family: var(--font-display);
                font-size: 17px; font-weight: 600; color: var(--color-primary);
                text-transform: uppercase; letter-spacing: 0.04em;
            }
            #oscpv2-modal .oscpv2-subtitle {
                font-size: 12px; color: var(--color-text-muted); margin-top: 2px;
            }
            #oscpv2-modal .oscpv2-badge-b2b {
                font-family: var(--font-display);
                font-size: 11px; font-weight: 700;
                padding: 3px 8px; border-radius: var(--radius-sm);
                background: var(--color-secondary); color: #fff;
                letter-spacing: 0.08em;
            }
            #oscpv2-modal .oscpv2-close {
                background: none; border: none; cursor: pointer;
                color: var(--color-text-muted);
                width: 32px; height: 32px; border-radius: var(--radius);
                display: flex; align-items: center; justify-content: center;
                transition: background var(--duration) var(--ease), color var(--duration) var(--ease);
                padding: 0;
            }
            #oscpv2-modal .oscpv2-close:hover { background: var(--color-surface); color: var(--color-primary); }

            /* BODY */
            #oscpv2-modal .oscpv2-body {
                display: grid;
                grid-template-columns: minmax(360px, 420px) 1fr;
                gap: 16px; padding: 16px;
                background: var(--color-surface);
            }
            #oscpv2-modal .oscpv2-left { display: flex; flex-direction: column; }

            /* CARDS */
            #oscpv2-modal .oscpv2-card {
                background: var(--color-surface-3);
                border: 1px solid var(--color-border);
                border-radius: var(--radius-lg);
                padding: 16px 18px;
                box-shadow: var(--shadow-sm);
            }
            #oscpv2-modal .oscpv2-card + .oscpv2-card { margin-top: 14px; }
            #oscpv2-modal .oscpv2-card-header {
                display: flex; align-items: center; justify-content: space-between;
                margin-bottom: 14px;
            }
            #oscpv2-modal .oscpv2-card-title {
                font-family: var(--font-display);
                font-size: 11px; font-weight: 600;
                color: var(--color-text-muted); letter-spacing: 0.08em;
                text-transform: uppercase;
                display: flex; align-items: center; gap: 8px;
            }

            /* TEXTAREA */
            #oscpv2-modal .oscpv2-textarea-wrap { position: relative; }
            #oscpv2-modal .oscpv2-field {
                width: 100%; min-height: 130px; resize: vertical;
                background: var(--color-surface-2);
                border: 1px solid var(--color-border-strong);
                border-radius: var(--radius-md);
                padding: 12px 14px;
                font-family: var(--font-mono);
                font-size: 13px; line-height: 1.6;
                color: var(--color-text); outline: none;
                transition: border-color var(--duration) var(--ease), box-shadow var(--duration) var(--ease);
            }
            #oscpv2-modal .oscpv2-field::placeholder { color: var(--color-text-subtle); }
            #oscpv2-modal .oscpv2-field:focus {
                border-color: var(--color-primary);
                box-shadow: 0 0 0 3px rgba(7,44,44,0.15);
            }
            #oscpv2-modal .oscpv2-count-badge {
                position: absolute; right: 10px; bottom: 14px;
                font-size: 11px; color: var(--color-text-muted);
                background: var(--color-surface-3); padding: 2px 8px;
                border-radius: var(--radius-sm);
                border: 1px solid var(--color-border); font-weight: 500;
            }

            /* NUMBER FIELDS */
            #oscpv2-modal .oscpv2-grid-2 {
                display: grid; grid-template-columns: 1fr 1fr;
                gap: 10px; margin-top: 12px;
            }
            #oscpv2-modal .oscpv2-num-field {
                background: var(--color-surface-2);
                border: 1px solid var(--color-border);
                border-radius: var(--radius-md);
                padding: 8px 12px; position: relative;
                transition: border-color var(--duration) var(--ease);
            }
            #oscpv2-modal .oscpv2-num-field:focus-within {
                border-color: var(--color-primary);
                box-shadow: 0 0 0 3px rgba(7,44,44,0.1);
            }
            #oscpv2-modal .oscpv2-num-field label {
                display: block;
                font-size: 10px; color: var(--color-text-muted);
                font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em;
                margin-bottom: 2px;
            }
            #oscpv2-modal .oscpv2-num-field input {
                width: 100%; border: none; background: transparent;
                font-family: var(--font-mono); font-size: 16px; font-weight: 600;
                color: var(--color-text); outline: none; padding: 0;
            }
            #oscpv2-modal .oscpv2-num-field .oscpv2-unit {
                position: absolute; right: 12px; bottom: 10px;
                font-size: 10px; color: var(--color-text-subtle);
                text-transform: uppercase; letter-spacing: 0.06em;
            }

            /* PROGRESS */
            #oscpv2-modal .oscpv2-progress-state {
                font-family: var(--font-display);
                font-size: 11px; font-weight: 600; color: var(--color-secondary);
                background: rgba(255,95,3,0.1);
                padding: 2px 8px; border-radius: var(--radius-sm);
                letter-spacing: 0.08em; text-transform: uppercase;
            }
            #oscpv2-modal .oscpv2-progress-top {
                display: flex; justify-content: space-between; align-items: baseline;
                margin-bottom: 10px;
            }
            #oscpv2-modal .oscpv2-progress-label {
                font-size: 13px; font-weight: 600; color: var(--color-text);
            }
            #oscpv2-modal .oscpv2-progress-sub { font-size: 12px; color: var(--color-text-muted); }
            #oscpv2-modal .oscpv2-progress-bar {
                height: 6px; background: var(--color-surface);
                border-radius: 99px; overflow: hidden;
                border: 1px solid var(--color-border);
            }
            #oscpv2-modal .oscpv2-progress-fill {
                height: 100%; width: 0;
                background: var(--color-secondary);
                border-radius: 99px;
                transition: width 0.3s ease;
                animation: oscpv2-progress-pulse 1.5s infinite;
            }
            #oscpv2-modal .oscpv2-progress-meta {
                display: flex; justify-content: space-between;
                margin-top: 8px; font-size: 11px; color: var(--color-text-muted);
            }
            #oscpv2-modal .oscpv2-progress-meta strong { color: var(--color-text); font-weight: 600; }

            /* RESULTS CARD */
            #oscpv2-modal .oscpv2-results-card {
                background: var(--color-surface-3);
                border: 1px solid var(--color-border);
                border-left: 3px solid var(--color-secondary);
                border-radius: var(--radius-lg);
                box-shadow: var(--shadow-sm);
                display: flex; flex-direction: column; overflow: hidden;
                height: 600px; max-height: 70vh;
            }
            #oscpv2-modal .oscpv2-results-header { padding: 16px 18px 0; }
            #oscpv2-modal .oscpv2-results-top {
                display: flex; align-items: center; justify-content: space-between;
                margin-bottom: 14px;
            }
            #oscpv2-modal .oscpv2-results-summary { display: flex; align-items: baseline; gap: 8px; }
            #oscpv2-modal .oscpv2-results-num {
                font-family: var(--font-display);
                font-size: 24px; font-weight: 700; color: var(--color-primary);
            }
            #oscpv2-modal .oscpv2-results-label { font-size: 13px; color: var(--color-text-muted); }

            /* TABS */
            #oscpv2-modal .oscpv2-tabs-wrap { position: relative; margin: 0 -2px; }
            #oscpv2-modal .oscpv2-tabs-wrap::after {
                content: ''; position: absolute; top: 0; bottom: 0; right: 0; width: 24px;
                background: linear-gradient(to right, transparent, var(--color-surface-3) 70%);
                pointer-events: none; opacity: 0.85;
            }
            #oscpv2-modal .oscpv2-tabs {
                display: flex; gap: 4px;
                border-bottom: 2px solid var(--color-border);
                overflow-x: auto; overflow-y: hidden;
                scroll-behavior: smooth;
                scrollbar-width: thin; scrollbar-color: var(--color-border) transparent;
                padding-bottom: 0;
            }
            #oscpv2-modal .oscpv2-tabs::-webkit-scrollbar { height: 4px; }
            #oscpv2-modal .oscpv2-tabs::-webkit-scrollbar-track { background: transparent; }
            #oscpv2-modal .oscpv2-tabs::-webkit-scrollbar-thumb {
                background: var(--color-border); border-radius: 3px;
            }
            #oscpv2-modal .oscpv2-tab {
                background: none; border: none; cursor: pointer;
                padding: 10px 14px;
                font-family: var(--font-body); font-size: 12px; font-weight: 500;
                color: var(--color-text-muted);
                border-bottom: 2px solid transparent; margin-bottom: -2px;
                display: flex; align-items: center; gap: 7px; white-space: nowrap;
                transition: color var(--duration) var(--ease), border-color var(--duration) var(--ease);
            }
            #oscpv2-modal .oscpv2-tab:hover { color: var(--color-text); }
            #oscpv2-modal .oscpv2-tab.active {
                color: var(--color-primary);
                border-bottom-color: var(--color-secondary);
                font-weight: 600;
            }
            #oscpv2-modal .oscpv2-tab-count {
                font-size: 11px; padding: 1px 7px;
                background: var(--color-surface); border-radius: 99px;
                color: var(--color-text-muted); font-weight: 600;
                border: 1px solid var(--color-border);
            }
            #oscpv2-modal .oscpv2-tab.active .oscpv2-tab-count {
                background: rgba(7,44,44,0.08);
                color: var(--color-primary); border-color: var(--color-border-strong);
            }

            /* RESULTS BODY */
            #oscpv2-modal .oscpv2-results-body {
                flex: 1 1 0; min-height: 0; overflow-y: auto; padding: 4px 0;
            }
            #oscpv2-modal .oscpv2-results-body::-webkit-scrollbar { width: 8px; }
            #oscpv2-modal .oscpv2-results-body::-webkit-scrollbar-track { background: var(--color-surface-2); }
            #oscpv2-modal .oscpv2-results-body::-webkit-scrollbar-thumb {
                background: var(--color-border); border-radius: 4px;
            }
            #oscpv2-modal .oscpv2-results-body::-webkit-scrollbar-thumb:hover {
                background: var(--color-border-strong);
            }
            #oscpv2-modal .oscpv2-company-group + .oscpv2-company-group {
                border-top: 1px solid var(--color-border);
            }
            #oscpv2-modal .oscpv2-company-row {
                display: flex; align-items: center; gap: 12px;
                padding: 12px 18px; background: var(--color-surface);
            }
            #oscpv2-modal .oscpv2-company-icon {
                width: 34px; height: 34px;
                background: var(--color-primary);
                border-radius: var(--radius);
                display: flex; align-items: center; justify-content: center;
                color: #fff;
                font-family: var(--font-display); font-weight: 600; font-size: 14px;
                flex-shrink: 0;
            }
            #oscpv2-modal .oscpv2-company-name {
                font-size: 14px; font-weight: 600; color: var(--color-text);
            }
            #oscpv2-modal .oscpv2-company-meta {
                font-size: 12px; color: var(--color-text-muted);
                font-family: var(--font-mono);
            }
            #oscpv2-modal .oscpv2-company-stats { margin-left: auto; display: flex; gap: 6px; }
            #oscpv2-modal .oscpv2-stat-chip {
                font-size: 11px; font-weight: 600;
                padding: 3px 9px; border-radius: 99px;
                background: var(--color-surface-2);
                border: 1px solid var(--color-border);
                color: var(--color-text-muted);
            }
            #oscpv2-modal .oscpv2-stat-chip strong { color: var(--color-text); }

            /* POLICIES TABLE */
            #oscpv2-modal table.oscpv2-policies {
                width: 100%; border-collapse: collapse; font-size: 13px;
            }
            #oscpv2-modal table.oscpv2-policies thead th {
                text-align: left;
                font-family: var(--font-display);
                font-size: 10px; font-weight: 600;
                text-transform: uppercase; letter-spacing: 0.08em;
                padding: 8px 12px;
                background: var(--color-primary); color: var(--color-surface);
                border-bottom: 1px solid var(--color-border);
            }
            #oscpv2-modal table.oscpv2-policies tbody td {
                padding: 11px 12px;
                border-bottom: 1px solid var(--color-border);
                vertical-align: middle; color: var(--color-text);
            }
            #oscpv2-modal table.oscpv2-policies tbody tr:hover td { background: var(--color-surface-2); }
            #oscpv2-modal .oscpv2-policy-no {
                font-family: var(--font-mono);
                font-size: 12px; color: var(--color-text); font-weight: 600;
            }
            #oscpv2-modal .oscpv2-car-cell { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
            #oscpv2-modal .oscpv2-car-brand { font-weight: 500; color: var(--color-text); }
            #oscpv2-modal .oscpv2-car-plate {
                font-family: var(--font-mono); font-size: 11px;
                color: var(--color-text-muted); letter-spacing: 0.04em;
            }

            /* TYPE PILLS */
            #oscpv2-modal .oscpv2-type-pill {
                display: inline-flex; align-items: center; gap: 5px;
                font-size: 11px; font-weight: 600;
                padding: 3px 8px; border-radius: 99px; white-space: nowrap;
            }
            #oscpv2-modal .oscpv2-type-truck   { background: var(--color-warning-bg); color: var(--color-warning); }
            #oscpv2-modal .oscpv2-type-agro    { background: var(--color-success-bg); color: var(--color-success); }
            #oscpv2-modal .oscpv2-type-car     { background: var(--color-danger-bg);  color: var(--color-danger); }
            #oscpv2-modal .oscpv2-type-bus     { background: #E3F2FD; color: #1565C0; }
            #oscpv2-modal .oscpv2-type-moto    { background: #FFF7D6; color: #876900; }
            #oscpv2-modal .oscpv2-type-trailer { background: #E6E6F5; color: #585A93; }
            #oscpv2-modal .oscpv2-type-other   { background: var(--color-surface); color: var(--color-text-muted); }

            #oscpv2-modal .oscpv2-insurer-cell { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
            #oscpv2-modal .oscpv2-insurer-name {
                font-size: 13px; color: var(--color-text); font-weight: 500; line-height: 1.2;
            }
            #oscpv2-modal .oscpv2-insurer-year {
                font-family: var(--font-mono); font-size: 11px;
                color: var(--color-text-muted); letter-spacing: 0.04em;
            }

            /* LOSS PILL */
            #oscpv2-modal .oscpv2-loss-pill {
                display: inline-flex; align-items: center; gap: 5px;
                font-size: 11px; font-weight: 600;
                padding: 3px 9px; border-radius: 99px; white-space: nowrap;
            }
            #oscpv2-modal .oscpv2-loss-none { background: var(--color-success-bg); color: var(--color-success-text); }
            #oscpv2-modal .oscpv2-loss-low  { background: var(--color-warning-bg); color: var(--color-warning); }
            #oscpv2-modal .oscpv2-loss-high { background: var(--color-danger-bg);  color: var(--color-danger); cursor: help; }
            #oscpv2-modal .oscpv2-loss-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: 0.7; }

            /* EMPTY STATE */
            #oscpv2-modal .oscpv2-empty-state {
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                padding: 60px 20px; color: var(--color-text-subtle); text-align: center;
            }
            #oscpv2-modal .oscpv2-empty-ico {
                display: flex; align-items: center; justify-content: center;
                opacity: 0.85; margin-bottom: 14px;
            }
            #oscpv2-modal .oscpv2-empty-txt { font-size: 14px; }

            /* LOG */
            #oscpv2-modal .oscpv2-log-wrap {
                background: var(--color-surface);
                border-top: 1px solid var(--color-border);
                padding: 14px 22px;
            }
            #oscpv2-modal .oscpv2-log-content {
                background: var(--color-primary); color: #CBD5E1;
                border-radius: var(--radius-md); padding: 12px;
                font-family: var(--font-mono); font-size: 12px;
                max-height: 180px; overflow-y: auto; white-space: pre-wrap;
            }
            #oscpv2-modal .oscpv2-log-content .ok   { color: #86EFAC; }
            #oscpv2-modal .oscpv2-log-content .err  { color: #FCA5A5; }
            #oscpv2-modal .oscpv2-log-content .info { color: #93C5FD; }
            #oscpv2-modal .oscpv2-log-content .dim  { color: #6B7280; }

            /* FOOTER */
            #oscpv2-modal .oscpv2-footer {
                display: flex; align-items: center; gap: 8px;
                padding: 14px 22px;
                background: var(--color-surface-3);
                border-top: 1px solid var(--color-border);
            }
            #oscpv2-modal .oscpv2-footer-status {
                flex: 1; font-size: 13px; color: var(--color-text-muted);
                display: flex; align-items: center; gap: 8px;
            }
            #oscpv2-modal .oscpv2-status-dot {
                width: 8px; height: 8px; border-radius: 50%;
                background: var(--color-border-strong); flex-shrink: 0;
            }
            #oscpv2-modal .oscpv2-status-dot.active {
                background: var(--color-secondary);
                box-shadow: 0 0 0 4px rgba(255,95,3,0.15);
                animation: oscpv2-pulse 1.8s ease-in-out infinite;
            }
            #oscpv2-modal .oscpv2-status-dot.success { background: var(--color-success); }
            #oscpv2-modal .oscpv2-btn {
                border: 1px solid var(--color-border);
                background: var(--color-surface-3);
                color: var(--color-text);
                font-family: var(--font-body);
                font-size: 12px; font-weight: 500;
                text-transform: uppercase; letter-spacing: 0.04em;
                padding: 8px 14px;
                border-radius: var(--radius);
                cursor: pointer;
                display: inline-flex; align-items: center; gap: 6px;
                transition: all var(--duration) var(--ease);
            }
            #oscpv2-modal .oscpv2-btn:hover { border-color: var(--color-border-strong); background: var(--color-surface); }
            #oscpv2-modal .oscpv2-btn:disabled { opacity: 0.55; cursor: not-allowed; }
            #oscpv2-modal .oscpv2-btn-primary {
                background: var(--color-primary);
                border-color: var(--color-primary);
                color: #fff; font-weight: 600; padding: 8px 18px;
            }
            #oscpv2-modal .oscpv2-btn-primary:hover { background: var(--color-primary-hover); border-color: var(--color-primary-hover); }
            #oscpv2-modal .oscpv2-btn-primary:active { background: var(--color-primary-active); transform: scale(0.98); }
            #oscpv2-modal .oscpv2-btn-primary:disabled { background: var(--color-border); border-color: var(--color-border); }
            #oscpv2-modal .oscpv2-btn.oscpv2-btn-active {
                background: rgba(7,44,44,0.08); color: var(--color-primary); border-color: var(--color-border-strong);
            }

            /* RESPONSIVE */
            @media (max-width: 920px) {
                #oscpv2-modal .oscpv2-body { grid-template-columns: 1fr; }
                #oscpv2-modal .oscpv2-results-card { height: 480px; }
            }
        `;
        document.head.appendChild(s);
    }

    function log(msg, type = '') {
        const l = document.getElementById('oscpv2-log');
        if (!l) return;
        const t = new Date().toLocaleTimeString();
        const div = document.createElement('div');
        div.className = type;
        div.textContent = `[${t}] ${msg}`;
        l.appendChild(div);
        l.scrollTop = l.scrollHeight;
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    // ====== Carplates gov-registration API ======

    function getOduaApiKey() {
        let key = GM_getValue('oscpv_odua_api_key', '');
        if (!key) {
            key = (prompt('Введіть API ключ OpenDataUA (odua_xxx...):\nhttps://opendata.universalnabaza.com.ua') || '').trim();
            if (key) GM_setValue('oscpv_odua_api_key', key);
        }
        return key;
    }

    function fetchVehicleData(identifier, type) {
        return new Promise(resolve => {
            const apiKey = getOduaApiKey();
            if (!apiKey) { resolve(null); return; }
            const endpoint = type === 'vin' ? 'vin' : 'plate';
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://opendata.universalnabaza.com.ua/api/v1/cars/' + endpoint + '/' + encodeURIComponent(identifier),
                headers: { 'X-Api-Key': apiKey },
                timeout: 10000,
                onload: resp => {
                    try {
                        if (resp.status === 404) { resolve(null); return; }
                        const json = JSON.parse(resp.responseText);
                        if (!json.records || !json.records.length) { resolve(null); return; }
                        const d = json.records[0];
                        let calc_category = '';
                        if (d.total_weight && d.own_weight) {
                            const total = parseInt(d.total_weight, 10);
                            const own = parseInt(d.own_weight, 10);
                            if (!isNaN(total) && !isNaN(own)) {
                                const payload = total - own;
                                if (total <= 2400 && payload <= 2000) {
                                    calc_category = 'C0';
                                } else if (total > 2400 && total <= 7500 && payload <= 2000) {
                                    calc_category = 'C1';
                                } else if (total > 7500 || payload > 2000) {
                                    calc_category = 'C2';
                                }
                            }
                        }
                        resolve({
                            brand: d.brand || '',
                            model: d.model || '',
                            year: d.year ? String(d.year) : '',
                            fuel: d.fuel_type || '',
                            engine: d.engine_volume ? d.engine_volume + '\xa0см³' : '',
                            weight: d.own_weight ? d.own_weight + '\xa0кг' : '',
                            total_weight: d.total_weight ? d.total_weight + '\xa0кг' : '',
                            region: d.region || '',
                            color: d.color || '',
                            vin: d.vin || '',
                            body: d.body_type || '',
                            body_detail: d.body_detail || '',
                            calc_category: calc_category
                        });
                    } catch (e) { resolve(null); }
                },
                onerror: () => resolve(null),
                ontimeout: () => resolve(null)
            });
        });
    }

    async function enrichResultsWithCarplates() {
        const btn = document.getElementById('oscpv2-enrich-btn');
        if (btn) { btn.disabled = true; btn.textContent = '...'; }

        const allRows = Array.from(document.querySelectorAll('tr[data-row-idx]'));

        const vinIds = [], plateIds = [];
        for (const tr of allRows) {
            const rowIdx = parseInt(tr.dataset.rowIdx);
            const r = results[rowIdx];
            if (!r) continue;
            if (r.vin) vinIds.push(r.vin);
            else {
                const plateEl = tr.querySelector('.oscpv2-car-plate');
                const plate = plateEl ? plateEl.textContent.trim() : '';
                if (plate) plateIds.push(plate);
            }
        }

        const apiKey = getOduaApiKey();
        if (!apiKey) {
            if (btn) { btn.disabled = false; btn.textContent = 'ЗБАГАТИТИ АВТО'; }
            return;
        }

        const resultMap = {};

        async function fetchBatch(identifiers) {
            const BATCH = 100;
            for (let i = 0; i < identifiers.length; i += BATCH) {
                const chunk = [...new Set(identifiers.slice(i, i + BATCH))];
                if (!chunk.length) continue;
                await new Promise(resolve => {
                    GM_xmlhttpRequest({
                        method: 'POST',
                        url: 'https://opendata.universalnabaza.com.ua/api/v1/cars/lookup',
                        headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
                        data: JSON.stringify({ identifiers: chunk }),
                        timeout: 30000,
                        onload: resp => {
                            try {
                                const json = JSON.parse(resp.responseText);
                                if (json.results) {
                                    for (const r of json.results) {
                                        if (!r.found) continue;
                                        let calc_category = '';
                                        if (r.total_weight && r.own_weight) {
                                            const total = parseInt(r.total_weight, 10);
                                            const own = parseInt(r.own_weight, 10);
                                            if (!isNaN(total) && !isNaN(own)) {
                                                const p = total - own;
                                                if (total <= 2400 && p <= 2000) calc_category = 'C0';
                                                else if (total > 2400 && total <= 7500 && p <= 2000) calc_category = 'C1';
                                                else if (total > 7500 || p > 2000) calc_category = 'C2';
                                            }
                                        }
                                        resultMap[r.query] = {
                                            brand: r.brand || '', model: r.model || '',
                                            year: r.year ? String(r.year) : '',
                                            fuel: r.fuel_type || '',
                                            engine: r.engine_volume ? r.engine_volume + ' см³' : '',
                                            weight: r.own_weight ? r.own_weight + ' кг' : '',
                                            total_weight: r.total_weight ? r.total_weight + ' кг' : '',
                                            region: r.region || '', color: r.color || '',
                                            vin: r.vin || '', body: r.body_type || '', calc_category
                                        };
                                    }
                                }
                            } catch (e) { /* skip */ }
                            resolve();
                        },
                        onerror: () => resolve(),
                        ontimeout: () => resolve()
                    });
                });
                if (btn) btn.textContent = `${Math.min(i + BATCH, identifiers.length)}/${identifiers.length}`;
            }
        }

        await fetchBatch(vinIds);
        await fetchBatch(plateIds);

        let enriched = 0;
        for (const tr of allRows) {
            const rowIdx = parseInt(tr.dataset.rowIdx);
            const r = results[rowIdx];
            if (!r) continue;
            const plateEl = tr.querySelector('.oscpv2-car-plate');
            const key = r.vin || (plateEl ? plateEl.textContent.trim() : '');
            const data = resultMap[key];
            if (!data || !data.brand) continue;
            const brandEl = tr.querySelector('.oscpv2-car-brand');
            if (brandEl) {
                brandEl.textContent = [data.brand, data.model, data.year ? `(${data.year})` : ''].filter(Boolean).join(' ');
                brandEl.title = [
                    data.color ? `Колір: ${data.color}` : '',
                    data.fuel ? `Пальне: ${data.fuel}` : '',
                    data.engine ? `Двигун: ${data.engine}` : '',
                    data.weight ? `Маса: ${data.weight}` : '',
                    data.total_weight ? `Повна маса: ${data.total_weight}` : '',
                    data.calc_category ? `Категорія: ${data.calc_category}` : '',
                    data.region ? `Регіон: ${data.region}` : '',
                    data.vin ? `VIN: ${data.vin}` : ''
                ].filter(Boolean).join('\n');
            }
            enriched++;
        }

        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<svg viewBox="0 0 20 20" fill="none" width="13" height="13" aria-hidden="true"><path d="M4 10a6 6 0 0 1 6-6 6 6 0 0 1 4.24 1.76" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14 5V2M14 5h-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 10a6 6 0 0 1-10 4.24" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> ЗБАГАТИТИ АВТО`;
            btn.title = `Збагачено: ${enriched} / ${allRows.length}`;
        }
    }

        async function startBatch() {
        const ipns = document.getElementById('oscpv2-ipns').value
            .split('\n').map(s => s.trim()).filter(Boolean);
        if (!ipns.length) { alert('Введіть хоча б один ІПН'); return; }

        const delayRun = parseInt(document.getElementById('oscpv2-delay-run').value) || CONFIG.DELAY_AFTER_RUN;
        const delayIpn = parseInt(document.getElementById('oscpv2-delay-ipn').value) || CONFIG.DELAY_BETWEEN_IPN;
        const concurrency = 3;  // паралельні потоки обробки ЄДРПОУ (як у B2C)

        // Готуємо UI для обробки
        document.getElementById('oscpv2-start').disabled = true;
        document.getElementById('oscpv2-export').disabled = true;
        document.getElementById('oscpv2-progress-card').style.display = 'block';
        document.getElementById('oscpv2-info').textContent = 'Йде обробка...';

        // Скидаємо лічильники
        results = [];
        statsFound = 0;
        statsEmpty = 0;

        document.getElementById('oscpv2-stat-found').textContent = '0';
        document.getElementById('oscpv2-stat-empty').textContent = '0';
        document.getElementById('oscpv2-fill').style.width = '0%';
        document.getElementById('oscpv2-progress-text').textContent = `0 / ${ipns.length}`;

        // Готуємо результати - очищуємо область, повертаємо empty-state
        const resArea = document.getElementById('oscpv2-results-area');
        resArea.innerHTML = `
            <div class="oscpv2-empty-state">
                <div class="oscpv2-empty-ico">
                    <svg viewBox="0 0 64 64" fill="none" width="64" height="64" aria-hidden="true">
                        <circle cx="32" cy="32" r="24" stroke="currentColor" stroke-width="3" stroke-dasharray="6 4"/>
                        <path d="M32 20v12l8 8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                    </svg>
                </div>
                <div class="oscpv2-empty-txt">Обробка запитів...</div>
            </div>
        `;
        // Скидаємо лічильники у заголовку результатів
        const numEl = document.getElementById('oscpv2-results-num');
        const labelEl = document.getElementById('oscpv2-results-label');
        if (numEl) numEl.textContent = '0';
        if (labelEl) labelEl.textContent = 'полісів';
        // Скидаємо лічильники у табах
        for (const g of VEHICLE_GROUPS) {
            const el = modalEl && modalEl.querySelector(`[data-tab-count="${g.id}"]`);
            if (el) el.textContent = '0';
        }
        // Активуємо вкладку "Всі"
        switchTab('all');

        // Скинути стан спінера у "Обробка..."
        const stage = document.getElementById('oscpv2-stage');
        if (stage) stage.textContent = 'Обробка...';

        const dot = document.getElementById('oscpv2-status-dot');
        if (dot) { dot.classList.remove('success'); dot.classList.add('active'); }

        const progressState = document.getElementById('oscpv2-progress-state');
        if (progressState) {
            progressState.textContent = 'У ПРОЦЕСІ';
            progressState.style.background = '';
            progressState.style.color = '';
        }

        log(`Старт обробки: ${ipns.length} ІПН`, 'info');
        log(`Відкриваю dict.universalna.com у фоновій вкладці...`, 'dim');

        const sessionId = 'oscpv_' + Date.now();
        GM_setValue('oscpvbb_request_' + sessionId, JSON.stringify({
            ipns, delayRun, delayIpn, concurrency,
            time: Date.now()
        }));

        // Відкриваємо dict як popup-вікно щоб не красти фокус з Odoo
        const dictFeatures = [
            'popup=yes',
            'width=500',
            'height=400',
            'left=' + (screen.width - 100),
            'top=' + (screen.height - 100),
            'menubar=no', 'toolbar=no', 'location=no', 'status=no'
        ].join(',');
        const win = window.open(CONFIG.TABLE_URL + '#oscpvbb_session=' + sessionId, '_blank', dictFeatures);
        if (!win) {
            log('ПОМИЛКА: спливаючі вікна заблоковані. Дозвольте їх для odoo.icu.int', 'err');
            document.getElementById('oscpv2-start').disabled = false;
            document.getElementById('oscpv2-info').textContent = 'Помилка: спливаючі вікна заблоковані';
            return;
        }

        // Повертаємо фокус на нашу вкладку Odoo
        try {
            win.blur();
            window.focus();
            let attempts = 0;
            const focusInt = setInterval(() => {
                try { window.focus(); } catch (e) { }
                if (++attempts > 10) clearInterval(focusInt);
            }, 100);
        } catch (e) { }

        const progressKey = 'oscpvbb_progress_' + sessionId;
        const resultKey = 'oscpvbb_result_' + sessionId;

        GM_addValueChangeListener(progressKey, (name, oldV, newV) => {
            if (!newV) return;
            try {
                const data = JSON.parse(newV);
                if (data.batch) {
                    data.batch.forEach(item => handleProgressUpdate(item, ipns.length));
                } else {
                    handleProgressUpdate(data, ipns.length);
                }
            } catch (e) { }
        });

        GM_addValueChangeListener(resultKey, (name, oldV, newV) => {
            if (!newV) return;
            try {
                const data = JSON.parse(newV);
                finishBatch(data);
                GM_deleteValue('oscpvbb_request_' + sessionId);
                GM_deleteValue(progressKey);
                GM_deleteValue(resultKey);
            } catch (e) { }
        });
    }

    function handleProgressUpdate(data, total) {
        if (data.log) log(data.log, data.logType || '');

        if (data.progress !== undefined) {
            const pct = (data.progress / total) * 100;
            document.getElementById('oscpv2-fill').style.width = pct + '%';
            document.getElementById('oscpv2-progress-text').textContent = `${data.progress} / ${total}`;

            // Оновлюємо текст у стадії
            const stage = document.getElementById('oscpv2-stage');
            if (stage && data.progress < total) {
                const dot = document.getElementById('oscpv2-status-dot');
                if (dot) dot.classList.add('active');
                stage.textContent = `Обробка ${data.progress + 1} з ${total}...`;
            }
        }

        if (data.newResults && data.newResults.length) {
            // Для B2B - ipn це насправді ЄДРПОУ
            const edrpou = data.ipn || (data.newResults[0] && data.newResults[0].ipn);

            data.newResults.forEach(r => {
                const rowIdx = results.length;
                results.push(r);

                if (r._notFound) {
                    statsEmpty++;
                    appendNotFoundRow(r, rowIdx);
                } else {
                    statsFound++;
                    appendPolicyRow(r, rowIdx);
                }
            });

            updateSummary();
            // Перезастосовуємо активний таб (для нових рядків)
            switchTab(activeTab);
        }
    }

    /**
     * Додає рядок результату до таблиці потрібної компанії (групи по ЄДРПОУ).
     * Створює групу якщо її ще немає.
     */
    function appendPolicyRow(r, rowIdx) {
        const edrpou = r.ipn; // у B2B полі ipn міститься ЄДРПОУ
        const group = ensureCompanyGroup(edrpou, r);

        const tbody = group.querySelector('tbody');
        const tr = document.createElement('tr');
        tr.dataset.rowIdx = rowIdx;
        const groupId = getVehicleGroup(r.vehicle_type);
        tr.dataset.tab = groupId;

        // Авто: марка/модель + номер
        const brand = r.vehicle_brand || '';
        const title = r.vehicle_title || '';
        const brandModel = [brand, title].filter(Boolean).join(' ');

        // Тип ТЗ - pill з відповідним кольором
        const typeMeta = VEHICLE_GROUPS.find(g => g.id === groupId);
        const typeLabelHtml = typeMeta ? (typeMeta.icon + ' ' + escapeHtml(typeMeta.label)) :
            escapeHtml(getVehicleCode(r.vehicle_type) || 'ІНШЕ');

        // Страховик + рік
        const insurerCell = `
            <div class="oscpv2-insurer-cell">
                <span class="oscpv2-insurer-name">${escapeHtml(r.insurer_name || '')}</span>
                <span class="oscpv2-insurer-year">${escapeHtml(r.start_date || '')}</span>
            </div>
        `;

        // Збитки
        const lossAmount = parseFloat(r.total_loss_amount) || 0;
        const eventsCount = parseInt(r.insured_events_count) || 0;
        const paidAmount = parseFloat(r.paid_loss_amount) || 0;
        const reservedAmount = parseFloat(r.reserved_loss_amount) || 0;
        let lossCell;
        if (lossAmount > 0 || eventsCount > 0) {
            const tooltip = `Подій: ${eventsCount}\nЗаг. сума: ${lossAmount}\nВиплачено: ${paidAmount}\nРезерв: ${reservedAmount}`;
            const lossClass = lossAmount > 30000 ? 'oscpv2-loss-high' : 'oscpv2-loss-low';
            lossCell = `<span class="oscpv2-loss-pill ${lossClass}" title="${escapeHtml(tooltip)}">${formatMoney(lossAmount)} ₴</span>`;
        } else {
            lossCell = `<span class="oscpv2-loss-pill oscpv2-loss-none"><span class="oscpv2-loss-dot"></span>немає</span>`;
        }

        tr.innerHTML = `
            <td><span class="oscpv2-policy-no">${escapeHtml(r.policy_no || '—')}</span></td>
            <td>
                <div class="oscpv2-car-cell">
                    <span class="oscpv2-car-brand">${escapeHtml(brandModel)}</span>
                    ${r.plate_no ? `<span class="oscpv2-car-plate">${escapeHtml(r.plate_no)}</span>` : ''}
                </div>
            </td>
            <td><span class="oscpv2-type-pill oscpv2-type-${groupId}">${typeLabelHtml}</span></td>
            <td>${insurerCell}</td>
            <td>${lossCell}</td>
        `;
        tbody.appendChild(tr);

        // Оновлюємо лічильники групи
        const groupData = group._oscpvData;
        groupData.policies++;
        if (!groupData.vehicles.has(r.vin || r.plate_no || `_${rowIdx}`)) {
            groupData.vehicles.add(r.vin || r.plate_no || `_${rowIdx}`);
        }
        const stats = group.querySelector('.oscpv2-company-stats');
        if (stats) {
            stats.innerHTML = `
                <span class="oscpv2-stat-chip"><strong>${groupData.policies}</strong> полісів</span>
                <span class="oscpv2-stat-chip"><strong>${groupData.vehicles.size}</strong> ТЗ</span>
            `;
        }
    }

    function appendNotFoundRow(r, rowIdx) {
        const edrpou = r.ipn;
        const group = ensureCompanyGroup(edrpou, r);
        const tbody = group.querySelector('tbody');
        const tr = document.createElement('tr');
        tr.dataset.rowIdx = rowIdx;
        tr.dataset.tab = 'all'; // показувати тільки в All
        tr.innerHTML = `
            <td colspan="5" style="text-align:center;color:#b3aaa8;font-style:italic;padding:14px">
                Полісів ОСЦПВ не знайдено
            </td>
        `;
        tbody.appendChild(tr);
    }

    /**
     * Знаходить або створює групу-картку для компанії за ЄДРПОУ.
     */
    function ensureCompanyGroup(edrpou, sampleResult) {
        const area = document.getElementById('oscpv2-results-area');
        // Якщо в зоні досі empty-state — прибираємо
        const empty = area.querySelector('.oscpv2-empty-state');
        if (empty) area.innerHTML = '';

        let group = area.querySelector(`.oscpv2-company-group[data-edrpou="${edrpou}"]`);
        if (group) return group;

        // Беремо першу літеру компанії з повного імені (якщо є) або з ЄДРПОУ
        const companyName = (sampleResult && sampleResult.full_name) || `Компанія ${edrpou}`;
        const initial = (companyName.replace(/^(ТОВ|ФГ|ПП|ПрАТ|АТ|ТзОВ|ФОП)[\s"«]*/i, '').trim()[0] || '?').toUpperCase();

        group = document.createElement('div');
        group.className = 'oscpv2-company-group';
        group.dataset.edrpou = edrpou;
        group._oscpvData = { policies: 0, vehicles: new Set() };
        group.innerHTML = `
            <div class="oscpv2-company-row">
                <div class="oscpv2-company-icon">${escapeHtml(initial)}</div>
                <div>
                    <div class="oscpv2-company-name">${escapeHtml(companyName)}</div>
                    <div class="oscpv2-company-meta">ЄДРПОУ ${escapeHtml(edrpou)}</div>
                </div>
                <div class="oscpv2-company-stats">
                    <span class="oscpv2-stat-chip"><strong>0</strong> полісів</span>
                    <span class="oscpv2-stat-chip"><strong>0</strong> ТЗ</span>
                </div>
            </div>
            <table class="oscpv2-policies">
                <thead>
                    <tr>
                        <th style="width:120px">№ полісу</th>
                        <th>Авто</th>
                        <th style="width:120px">Тип</th>
                        <th style="width:170px">Оформлено в</th>
                        <th style="width:120px">Збитковість</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        `;
        area.appendChild(group);
        return group;
    }

    /**
     * Оновлює великий заголовок "47 полісів", лічильники табів
     * і прогрес-секцію.
     */
    function updateSummary() {
        const totalPolicies = results.filter(r => !r._notFound).length;
        const allVehicles = new Set();
        const tabCounts = {};
        VEHICLE_GROUPS.forEach(g => tabCounts[g.id] = 0);

        for (const r of results) {
            if (r._notFound) continue;
            allVehicles.add(r.vin || r.plate_no || `_${r.policy_no}`);
            tabCounts.all++;
            const g = getVehicleGroup(r.vehicle_type);
            if (tabCounts[g] !== undefined) tabCounts[g]++;
        }

        // Великий лічильник зверху таблиці
        const numEl = document.getElementById('oscpv2-results-num');
        const labelEl = document.getElementById('oscpv2-results-label');
        if (numEl) numEl.textContent = totalPolicies;
        if (labelEl) {
            const companies = document.querySelectorAll('.oscpv2-company-group').length;
            labelEl.textContent = `полісів · ${allVehicles.size} ТЗ · ${companies} ЄДРПОУ`;
        }

        // Лічильники в табах
        for (const g of VEHICLE_GROUPS) {
            const el = modalEl && modalEl.querySelector(`[data-tab-count="${g.id}"]`);
            if (el) el.textContent = tabCounts[g.id] || 0;
        }

        // Стати у прогрес-картці
        document.getElementById('oscpv2-stat-found').textContent = totalPolicies;
        document.getElementById('oscpv2-stat-empty').textContent = statsEmpty;
        const tzEl = document.getElementById('oscpv2-stat-tz');
        if (tzEl) tzEl.textContent = allVehicles.size;
    }


    async function finishBatch(data) {
        log(`Готово! Зібрано ${results.length} записів`, 'ok');

        const stage = document.getElementById('oscpv2-stage');
        const info = document.getElementById('oscpv2-info');

        document.getElementById('oscpv2-start').disabled = false;
        document.getElementById('oscpv2-export').disabled = results.length === 0;
        const enrichBtn = document.getElementById('oscpv2-enrich-btn');
        if (enrichBtn) enrichBtn.disabled = results.length === 0;

        // Деактивуємо пульсуючу крапку статусу
        const dot = document.getElementById('oscpv2-status-dot');
        if (dot) { dot.classList.remove('active'); dot.classList.add('success'); }

        const progressState = document.getElementById('oscpv2-progress-state');
        if (progressState) {
            progressState.textContent = 'ГОТОВО';
            progressState.style.background = '#eaf5ec';
            progressState.style.color = '#3f7a3a';
        }

        if (stage) stage.textContent = 'ЗАВЕРШЕНО';
        if (info) info.textContent = `Готово: ${statsFound} полісів, ${statsEmpty} без даних`;
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function formatMoney(n) {
        // Розділяємо тисячі пробілами для зручного читання: 12500 → "12 500"
        return Number(n).toLocaleString('uk-UA').replace(/,/g, ' ');
    }

    function exportExcel() {
        if (!results.length) return alert('Немає даних для експорту');

        const today = new Date();
        const todayIso = today.toISOString().slice(0, 10);
        const todayDt = today.toISOString().replace('T', ' ').slice(0, 19) + '.000000';

        // Стилі для заголовків (групові + детальні): жирний #666666, фон #AFEEEE, центр+wrap
        const HEADER_GROUP_STYLE = {
            font: { name: 'Arial', sz: 11, bold: true, color: { rgb: '666666' } },
            fill: { patternType: 'solid', fgColor: { rgb: 'AFEEEE' } },
            alignment: { horizontal: 'center', vertical: 'top', wrapText: true },
            border: {
                top: { style: 'thin', color: { rgb: 'CCCCCC' } },
                bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
                left: { style: 'thin', color: { rgb: 'CCCCCC' } },
                right: { style: 'thin', color: { rgb: 'CCCCCC' } }
            }
        };
        const HEADER_CELL_STYLE = {
            font: { name: 'Arial', sz: 11, bold: true, color: { rgb: '666666' } },
            fill: { patternType: 'solid', fgColor: { rgb: 'AFEEEE' } },
            alignment: { horizontal: 'center', vertical: 'top', wrapText: true },
            border: {
                top: { style: 'thin', color: { rgb: 'CCCCCC' } },
                bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
                left: { style: 'thin', color: { rgb: 'CCCCCC' } },
                right: { style: 'thin', color: { rgb: 'CCCCCC' } }
            }
        };
        const DATA_CELL_STYLE = {
            font: { name: 'Arial', sz: 10, color: { rgb: '333333' } },
            alignment: { vertical: 'top', wrapText: true }
        };

        // Об'єднання A1:E1, F1:N1, O1:AJ1
        const headerRow1 = [
            'Виконання запиту', '', '', '', '',
            'Параметри пошуку', '', '', '', '', '', '', '', '',
            'Відповідь МТСБУ'
        ];
        // 36 деталізованих колонок
        const headerRow2 = [
            'Мітка для імпорту', 'Середовище', 'Дата запиту', 'Успішність запиту', 'Помилка якщо є',
            'РНОКПП Фізичної або ЄДРПОУ юридичної особи або серія та номер паспорту або ID паспорту для фізичних осіб',
            'Номер ТЗ або Vin код ТЗ', 'Vin код ТЗ',
            'Прізвище фізичної особи або назва юридичної особи', "Ім'я", 'По батькові',
            'Дата початку періоду', 'Дата кінця періоду', 'Тип страхування',
            'Державний номер ТЗ', 'VIN код ТЗ', 'Серія полісу', 'Номер полісу',
            'Рік початку дії полісу', 'Строк дії полісу', 'Страхувальник назва ПІБ',
            'Код страхової компанії', 'Назва страхової компанії',
            'Тип ТЗ позначення', 'Марка ТЗ', 'Повне найменування ТЗ розрах',
            'Кількість потерпілих', 'Кількість випадків', 'Дата ДТП події',
            'Загальна кількість вимог за полісом', 'Кількість вимог в роботі рішення не прийнято',
            'Кількість врегульованих вимог', 'Кількість вимог за якими відмовлено у виплаті',
            'Нарахована сума відшкодуваня', 'Сплачена сума збитку', 'Несплачена сума збитку'
        ];

        // Будуємо дані
        const dataRows = results.map(r => {
            const isError = !!r._notFound;
            return [
                // A-E: Виконання запиту
                r.ipn || '',                            // Мітка для імпорту
                'Пром',                                  // Середовище
                todayDt,                                 // Дата запиту
                isError ? '—' : 'Успішно',               // Успішність запиту
                isError ? 'Поліси не знайдено' : '',     // Помилка якщо є

                // F-N: Параметри пошуку
                r.ipn || '',                            // РНОКПП/ЄДРПОУ
                '',                                      // Номер ТЗ або Vin (порожнє при пошуку за ЄДРПОУ)
                '',                                      // Vin код
                '',                                      // Прізвище/назва (порожнє при пошуку)
                '',                                      // Ім'я
                '',                                      // По батькові
                '2025-01-01',                            // Дата початку
                todayIso,                                // Дата кінця
                'OSCPV',                                 // Тип страхування

                // O-AJ: Відповідь МТСБУ
                r.plate_no || '',                       // Держ. номер
                r.vin || '',                            // VIN
                r.policy_series || '',                  // Серія полісу
                r.policy_no || '',                      // Номер полісу
                r.start_date || '',                     // Рік початку
                r.validity_period || '',                // Строк дії
                r.full_name || '',                      // Страхувальник
                r.insurer_code || '',                   // Код СК
                r.insurer_name || '',                   // Назва СК
                r.vehicle_type || '',                   // Тип ТЗ позначення
                r.vehicle_brand || '',                  // Марка
                r.vehicle_title || '',                  // Повне найменування
                r.claims_count !== undefined ? r.claims_count : '',
                r.insured_events_count !== undefined ? r.insured_events_count : '',
                Array.isArray(r.event_date) ? r.event_date.join(', ') : (r.event_date || ''),
                r.total_claims_count !== undefined ? r.total_claims_count : '',
                r.claims_in_work_count !== undefined ? r.claims_in_work_count : '',
                r.settled_claims_count !== undefined ? r.settled_claims_count : '',
                r.refused_claims_count !== undefined ? r.refused_claims_count : '',
                r.total_loss_amount !== undefined ? r.total_loss_amount : '',
                r.paid_loss_amount !== undefined ? r.paid_loss_amount : '',
                r.reserved_loss_amount !== undefined ? r.reserved_loss_amount : ''
            ];
        });

        // Збираємо aoa
        const aoa = [headerRow1, headerRow2, ...dataRows];
        const ws = XLSX.utils.aoa_to_sheet(aoa);

        // Merges
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, // A1:E1
            { s: { r: 0, c: 5 }, e: { r: 0, c: 13 } }, // F1:N1
            { s: { r: 0, c: 14 }, e: { r: 0, c: 35 } }  // O1:AJ1
        ];

        // Застосовуємо стилі ДО ВСІХ КОМІРОК
        const numCols = 36;
        // Рядок 1 — групи (центр, фон)
        for (let c = 0; c < numCols; c++) {
            const addr = XLSX.utils.encode_cell({ r: 0, c });
            if (!ws[addr]) ws[addr] = { t: 's', v: '' };
            ws[addr].s = HEADER_GROUP_STYLE;
        }
        // Рядок 2 — детальні заголовки
        for (let c = 0; c < numCols; c++) {
            const addr = XLSX.utils.encode_cell({ r: 1, c });
            if (!ws[addr]) ws[addr] = { t: 's', v: '' };
            ws[addr].s = HEADER_CELL_STYLE;
        }
        // Рядки даних
        for (let r = 2; r < aoa.length; r++) {
            for (let c = 0; c < numCols; c++) {
                const addr = XLSX.utils.encode_cell({ r, c });
                if (!ws[addr]) ws[addr] = { t: 's', v: '' };
                ws[addr].s = DATA_CELL_STYLE;
            }
        }

        // Ширини колонок (близько до прикладу)
        ws['!cols'] = [
            { wch: 14 },  // A: Мітка
            { wch: 12 },  // B: Середовище
            { wch: 20 },  // C: Дата запиту
            { wch: 14 },  // D: Успішність
            { wch: 16 },  // E: Помилка
            { wch: 22 },  // F: РНОКПП/ЄДРПОУ
            { wch: 14 },  // G: Номер/Vin
            { wch: 20 },  // H: Vin код
            { wch: 28 },  // I: Прізвище/назва
            { wch: 12 },  // J: Ім'я
            { wch: 14 },  // K: По батькові
            { wch: 14 },  // L: Дата початку
            { wch: 14 },  // M: Дата кінця
            { wch: 14 },  // N: Тип страх.
            { wch: 14 },  // O: Держ. номер
            { wch: 22 },  // P: VIN
            { wch: 10 },  // Q: Серія
            { wch: 14 },  // R: Номер полісу
            { wch: 10 },  // S: Рік
            { wch: 10 },  // T: Строк
            { wch: 28 },  // U: Страхувальник
            { wch: 8 },   // V: Код СК
            { wch: 22 },  // W: Назва СК
            { wch: 50 },  // X: Тип ТЗ
            { wch: 14 },  // Y: Марка
            { wch: 32 },  // Z: Повне найменування
            { wch: 12 },  // AA: К-сть потерпілих
            { wch: 12 },  // AB: К-сть випадків
            { wch: 14 },  // AC: Дата ДТП
            { wch: 14 },  // AD: Заг. к-сть вимог
            { wch: 16 },  // AE: К-сть в роботі
            { wch: 14 },  // AF: К-сть врегул.
            { wch: 14 },  // AG: К-сть відмов
            { wch: 14 },  // AH: Нарахована
            { wch: 14 },  // AI: Сплачена
            { wch: 14 }   // AJ: Несплачена
        ];

        // Висоти рядків заголовків і даних
        ws['!rows'] = [
            { hpt: 18 },  // груповий заголовок
            { hpt: 80 }   // деталізований (висота для wrap)
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'InsuredLoss');
        XLSX.writeFile(wb, `oscpv_b2b_${todayIso}_${Date.now()}.xlsx`);
    }


    // =====================================================================
    //         СТОРОНА INCORE.UNIVERSALNA.COM — захоплення CSRF токена
    // =====================================================================
    // Логіка:
    //   1. Користувач відкриває https://incore.universalna.com/ReportingServicesReports/ReportsPage?ReportGID=...
    //   2. Наш скрипт автоматично знаходить __RequestVerificationToken у формі
    //   3. Зберігає його в GM_setValue (oscpvbb_incore_token) для подальшого використання
    //   4. Показує банер з підтвердженням що токен збережено
    function initIncoreSide() {
        const url = location.href;
        if (!url.includes(CONFIG.INCORE_REPORT_GID)) {
            console.log('[OSCPV B2B] incore: звичайний візит, скрипт пасивний');
            return;
        }

        console.log('[OSCPV B2B] ===== INCORE TOKEN CAPTURE =====');

        const captureToken = () => {
            const input = document.querySelector('input[name="__RequestVerificationToken"]');
            if (!input || !input.value) return false;

            const token = input.value;
            const saved = GM_getValue('oscpvbb_incore_token', '');
            if (saved === token) {
                console.log('[OSCPV B2B] incore token unchanged, length:', token.length);
                showIncoreBanner('✓ Токен вже збережено (без змін)', '#0d9488');
                return true;
            }
            GM_setValue('oscpvbb_incore_token', token);
            GM_setValue('oscpvbb_incore_token_at', Date.now());
            console.log('[OSCPV B2B] incore token saved, length:', token.length);
            showIncoreBanner('✓ Токен для пошуку OSCPV B2B збережено. Тепер можете запускати пошук з Odoo.', '#0d9488');
            return true;
        };

        if (document.readyState !== 'loading') {
            if (!captureToken()) waitForForm();
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                if (!captureToken()) waitForForm();
            });
        }

        function waitForForm() {
            const started = Date.now();
            const observer = new MutationObserver(() => {
                if (captureToken()) {
                    observer.disconnect();
                } else if (Date.now() - started > 10000) {
                    observer.disconnect();
                    showIncoreBanner('⚠ Не знайдено токен на сторінці', '#dc2626');
                }
            });
            if (document.body) {
                observer.observe(document.body, { childList: true, subtree: true });
            }
            const interval = setInterval(() => {
                if (captureToken() || Date.now() - started > 10000) clearInterval(interval);
            }, 500);
        }
    }

    function showIncoreBanner(text, color) {
        const tryShow = () => {
            if (!document.body) { setTimeout(tryShow, 100); return; }
            let bannerEl = document.getElementById('oscpv-incore-banner-b2b');
            if (!bannerEl) {
                bannerEl = document.createElement('div');
                bannerEl.id = 'oscpv-incore-banner-b2b';
                bannerEl.style.cssText = `
                    position: fixed; top: 0; left: 0; right: 0;
                    color: #fff; padding: 12px 20px; text-align: center;
                    font-family: 'Ubuntu', system-ui, sans-serif;
                    font-size: 13px; font-weight: 600; letter-spacing: 0.04em;
                    text-transform: uppercase;
                    z-index: 2147483647; box-shadow: 0 2px 10px rgba(7,44,44,0.2);
                `;
                document.body.appendChild(bannerEl);
            }
            bannerEl.style.background = color || '#072C2C';
            bannerEl.textContent = 'OSCPV B2B: ' + text;
        };
        tryShow();
    }


    // =====================================================================
    //                СТОРОНА DICT.UNIVERSALNA.COM (вся робота)
    // =====================================================================

    // Глобальне сховище актуального токена — оновлюється при кожному запиті сайту
    // (Sniffer вже встановлений зверху, до DOMContentLoaded)

    function initDictSide() {
        const hash = location.hash;
        const m = hash.match(/oscpvbb_session=(\w+)/);
        if (!m) return; // звичайний візит, нічого не робимо

        const sessionId = m[1];
        const reqRaw = GM_getValue('oscpvbb_request_' + sessionId);
        if (!reqRaw) {
            console.warn('[OSCPV] Сесію не знайдено:', sessionId);
            return;
        }

        const req = JSON.parse(reqRaw);
        console.log('[OSCPV] Запуск обробки в dict-вкладці', req);

        // Одразу повертаємо фокус на opener (Odoo) і пробуємо мінімізувати своє вікно
        try {
            if (window.opener && !window.opener.closed) {
                window.opener.focus();
            }
        } catch (e) { }
        try {
            window.moveTo(screen.width - 100, screen.height - 100);
            window.resizeTo(200, 100);
        } catch (e) { }

        // Показуємо банер що скрипт працює
        showDictBanner();

        // Чекаємо щоб сторінка зробила хоча б один запит і ми перехопили токен
        waitForLiveToken(20000).then(token => {
            if (!token) {
                // fallback на localStorage
                token = localStorage.getItem('token');
            }
            if (!token) {
                pushProgress(sessionId, { log: 'НЕ ЗНАЙДЕНО актуальний токен', logType: 'err' });
                pushResult(sessionId, { error: 'no_token' });
                return;
            }
            console.log('[OSCPV] Стартую batch з токеном довжиною', token.length);
            processBatch(sessionId, req);
        });
    }

    async function waitForLiveToken(maxMs) {
        const start = Date.now();
        while (Date.now() - start < maxMs) {
            if (LIVE_TOKEN) return LIVE_TOKEN;
            await sleep(300);
        }
        return null;
    }

    // Завжди повертає НАЙСВІЖІШИЙ токен
    function getCurrentToken() {
        return LIVE_TOKEN || localStorage.getItem('token');
    }

    let dictPendingProgress = [];
    let dictProgressTimer = null;
    function pushProgress(sessionId, payload) {
        payload._ts = Date.now() + Math.random();
        dictPendingProgress.push(payload);
        if (!dictProgressTimer) {
            dictProgressTimer = setTimeout(() => {
                const batch = dictPendingProgress;
                dictPendingProgress = [];
                dictProgressTimer = null;
                GM_setValue('oscpvbb_progress_' + sessionId, JSON.stringify({ batch }));
            }, 100);
        }
    }

    function pushResult(sessionId, payload) {
        GM_setValue('oscpvbb_result_' + sessionId, JSON.stringify(payload));
    }

    function showDictBanner() {
        const b = document.createElement('div');
        b.id = 'oscpv2-banner';
        b.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0;
            background: #072C2C; color: #fff;
            padding: 10px 20px; text-align: center;
            font-family: 'Ubuntu', system-ui, sans-serif; font-size: 13px; font-weight: 600;
            letter-spacing: 0.04em; text-transform: uppercase;
            z-index: 2147483647; box-shadow: 0 2px 6px rgba(7,44,44,0.3);
        `;
        b.innerHTML = 'OSCPV B2B — обробляємо ЄДРПОУ. Не закривайте вкладку. <span id="oscpv2-banner-status"></span>';
        document.body.appendChild(b);
    }

    function updateBanner(text) {
        const s = document.getElementById('oscpv2-banner-status');
        if (s) s.textContent = ' — ' + text;
    }

    async function processBatch(sessionId, req) {
        const { ipns, delayRun, delayIpn, concurrency = 3 } = req;
        const today = new Date().toISOString().slice(0, 10);

        let completedCount = 0;
        let runningCount = 0;
        let index = -1;

        return new Promise((resolve) => {
            function processNext() {
                if (index >= ipns.length - 1 && runningCount === 0) {
                    pushResult(sessionId, { done: true });
                    updateBanner('завершено ✓');
                    setTimeout(() => window.close(), 3000);
                    resolve();
                    return;
                }
                while (runningCount < concurrency && index < ipns.length - 1) {
                    index++;
                    runningCount++;
                    const i = index;
                    const ipn = ipns[i];
                    const prefix = `[${i + 1}/${ipns.length}] ${ipn}`;
                    updateBanner(`${completedCount}/${ipns.length}`);

                    (async () => {
                        try {
                            pushProgress(sessionId, { log: `${prefix}: INSERT в dict...`, logType: 'dim' });
                            const inserted = await dictInsert(ipn, today);
                            const newId = extractIdFromInsert(inserted);
                            pushProgress(sessionId, { log: `${prefix}: створено id=${newId || '?'}`, logType: 'dim' });

                            pushProgress(sessionId, { log: `${prefix}: RUN на incore...`, logType: 'dim' });
                            await importToolRun(ipn);

                            pushProgress(sessionId, { log: `${prefix}: чекаю ${delayRun}мс обробку...`, logType: 'info' });
                            await sleep(delayRun);

                            pushProgress(sessionId, { log: `${prefix}: парсинг таблиці...`, logType: 'dim' });
                            const responseJson = await parseTableForIpn(ipn, newId, sessionId);

                            completedCount++;
                            updateBanner(`${completedCount}/${ipns.length}`);

                            if (!responseJson) {
                                pushProgress(sessionId, { log: `${prefix}: ✗ не знайдено response в таблиці`, logType: 'err', progress: completedCount });
                            } else if (responseJson.oscpv === null || (Array.isArray(responseJson.oscpv) && responseJson.oscpv.length === 0)) {
                                // ОСЦПВ не знайдено для цього ЄДРПОУ
                                pushProgress(sessionId, {
                                    log: `${prefix}: ⚠ Авто відсутнє або страхування не на клієнті`,
                                    logType: 'err',
                                    progress: completedCount,
                                    newResults: [{
                                        ipn,
                                        policy_no: '—',
                                        full_name: 'Авто відсутнє або страхування не на клієнті',
                                        vehicle_brand: '',
                                        vehicle_title: '',
                                        plate_no: '',
                                        insurer_name: '',
                                        _notFound: true
                                    }]
                                });
                            } else {
                                const oscpvList = responseJson.oscpv.map(p => ({ ipn, ...p }));
                                pushProgress(sessionId, {
                                    log: `${prefix}: ✓ знайдено ${oscpvList.length} полісів`,
                                    logType: 'ok',
                                    progress: completedCount,
                                    newResults: oscpvList
                                });
                            }

                            if (delayIpn > 0) await sleep(delayIpn);
                        } catch (e) {
                            console.error(e);
                            completedCount++;
                            updateBanner(`${completedCount}/${ipns.length}`);
                            pushProgress(sessionId, {
                                log: `${prefix}: ПОМИЛКА ${e.message}`,
                                logType: 'err',
                                progress: completedCount
                            });
                        } finally {
                            runningCount--;
                            processNext();
                        }
                    })();
                }
            }
            processNext();
        });
    }

    function dictInsert(ipn, today) {
        const payload = {
            label_: ipn,
            ident_code: ipn,
            plate_no: null, vin: null,
            surname: null, given_name: null, middle_name: null,
            start_date: "2025-01-01",
            end_date: today,
            policy_type: "OSCPV",
            server_: "P",
            status: 0
        };
        const token = getCurrentToken();
        return fetch(CONFIG.INSERT_URL, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(payload)
        }).then(r => {
            if (!r.ok) throw new Error('INSERT HTTP ' + r.status);
            return r.json();
        });
    }

    function extractIdFromInsert(response) {
        if (!response) return null;
        if (typeof response === 'number') return response;
        if (response.id) return response.id;
        if (response.data && response.data.id) return response.data.id;
        if (Array.isArray(response) && response[0] && response[0].id) return response[0].id;
        return null;
    }

    /**
     * Запускає генерацію звіту через incore.universalna.com.
     * Це замінило старий `importToolRun` що ходив на import-tool.
     *
     * Логіка:
     *   1. Беремо __RequestVerificationToken з GM_setValue
     *      (захоплюється коли користувач відкриває incore-сторінку — initIncoreSide)
     *   2. Робимо POST на /ReportingServicesReports/ReportsPage?...&handler=GenerateReport
     *      з form-encoded payload: d1, d2, label, ident_code, SelectedExportType, __RequestVerificationToken
     *   3. Сервер створить/оновить запис у dict, який потім ми парсимо як зараз
     *
     * Якщо токен не збережено / застарів - кидаємо помилку з підказкою користувачу.
     */
    function importToolRun(ipn) {
        const token = GM_getValue('oscpvbb_incore_token', '');
        if (!token) {
            return Promise.reject(new Error(
                'Немає incore-токена. Відкрийте https://incore.universalna.com/ReportingServicesReports/ReportsPage?ReportGID=' +
                CONFIG.INCORE_REPORT_GID + ' щоб скрипт зловив __RequestVerificationToken, потім повторіть пошук.'
            ));
        }

        // Дата — сьогодні в форматі DD.MM.YYYY
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();
        const dateStr = `${dd}.${mm}.${yyyy}`;

        // application/x-www-form-urlencoded payload
        const params = new URLSearchParams();
        params.set('d1', dateStr);
        params.set('d2', dateStr);
        params.set('label', String(ipn));
        params.set('ident_code', '');
        params.set('SelectedExportType', 'EXCELOPENXML');
        params.set('__RequestVerificationToken', token);

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: CONFIG.INCORE_GENERATE_URL,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Accept': '*/*',
                    'Origin': 'https://incore.universalna.com',
                    'Referer': CONFIG.INCORE_FORM_URL,
                    'X-Requested-With': 'XMLHttpRequest'
                },
                data: params.toString(),
                onload: r => {
                    if (r.status >= 200 && r.status < 300) {
                        resolve(r.responseText);
                    } else if (r.status === 400 || r.status === 401 || r.status === 403) {
                        // токен застарів - чистимо щоб користувач заново відкрив incore
                        GM_deleteValue('oscpvbb_incore_token');
                        reject(new Error(
                            'incore HTTP ' + r.status + ' — токен застарів. ' +
                            'Відкрийте https://incore.universalna.com/ReportingServicesReports/ReportsPage?ReportGID=' +
                            CONFIG.INCORE_REPORT_GID + ' щоб оновити токен.'
                        ));
                    } else {
                        reject(new Error('incore HTTP ' + r.status));
                    }
                },
                onerror: () => reject(new Error('incore network error'))
            });
        });
    }

    // Рівень 1: прямий HTTP-запит (fetchTableRowsDirect); Рівень 2: iframe DOM як фолбек.
    async function parseTableForIpn(ipn, expectedId, sessionId) {
        const MAX_ATTEMPTS = 12;
        const ATTEMPT_DELAY = 3000;
        let directKnown = null; // null=не пробували, true=URL працює, false=URL недоступний

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            if (sessionId) pushProgress(sessionId, {
                log: `   спроба ${attempt}/${MAX_ATTEMPTS} (id=${expectedId})...`,
                logType: 'dim'
            });

            if (directKnown !== false) {
                try {
                    const allRows = await fetchTableRowsDirect();
                    if (allRows !== null) {
                        directKnown = true;
                        const row = expectedId ? allRows.find(r => r.id === expectedId) : null;
                        if (row?.resp) {
                            try {
                                const parsed = JSON.parse(row.resp);
                                if (sessionId) pushProgress(sessionId, { log: `   ✓ id=${expectedId} знайдено`, logType: 'ok' });
                                return parsed;
                            } catch (e) {
                                if (sessionId) pushProgress(sessionId, { log: `   ⚠ response не JSON`, logType: 'err' });
                                return null;
                            }
                        }
                        if (sessionId) pushProgress(sessionId, {
                            log: row ? `   id=${expectedId} є, resp порожній — чекаю...`
                                : `   id=${expectedId} ще не з'явився — чекаю...`,
                            logType: 'dim'
                        });
                        if (attempt < MAX_ATTEMPTS) await sleep(ATTEMPT_DELAY);
                        continue;
                    }
                    directKnown = false; // URL ще не закешовано — переходимо на iframe
                } catch (e) {
                    directKnown = false;
                }
            }

            // Iframe-фолбек (коли URL прямого запиту ще не закешований)
            const result = await tryParseOnce(ipn, expectedId);

            if (result.found && result.responseText) {
                try {
                    const parsed = JSON.parse(result.responseText);
                    if (sessionId) pushProgress(sessionId, { log: `   ✓ знайдено id=${result.foundId}`, logType: 'ok' });
                    return parsed;
                } catch (e) {
                    console.warn('[OSCPV] response не JSON:', result.responseText.slice(0, 300));
                    if (sessionId) pushProgress(sessionId, {
                        log: `   ⚠ response не JSON: ${result.responseText.slice(0, 80)}...`,
                        logType: 'err'
                    });
                    return null;
                }
            }

            if (result.found && !result.responseText) {
                if (sessionId) pushProgress(sessionId, { log: `   рядок id=${result.foundId} є, але response ще порожній — чекаю...`, logType: 'dim' });
            } else if (!result.found) {
                if (sessionId) pushProgress(sessionId, { log: `   рядок з id=${expectedId} ще не з'явився — чекаю...`, logType: 'dim' });
            }

            if (attempt < MAX_ATTEMPTS) await sleep(ATTEMPT_DELAY);
        }

        return null;
    }

    /**
     * Одна спроба парсингу через свіжий iframe:
     * чекаємо рендеру таблиці, клікаємо ASC-сортування по колонці id
     * (найсвіжіший зверху), знаходимо рядок з потрібним id.
     */
    async function tryParseOnce(ipn, expectedId) {
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1800px;height:1000px;border:0;';
        iframe.src = CONFIG.TABLE_URL + '?_=' + Date.now();
        document.body.appendChild(iframe);

        try {
            let rows = await waitForRows(iframe, CONFIG.ROW_WAIT_TIMEOUT);
            if (!rows.length) return { found: false };

            const doc = iframe.contentDocument || iframe.contentWindow.document;
            const sorted = await clickSortAsc(doc);

            if (sorted) {
                await sleep(1500);
            }

            rows = Array.from(doc.querySelectorAll('tr.el-table__row'));
            if (!rows.length) return { found: false };

            if (expectedId) {
                for (const row of rows) {
                    const cells = row.querySelectorAll('td');
                    if (cells.length < 19) continue;
                    const cellId = parseInt((cells[COL.ID].textContent || '').trim());
                    if (cellId === expectedId) {
                        const respCell = cells[COL.RESPONSE];
                        const respSpan = respCell && respCell.querySelector('span');
                        const respText = ((respSpan ? respSpan.textContent : respCell?.textContent) || '').trim();
                        return { found: true, foundId: expectedId, responseText: respText };
                    }
                }
                return { found: false };
            }

            // Фолбек без expectedId — беремо рядок з потрібним ident_code/label (найсвіжіший зверху)
            for (const row of rows) {
                const cells = row.querySelectorAll('td');
                if (cells.length < 19) continue;
                const idText = (cells[COL.ID].textContent || '').trim();
                const identText = (cells[COL.IDENT_CODE].textContent || '').trim();
                const labelText = cells[COL.LABEL] ? (cells[COL.LABEL].textContent || '').trim() : '';
                if (identText === String(ipn) || labelText === String(ipn)) {
                    const respCell = cells[COL.RESPONSE];
                    const respSpan = respCell && respCell.querySelector('span');
                    const respText = ((respSpan ? respSpan.textContent : respCell?.textContent) || '').trim();
                    return {
                        found: true,
                        foundId: parseInt(idText) || 0,
                        responseText: respText
                    };
                }
            }
            return { found: false };
        } finally {
            iframe.remove();
        }
    }

    /**
     * Знаходить у заголовку таблиці колонку id та клікає на стрілку sort-caret.ascending.
     * Повертає true якщо клік виконано.
     */
    async function clickSortAsc(doc) {
        try {
            // Колонка id — перший th (el-table_1_column_1)
            const idHeader = doc.querySelector('th.el-table_1_column_1');
            if (!idHeader) {
                console.warn('[OSCPV] th колонки id не знайдено');
                return false;
            }
            const ascCaret = idHeader.querySelector('i.sort-caret.ascending');
            if (!ascCaret) {
                console.warn('[OSCPV] sort-caret.ascending не знайдено');
                return false;
            }

            // Якщо стрілка вже активна — не клікаємо
            if (ascCaret.classList.contains('active')) {
                console.log('[OSCPV] ASC сортування вже активне');
                return true;
            }

            // Клікаємо. Element UI слухає клік на батьківському <span class="head-sort">,
            // тому імітуємо нативний клік через MouseEvent.
            const clickTarget = ascCaret.closest('.head-sort') || ascCaret;
            // деякі версії Element UI реагують на клік саме по caret, тому клікаємо обидва
            ['mousedown', 'mouseup', 'click'].forEach(type => {
                ascCaret.dispatchEvent(new MouseEvent(type, {
                    bubbles: true, cancelable: true, view: doc.defaultView
                }));
            });
            console.log('[OSCPV] Клік на сортування ASC виконано');
            return true;
        } catch (e) {
            console.warn('[OSCPV] Помилка кліку на сортування:', e);
            return false;
        }
    }

    function waitForRows(iframe, timeoutMs) {
        return new Promise(resolve => {
            const start = Date.now();
            const check = () => {
                let rows = [];
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow.document;
                    rows = Array.from(doc.querySelectorAll('tr.el-table__row'));
                } catch (e) { /* ще не готовий */ }

                if (rows.length > 0) {
                    // дочекаємось ще трохи щоб response повністю прорендерився
                    setTimeout(() => {
                        try {
                            const doc = iframe.contentDocument || iframe.contentWindow.document;
                            resolve(Array.from(doc.querySelectorAll('tr.el-table__row')));
                        } catch (e) { resolve([]); }
                    }, 800);
                    return;
                }
                if (Date.now() - start > timeoutMs) { resolve([]); return; }
                setTimeout(check, CONFIG.ROW_WAIT_INTERVAL);
            };
            check();
        });
    }

})();
