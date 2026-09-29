const SITE_TEXTS = Object.freeze({
  heroKicker: 'Hospedado com amor por GitHub',
  heroTitle: 'Bufus',
  heroAccent: 'Essentials',
  heroDescription: 'Uma seleção de recursos essenciais reunidos em um só lugar.',
  searchPlaceholder: 'Pesquisar no catálogo',
  openAction: 'ABRIR',
  noResults: 'Nenhum resultado encontrado.',
  loading: 'Carregando',
  errorTitle: 'OCORREU UM ERRO',
  errorDescription: 'Infelizmente, o site possui algum problema. Isso será resolvido em breve.',
  backToCatalog: 'VOLTAR AO CATÁLOGO',
  contentTitle: 'Conteúdo',
  imagesTitle: 'Imagens',
  guideLabel: 'GUIA DE USO',
  informationLabel: 'INFORMAÇÃO',
  warningLabel: 'Este conteúdo possui um aviso.',
  removedLabel: 'ESTE CONTEÚDO POSSUI UMA OBSERVAÇÃO',
  linkLabel: 'ABRIR LINK',
});

const state = {
  items: [],
  query: '',
  category: 'TODOS'
};

const app = document.querySelector('#app');

const detailTimers = new Set();

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
  devices: 'mdi:devices'
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

function markdownInline(value, { allowLinks = true } = {}) {
  const tokens = [];
  const stash = html => {
    const key = `\uE000K${tokens.length}\uE001`;
    tokens.push(html);
    return key;
  };

  let text = String(value ?? '');

  // Protect inline code before applying emphasis/link rules.
  text = text.replace(/`([^`\n]+)`/g, (_, code) => stash(`<code>${escapeHTML(code)}</code>`));
  text = escapeHTML(text);

  // Markdown images and links are converted before emphasis, then restored last.
  text = text.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/gi, (_, alt, url) => (
    stash(`<img src="${url}" alt="${escapeHTML(alt)}" loading="lazy" decoding="async">`)
  ));

  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, (_, label, url) => {
    if (!allowLinks) return label;
    return stash(`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
  });

  text = text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>');

  if (allowLinks) {
    text = text.replace(/(^|[\s(])((?:https?:\/\/|www\.)[^\s<]+)/gi, (_, prefix, rawUrl) => {
      const match = rawUrl.match(/^(.*?)([.,!?;:]+)?(?:\)+|\]+)?$/);
      const cleanUrl = (match?.[1] || rawUrl).trim();
      const trailing = rawUrl.slice(cleanUrl.length);
      if (!cleanUrl) return prefix + rawUrl;

      const href = /^www\./i.test(cleanUrl) ? `https://${cleanUrl}` : cleanUrl;
      return `${prefix}${stash(`<a href="${href}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>`)}${trailing}`;
    });
  }

  return text.replace(/\uE000K(\d+)\uE001/g, (_, index) => tokens[Number(index)] || '');
}

