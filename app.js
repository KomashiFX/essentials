const state = { items: [], query: '', category: 'TODOS' };
const SOUNDCLOUD_PROFILE_URL = 'https://soundcloud.com/sui_uzi';
const player = {
  tracks: [],
  index: 0,
  widget: null,
  ready: false,
  playing: false,
  duration: 0,
  error: false
};
const app = document.querySelector('#app');

const playerElements = {
  art: document.querySelector('#player-art'),
  titleLink: document.querySelector('#player-title-link'),
  sourceLink: document.querySelector('#player-source-link'),
  title: document.querySelector('#player-title'),
  artist: document.querySelector('#player-artist'),
  play: document.querySelector('#player-play'),
  prev: document.querySelector('#player-prev'),
  next: document.querySelector('#player-next'),
  seek: document.querySelector('#player-seek'),
  current: document.querySelector('#player-current'),
  duration: document.querySelector('#player-duration'),
  volume: document.querySelector('#player-volume')
};

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

function trackCover(track) {
  return track?.cover || '';
}

function mapSound(sound) {
  return {
    title: sound?.title || 'Faixa sem título',
    artist: sound?.publisher_metadata?.artist || sound?.user?.username || 'SUI UZI',
    src: sound?.permalink_url || '',
    officialUrl: sound?.permalink_url || SOUNDCLOUD_PROFILE_URL,
    cover: sound?.artwork_url || sound?.user?.avatar_url || '',
    duration: Number.isFinite(sound?.duration) ? sound.duration : 0
  };
}

function updateMediaSession(track) {
  if (!('mediaSession' in navigator) || !track) return;
  const cover = trackCover(track);
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist || 'SUI UZI',
    album: 'SUI UZI • SoundCloud',
    artwork: cover ? [{ src: cover, sizes: '512x512', type: 'image/jpeg' }] : []
  });
}

function updateNavigation() {
  const hasTracks = player.tracks.length > 0;
  const canSkip = player.tracks.length > 1;
  [playerElements.prev, playerElements.next].forEach(button => {
    button.disabled = !canSkip;
    button.setAttribute('aria-disabled', String(!canSkip));
  });
  playerElements.play.disabled = !hasTracks;
}

function updatePlayer() {
  const track = player.tracks[player.index];
  if (!track) {
    playerElements.title.textContent = player.error ? 'SoundCloud indisponível' : (player.ready ? 'Nenhuma faixa disponível' : 'Carregando músicas...');
    playerElements.artist.textContent = player.error ? 'Não foi possível carregar as faixas' : (player.ready ? 'SUI UZI' : 'Conectando ao SoundCloud');
    playerElements.play.innerHTML = '<iconify-icon icon="solar:play-linear"></iconify-icon>';
    updateNavigation();
    return;
  }

  const cover = trackCover(track);
  const officialUrl = /^https?:\/\//i.test(track.officialUrl || '') ? track.officialUrl : SOUNDCLOUD_PROFILE_URL;
  playerElements.title.textContent = track.title;
  playerElements.artist.textContent = track.artist || 'SUI UZI';
  playerElements.titleLink.href = officialUrl;
  playerElements.titleLink.classList.add('has-link');
  playerElements.titleLink.setAttribute('aria-label', `Abrir ${track.title} no SoundCloud`);
  playerElements.sourceLink.href = officialUrl;
  playerElements.art.innerHTML = cover
    ? `<img src="${escapeHTML(cover)}" alt="" loading="lazy">`
    : '<iconify-icon icon="solar:music-note-3-linear"></iconify-icon>';
  playerElements.art.href = officialUrl;
  playerElements.art.classList.add('has-link');
  playerElements.play.innerHTML = `<iconify-icon icon="${player.playing ? 'solar:pause-linear' : 'solar:play-linear'}"></iconify-icon>`;
  playerElements.play.setAttribute('aria-label', player.playing ? 'Pausar' : 'Reproduzir');
  playerElements.play.title = player.playing ? 'Pausar' : 'Reproduzir';
  playerElements.seek.value = 0;
  playerElements.current.textContent = '0:00';
  playerElements.duration.textContent = formatTime(track.duration / 1000);
  if (track.duration) player.duration = track.duration;
  updateNavigation();
  updateMediaSession(track);
}

