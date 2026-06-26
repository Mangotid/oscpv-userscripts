# OpenDataUA — Design System

Цей документ є єдиним джерелом правди щодо стилю інтерфейсу.
Будь-яка нова сторінка або компонент мусить суворо дотримуватись цих правил.

---

## 0. Design Brief (вихідний промт стилю)

> **Category:** Professional & Corporate
> Clean, high-contrast enterprise design for data-driven workflows with intuitive drag-and-drop patterns and structured layouts.

### 1. Visual Theme & Atmosphere

Clean, high-contrast enterprise design for data-driven workflows with intuitive drag-and-drop patterns and structured layouts.

- Visual style: clean, high-contrast, enterprise
- Color stance: primary, success, warning, danger
- Design intent: Keep outputs recognizable to this style family while preserving usability and readability.

### 2. Color

| Role | Token | Value |
|---|---|---|
| Primary | `--color-primary` | `#072C2C` |
| Secondary | `--color-secondary` | `#FF5F03` |
| Success | `--color-success` | `#16A34A` |
| Warning | `--color-warning` | `#D97706` |
| Danger | `--color-danger` | `#DC2626` |
| Surface | `--color-surface` | `#EDEADE` |
| Text | `--color-text` | `#111827` |
| Neutral | — | `#EDEADE` (похідний від surface) |

- Favor **Primary** (`#072C2C`) for CTA emphasis.
- Use **Surface** (`#EDEADE`) for large backgrounds and cards.
- Keep body copy on **Text** (`#111827`) for legibility.

### 3. Typography

- Scale: desktop-first expressive scale
- Families: primary = Ubuntu, display = Oswald, mono = Ubuntu Mono
- Weights: 300, 400, 500, 600, 700
- Headings carry the style personality; body text optimizes scanability and contrast.

### 4. Spacing & Grid

- Spacing scale: comfortable density mode
- Keep vertical rhythm consistent across sections and components.
- Align columns and modules to a predictable grid; avoid ad-hoc offsets.

### 5. Layout & Composition

- Prefer clear content blocks with consistent internal padding.
- Keep hierarchy obvious: headline → support text → primary action.
- Use whitespace to separate concerns before adding borders or shadows.

### 6. Components

- **Buttons:** primary action uses `#072C2C`; secondary actions stay neutral.
- **Inputs:** strong `focus-visible` states, clear labels, predictable error messaging.
- **Cards/sections:** consistent radii, spacing, and elevation strategy across the page.

### 7. Motion & Interaction

- Subtle transitions that emphasize Primary (`#072C2C`) as the interaction signal.
- Default: short, purposeful transitions **150–250ms** with stable easing (`cubic-bezier(0.4, 0, 0.2, 1)`).
- States that must be explicit: `hover`, `focus-visible`, `active`, `disabled`, `loading`.

### 8. Voice & Brand

- Tone: concise, confident, product-specific.
- Microcopy: action-oriented, no generic filler language.
- Headlines carry the style identity; UI labels stay literal and clear.

### 9. Anti-patterns

- Do not introduce off-palette colors when an existing token can solve the problem.
- Do not flatten hierarchy by using the same type size/weight for all text.
- Do not add decorative effects that reduce readability or accessibility.
- Do not mix unrelated visual metaphors in the same interface.
- Do not use emoji — only inline SVG icons (stroke-based, `currentColor`).

---

## 1. Принципи

| Принцип | Що означає на практиці |
|---|---|
| **Enterprise, не consumer** | Щільний, темно-зелений, без пастельних кольорів |
| **Ніяких emoji** | Іконки — виключно inline SVG (stroke-based, без fill) |
| **Uppercase як акцент** | Заголовки, ярлики, кнопки, мітки — всі UPPERCASE |
| **Monospace для даних** | VIN, номери, коди — Ubuntu Mono |
| **Токени, не хардкод** | Кольори, відступи, радіуси — тільки CSS-змінні |

---

## 2. Колірна палітра

### Основні кольори

