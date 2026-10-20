const SITE_TEXTS = Object.freeze({
  openAction: 'ABRIR',
  noResults: 'Nenhum resultado encontrado.',
  loading: 'Carregando',
  errorTitle: 'OCORREU UM ERRO',
  errorDescription: 'Algo aconteceu, perdão, isso será arrumado em breve.',
  backToCatalog: 'VOLTAR AO CATÁLOGO',
  contentTitle: 'Conteúdo',
  imagesTitle: 'Imagens',
  guideLabel: 'GUIA DE USO',
  informationLabel: 'INFORMAÇÃO',
  warningLabel: 'Aviso sobre o conteúdo',
  removedLabel: 'CONTEÚDO REMOVIDO',
  linkLabel: 'ABRIR LINK',
});

const state = {
  items: [],
  query: '',
  categories: new Set(),
  platforms: new Set(),
  view: 'grid',
  filtersOpen: false
};

const app = document.querySelector('#app');

const detailTimers = new Set();
const APPEARANCE_KEY = 'essentials-appearance';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let themeWarningTimer;
let themeWarningHideTimer;
let themeWarningFrame;
const appearance = {
  theme: 'dark',
  animations: !reducedMotion.matches,
  glass: true
};

function loadAppearance() {
  try {
    const saved = JSON.parse(localStorage.getItem(APPEARANCE_KEY) || '{}');
    if (saved.theme === 'dark' || saved.theme === 'light') appearance.theme = saved.theme;
    if (typeof saved.animations === 'boolean') appearance.animations = saved.animations;
    if (typeof saved.glass === 'boolean') appearance.glass = saved.glass;
    if ('background' in saved) {
      delete saved.background;
      saveAppearance();
    }
  } catch (error) {
    console.warn('[Essentials] Preferências de aparência indisponíveis:', error);
  }
}

function saveAppearance() {
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify({
      theme: appearance.theme,
      animations: appearance.animations,
      glass: appearance.glass
    }));
  } catch (error) {
    console.warn('[Essentials] Não foi possível salvar as preferências de aparência:', error);
  }
}

function applyAppearance() {
  document.documentElement.dataset.theme = appearance.theme;
  document.documentElement.classList.toggle('theme-light', appearance.theme === 'light');
  document.documentElement.classList.toggle('motion-off', !appearance.animations || reducedMotion.matches);
  document.documentElement.classList.toggle('glass-off', !appearance.glass);
  document.querySelector('meta[name="theme-color"]').content = appearance.theme === 'light' ? '#f4f2ec' : '#000000';
  document.querySelector('#theme-icon').setAttribute('icon', appearance.theme === 'light' ? 'solar:sun-2-linear' : 'solar:moon-stars-linear');
  document.querySelector('#theme-toggle').setAttribute('aria-label', `Mudar para tema ${appearance.theme === 'light' ? 'escuro' : 'claro'}`);
  document.querySelector('#animations-choice').checked = appearance.animations;
  document.querySelector('#glass-choice').checked = appearance.glass;
  if (!appearance.glass) document.querySelectorAll('.cursor-glow.pointer-lit').forEach(element => element.classList.remove('pointer-lit'));
  if (!appearance.animations || reducedMotion.matches) {
    detailTimers.forEach(timer => {
      clearTimeout(timer);
      clearInterval(timer);
    });
    detailTimers.clear();
    document.querySelectorAll('[data-marquee]').forEach(track => {
      track.style.animation = 'none';
    });
  }

}

function hideThemeWarning() {
  const warning = document.querySelector('#light-theme-warning');
  clearTimeout(themeWarningTimer);
  clearTimeout(themeWarningHideTimer);
  cancelAnimationFrame(themeWarningFrame);
  themeWarningFrame = undefined;
  warning.classList.remove('is-visible');
  themeWarningHideTimer = setTimeout(() => {
    warning.hidden = true;
  }, appearance.animations && !reducedMotion.matches ? 220 : 0);
}