function syncCurrentSound() {
  if (!player.widget) return;

  player.widget.getCurrentSoundIndex(index => {
    if (Number.isInteger(index) && index >= 0) player.index = index;
    player.widget.getCurrentSound(sound => {
      if (!sound) return;
      const mapped = mapSound(sound);
      player.tracks[player.index] = { ...(player.tracks[player.index] || {}), ...mapped };
      player.duration = mapped.duration || player.duration;
      updatePlayer();
    });
  });
}

function syncTrackList() {
  if (!player.widget) return;
  player.widget.getSounds(sounds => {
    player.error = false;
    const nextTracks = Array.isArray(sounds) ? sounds.map(mapSound).filter(track => track.src) : [];
    if (nextTracks.length) {
      player.tracks = nextTracks;
      player.index = 0;
      const first = player.tracks[0];
      if (first?.duration) player.duration = first.duration;
    }
    player.ready = true;
    updatePlayer();
    syncCurrentSound();
  });
}

function selectTrack(index, autoplay = false) {
  if (!player.widget || !player.tracks.length) return;
  player.index = (index + player.tracks.length) % player.tracks.length;
  player.duration = player.tracks[player.index]?.duration || 0;
  playerElements.seek.value = 0;
  playerElements.current.textContent = '0:00';
  updatePlayer();

  const target = player.index;
  if (typeof player.widget.skip === 'function') {
    player.widget.skip(target);
    if (autoplay) player.widget.play();
  } else {
    const track = player.tracks[target];
    if (!track?.src) return;
    player.widget.load(track.src, { auto_play: autoplay, show_artwork: false, hide_related: true, show_comments: false, show_user: false, show_reposts: false, visual: false });
  }
  player.playing = autoplay;
  updatePlayer();
}

function wakePlayer() {
  // Keeps keyboard/touch interactions explicit without changing the player layout.
}

function setupPlayer() {
  const frame = document.querySelector('#soundcloud-player');
  if (!frame || !window.SC?.Widget) return;
  const playerElement = document.querySelector('#music-player');
  ['pointerdown', 'keydown', 'touchstart'].forEach(eventName => playerElement.addEventListener(eventName, wakePlayer, { passive: true }));

  const params = new URLSearchParams({
    url: SOUNDCLOUD_PROFILE_URL,
    color: '#d2f36b',
    auto_play: 'false',
    hide_related: 'true',
    show_comments: 'false',
    show_user: 'false',
    show_reposts: 'false',
    show_artwork: 'false',
    visual: 'false'
  });
  frame.src = `https://w.soundcloud.com/player/?${params.toString()}`;
  player.widget = window.SC.Widget(frame);

  player.widget.bind(window.SC.Widget.Events.READY, () => {
    player.ready = true;
    player.error = false;
    player.widget.setVolume(Number(playerElements.volume.value) * 100);
    updatePlayer();
    syncTrackList();
  });
  player.widget.bind(window.SC.Widget.Events.PLAY, () => {
    player.playing = true;
    syncCurrentSound();
    player.widget.getDuration(duration => {
      if (Number.isFinite(duration)) player.duration = duration;
      updatePlayer();
    });
  });
  player.widget.bind(window.SC.Widget.Events.PAUSE, () => {
    player.playing = false;
    updatePlayer();
  });
  player.widget.bind(window.SC.Widget.Events.FINISH, () => {
    if (player.tracks.length > 1) selectTrack(player.index + 1, true);
    else {
      player.playing = false;
      updatePlayer();
    }
  });
  player.widget.bind(window.SC.Widget.Events.PLAY_PROGRESS, data => {
    const position = Number(data?.currentPosition) || 0;
    const relative = Number(data?.relativePosition) || 0;
    if (!player.duration && relative > 0) player.duration = position / relative;
    playerElements.current.textContent = formatTime(position / 1000);
    playerElements.duration.textContent = formatTime(player.duration / 1000);
    playerElements.seek.value = Math.max(0, Math.min(100, relative * 100));
  });
  player.widget.bind(window.SC.Widget.Events.ERROR, () => {
    player.ready = true;
    player.error = true;
    player.playing = false;
    updatePlayer();
  });

  playerElements.play.addEventListener('click', () => {
    wakePlayer();
    if (!player.widget || !player.tracks.length) return;
    if (player.playing) player.widget.pause();
    else player.widget.play();
  });
  playerElements.prev.addEventListener('click', () => { wakePlayer(); selectTrack(player.index - 1, true); });
  playerElements.next.addEventListener('click', () => { wakePlayer(); selectTrack(player.index + 1, true); });
  playerElements.seek.addEventListener('input', () => {
    wakePlayer();
    if (player.widget && player.duration) player.widget.seekTo((Number(playerElements.seek.value) / 100) * player.duration);
  });
  playerElements.volume.addEventListener('input', () => {
    wakePlayer();
    if (player.widget) player.widget.setVolume(Number(playerElements.volume.value) * 100);
  });

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => player.widget?.play());
    navigator.mediaSession.setActionHandler('pause', () => player.widget?.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => selectTrack(player.index - 1, true));
    navigator.mediaSession.setActionHandler('nexttrack', () => selectTrack(player.index + 1, true));
  }
}