| Токен | Hex | Призначення |
|---|---|---|
| `--color-primary` | `#072C2C` | Фон хедера, кнопки за замовчуванням, заголовки, акцент |
| `--color-primary-hover` | `#0A3D3D` | Hover-стан для primary елементів |
| `--color-primary-active` | `#051F1F` | Active/pressed стан |
| `--color-secondary` | `#FF5F03` | Акцент: логотип, border-bottom хедера, hover посилань, progress bar |
| `--color-secondary-hover` | `#E55303` | Hover secondary |

### Семантичні кольори

| Токен | Hex | Використання |
|---|---|---|
| `--color-success` | `#16A34A` | Текст успіху |
| `--color-success-bg` | `#DCFCE7` | Фон бейджу активного/знайденого |
| `--color-warning` | `#D97706` | Текст попередження |
| `--color-warning-bg` | `#FEF3C7` | Фон бейджу попередження |
| `--color-danger` | `#DC2626` | Текст помилки |
| `--color-danger-bg` | `#FEE2E2` | Фон бейджу помилки/відсутнього |

### Поверхні та текст

| Токен | Hex | Призначення |
|---|---|---|
| `--color-surface` | `#EDEADE` | Фон сторінки (cream) |
| `--color-surface-2` | `#F5F3EB` | Піднятий фон (всередині карток, textarea) |
| `--color-surface-3` | `#FFFFFF` | Картки, elevated елементи |
| `--color-text` | `#111827` | Основний текст |
| `--color-text-muted` | `#4B5563` | Вторинний текст, підписи |
| `--color-text-subtle` | `#6B7280` | Ще слабший текст, плейсхолдери |
| `--color-border` | `#D6D2C4` | Звичайна межа |
| `--color-border-strong` | `#9B9785` | Акцентована межа (інпути) |

### Розширені токени (у `:root`, не в базовій палітрі)

| Токен | Значення | Де використовується |
|---|---|---|
| `--color-success-text` | `#0F6B33` | Текст бейджів успіху, `.has-file`, `bulk-stat--success` |
| `--color-excel-green` | `#1D6F42` | `.search-btn--green`, `.btn--excel`, іконки форматування |
| `--color-excel-green-hover` | `#155a34` | Hover для excel-green |
| `--color-excel-green-bg` | `#E8F5E9` | Фон `.excel-info-card__icon` (форматування) |
| `--color-dedup-blue` | `#1565C0` | `.search-btn--blue`, іконки дедублікації |
| `--color-dedup-blue-hover` | `#0d47a1` | Hover для dedup-blue |
| `--color-dedup-blue-bg` | `#E3F2FD` | Фон `.excel-info-card__icon--blue` (дедублікація) |

SVG-атрибути (`fill`, `stroke`) не підтримують CSS-змінні, тому в inline SVG використовуються літеральні значення що відповідають токенам.

---

## 3. Типографіка

### Шрифти

```
--font-body:    'Ubuntu', system-ui, sans-serif       → основний текст
--font-display: 'Oswald', 'Ubuntu', sans-serif        → заголовки, кнопки, мітки
--font-mono:    'Ubuntu Mono', ui-monospace, monospace → коди, VIN, номери
```

Шрифти завантажуються з Google Fonts (Ubuntu 300/400/500/700, Oswald 400/500/600/700, Ubuntu Mono 400/700).

### Правила використання

| Ситуація | Шрифт | Вага | Трансформація |
|---|---|---|---|
| H1–H4 заголовки сторінок | Oswald | 600 | UPPERCASE |
| Назви карток (`.service-card__title`) | Oswald | 600 | UPPERCASE |
| Мітки полів (`.result-field__label`) | Ubuntu | 500 | UPPERCASE, `letter-spacing: 0.08em` |
| Кнопки | Ubuntu | 500 | UPPERCASE, `letter-spacing: 0.04em` |
| Таблиці — th | Oswald | 500 | UPPERCASE, `letter-spacing: 0.08em` |
| Основний текст | Ubuntu | 400 | normal |
| Підрядки, описи | Ubuntu | 400 | normal, `color: text-muted` |
| Коди, VIN, номери | Ubuntu Mono | 400 | normal |
| `.bulk-stat__num` (велика цифра) | Oswald | 700 | — |