function showThemeWarning() {
  const warning = document.querySelector('#light-theme-warning');
  clearTimeout(themeWarningTimer);
  clearTimeout(themeWarningHideTimer);
  cancelAnimationFrame(themeWarningFrame);
  warning.hidden = false;
  if (appearance.animations && !reducedMotion.matches) {
    themeWarningFrame = requestAnimationFrame(() => {
      warning.classList.add('is-visible');
      themeWarningFrame = undefined;
    });
  } else {
    warning.classList.add('is-visible');
  }
  const fadeDuration = appearance.animations && !reducedMotion.matches ? 220 : 0;
  themeWarningTimer = setTimeout(hideThemeWarning, 10000 - fadeDuration);
}

const icons = {
  heart: 'solar:heart-linear',
  search: 'solar:magnifer-linear',
  back: 'solar:arrow-left-linear',
  open: 'solar:arrow-up-right-linear',
  download: 'solar:download-minimalistic-linear',
  gallery: 'solar:gallery-linear',
  tag: 'solar:tag-linear',
  content: 'solar:document-text-linear',
  info: 'solar:info-circle-linear',
  warning: 'solar:danger-triangle-linear',
  guide: 'solar:book-2-linear',
  computer: 'mdi:desktop-classic',
  phone: 'mdi:cellphone-android',
  tv: 'mdi:television',
  linux: 'mdi:linux',
  web: 'mdi:web',
  tablet: 'mdi:tablet-android',
  devices: 'mdi:devices',
  loading: 'svg-spinners:90-ring-with-bg'
};

function icon(name) {
  return '<iconify-icon class="icon" icon="' + (icons[name] || icons.tag) + '" aria-hidden="true"></iconify-icon>';
}

function editDistance(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      previous = current;
    }
  }

  return row[b.length];
}

function fuzzyScore(search, item) {
  const query = normalize(search);
  if (!query) return 0;

  const title = normalize(item.Title);
  const aliases = (item.aliases || []).map(normalize);
  const category = normalize(item.Category);
  const description = normalize(item.Description);
  const fields = [title, ...aliases, category, description].filter(Boolean);
  let best = 0;

  for (const text of fields) {
    if (text === query) best = Math.max(best, 1);
    if (text.includes(query)) {
      best = Math.max(best, 0.92 - Math.min(0.2, (text.length - query.length) / 500));
    }

    for (const word of text.split(/\s+/)) {
      const distance = editDistance(query, word);
      const score = 1 - distance / Math.max(query.length, word.length, 1);
      best = Math.max(best, score * (text === title ? 0.98 : 0.86));
    }
  }

  const parts = query.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    const matched = parts.filter(part => fields.some(field => (
      field.includes(part) ||
      field.split(/\s+/).some(word => 1 - editDistance(part, word) / Math.max(part.length, word.length, 1) > 0.62)
    ))).length;
    best = Math.max(best, matched / parts.length * 0.85);
  }

  return best;
}