const normalize = (value) => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();

function editDistance(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i-1] === b[j-1] ? 0 : 1));
      prev = temp;
    }
  }
  return row[b.length];
}

function fuzzyScore(query, item) {
  const q = normalize(query);
  if (!q) return 0;
  const title = normalize(item.Title);
  const aliases = (item.aliases || []).map(normalize);
  const hay = [title, ...aliases, normalize(item.Description)].filter(Boolean);
  let best = 0;
  for (const text of hay) {
    if (text === q) best = Math.max(best, 1.0);
    if (text.includes(q)) best = Math.max(best, 0.92 - Math.min(.2, (text.length-q.length)/500));
    for (const word of text.split(/\s+/)) {
      const d = editDistance(q, word);
      const score = 1 - d / Math.max(q.length, word.length, 1);
      best = Math.max(best, score * (text === title ? 0.98 : 0.86));
    }
  }
  const parts = q.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    let matched = 0;
    for (const part of parts) {
      if (hay.some(t => t.includes(part) || t.split(/\s+/).some(w => 1 - editDistance(part,w)/Math.max(part.length,w.length,1) > .62))) matched++;
    }
    best = Math.max(best, (matched / parts.length) * .85);
  }
  return best;
}

async function loadCatalog() {
  const catalog = window.ESSENTIALS_ITEMS;
  if (!Array.isArray(catalog)) throw new Error('items');
  state.items = catalog;
}

function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function logoMarkup(source) {
  const value = String(source ?? '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return `<img class="card-logo" src="${escapeHTML(value)}" alt="" loading="lazy">`;
  const svg = value.startsWith('<svg')
    ? value.replace(/currentColor/gi, '#fff')
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 66.145831 61.515624"><path d="${escapeHTML(value)}" fill="#fff"></path></svg>`;
  const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return `<img class="card-logo" src="${escapeHTML(dataUri)}" alt="" loading="lazy">`;
}

function markdownInline(value) {
  let text = escapeHTML(value);
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/gi, '<img src="$2" alt="$1" loading="lazy">');
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
  return text;
}

function markdownHTML(value) {
  const lines = String(value ?? '').replace(/\r/g, '').split('\n');
  const output = [];
  let list = false;
  let code = false;
  let codeLines = [];
  const closeList = () => { if (list) { output.push('</ul>'); list = false; } };
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (code) { output.push(`<pre><code>${escapeHTML(codeLines.join('\n'))}</code></pre>`); codeLines = []; }
      code = !code;
      closeList();
      continue;
    }
    if (code) { codeLines.push(line); continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (heading) { closeList(); output.push(`<h${heading[1].length}>${markdownInline(heading[2])}</h${heading[1].length}>`); continue; }
    if (bullet) { if (!list) { output.push('<ul>'); list = true; } output.push(`<li>${markdownInline(bullet[1])}</li>`); continue; }
    closeList();
    if (line.trim()) output.push(`<p>${markdownInline(line)}</p>`);
  }
  if (code) output.push(`<pre><code>${escapeHTML(codeLines.join('\n'))}</code></pre>`);
  closeList();
  return output.join('');
}

function renderError(code = '500') {
  app.innerHTML = `<section class="error-screen" role="alert">
    <div class="error-icon" aria-hidden="true"><iconify-icon icon="solar:danger-triangle-bold"></iconify-icon></div>
    <div class="error-code">${escapeHTML(code)}</div>
    <h1>OCORREU UM ERRO</h1>
    <p>Infelizmente, o site possui algum problema. Isso será resolvido em breve.</p>
    <a class="error-back" href="#/">Voltar ao catálogo</a>
  </section>`;
}

function categoryList() {
  const cats = [...new Set(state.items.map(i => i.Category).filter(Boolean))].sort();
  return ['TODOS', ...cats];
}