function markdownHTML(value, options = {}) {
  const lines = String(value ?? '').replace(/\r/g, '').split('\n');
  const output = [];
  let listOpen = false;
  let inCode = false;
  let codeLines = [];

  const closeList = () => {
    if (!listOpen) return;
    output.push('</ul>');
    listOpen = false;
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCode) {
        output.push(`<pre><code>${escapeHTML(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
      }
      inCode = !inCode;
      closeList();
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const marker = line.match(/^\s*[-*]\s+(.+)$/);
    const quote = line.match(/^\s*>\s?(.+)$/);

    if (heading) {
      closeList();
      const level = heading[1].length;
      output.push(`<h${level}>${markdownInline(heading[2], options)}</h${level}>`);
      continue;
    }

    if (marker) {
      if (!listOpen) {
        output.push('<ul>');
        listOpen = true;
      }
      output.push(`<li>${markdownInline(marker[1], options)}</li>`);
      continue;
    }

    if (quote) {
      closeList();
      output.push(`<blockquote>${markdownInline(quote[1], options)}</blockquote>`);
      continue;
    }

    closeList();
    if (line.trim()) output.push(`<p>${markdownInline(line, options)}</p>`);
  }

  if (inCode) output.push(`<pre><code>${escapeHTML(codeLines.join('\n'))}</code></pre>`);
  closeList();

  return output.join('');
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

  return ['TODOS', ...Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'))];
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
  const key = String(value ?? '').trim().toLowerCase();
  if (!key) return '';
  if (key === 'android-tv' || key.includes('smarttv') || key.includes('androidtv') || key === 'tv' || key.includes('television')) return 'tv';
  if (key.includes('pc') || key.includes('desktop') || key.includes('windows')) return 'pc';
  if (key.includes('android')) return 'android';
  if (key.includes('ios') || key.includes('iphone') || key.includes('ipad')) return 'ios';
  if (key.includes('linux')) return 'linux';
  if (key.includes('web') || key.includes('browser')) return 'web';
  if (key.includes('tablet')) return 'tablet';
  return 'other';
}

function platformBadges(platforms) {
  const values = Array.isArray(platforms)
    ? platforms
    : typeof platforms === 'string'
      ? platforms.split(/[\n,;]+/)
      : [];
  const unique = [...new Set(values.map(normalizePlatform).filter(Boolean))];
  const map = platformsMap();

  return unique.map(key => {
    const meta = map[key] || { label: key, icon: 'tag' };
    const platformIcon = key === 'linux'
      ? `<img class="platform-logo-linux" src="https://api.iconify.design/simple-icons:linux.svg?color=%23FCC624" alt="" aria-hidden="true" loading="lazy" decoding="async">`
      : icon(meta.icon);
    return `<span class="platform-badge">${platformIcon}<span>${escapeHTML(meta.label)}</span></span>`;
  }).join('');
}

function cardDescriptionHTML(value) {
  return markdownHTML(String(value ?? ''), { allowLinks: false });
}

function cardHTML(item, index = 0) {
  const banner = item.Banner || item.banner || (Array.isArray(item.Image) ? item.Image[0] : item.Image);
  const logo = item.Logo || item.logo;
  const platforms = platformBadges(item.Platforms);
  const category = normalizeCategory(item.Category);

  return `<a class="card" style="--card-index:${index}" href="#/item/${encodeURIComponent(item.slug)}">
    ${banner ? `<div class="card-media"><img class="card-banner" src="${escapeHTML(banner)}" alt="" aria-hidden="true" loading="lazy" decoding="async"></div>` : ''}
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
    <div class="card-foot"><span>${SITE_TEXTS.openAction}</span>${icon('open')}</div>
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
  app.innerHTML = `<div class="loading-screen" role="status" aria-live="polite"><span class="loading-mark" aria-hidden="true">${icon('content')}</span><span>${SITE_TEXTS.loading}</span></div>`;
}

function updateHomeResults() {
  const grid = document.querySelector('.grid');
  const meta = document.querySelector('.result-meta');
  if (!grid || !meta) return;

  const items = filteredItems();

  meta.innerHTML =
    items.length +
    ' resultado' +
    (items.length === 1 ? '' : 's') +
    (state.query ? ' para “' + escapeHTML(state.query) + '”' : '');

  grid.innerHTML = items.length
    ? items.map((item, index) => cardHTML(item, index)).join('')
    : '<div class="empty">' + escapeHTML(SITE_TEXTS.noResults) + '</div>';
}

function filteredItems() {
  let items = state.items.slice();

  if (state.category !== 'TODOS') {
    const selected = normalizeCategory(state.category).toLowerCase();
    items = items.filter(item => normalizeCategory(item.Category).toLowerCase() === selected);
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
  const categoryList = categories();

  app.innerHTML = `<section class="hero">
    <div class="hero-copy">
      <h1>${escapeHTML(SITE_TEXTS.heroTitle)} <em>${escapeHTML(SITE_TEXTS.heroAccent)}</em></h1>
      <div class="hero-kicker">${icon('heart')} ${escapeHTML(SITE_TEXTS.heroKicker)}</div>
      <p>${escapeHTML(SITE_TEXTS.heroDescription)}</p>
    </div>
  </section>
  <section class="search-shell">
    <div class="searchbox">
      <div class="search-field">${icon('search')}<input id="search" autocomplete="off" spellcheck="false" placeholder="${escapeHTML(SITE_TEXTS.searchPlaceholder)}" value="${escapeHTML(state.query)}" aria-label="Pesquisar"></div>
    </div>
  </section>
  <section class="catalog-tools" id="catalog">
    <div class="filters">
      ${categoryList.map(category => `<button class="filter ${category === state.category ? 'active' : ''}" data-category="${escapeHTML(category)}" type="button">${icon('tag')}<span>${escapeHTML(category)}</span></button>`).join('')}
    </div>
    <div class="result-meta">${items.length} resultado${items.length === 1 ? '' : 's'}${state.query ? ` para “${escapeHTML(state.query)}”` : ''}</div>
  </section>
  <section class="grid">${items.length ? items.map((item, index) => cardHTML(item, index)).join('') : `<div class="empty">${escapeHTML(SITE_TEXTS.noResults)}</div>`}</section>`;

  const field = document.querySelector('#search');
  field?.addEventListener('input', event => {
    state.query = event.target.value;
    updateHomeResults();
  });

  document.querySelectorAll('[data-category]').forEach(button => {
    button.addEventListener('click', () => {
      state.category = button.dataset.category;
      renderHome();
    });
  });

  if (document.activeElement !== field && state.query) field?.focus();
  if (state.query && field) field.setSelectionRange(state.query.length, state.query.length);
}

function renderError(code = '500') {
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

  document.querySelectorAll('[data-marquee]').forEach(track => {
    const clip = track.closest('.marquee-clip');
    const group = track.querySelector('.marquee-group');
    if (!clip || !group) return;

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

(async () => {
  try {
    renderLoading();
    loadCatalog();
    await route();
  } catch (error) {
    console.error('[Essentials] Falha ao iniciar:', error);
    renderError('500');
  }
})();