function loadCatalog() {
  if (!Array.isArray(window.ESSENTIALS_ITEMS)) throw new Error('items');
  state.items = window.ESSENTIALS_ITEMS;
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function logoMarkup(source) {
  const value = String(source ?? '').trim();
  if (!value) return '';

  if (/^https?:\/\//i.test(value)) {
    return `<img class="card-logo" src="${escapeHTML(value)}" alt="" loading="lazy" decoding="async">`;
  }

  const svg = value.startsWith('<svg')
    ? value.replace(/currentColor/gi, '#fff')
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 66.145831 61.515624"><path d="${escapeHTML(value)}" fill="#fff"></path></svg>`;

  return `<img class="card-logo" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}" alt="" loading="lazy" decoding="async">`;
}

function markdownHTML(value, { allowLinks = true } = {}) {
  if (!window.marked?.parse || !window.DOMPurify?.sanitize) {
    throw new Error('Não foi possível carregar o renderizador seguro de Markdown.');
  }
  const safeHTML = DOMPurify.sanitize(marked.parse(String(value ?? ''), { gfm: true, breaks: true }), {
    USE_PROFILES: { html: true }
  });
  const template = document.createElement('template');
  template.innerHTML = safeHTML;
  template.content.querySelectorAll('a[href]').forEach(link => {
    if (!allowLinks) {
      link.replaceWith(...link.childNodes);
      return;
    }
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });
  template.content.querySelectorAll('img').forEach(image => {
    image.loading = 'lazy';
    image.decoding = 'async';
  });
  return template.innerHTML;
}

function normalizeCategory(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function categories() {
  const map = new Map();

  state.items.forEach(item => {
    const category = normalizeCategory(item.Category);
    if (category && !map.has(category.toLowerCase())) map.set(category.toLowerCase(), category);
  });

  return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function platformsMap() {
  return {
    pc: { label: 'PC', icon: 'computer' },
    android: { label: 'Android', icon: 'phone' },
    ios: { label: 'iOS', icon: 'phone' },
    tv: { label: 'TV', icon: 'tv' },
    linux: { label: 'Linux', icon: 'linux' },
    web: { label: 'Web', icon: 'web' },
    tablet: { label: 'Tablet', icon: 'tablet' },
    other: { label: 'Outros', icon: 'devices' }
  };
}

function normalizePlatform(value) {
  const key = normalize(value).replace(/\s+/g, ' ');
  if (!key) return '';
  if (key === 'android-tv' || key.includes('smarttv') || key.includes('androidtv') || key === 'tv' || key.includes('television')) return 'tv';
  if (key.includes('pc') || key.includes('desktop') || key.includes('windows')) return 'pc';
  if (key.includes('android')) return 'android';
  if (key.includes('ios') || key.includes('iphone') || key.includes('ipad')) return 'ios';
  if (key.includes('linux')) return 'linux';
  if (key.includes('web') || key.includes('browser')) return 'web';
  if (key.includes('tablet')) return 'tablet';
  return key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function itemPlatforms(item) {
  return Array.isArray(item.Platforms)
    ? item.Platforms
    : typeof item.Platforms === 'string'
      ? item.Platforms.split(/[\n,;]+/)
      : [];
}

function platformOptions() {
  const options = new Map();
  const map = platformsMap();

  state.items.forEach(item => {
    itemPlatforms(item).forEach(value => {
      const key = normalizePlatform(value);
      if (!key || options.has(key)) return;
      options.set(key, map[key]?.label || String(value).trim());
    });
  });

  return Array.from(options, ([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

function activeFilterCount() {
  return state.categories.size + state.platforms.size;
}

function resultMetaHTML(items) {
  const count = activeFilterCount();
  return items.length +
    ' resultado' +
    (items.length === 1 ? '' : 's') +
    (state.query ? ' para “' + escapeHTML(state.query) + '”' : '') +
    (count ? ` · ${count} ${count === 1 ? 'filtro ativo' : 'filtros ativos'}` : '');
}

function renderCatalogControls() {
  const content = document.querySelector('#catalog-filter-content');
  const panel = document.querySelector('#catalog-filter-panel');
  const toggle = document.querySelector('#filters-toggle');
  const count = document.querySelector('#active-filter-count');
  const total = activeFilterCount();

  if (!content || !panel || !toggle || !count) return;

  content.innerHTML = `
    <div class="filter-section">
      <h2 class="filter-heading">Categorias</h2>
      <div class="filter-options">
        ${categories().map(category => {
          const key = category.toLowerCase();
          const selected = state.categories.has(key);
          return `<button class="filter-option${selected ? ' active' : ''}" type="button" data-filter-category="${escapeHTML(key)}" aria-pressed="${selected}">${escapeHTML(category)}</button>`;
        }).join('')}
      </div>
    </div>
    <div class="filter-section">
      <h2 class="filter-heading">Plataformas</h2>
      <div class="filter-options">
        ${platformOptions().map(platform => {
          const selected = state.platforms.has(platform.key);
          return `<button class="filter-option${selected ? ' active' : ''}" type="button" data-filter-platform="${escapeHTML(platform.key)}" aria-pressed="${selected}">${escapeHTML(platform.label)}</button>`;
        }).join('')}
      </div>
    </div>
    <button class="clear-filters" type="button" data-clear-filters ${total ? '' : 'disabled'}>Limpar filtros</button>`;

  count.hidden = total === 0;
  count.textContent = String(total);
  count.setAttribute('aria-label', `${total} ${total === 1 ? 'filtro ativo' : 'filtros ativos'}`);
  toggle.setAttribute('aria-expanded', String(state.filtersOpen));
  panel.classList.toggle('is-open', state.filtersOpen);
  panel.setAttribute('aria-hidden', String(!state.filtersOpen));
  panel.inert = !state.filtersOpen;
  document.querySelectorAll('[data-view]').forEach(button => {
    const selected = button.dataset.view === state.view;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

function platformBadges(platforms) {
  const unique = [...new Set(itemPlatforms({ Platforms: platforms }).map(normalizePlatform).filter(Boolean))];
  const map = platformsMap();

  return unique.map(key => {
    const meta = map[key] || { label: key, icon: 'tag' };
    const platformIcon = icon(meta.icon);
    return `<span class="platform-badge">${platformIcon}<span>${escapeHTML(meta.label)}</span></span>`;
  }).join('');
}

function cardDescriptionHTML(value) {
  return markdownHTML(String(value ?? ''), { allowLinks: false });
}

function cardHTML(item, index = 0) {
  const logo = item.Logo || item.logo;
  const platforms = platformBadges(item.Platforms);
  const category = normalizeCategory(item.Category);

  return `<a class="card cursor-glow" style="--card-index:${index}" href="#/item/${encodeURIComponent(item.slug)}">
    <div class="card-content">
      <div class="card-meta">
        ${category ? `<div class="card-category">${icon('tag')}<span>${escapeHTML(category)}</span></div>` : ''}
        ${platforms ? `<div class="card-platforms">${platforms}</div>` : ''}
      </div>
      <div class="card-title-row">
        ${logoMarkup(logo)}
        <h2>${escapeHTML(item.Title)}</h2>
      </div>
      <div class="card-description markdown">${cardDescriptionHTML(item.Description)}</div>
    </div>
    <div class="card-foot"><span>${SITE_TEXTS.openAction}</span><span class="card-foot-icon" aria-hidden="true">${icon('open')}</span></div>
  </a>`;
}

function noticeIcon(type) {
  return type === 'guide' ? 'guide' : type === 'info' ? 'info' : 'warning';
}

function marqueeBar(type, text, content) {
  const className = type === 'warn' ? 'warn-bar' : type === 'info' ? 'info-bar' : 'removed-bar critical-bar';
  const label = escapeHTML(text);

  return `<div class="dynamic-bar ${className}" data-marquee-bar>
    <button class="notice-button" data-expand="${escapeHTML(type)}" type="button" aria-expanded="false">
      <span class="notice-main">
        <span class="notice-icon" aria-hidden="true">${icon(noticeIcon(type))}</span>
        <span class="notice-label marquee-label">
          <span class="marquee-clip"><span class="marquee-track" data-marquee><span class="marquee-group"><span>${label}</span><span class="marquee-separator" aria-hidden="true">•</span></span></span></span>
        </span>
      </span>
      <span class="notice-chevron" aria-hidden="true">+</span>
    </button>
    ${content ? `<div class="expand" id="expand-${escapeHTML(type)}"><div class="expand-inner markdown">${markdownHTML(content)}</div></div>` : ''}
  </div>`;
}

function summarizeNotice(value, maxLength = 150) {
  const source = String(value ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[*_`#>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!source) return 'Clique para abrir e ver o conteúdo completo.';
  if (source.length <= maxLength) return source;
  return `${source.slice(0, maxLength - 1).trimEnd()}…`;
}

function detailBarWithFlip(type, shortText, longText) {
  const className = type === 'warn' ? 'warn-bar' : type === 'guide' ? 'guide-bar' : 'info-bar';
  const label = shortText || (type === 'guide' ? SITE_TEXTS.guideLabel : type === 'info' ? SITE_TEXTS.informationLabel : SITE_TEXTS.warningLabel);
  const summary = summarizeNotice(longText);

  return `<div class="dynamic-bar ${className}" data-notice-flip>
    <button class="notice-button" data-expand="${escapeHTML(type)}" type="button" aria-expanded="false">
      <span class="notice-main">
        <span class="notice-icon" aria-hidden="true">${icon(noticeIcon(type))}</span>
        <span class="notice-stack" aria-live="polite">
          <span class="notice-line notice-label">${escapeHTML(label)}</span>
          <span class="notice-line notice-summary">${escapeHTML(summary)}</span>
        </span>
      </span>
      <span class="notice-chevron" aria-hidden="true">+</span>
    </button>
    <div class="expand" id="expand-${escapeHTML(type)}"><div class="expand-inner markdown">${markdownHTML(longText)}</div></div>
  </div>`;
}

function renderLoading() {
  app.innerHTML = `<div class="loading-screen" role="status" aria-live="polite"><span class="loading-mark" aria-hidden="true">${icon('loading')}</span><span>${SITE_TEXTS.loading}</span></div>`;
}

function updateHomeResults() {
  const grid = document.querySelector('.grid');
  const meta = document.querySelector('.result-meta');
  if (!grid || !meta) return;

  const items = filteredItems();
  meta.innerHTML = resultMetaHTML(items);

  grid.classList.toggle('list-view', state.view === 'list');
  grid.innerHTML = items.length
    ? items.map((item, index) => cardHTML(item, index)).join('')
    : '<div class="empty">' + escapeHTML(SITE_TEXTS.noResults) + '</div>';
}

function filteredItems() {
  let items = state.items.slice();

  if (state.categories.size) items = items.filter(item => state.categories.has(normalizeCategory(item.Category).toLowerCase()));
  if (state.platforms.size) {
    items = items.filter(item => itemPlatforms(item).some(platform => state.platforms.has(normalizePlatform(platform))));
  }

  if (state.query.trim()) {
    return items
      .map(item => ({ item, score: fuzzyScore(state.query, item) }))
      .filter(result => result.score >= 0.48)
      .sort((a, b) => b.score - a.score)
      .map(result => result.item);
  }

  return items.sort((a, b) => (a.Title || '').localeCompare(b.Title || '', 'pt-BR'));
}

function renderHome() {
  const items = filteredItems();
  document.querySelector('.site-header').classList.add('catalog-mode');

  app.innerHTML = `<section class="catalog-tools" id="catalog">
    <div class="result-meta">${resultMetaHTML(items)}</div>
  </section>
  <section class="grid${state.view === 'list' ? ' list-view' : ''}">${items.length ? items.map((item, index) => cardHTML(item, index)).join('') : `<div class="empty">${escapeHTML(SITE_TEXTS.noResults)}</div>`}</section>`;
  renderCatalogControls();
}

function renderError(code = '500') {
  document.querySelector('.site-header').classList.remove('catalog-mode');
  app.innerHTML = `<section class="error-screen" role="alert">
    <div class="error-icon" aria-hidden="true">${icon('open')}</div>
    <div class="error-code">${escapeHTML(code)}</div>
    <h1>${escapeHTML(SITE_TEXTS.errorTitle)}</h1>
    <p>${escapeHTML(SITE_TEXTS.errorDescription)}</p>
    <a class="error-back" href="#/">${icon('back')} ${escapeHTML(SITE_TEXTS.backToCatalog)}</a>
  </section>`;
}

let detailRouteToken = 0;

async function renderDetail(slug) {
  document.querySelector('.site-header').classList.remove('catalog-mode');
  const currentToken = ++detailRouteToken;
  const meta = state.items.find(item => item.slug === slug);

  if (!meta) {
    renderError('404');
    return;
  }

  renderLoading();

  try {
    const response = await fetch(`data/items/${encodeURIComponent(meta.file)}`, { cache: 'default' });
    if (!response.ok) throw new Error('item');

    const item = { ...meta, ...await response.json() };
    if (currentToken !== detailRouteToken) return;

    const removed = Boolean(item.removed !== undefined || item.removedtxt);
    const warning = Boolean(item.warn);
    const information = Boolean(item.info || item.infotxt);
    const guide = Boolean(item.guiatxt);
    const hasNotices = warning || information || guide;
    const images = Array.isArray(item.Image) ? item.Image : item.Image ? [item.Image] : [];
    const links = Array.isArray(item.ButtonLink) ? item.ButtonLink : item.ButtonLink ? [item.ButtonLink] : [];
    const labels = Array.isArray(item.ButtonLabel) ? item.ButtonLabel : item.ButtonLabel ? [item.ButtonLabel] : [];
    const platforms = platformBadges(item.Platforms);
    const category = normalizeCategory(item.Category);
    const content = item.text || item.content || item.notes || '';

    const buttons = links.map((link, index) => `
      <a class="side-action" target="_blank" rel="noopener noreferrer" href="${escapeHTML(link)}">
        ${icon('download')}<span>${escapeHTML(labels[index] || labels[0] || SITE_TEXTS.linkLabel)}</span>
      </a>`).join('');

    app.innerHTML = `<div class="detail-wrap">
      <a class="back" href="#/">${icon('back')} ${escapeHTML(SITE_TEXTS.backToCatalog)}</a>
      ${removed ? `<div class="detail-removed">${marqueeBar('removed', item.removed || SITE_TEXTS.removedLabel, item.removedtxt || '')}</div>` : ''}
      <article class="detail">
        <header class="detail-head">
          ${category || platforms ? `<div class="detail-meta">${category ? `<span class="detail-category">${icon('tag')} ${escapeHTML(category)}</span>` : ''}${platforms ? `<div class="detail-platforms">${platforms}</div>` : ''}</div>` : ''}
          <h1 class="detail-title">${escapeHTML(item.Title)}</h1>
          <div class="detail-desc markdown">${markdownHTML(item.Description)}</div>
          ${buttons ? `<div class="actions">${buttons}</div>` : ''}
        </header>
        <div class="detail-body">
          ${content ? `<div class="section-block markdown"><h3>${icon('content')} ${escapeHTML(SITE_TEXTS.contentTitle)}</h3>${markdownHTML(content)}</div>` : ''}
          ${images.length ? `<div class="section-block"><h3>${icon('gallery')} ${escapeHTML(SITE_TEXTS.imagesTitle)}</h3><div class="images">${images.map(src => `<img loading="lazy" decoding="async" src="${escapeHTML(src)}" alt="Imagem de ${escapeHTML(item.Title)}">`).join('')}</div></div>` : ''}
          ${hasNotices ? '<div class="line-sep" role="separator"></div>' : ''}
          ${warning ? detailBarWithFlip('warn', item.warnTitle || SITE_TEXTS.warningLabel, item.warn) : ''}
          ${information ? detailBarWithFlip('info', item.info || SITE_TEXTS.informationLabel, item.infotxt || item.info) : ''}
          ${guide ? detailBarWithFlip('guide', item.guia || SITE_TEXTS.guideLabel, item.guiatxt) : ''}
        </div>
      </article>
    </div>`;

    wireBars();
  } catch (error) {
    console.error('[Essentials] Falha ao carregar item:', error);
    if (currentToken === detailRouteToken) renderError('500');
  }
}

function wireBars() {
  detailTimers.forEach(timer => {
    clearTimeout(timer);
    clearInterval(timer);
  });
  detailTimers.clear();

  document.querySelectorAll('[data-expand]').forEach(button => {
    if (button.dataset.bound) return;
    button.dataset.bound = '1';
    button.addEventListener('click', () => {
      const target = document.querySelector(`#expand-${button.dataset.expand}`);
      if (!target) return;

      const bar = target.closest('.dynamic-bar');
      const isOpen = !target.classList.contains('open');
      target.classList.toggle('open', isOpen);
      bar?.classList.toggle('is-open', isOpen);
      button.setAttribute('aria-expanded', String(isOpen));
    });
  });

  if (!appearance.animations || reducedMotion.matches) return;

  document.querySelectorAll('[data-marquee]').forEach(track => {
    const clip = track.closest('.marquee-clip');
    const group = track.querySelector('.marquee-group');
    if (!clip || !group) return;
    track.style.animation = '';

    requestAnimationFrame(() => {
      if (track.dataset.prepared) return;
      track.dataset.prepared = '1';

      while (group.scrollWidth < clip.clientWidth + 100 && group.firstElementChild) {
        group.insertAdjacentHTML('beforeend', group.firstElementChild.outerHTML);
      }

      track.append(group.cloneNode(true));
      const travelWidth = Math.max(group.scrollWidth, clip.clientWidth);
      track.style.setProperty('--marquee-duration', `${Math.max(10, travelWidth / 34)}s`);
    });
  });

  document.querySelectorAll('[data-notice-flip]').forEach(bar => {
    const showSummary = () => {
      if (bar.classList.contains('is-open')) return;
      bar.classList.toggle('show-summary');
    };

    const first = setTimeout(showSummary, 2400);
    const cycle = setInterval(showSummary, 6200);
    detailTimers.add(first);
    detailTimers.add(cycle);
  });
}

async function route() {
  const hash = location.hash || '#/';
  if (hash === '#/' || hash === '#') return renderHome();

  const match = hash.match(/^#\/item\/(.+)$/);
  return match ? renderDetail(decodeURIComponent(match[1])) : renderHome();
}

window.addEventListener('hashchange', route);
window.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    document.querySelector('#search')?.focus();
  }
});

reducedMotion.addEventListener?.('change', () => {
  applyAppearance();
  if (appearance.animations && !reducedMotion.matches && document.querySelector('.detail')) wireBars();
});

document.querySelector('#search').addEventListener('input', event => {
  state.query = event.target.value;
  const hash = location.hash || '#/';
  if (hash !== '#/' && hash !== '#') {
    location.hash = '#/';
    return;
  }
  updateHomeResults();
});

document.querySelector('#filters-toggle').addEventListener('click', () => {
  state.filtersOpen = !state.filtersOpen;
  renderCatalogControls();
});

document.querySelector('#catalog-filter-panel').addEventListener('click', event => {
  const categoryButton = event.target.closest('[data-filter-category]');
  const platformButton = event.target.closest('[data-filter-platform]');
  let focusAttribute;
  let focusValue;

  if (categoryButton) {
    const key = categoryButton.dataset.filterCategory;
    if (state.categories.has(key)) state.categories.delete(key);
    else state.categories.add(key);
    focusAttribute = 'data-filter-category';
    focusValue = key;
  } else if (platformButton) {
    const key = platformButton.dataset.filterPlatform;
    if (state.platforms.has(key)) state.platforms.delete(key);
    else state.platforms.add(key);
    focusAttribute = 'data-filter-platform';
    focusValue = key;
  } else if (event.target.closest('[data-clear-filters]')) {
    state.categories.clear();
    state.platforms.clear();
  } else {
    return;
  }

  renderCatalogControls();
  updateHomeResults();
  if (focusAttribute) {
    [...document.querySelectorAll(`#catalog-filter-panel [${focusAttribute}]`)]
      .find(button => button.getAttribute(focusAttribute) === focusValue)
      ?.focus();
  } else {
    document.querySelector('#filters-toggle').focus();
  }
});

document.querySelector('.view-toggle').addEventListener('click', event => {
  const button = event.target.closest('[data-view]');
  if (!button || button.dataset.view === state.view) return;
  state.view = button.dataset.view;
  renderCatalogControls();
  updateHomeResults();
});

document.querySelector('#theme-toggle').addEventListener('click', () => {
  appearance.theme = appearance.theme === 'dark' ? 'light' : 'dark';
  applyAppearance();
  if (appearance.theme === 'light') showThemeWarning();
  else hideThemeWarning();
  saveAppearance();
});

document.querySelector('#animations-choice').addEventListener('change', event => {
  appearance.animations = event.target.checked;
  applyAppearance();
  if (appearance.animations && !reducedMotion.matches && document.querySelector('.detail')) wireBars();
  saveAppearance();
});
document.querySelector('#glass-choice').addEventListener('change', event => {
  appearance.glass = event.target.checked;
  applyAppearance();
  saveAppearance();
});

document.addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse') return;
  const target = event.target.closest('.cursor-glow');
  if (!target || !appearance.glass) return;
  document.querySelectorAll('.cursor-glow.pointer-lit').forEach(element => {
    if (element !== target && !element.matches(':hover')) element.classList.remove('pointer-lit');
  });
  const bounds = target.getBoundingClientRect();
  target.style.setProperty('--pointer-x', `${event.clientX - bounds.left}px`);
  target.style.setProperty('--pointer-y', `${event.clientY - bounds.top}px`);
  target.classList.add('pointer-lit');
});

document.addEventListener('pointerout', event => {
  requestAnimationFrame(() => {
    document.querySelectorAll('.cursor-glow.pointer-lit').forEach(element => {
      if (!element.matches(':hover')) element.classList.remove('pointer-lit');
    });
  });
});

(async () => {
  try {
    loadAppearance();
    applyAppearance();
    renderLoading();
    loadCatalog();
    await route();
  } catch (error) {
    console.error('[Essentials] Falha ao iniciar:', error);
    renderError('500');
  }
})();