### Масштаб розмірів (приклади)

```
0.72rem  → мікромітки, бейджі, підказки
0.78rem  → дрібні підписи (.merge-file-row__name)
0.82rem  → більшість підрядних текстів, прогрес, підказки
0.85rem  → кнопки, посилання навігації
0.88rem  → картки опис (.merge-file-row__label strong)
0.92rem  → bulk-desc, drop-text
0.95rem  → .result-field__value, .service-card__desc
1rem     → hero subtitle
1.1rem   → .bulk-title, .results__title, вкладка-заголовок
1.25rem  → logo, .results__title display
1.5rem   → .bulk-stat__num
clamp(1.75, 3.4vw, 2.5rem) → .check-hero__title
clamp(2, 4.8vw, 3.25rem)   → .hero__title
```

---

## 4. Відступи

```
--space-1:  4px
--space-2:  8px
--space-3:  12px
--space-4:  16px
--space-5:  20px
--space-6:  24px
--space-7:  32px
--space-8:  40px
--space-9:  56px
--space-10: 72px
```

**Ніколи не використовувати числа в `px` напряму** — тільки через `var(--space-N)`.

---

## 5. Радіуси і тіні

```
--radius-sm:  4px   → мікроелементи: бейджі, inline-code
--radius:     6px   → кнопки, інпути, таблиці
--radius-md:  10px  → картки (.search-box, .service-card)
--radius-lg:  14px  → Hero block на головній

--shadow-sm:  0 1px 2px rgba(7, 44, 44, 0.06)    → пасивні картки
--shadow:     0 4px 14px rgba(7, 44, 44, 0.08)   → hover картки
--shadow-md:  0 10px 30px rgba(7, 44, 44, 0.12)  → service-card hover
```

---

## 6. Анімація

```
--duration: 180ms
--ease:     cubic-bezier(0.4, 0, 0.2, 1)
```

- Hover-переходи: `transition: ... var(--duration) var(--ease)`
- Active/press: `transform: scale(0.98)` + `80ms`
- Progress bar fill: `transition: width 0.3s ease` + `animation: progress-pulse 1.5s infinite`
- Skeleton shimmer: `animation: shimmer 1.4s linear infinite`

---

## 7. Іконки

### Правила

- **Виключно inline SVG.** Emoji, іконочні шрифти, PNG-іконки — заборонені.
- **Стиль: stroke-based.** `fill="none"`, `stroke="currentColor"`, `stroke-linecap="round"`, `stroke-linejoin="round"`.
- Товщина лінії: `stroke-width="2"` (стандарт), `stroke-width="2.5"` (великі).
- Колір завжди через `currentColor` — іконка успадковує колір батька.
- Відступ від тексту: `gap: var(--space-2)` в flex-контейнері.

### Розміри по контексту

| Контекст | Розмір |
|---|---|
| В тексті кнопки | `16x16` або `18x18` |
| В заголовку hero | `32x32` |
| В info-item (головна) | `28x28` |
| В service-card | `64x64` |
| В empty-state | `64x64` |
| В excel-info-card | `22x22` |
| В merge-file-row кнопці | `16x16` |
| В логотипі | `36x36` (rect + path, кастомний) |

### SVG-атрибути шаблон

```html
<svg viewBox="0 0 20 20" fill="none" width="16" height="16">
  <path d="..." stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

### Використовувані патерни іконок (приклади з кодобази)

| Призначення | Патерн path |
|---|---|
| Завантаження файлу | `M10 3v10M5 8l5-5 5 5` + `M3 15h14` |
| Таблиця/документ | rect + горизонтальні лінії |
| Стрілка назад | `M16 10H4M10 4L4 10l6 6` |
| Стрілка вправо | `M4 10h12M10 4l6 6-6 6` |
| Галочка | `M9 12l2 2 4-4` (всередині кола) |
| Злиття/merge | `M4 5h5M4 10h12M4 15h5M13 3l4 4-4 4` |
| Сортування | `M7 16V4m0 0L3 8m4-4l4 4M17 8v12...` |

---

## 8. Структура сторінки

### Shell

```
.page                → flex column, min-height: 100vh
  .header            → sticky top, primary bg, 3px secondary border-bottom, h=68px
    .header__inner   → max-width 1200px, flex space-between
  <main>             → flex: 1
  .footer            → primary bg, 3px secondary border-top
    .footer__inner   → max-width 1200px, flex center, gap space-5