function filteredItems() {
  let arr = state.items.slice();
  if (state.category !== 'TODOS') arr = arr.filter(i => i.Category === state.category);
  if (state.query.trim()) arr = arr.map(i => ({i, score: fuzzyScore(state.query, i)})).filter(x => x.score >= .48).sort((a,b)=>b.score-a.score).map(x=>x.i);
  else arr.sort((a,b) => (a.Title||'').localeCompare(b.Title||'', 'pt-BR'));
  return arr;
}

function renderHome() {
  const items = filteredItems();
  app.innerHTML = `
    <section class="hero">
      <div class="hero-copy">
        <h1>Bufus<br><em>Essentials</em></h1>
        <p>Uma seleção de recursos essenciais reunidos em um só lugar.</p>
      </div>
    </section>
    <section class="search-shell">
      <div class="searchbox">
        <div class="search-field"><iconify-icon icon="solar:magnifer-linear" aria-hidden="true"></iconify-icon><input id="search" autocomplete="off" spellcheck="false" placeholder="Pesquisar no catálogo" value="${escapeHTML(state.query)}" aria-label="Pesquisar"></div>
      </div>
    </section>
    <div class="catalog-tools" id="catalog">
      <div class="filters">${categoryList().map(c=>`<button class="filter ${c===state.category?'active':''}" data-cat="${escapeHTML(c)}">${escapeHTML(c)}</button>`).join('')}</div>
      <div class="result-meta">${items.length} resultado${items.length===1?'':'s'} ${state.query ? `para “${escapeHTML(state.query)}”` : ''}</div>
    </div>
    <section class="grid">
      ${items.length ? items.map(cardHTML).join('') : '<div class="empty">Nenhum resultado encontrado.</div>'}
    </section>`;

  const input = document.querySelector('#search');
  input.addEventListener('input', e => { state.query = e.target.value; renderHome(); document.querySelector('#search')?.focus(); document.querySelector('#search')?.setSelectionRange(state.query.length,state.query.length); });
  document.querySelectorAll('[data-cat]').forEach(b=>b.addEventListener('click',()=>{state.category=b.dataset.cat; renderHome();}));
}

function platformMap() {
  return {
    pc: { label: 'PC', icon: 'mdi:desktop-classic' },
    android: { label: 'Android', icon: 'mdi:cellphone-android' },
    ios: { label: 'iOS', icon: 'mdi:apple-ios' },
    tv: { label: 'TV', icon: 'mdi:television' },
    linux: { label: 'Linux', icon: 'mdi:linux' },
    web: { label: 'Web', icon: 'mdi:web' },
    browser: { label: 'Browser', icon: 'mdi:application-outline' },
    tablet: { label: 'Tablet', icon: 'mdi:tablet-android' },
    outros: { label: 'Outros', icon: 'mdi:devices' }
  };
}

function normalizePlatformKey(value) {
  const key = String(value ?? '').trim().toLowerCase();
  if (!key) return '';
  if (key === 'android-tv') return 'tv';
  if (key.includes('pc') || key.includes('desktop') || key.includes('windows')) return 'pc';
  if (key.includes('android')) return 'android';
  if (key.includes('ios') || key.includes('iphone') || key.includes('ipad')) return 'ios';
  if (key.includes('tv') || key.includes('smarttv') || key.includes('androidtv')) return 'tv';
  if (key.includes('linux')) return 'linux';
  if (key.includes('web') || key.includes('browser')) return 'web';
  if (key.includes('tablet')) return 'tablet';
  return 'outros';
}

function platformBadges(platforms) {
  const values = Array.isArray(platforms) ? platforms : (typeof platforms === 'string' ? platforms.split(/[\n,;]+/) : []);
  const unique = [...new Set(values.map(value => normalizePlatformKey(value)).filter(Boolean))];
  if (!unique.length) return '';
  const map = platformMap();
  return unique.map(key => {
    const meta = map[key] || { label: key, icon: 'mdi:circle-medium' };
    return `<span class="platform-badge"><iconify-icon icon="${meta.icon}" aria-hidden="true"></iconify-icon><span>${escapeHTML(meta.label)}</span></span>`;
  }).join('');
}

function cardDescriptionHTML(value) {
  const withoutLinks = String(value ?? '').replace(/\[([^\]]+)\]\(https?:\/\/[^\s)]+\)/gi, '$1');
  return markdownHTML(withoutLinks);
}