```

### Головна сторінка

```
.hero                → primary bg, border-radius lg, max-width 1200px
  .hero__bg          → radial-gradient декорація (secondary 22% + white 5%)
  .hero__content
    .hero__badge     → маленький тег (secondary border + bg 12%)
    .hero__title
    .hero__subtitle
.services            → max-width 1200px, padding space-8 space-6
  .services__grid    → 2-колонки grid, gap space-5
.info-strip          → 3-колонки grid, border top/bottom
```

### Check-сторінки (Car-Check, LLC-Check, Excel-Format)

```
.check-page (main)
  .check-hero        → primary bg + radial-gradient overlay, 3px secondary border-bottom
    .check-hero__inner → max-width 1200px
      .back-link
      .check-hero__title  → svg 32x32 + текст, UPPERCASE
      .check-hero__subtitle
  .check-body        → max-width 1000px, padding space-8/space-9
    .mode-tabs       → перемикач режимів (якщо є)
    .search-box      → white card, border-radius md, shadow-sm
    …результати…
```

---

## 9. Компоненти

### Хедер / Логотип / Навігація

```html
<header class="header">
  <div class="header__inner">
    <a href="/" class="logo">
      <svg class="logo__icon" …> <!-- кастомний логотип --> </svg>
      <span class="logo__text">OpenData<strong>UA</strong></span>
    </a>
    <nav class="nav">
      <a href="/car-check/" class="nav__link">Car-Check</a>
      <a href="…" class="nav__link nav__link--active">Активний</a>
    </nav>
  </div>
</header>
```

Активний пункт: `nav__link--active` → `box-shadow: inset 0 -2px 0 var(--color-secondary)`.

---

### Кнопки

#### `.btn` (загальна кнопка)

```html
<a class="btn btn--primary">Перейти</a>
<button class="btn btn--ghost">Скасувати</button>
```

| Модифікатор | Колір | Застосування |
|---|---|---|
| `btn--primary` | primary bg | Основна дія |
| `btn--secondary` | secondary bg | Виділений заклик |
| `btn--success` | `#16A34A` | Підтвердження |
| `btn--excel` | `#1D6F42` | Excel-пов'язані дії |
| `btn--ghost` | прозорий + primary border | Вторинна дія |

#### `.search-btn` (кнопка пошуку / дії у формі)

```html
<button class="search-btn search-btn--green" id="xlsxSubmitBtn" disabled>
  <svg …>…</svg>
  Форматувати та завантажити
</button>
```

| Модифікатор | Колір | Застосування |
|---|---|---|
| (без модифікатора) | primary | Пошук, основна дія в search-box |
| `search-btn--green` | `#1D6F42` | Форматування Excel |
| `search-btn--blue` | `#1565C0` | Дедублікація |

Кнопка завжди має іконку зліва, текст UPPERCASE.
Disabled стан: `opacity: 0.55`, `cursor: not-allowed`.

---

### Вкладки

#### `.mode-tabs` (основний перемикач режимів)

```html
<div class="mode-tabs">
  <button class="mode-tab mode-tab--active" data-mode="format">
    <svg …>…</svg>
    Форматування
  </button>
  <button class="mode-tab" data-mode="merge">…</button>
</div>
```

- Підкреслення активної: `border-bottom: 2px solid var(--color-secondary)`
- Контейнер: `border-bottom: 2px solid var(--color-border)`, `padding-bottom: 0`
- Активна вкладка: `font-weight: 600`

#### `.search-tabs` (мікро-перемикач всередині search-box)

```html
<div class="search-tabs">
  <button class="search-tab search-tab--active">Номер</button>
  <button class="search-tab">VIN</button>
</div>
```

---

### Картки

#### `.search-box` — основний контейнер форми/панелі