function cardHTML(item) {
  const banner = item.Banner || item.banner || (Array.isArray(item.Image) ? item.Image[0] : item.Image);
  const logo = item.Logo || item.logo;
  return `<a class="card ${banner ? 'has-banner' : ''}" href="#/item/${encodeURIComponent(item.slug)}">
    ${banner ? `<div class="card-media"><img class="card-banner" src="${escapeHTML(banner)}" alt="" aria-hidden="true" loading="lazy"></div>` : ''}
    <div class="card-content">
      <div class="card-meta">
        ${item.Category ? `<div class="card-category">${escapeHTML(item.Category)}</div>` : ''}
        ${platformBadges(item.Platforms) ? `<div class="card-platforms">${platformBadges(item.Platforms)}</div>` : ''}
      </div>
      <div class="card-title-row">${logoMarkup(logo)}<h2>${escapeHTML(item.Title)}</h2></div>
      <div class="card-description markdown">${cardDescriptionHTML(item.Description)}</div>
    </div>
    <div class="card-foot"><span>ABRIR</span><iconify-icon class="arrow" icon="solar:arrow-up-right-linear" aria-hidden="true"></iconify-icon></div>
  </a>`;
}

function marqueeBar(type, text, extraText) {
  const cls = type === 'warn' ? 'warn-bar' : type === 'info' ? 'info-bar' : 'removed-bar';
  const icon = type === 'warn' ? 'solar:danger-triangle-linear' : type === 'info' ? 'solar:info-circle-linear' : 'solar:close-circle-linear';
  return `<div class="dynamic-bar ${cls}">
    <button data-expand="${type}"><div class="marquee-row"><iconify-icon class="notice-icon" icon="${icon}" aria-hidden="true"></iconify-icon><div class="marquee-clip"><div class="marquee-track" data-marquee><div class="marquee-group"><span>${escapeHTML(text)}</span></div></div></div></div></button>
    ${extraText ? `<div class="expand" id="expand-${type}"><div class="expand-inner markdown">${markdownHTML(extraText)}</div></div>` : ''}
  </div>`;
}

function detailBarWithFlip(type, shortText, longText) {
  const cls = type === 'warn' ? 'warn-bar' : 'info-bar';
  const icon = type === 'warn' ? 'solar:danger-triangle-linear' : type === 'guia' ? 'solar:book-2-linear' : 'solar:info-circle-linear';
  return `<div class="dynamic-bar ${cls}">
    <button data-expand="${type}"><div class="marquee-row"><iconify-icon class="notice-icon" icon="${icon}" aria-hidden="true"></iconify-icon><span class="notice-copy" data-short="${escapeHTML(shortText)}" data-long="${escapeHTML(longText)}">${escapeHTML(shortText)}</span></div></button>
    <div class="expand" id="expand-${type}"><div class="expand-inner markdown">${markdownHTML(longText)}</div></div>
  </div>`;
}

function renderLoading() {
  app.innerHTML = `<div class="loading-screen" role="status" aria-live="polite">
    <iconify-icon icon="svg-spinners:90-ring-with-bg" aria-hidden="true"></iconify-icon>
    <span>Carregando</span>
  </div>`;
}