```
background: white
border: 1px solid --color-border
border-radius: --radius-md
padding: --space-7
box-shadow: --shadow-sm
margin-bottom: --space-7
```

#### `.result-card` — картка результату пошуку

```
border-left: 3px solid --color-secondary  ← помаранчева смужка
border-radius: --radius
padding: space-5 space-6
```

#### `.service-card` — картка сервісу на головній

```
border-radius: --radius-md
hover: translateY(-2px) + --shadow-md
```

#### `.excel-info-card` — інформаційна картка в Excel-Format

```html
<div class="excel-info-card">
  <div class="excel-info-card__icon"> <!-- 40x40, bg #E8F5E9, color #1D6F42 -->
    <svg …>…</svg>
  </div>
  <div>
    <strong>Заголовок</strong>
    <p>Опис</p>
  </div>
</div>
```

Сітка карток: `.excel-info-grid` → `grid-template-columns: 1fr 1fr`.

---

### Бейджі

```html
<span class="badge badge--active">Активний</span>
<span class="badge badge--inactive">Не активний</span>
<span class="badge badge--warning">Очікування</span>
<span class="badge badge--unknown">Невідомо</span>
```

| Модифікатор | Фон | Текст |
|---|---|---|
| `badge--active` | `#DCFCE7` | `#0F6B33` |
| `badge--inactive` | `#FEE2E2` | `#DC2626` |
| `badge--warning` | `#FEF3C7` | `#D97706` |
| `badge--unknown` | surface | text-muted |
| `badge--green` | `#DCFCE7` | `#0F6B33`, + `margin-left: space-2`, `vertical-align: middle` |

---

### Поля форми

```html
<div class="search-input-wrap">
  <span class="plate-prefix">UA</span>   <!-- якщо потрібен префікс -->
  <input class="search-input" type="text" placeholder="АА1234АА" />
  <button class="search-btn">…</button>
</div>
```

- Висота інпуту: `48px`
- Focus ring: `box-shadow: 0 0 0 3px rgba(7, 44, 44, 0.15)`
- Invalid: `border-color: --color-danger` + `box-shadow: rgba(220, 38, 38, 0.12)`
- `.search-input--no-prefix` — знімає `text-transform: uppercase`

#### Textarea

```html
<textarea class="bulk-textarea" placeholder="…"></textarea>
```

- `font-family: --font-mono`
- `min-height: 180px`, `resize: vertical`

---

### Drag-and-drop зона

```html
<div class="bulk-drop-zone" id="myDropZone">
  <svg …>…</svg>  <!-- 48x48, кольоровий (green або blue) -->
  <p class="bulk-drop-text">Перетягніть .xlsx-файл сюди<br/>або
    <label class="bulk-browse" for="myInput">оберіть файл</label>
  </p>
  <p class="bulk-drop-hint" id="myFileName">Підтримується: .xlsx, до 50 МБ</p>
  <input type="file" id="myInput" accept=".xlsx" hidden />
</div>
```

- Border: `2px dashed --color-border-strong`
- Drag-over / has-file: `border-color: --color-secondary`
- `.bulk-browse`: `color: --color-secondary`, `text-decoration: underline`

---

### Progress bar

```html
<div class="bulk-progress" hidden>
  <div class="bulk-progress__bar">
    <div class="bulk-progress__fill" id="fill"></div>
  </div>
  <p class="bulk-progress__text">Обробка...</p>
</div>
```

- Fill color: `--color-secondary`
- Висота: `6px`, `border-radius: 99px`
- Анімація: `progress-pulse` (opacity 1→0.7→1, 1.5s)

---

### Статистика результату (bulk-stat)

```html
<div class="bulk-result__stats">
  <div class="bulk-stat">
    <span class="bulk-stat__num">1234</span>
    <span class="bulk-stat__label">Основних рядків</span>
  </div>
  <div class="bulk-stat">
    <span class="bulk-stat__num bulk-stat__num--success">56</span>
    <span class="bulk-stat__label">Знайдено</span>
  </div>
  <div class="bulk-stat">
    <span class="bulk-stat__num bulk-stat__num--danger">7</span>
    <span class="bulk-stat__label">Помилок</span>
  </div>
  <div class="bulk-stat bulk-stat--info">
    <span class="bulk-stat__num bulk-stat__num--mono">vin</span>
    <span class="bulk-stat__label">Join колонка</span>
  </div>
</div>
```

| Модифікатор `__num` | Колір |
|---|---|
| (без) | `--color-primary` |
| `--success` | `#0F6B33` |
| `--danger` | `--color-danger` |
| `--mono` | `--font-mono`, 0.9rem |

`bulk-stat--info` → `border-style: dashed`.

---

### Рядки файлів (merge-file-row)

```html
<div class="merge-files">
  <div class="merge-file-row">
    <div class="merge-file-row__label">
      <span class="merge-file-row__num">1</span>
      <div>
        <strong>Назва файлу</strong>
        <span>Опис з <code>полем</code></span>
      </div>
    </div>
    <label class="merge-file-row__btn" for="inputId">
      <svg …>…</svg>
      Обрати .xlsx
    </label>
    <input type="file" id="inputId" accept=".xlsx" hidden />
    <span class="merge-file-row__name" id="nameEl">файл не обрано</span>
  </div>
</div>
```

- `.merge-file-row__num`: круглий бейдж 28x28, primary bg.
- `.merge-file-row__name.has-file`: `color: #0F6B33`, `font-style: normal`, `font-weight: 500`.

---

### Порожній стан / помилка

```html
<div class="empty-state">
  <svg width="64" height="64" …>…</svg>  <!-- opacity: 0.85 -->
  <span>Нічого не знайдено</span>
</div>

<div class="error-banner">
  <svg …>…</svg>
  Текст помилки
</div>
```

`error-banner`: `border-left: 3px solid --color-danger`, `background: --color-danger-bg`.

---

### Скелетон завантаження

```html
<div class="skeleton" style="width: 60%; height: 14px;"></div>
```

Градієнт-shimmer: `background: linear-gradient(90deg, surface-2 25%, border 50%, surface-2 75%)`.

---

### Таблиця результатів (bulk)

```html
<div class="multi-table-wrap">
  <table class="multi-table">
    <thead>
      <tr><th>…</th></tr>  <!-- primary bg, surface text -->
    </thead>
    <tbody>
      <tr><td class="multi-table__mono">…</td></tr>
      <tr class="multi-table__row--missing"><td>Не знайдено</td></tr>
    </tbody>
  </table>
</div>
```

`multi-table-wrap`: `border-left: 3px solid --color-secondary`.

---

## 10. Варіанти кольору hero/check-hero фону

Всі hero-смуги використовують radial-gradient overlay:

```css
background:
  radial-gradient(circle at 92% 22%, rgba(255, 95, 3, 0.20), transparent 50%),
  radial-gradient(circle at 8% 90%, rgba(255, 255, 255, 0.04), transparent 55%);
```

Варіація у `.check-hero--excel` може мати зміщені координати, але той самий принцип.

---

## 11. Адаптивність

| Breakpoint | Зміни |
|---|---|
| `≤ 800px` | `.services__grid` → 1 колонка; `.info-strip__inner` → 1 колонка |
| `≤ 700px` | `.check-body` менший padding; `.result-card__grid` → 1 колонка; `.search-btn` → `width: 100%` |
| `≤ 560px` | Nav: менші відступи, менший шрифт; `padding: 0 space-4` |

---

## 12. Заборонено

- **Emoji** в UI: ні `📄`, ні `✅`, ні `❌` — тільки SVG-іконки.
- **Хардкод кольорів** замість токенів (окрім Excel-green, Blue і #0F6B33 де токена немає).
- **Padding/margin числами** без `var(--space-N)`.
- **Fill-іконки** (filled/solid style) — тільки stroke.
- **Системні шрифти** без fallback-ланцюжка — завжди через `var(--font-*)`.
- **Шрифт без transform** для ярликів/міток — label завжди UPPERCASE.
- **Кольоровий текст success/danger** без відповідного семантичного класу.
- **`border-radius` числами** — тільки через `var(--radius-*)`.