async function renderDetail(slug) {
  const meta = state.items.find(i=>i.slug===slug);
  if (!meta) { renderError('404'); return; }
  renderLoading();
  let item;
  try {
    const res = await fetch(`data/items/${encodeURIComponent(meta.file)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('item');
    item = await res.json();
  } catch {
    renderError('500');
    return;
  }

  const hasRemoved = Boolean(item.removed !== undefined || item.removedtxt);
  const hasWarn = Boolean(item.warn);
  const hasInfo = Boolean(item.info || item.infotxt);
  const hasGuide = Boolean(item.guiatxt);
  const hasBottomNotices = hasWarn || hasInfo || hasGuide;
  const imageArray = Array.isArray(item.Image) ? item.Image : (item.Image ? [item.Image] : []);
  const buttonLinks = Array.isArray(item.ButtonLink) ? item.ButtonLink : (item.ButtonLink ? [item.ButtonLink] : []);

  const detailsMeta = item.Category || item.Platforms ? `<div class="detail-meta">${item.Category ? `<span class="detail-category">${escapeHTML(item.Category)}</span>` : ''}${platformBadges(item.Platforms) ? `<div class="detail-platforms">${platformBadges(item.Platforms)}</div>` : ''}</div>` : '';

  let html = `<div class="detail-wrap">
    <a class="back" href="#/"><iconify-icon icon="solar:arrow-left-linear" aria-hidden="true"></iconify-icon> VOLTAR AO CATÁLOGO</a>
    ${hasRemoved ? `<div class="detail-removed">${marqueeBar('removed', item.removed || 'ESTE CONTEÚDO POSSUI UMA OBSERVAÇÃO', item.removedtxt || '')}</div>` : ''}
    <article class="detail">
      <header class="detail-head">
        ${detailsMeta}
        <h1 class="detail-title">${escapeHTML(item.Title)}</h1>
        <div class="detail-desc markdown">${markdownHTML(item.Description)}</div>
        ${buttonLinks.length ? `<div class="actions">
          ${buttonLinks.map((x,idx)=>`<a class="side-action" target="_blank" rel="noopener" href="${escapeHTML(x)}"><iconify-icon icon="solar:download-minimalistic-linear" aria-hidden="true"></iconify-icon><span>${escapeHTML(Array.isArray(item.ButtonLabel)?item.ButtonLabel[idx]:(item.ButtonLabel||'ABRIR LINK'))}</span></a>`).join('')}
        </div>` : ''}
      </header>
      <div class="detail-body">
        ${(item.text || item.content || item.notes) ? `<div class="section-block markdown">${markdownHTML(item.text || item.content || item.notes)}</div>` : ''}
        ${imageArray.length ? `<div class="section-block"><h3><iconify-icon icon="solar:gallery-linear" aria-hidden="true"></iconify-icon> Imagens</h3><div class="images">${imageArray.map(src=>`<img loading="lazy" src="${escapeHTML(src)}" alt="Imagem de ${escapeHTML(item.Title)}">`).join('')}</div></div>` : ''}
        ${hasBottomNotices ? '<div class="line-sep" role="separator"></div>' : ''}
        ${hasWarn ? detailBarWithFlip('warn', 'Este conteúdo possui um aviso.', item.warn) : ''}
        ${hasInfo ? detailBarWithFlip('info', item.info || 'INFORMAÇÃO', item.infotxt || item.info) : ''}
        ${hasGuide ? detailBarWithFlip('guia', item.guia || 'GUIA DE USO', item.guiatxt) : ''}
      </div>
    </article>
  </div>`;
  app.innerHTML = html;
  wireBars();
}

function wireBars() {
  document.querySelectorAll('[data-expand]').forEach(btn => {
    btn.addEventListener('click', e => {
      const key = btn.dataset.expand;
      const target = document.querySelector(`#expand-${key}`);
      if (!target) return;
      target.classList.toggle('open');
      const bar = target.closest('.dynamic-bar');
      if (bar) bar.classList.toggle('is-open', target.classList.contains('open'));
    });
  });
  document.querySelectorAll('[data-marquee]').forEach(track => {
    const clip = track.closest('.marquee-clip');
    const group = track.querySelector('.marquee-group');
    if (!clip || !group) return;
    requestAnimationFrame(() => {
      while (group.scrollWidth < clip.clientWidth + 100) {
        group.insertAdjacentHTML('beforeend', group.firstElementChild.outerHTML);
      }
      const duplicate = group.cloneNode(true);
      duplicate.setAttribute('aria-hidden', 'true');
      track.append(duplicate);
      track.style.setProperty('--marquee-duration', `${Math.max(8, group.scrollWidth / 42)}s`);
    });
  });
  document.querySelectorAll('.notice-copy').forEach(copy => {
    let showingLong = false;
    const fadeDuration = 250;
    setInterval(() => {
      const bar = copy.closest('.dynamic-bar');
      if (!bar || bar.classList.contains('is-open')) return;
      copy.classList.add('notice-exit');
      setTimeout(() => {
        if (bar.classList.contains('is-open')) {
          copy.classList.remove('notice-exit');
          return;
        }
        showingLong = !showingLong;
        copy.textContent = showingLong ? copy.dataset.long : copy.dataset.short;
        copy.classList.add('notice-prep', 'notice-enter');
        copy.classList.remove('notice-exit');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            copy.classList.remove('notice-prep');
            requestAnimationFrame(() => copy.classList.remove('notice-enter'));
          });
        });
      }, fadeDuration);
    }, 5600);
  });
}

async function route() {
  const hash = location.hash || '#/';
  if (hash === '#/' || hash === '#') return renderHome();
  const match = hash.match(/^#\/item\/(.+)$/);
  if (match) return renderDetail(decodeURIComponent(match[1]));
  return renderHome();
}

window.addEventListener('hashchange', route);
window.addEventListener('keydown', e=> { if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k') { e.preventDefault(); document.querySelector('#search')?.focus(); } });

(async()=>{ try { renderLoading(); setupPlayer(); await loadCatalog(); await route(); } catch { renderError('500'); } })();
