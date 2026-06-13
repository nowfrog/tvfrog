document.addEventListener('DOMContentLoaded', async () => {
const API = 'https://api.tvmaze.com';
const COLORS = { Favourites:'#ff3b30', Watchlist:'#34c759', Seen:'#007aff', 'To Finish':'#ff9500' };
const defaultColor = '#af52de';

// DOM refs
const nav = document.getElementById('nav');
const showsGrid = document.getElementById('shows');
const listsView = document.getElementById('lists-view');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const welcome = document.getElementById('welcome');
const scrollTop = document.getElementById('scroll-top');
const themeToggle = document.getElementById('theme-toggle');
const lockBtn = document.getElementById('lock-btn');
const lockPopup = document.getElementById('lock-popup');
const loginForm = document.getElementById('login-form');
const logoutForm = document.getElementById('logout-form');
const adminBar = document.getElementById('admin-bar');
const adminPanel = document.getElementById('admin-panel');
const manageBtn = document.getElementById('manage-btn');
const modal = document.getElementById('modal');

// State
let appData = { userLists: {}, followedShows: [], showData: {} };
let isAdmin = false;
let currentView = 'search';
let currentListName = null;
let currentModalShow = null;
let currentListShows = [];

// SVGs
const sunSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const moonSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
const lockSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>';
const unlockSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v1"/></svg>';

// Helpers
function getShow(id) { return appData.showData?.[String(id)] || null; }
const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatDate(d) { if (!d) return ''; const t = new Date(d+'T00:00:00'); return `${MN[t.getMonth()]} ${t.getDate()}, ${t.getFullYear()}`; }

// ===== DATA =====
async function loadData() {
    try {
        const r = await fetch(`data/app_data.json?v=${Date.now()}`);
        if (r.ok) appData = await r.json();
        if (!appData.showData) appData.showData = {};
    } catch (e) {}
    buildNav();
}

async function saveData() {
    try {
        const r = await fetch('admin/api/data_handler.php', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(appData)
        });
        return (await r.json()).success;
    } catch (e) { return false; }
}

// Fetch full show data from API and store in showData
async function fetchAndStoreShow(showId) {
    try {
        const [show, castRaw, eps] = await Promise.all([
            fetch(`${API}/shows/${showId}`).then(r => r.ok ? r.json() : null),
            fetch(`${API}/shows/${showId}/cast`).then(r => r.ok ? r.json() : []),
            fetch(`${API}/shows/${showId}/episodes`).then(r => r.ok ? r.json() : [])
        ]);
        if (!show) return null;

        const cast = castRaw.slice(0, 12).map(c => ({
            id: c.person?.id, name: c.person?.name || '',
            character: c.character?.name || '',
            image: c.person?.image?.medium
        }));

        const seasons = new Set();
        eps.forEach(ep => { if (ep?.season) seasons.add(ep.season); });

        const entry = {
            id: show.id, name: show.name || '', image: show.image,
            genres: show.genres || [], premiered: show.premiered, ended: show.ended,
            status: show.status, runtime: show.runtime, averageRuntime: show.averageRuntime,
            network: show.network?.name || show.webChannel?.name || null,
            country: show.network?.country?.code || show.webChannel?.country?.code || null,
            rating: show.rating?.average, summary: show.summary || '', url: show.url || '',
            cast, episodeCount: eps.length, seasonCount: seasons.size
        };

        // Preserve existing added_date or set new one
        const existing = appData.showData[String(show.id)];
        if (existing?.added_date) entry.added_date = existing.added_date;
        else entry.added_date = new Date().toISOString().substring(0, 10);

        appData.showData[String(show.id)] = entry;
        return entry;
    } catch (e) { return null; }
}

// ===== THEME =====
function initTheme() {
    const saved = localStorage.getItem('tvfrog-theme');
    if (saved === 'dark' || (!saved && matchMedia('(prefers-color-scheme:dark)').matches)) document.body.classList.add('dark');
    updateThemeIcon();
}
function updateThemeIcon() {
    const isDark = document.body.classList.contains('dark');
    themeToggle.innerHTML = isDark ? sunSvg : moonSvg;
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove());
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = isDark ? '#000000' : '#f2f2f7';
    document.head.appendChild(meta);
}
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('tvfrog-theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    updateThemeIcon();
});

// ===== AUTH =====
lockBtn.addEventListener('click', e => { e.stopPropagation(); lockPopup.classList.toggle('hidden'); });
document.addEventListener('click', e => { if (!lockPopup.contains(e.target) && !lockBtn.contains(e.target)) lockPopup.classList.add('hidden'); });

document.getElementById('login-btn').addEventListener('click', async () => {
    const pwd = document.getElementById('admin-pwd').value.trim();
    if (!pwd) return;
    try {
        const r = await fetch('admin/api/auth.php', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', password: pwd })
        });
        const d = await r.json();
        if (d.success) {
            isAdmin = true; lockBtn.innerHTML = unlockSvg;
            loginForm.classList.add('hidden'); logoutForm.classList.remove('hidden');
            lockPopup.classList.add('hidden'); adminBar.classList.remove('hidden');
            document.getElementById('refresh-all-btn').classList.remove('hidden');
            buildNav();
        } else {
            document.getElementById('admin-pwd').value = '';
            document.getElementById('admin-pwd').placeholder = 'Wrong password!';
            setTimeout(() => document.getElementById('admin-pwd').placeholder = 'Password...', 2000);
        }
    } catch (e) {
        document.getElementById('admin-pwd').placeholder = 'Connection error!';
        setTimeout(() => document.getElementById('admin-pwd').placeholder = 'Password...', 2000);
    }
});
document.getElementById('admin-pwd').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('login-btn').click(); });

document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('admin/api/auth.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
    isAdmin = false; lockBtn.innerHTML = lockSvg;
    loginForm.classList.remove('hidden'); logoutForm.classList.add('hidden');
    lockPopup.classList.add('hidden'); adminBar.classList.add('hidden'); adminPanel.classList.add('hidden');
    document.getElementById('refresh-all-btn').classList.add('hidden');
    document.getElementById('admin-pwd').value = '';
    buildNav();
});

manageBtn.addEventListener('click', () => {
    adminPanel.classList.toggle('hidden');
    manageBtn.textContent = adminPanel.classList.contains('hidden') ? 'Manage Shows' : 'Hide Panel';
    if (!adminPanel.classList.contains('hidden')) populateAdminLists();
});

// ===== NAV =====
function getListColor(name) { return COLORS[name] || defaultColor; }

function buildNav() {
    nav.innerHTML = '';
    const mk = (text, view, extra) => {
        const b = document.createElement('button'); b.className = 'nav-pill'; b.dataset.view = view;
        b.textContent = text; if (extra) Object.assign(b.style, extra);
        return b;
    };

    const sp = mk('Search', 'search'); sp.classList.add('active');
    sp.addEventListener('click', () => switchView('search', sp)); nav.appendChild(sp);

    if ((appData.followedShows || []).length > 0 || isAdmin) {
        const fp = mk(`Following (${(appData.followedShows||[]).length})`, 'following');
        fp.addEventListener('click', () => switchView('following', fp)); nav.appendChild(fp);
    }

    const cp = mk('Calendar', 'calendar');
    cp.addEventListener('click', () => switchView('calendar', cp)); nav.appendChild(cp);

    const order = ['Favourites', 'Watchlist', 'Seen', 'To Finish'];
    const listNames = Object.keys(appData.userLists);
    const sorted = [...order.filter(n => listNames.includes(n)), ...listNames.filter(n => !order.includes(n))];
    sorted.forEach(name => {
        const btn = mk(name, 'list');
        btn.addEventListener('click', () => switchView('list', btn, name)); nav.appendChild(btn);
    });
}

function switchView(view, btn, listName) {
    currentView = view; currentListName = listName || null;
    nav.querySelectorAll('.nav-pill').forEach(b => { b.classList.remove('active'); b.style.background = ''; b.style.color = ''; b.style.borderColor = ''; });
    btn.classList.add('active');

    if (view === 'list') { const c = getListColor(listName); btn.style.background = c; btn.style.color = '#fff'; btn.style.borderColor = 'transparent'; }
    else if (view === 'calendar') { btn.style.background = '#5856d6'; btn.style.color = '#fff'; btn.style.borderColor = 'transparent'; }
    else if (view === 'following') { btn.style.background = '#af52de'; btn.style.color = '#fff'; btn.style.borderColor = 'transparent'; }

    welcome.classList.add('hidden'); showsGrid.innerHTML = ''; listsView.classList.add('hidden');
    document.getElementById('calendar-view').classList.add('hidden');
    document.getElementById('following-view').classList.add('hidden');
    document.getElementById('list-filter').classList.add('hidden');
    error.classList.add('hidden');

    if (view === 'search') { document.querySelector('.search-bar').style.display = 'flex'; }
    else if (view === 'calendar') { document.querySelector('.search-bar').style.display = 'none'; showCalendar(); }
    else if (view === 'following') { document.querySelector('.search-bar').style.display = 'none'; showFollowing(); }
    else { document.querySelector('.search-bar').style.display = 'none'; displayList(listName); }
}

// ===== SEARCH (live API) =====
async function performSearch() {
    const q = searchInput.value.trim(); if (!q) return;
    showsGrid.innerHTML = ''; loading.classList.remove('hidden'); welcome.classList.add('hidden'); error.classList.add('hidden');
    try {
        const r = await fetch(`${API}/search/shows?q=${encodeURIComponent(q)}`);
        const results = await r.json(); loading.classList.add('hidden');
        if (!results.length) { showsGrid.innerHTML = '<p class="no-results">No results found.</p>'; return; }
        results.forEach(item => { if (item.show) showsGrid.appendChild(createCard(item.show)); });
    } catch (e) { loading.classList.add('hidden'); error.textContent = 'Search failed.'; error.classList.remove('hidden'); }
}
searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') performSearch(); });

// ===== DISPLAY LIST (from local data) =====
async function displayList(name) {
    const ids = appData.userLists[name] || [];
    const listFilter = document.getElementById('list-filter');
    const filterInput = document.getElementById('list-filter-input');
    if (!ids.length) { showsGrid.innerHTML = `<p class="no-results">"${name}" is empty.</p>`; listFilter.classList.add('hidden'); return; }

    listFilter.classList.remove('hidden'); filterInput.value = '';
    currentListShows = [];

    // Try local data first, fetch missing ones
    let needsFetch = false;
    for (const id of ids) {
        const s = getShow(id);
        if (s) { currentListShows.push(s); }
        else { needsFetch = true; }
    }

    if (needsFetch) {
        loading.classList.remove('hidden');
        for (const id of ids) {
            if (!getShow(id)) {
                const s = await fetchAndStoreShow(id);
                if (s) currentListShows.push(s);
            }
        }
        await saveData();
        loading.classList.add('hidden');
    }

    renderFilteredList('');
}

let currentSort = '';

function renderFilteredList(query) {
    showsGrid.innerHTML = '';
    const q = (query || '').toLowerCase();
    let filtered = q ? currentListShows.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.genres || []).some(g => g.toLowerCase().includes(q)) ||
        (s.premiered && s.premiered.substring(0,4).includes(q)) ||
        (s.network && s.network.toLowerCase().includes(q))
    ) : [...currentListShows];

    // Sort
    if (currentSort) {
        filtered.sort((a, b) => {
            switch (currentSort) {
                case 'name-asc': return (a.name || '').localeCompare(b.name || '');
                case 'name-desc': return (b.name || '').localeCompare(a.name || '');
                case 'year-desc': return (b.premiered || '').localeCompare(a.premiered || '');
                case 'year-asc': return (a.premiered || '').localeCompare(b.premiered || '');
                case 'rating-desc': return (b.rating || 0) - (a.rating || 0);
                case 'rating-asc': return (a.rating || 0) - (b.rating || 0);
                case 'eps-desc': return (b.episodeCount || 0) - (a.episodeCount || 0);
                case 'eps-asc': return (a.episodeCount || 0) - (b.episodeCount || 0);
                case 'added-desc': return (b.added_date || '').localeCompare(a.added_date || '');
                case 'added-asc': return (a.added_date || '').localeCompare(b.added_date || '');
                default: return 0;
            }
        });
    }

    if (!filtered.length) { showsGrid.innerHTML = '<p class="no-results">No matches.</p>'; return; }
    filtered.forEach(show => showsGrid.appendChild(createCardLocal(show)));
}

document.getElementById('list-filter-input').addEventListener('input', e => { if (currentView === 'list') renderFilteredList(e.target.value); });
document.getElementById('list-sort').addEventListener('change', e => { currentSort = e.target.value; if (currentView === 'list') renderFilteredList(document.getElementById('list-filter-input').value); });

// ===== CARDS =====
// Card from API result (search)
function createCard(show) {
    const card = document.createElement('div'); card.className = 'show-card';
    const img = document.createElement('img');
    img.src = show.image?.medium || ''; img.alt = show.name; img.loading = 'lazy'; card.appendChild(img);
    const info = document.createElement('div'); info.className = 'show-card-info';
    info.innerHTML = `<div class="show-card-title">${show.name}</div><div class="show-card-meta">${show.premiered?.substring(0,4)||''}</div>`;
    // Tags
    const tags = document.createElement('div'); tags.className = 'show-card-tags';
    Object.keys(appData.userLists).forEach(ln => { if (appData.userLists[ln].includes(show.id)) { const t = document.createElement('span'); t.className = 'show-tag'; t.textContent = ln; t.style.backgroundColor = getListColor(ln); tags.appendChild(t); }});
    if (tags.children.length) info.appendChild(tags);
    card.appendChild(info);
    card.addEventListener('click', () => openModal(show.id));
    return card;
}

// Card from local data
function createCardLocal(show) {
    const card = document.createElement('div'); card.className = 'show-card';
    const img = document.createElement('img');
    img.src = show.image?.medium || show.image?.original || ''; img.alt = show.name; img.loading = 'lazy'; card.appendChild(img);
    const info = document.createElement('div'); info.className = 'show-card-info';
    const year = show.premiered ? show.premiered.substring(0,4) : '';
    const rt = show.averageRuntime || show.runtime;
    const net = show.network || '';
    const addedStr = show.added_date ? formatDate(show.added_date) : '';
    info.innerHTML = `<div class="show-card-title">${show.name}</div><div class="show-card-meta">${year}${rt?' · '+rt+'m':''}${net?' · '+net:''}</div>${addedStr?'<div class="show-card-added">Added '+addedStr+'</div>':''}`;
    const tags = document.createElement('div'); tags.className = 'show-card-tags';
    Object.keys(appData.userLists).forEach(ln => { if (appData.userLists[ln].includes(show.id)) { const t = document.createElement('span'); t.className = 'show-tag'; t.textContent = ln; t.style.backgroundColor = getListColor(ln); tags.appendChild(t); }});
    if (tags.children.length) info.appendChild(tags);
    card.appendChild(info);
    card.addEventListener('click', () => openModal(show.id));
    return card;
}

// ===== MODAL =====
async function openModal(showId) {
    let show = getShow(showId);
    let cast = show?.cast || [];
    let episodes = [];

    if (!show) {
        // Not in local data — need to fetch, show loading
        loading.classList.remove('hidden');
        show = await fetchAndStoreShow(showId);
        if (show) cast = show.cast || [];
        loading.classList.add('hidden');
        if (!show) return;
    }

    // Show modal immediately with local data
    currentModalShow = { ...show, _episodes: [] };
    renderModal(show, [], cast);

    // Fetch episodes in background (for next episode + episode list)
    try {
        episodes = await fetch(`${API}/shows/${showId}/episodes?specials=1`).then(r => r.ok ? r.json() : []);
        currentModalShow._episodes = episodes;
        // Update next episode and episode list without re-rendering whole modal
        const nextEl = document.getElementById('m-next');
        const nextInfo = calcNextEp(episodes);
        if (nextInfo) { nextEl.textContent = nextInfo; nextEl.classList.remove('hidden'); }
        else { nextEl.classList.add('hidden'); }
        renderEpisodes(episodes);
    } catch (e) {}
}

function renderModal(show, episodes, cast) {
    document.getElementById('m-poster').src = show.image?.medium || show.image?.original || '';
    document.getElementById('m-title').textContent = show.name;
    const year = show.premiered ? show.premiered.substring(0,4) : '';
    const rt = show.averageRuntime || show.runtime;
    const net = show.network || '';
    const parts = [year, rt ? rt+'m' : '', show.status, net, show.episodeCount ? show.episodeCount+' eps' : '', show.seasonCount ? show.seasonCount+' seasons' : ''].filter(Boolean);
    document.getElementById('m-meta').textContent = parts.join(' · ');

    // Tags
    const tagsEl = document.getElementById('m-tags'); tagsEl.innerHTML = '';
    Object.keys(appData.userLists).forEach(name => {
        if (appData.userLists[name].includes(show.id)) {
            const t = document.createElement('span'); t.className = 'show-tag'; t.textContent = name;
            t.style.backgroundColor = getListColor(name); tagsEl.appendChild(t);
        }
    });

    // Next episode
    const nextEl = document.getElementById('m-next');
    const nextInfo = calcNextEp(episodes);
    if (nextInfo) { nextEl.textContent = nextInfo; nextEl.classList.remove('hidden'); }
    else { nextEl.classList.add('hidden'); }

    document.getElementById('m-summary').innerHTML = show.summary || 'No summary available.';
    document.getElementById('m-tvmaze').href = show.url || '#';

    // Follow button
    const followBtn = document.getElementById('m-follow-btn');
    const isFollowed = (appData.followedShows || []).includes(show.id);
    followBtn.textContent = isFollowed ? 'Following' : 'Follow';
    followBtn.className = 'm-follow-btn ' + (isFollowed ? 'following' : 'not-following');

    document.getElementById('m-admin-actions').classList.toggle('hidden', !isAdmin);
    document.getElementById('m-list-popup').classList.add('hidden');

    // Cast
    const castEl = document.getElementById('m-cast');
    const castSection = document.getElementById('m-cast-section');
    castEl.innerHTML = '';
    if (cast && cast.length > 0) {
        cast.forEach(c => {
            const item = document.createElement('div'); item.className = 'm-cast-item';
            item.innerHTML = `<img src="${c.image || ''}" alt="${c.name}" loading="lazy"><div class="m-cast-name">${c.name}</div><div class="m-cast-char">${c.character}</div>`;
            castEl.appendChild(item);
        });
        castSection.classList.remove('hidden');
    } else { castSection.classList.add('hidden'); }

    // Episodes
    renderEpisodes(episodes);
    modal.classList.remove('hidden'); document.body.classList.add('modal-open');
}

function renderEpisodes(episodes) {
    const el = document.getElementById('m-episodes-list'); el.innerHTML = '';
    if (!episodes.length) { el.innerHTML = '<div class="ep-item">No episode info.</div>'; return; }
    const seasons = {};
    episodes.forEach(ep => { if (!ep) return; const s = ep.season || 0; if (!seasons[s]) seasons[s] = []; seasons[s].push(ep); });
    Object.keys(seasons).sort((a,b) => +a - +b).forEach(sNum => {
        const h = document.createElement('div'); h.className = 'season-header';
        h.textContent = sNum == 0 ? 'Specials' : `Season ${sNum}`; el.appendChild(h);
        seasons[sNum].forEach(ep => {
            const d = document.createElement('a'); d.className = 'ep-item';
            d.href = ep.url || '#'; d.target = '_blank'; d.rel = 'noopener noreferrer';
            const num = String(ep.number).padStart(2,'0');
            d.textContent = `E${num}${ep.name?': '+ep.name:''}${ep.airdate?' ('+ep.airdate+')':''}`;
            el.appendChild(d);
        });
    });
}

function calcNextEp(episodes) {
    if (!episodes || !episodes.length) return null;
    const now = new Date(); let next = null;
    for (const ep of episodes) {
        if (!ep) continue;
        let d = ep.airstamp ? new Date(ep.airstamp) : ep.airdate ? new Date(ep.airdate) : null;
        if (d && d > now && (!next || d < new Date(next.airstamp || next.airdate))) next = ep;
    }
    if (!next) return null;
    const d = new Date(next.airstamp || next.airdate);
    const days = Math.ceil((d - now) / 864e5);
    const ep = `S${String(next.season).padStart(2,'0')}E${String(next.number).padStart(2,'0')}`;
    const name = next.name ? `: ${next.name}` : '';
    if (days > 1) return `Next: ${ep}${name} in ${days} days`;
    if (days === 1) return `Next: ${ep}${name} tomorrow`;
    return `Next: ${ep}${name} today!`;
}

function closeModal() {
    modal.classList.add('hidden'); document.body.classList.remove('modal-open');
    currentModalShow = null;
    document.getElementById('m-poster').src = '';
    document.getElementById('m-episodes-list').innerHTML = '';
    document.getElementById('m-cast').innerHTML = '';
    document.getElementById('m-cast-section').classList.add('hidden');
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', closeModal);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal(); });

// Share
document.getElementById('m-share').addEventListener('click', async () => {
    if (!currentModalShow) return;
    const s = currentModalShow;
    const text = `${s.name} (${s.premiered?.substring(0,4)||''})\n${(s.summary||'').replace(/<[^>]*>/g,'')}`;
    if (navigator.share) { try { await navigator.share({ title: s.name, text, url: s.url }); } catch (e) {} }
    else { try { await navigator.clipboard.writeText(text + '\n' + (s.url||'')); } catch (e) {} }
});

// Follow
document.getElementById('m-follow-btn').addEventListener('click', async () => {
    if (!currentModalShow) return;
    if (!appData.followedShows) appData.followedShows = [];
    const id = currentModalShow.id;
    const idx = appData.followedShows.indexOf(id);
    if (idx >= 0) appData.followedShows.splice(idx, 1); else appData.followedShows.push(id);
    await saveData();
    const btn = document.getElementById('m-follow-btn');
    const f = appData.followedShows.includes(id);
    btn.textContent = f ? 'Following' : 'Follow';
    btn.className = 'm-follow-btn ' + (f ? 'following' : 'not-following');
    buildNav();
});

// Add to list
document.getElementById('m-add-to-list').addEventListener('click', () => {
    const popup = document.getElementById('m-list-popup');
    const opts = document.getElementById('m-list-options');
    opts.innerHTML = ''; popup.querySelector('.m-list-popup-title').textContent = 'Add to list:';
    Object.keys(appData.userLists).forEach(name => {
        if (appData.userLists[name].includes(currentModalShow.id)) return;
        const btn = document.createElement('button'); btn.className = 'm-list-opt'; btn.textContent = name;
        btn.style.backgroundColor = getListColor(name);
        btn.addEventListener('click', async () => {
            appData.userLists[name].push(currentModalShow.id);
            // Ensure show data is stored
            if (!getShow(currentModalShow.id)) await fetchAndStoreShow(currentModalShow.id);
            await saveData(); popup.classList.add('hidden');
            renderModal(currentModalShow, currentModalShow._episodes || [], currentModalShow.cast || getShow(currentModalShow.id)?.cast || []);
            buildNav();
        });
        opts.appendChild(btn);
    });
    popup.classList.remove('hidden');
});

document.getElementById('m-list-cancel').addEventListener('click', () => document.getElementById('m-list-popup').classList.add('hidden'));

// Remove from list
document.getElementById('m-remove-from').addEventListener('click', async () => {
    if (!currentModalShow) return;
    if (currentView === 'list' && currentListName) {
        const list = appData.userLists[currentListName];
        if (!list || !list.includes(currentModalShow.id)) return;
        if (!confirm(`Remove "${currentModalShow.name}" from "${currentListName}"?`)) return;
        appData.userLists[currentListName] = list.filter(id => id !== currentModalShow.id);
        await saveData(); closeModal(); showsGrid.innerHTML = ''; displayList(currentListName); buildNav(); return;
    }
    const popup = document.getElementById('m-list-popup');
    const opts = document.getElementById('m-list-options');
    opts.innerHTML = ''; popup.querySelector('.m-list-popup-title').textContent = 'Remove from:';
    let found = false;
    Object.keys(appData.userLists).forEach(name => {
        if (!appData.userLists[name].includes(currentModalShow.id)) return; found = true;
        const btn = document.createElement('button'); btn.className = 'm-list-opt'; btn.textContent = name;
        btn.style.backgroundColor = getListColor(name);
        btn.addEventListener('click', async () => {
            appData.userLists[name] = appData.userLists[name].filter(id => id !== currentModalShow.id);
            await saveData(); popup.classList.add('hidden');
            renderModal(currentModalShow, currentModalShow._episodes || [], currentModalShow.cast || getShow(currentModalShow.id)?.cast || []);
            buildNav();
        });
        opts.appendChild(btn);
    });
    if (!found) opts.innerHTML = '<p style="color:var(--text2);font-size:.85em;padding:4px">Not in any list.</p>';
    popup.classList.remove('hidden');
});

// ===== FOLLOWING =====
async function showFollowing() {
    const view = document.getElementById('following-view'); view.classList.remove('hidden');
    const ids = appData.followedShows || [];
    if (!ids.length) { view.innerHTML = '<p class="cal-no-data">Not following any shows yet.</p>'; return; }
    view.innerHTML = '';
    for (const id of ids) {
        let show = getShow(id);
        if (!show) { show = await fetchAndStoreShow(id); if (!show) continue; }
        const card = document.createElement('div'); card.className = 'follow-card';
        const img = document.createElement('img'); img.src = show.image?.medium || ''; img.loading = 'lazy';
        img.addEventListener('click', (e) => { e.stopPropagation(); openModal(show.id); }); card.appendChild(img);
        const info = document.createElement('div'); info.className = 'follow-card-info';
        info.innerHTML = `<div class="follow-card-name">${show.name}</div><div class="follow-card-status">${show.premiered?.substring(0,4)||''} · ${show.status||''}</div>`;
        info.querySelector('.follow-card-name').addEventListener('click', (e) => { e.stopPropagation(); openModal(show.id); });
        card.appendChild(info);
        if (isAdmin) {
            const unfBtn = document.createElement('button'); unfBtn.className = 'unfollow-btn'; unfBtn.textContent = 'Unfollow';
            unfBtn.addEventListener('click', async () => {
                appData.followedShows = appData.followedShows.filter(i => i !== show.id);
                await saveData(); card.remove(); buildNav();
                if (!view.children.length) view.innerHTML = '<p class="cal-no-data">Not following any shows.</p>';
            });
            card.appendChild(unfBtn);
        }
        view.appendChild(card);
    }
}

// ===== CALENDAR (live API for next episodes only) =====
async function showCalendar() {
    const calView = document.getElementById('calendar-view'); calView.classList.remove('hidden');
    const followedIds = appData.followedShows || [];
    if (!followedIds.length) { calView.innerHTML = '<p class="cal-no-data">No shows followed. Follow shows to see upcoming episodes.</p>'; return; }

    calView.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    const entries = []; const now = new Date();

    // Fetch episodes live for accuracy, but use local data for show info
    for (let i = 0; i < followedIds.length; i += 10) {
        const batch = followedIds.slice(i, i + 10);
        await Promise.all(batch.map(async id => {
            let show = getShow(id);
            if (!show) show = await fetchAndStoreShow(id);
            if (!show) return;
            try {
                const eps = await fetch(`${API}/shows/${id}/episodes?specials=1`).then(r => r.ok ? r.json() : []);
                let nextEp = null;
                for (const ep of eps) { if (!ep) continue; const d = ep.airstamp ? new Date(ep.airstamp) : ep.airdate ? new Date(ep.airdate) : null; if (d && d > now && (!nextEp || d < new Date(nextEp.airstamp||nextEp.airdate))) nextEp = ep; }
                if (nextEp) entries.push({ show, nextEp });
            } catch (e) {}
        }));
        if (i + 10 < followedIds.length) await new Promise(r => setTimeout(r, 200));
    }

    entries.sort((a,b) => new Date(a.nextEp.airstamp||a.nextEp.airdate) - new Date(b.nextEp.airstamp||b.nextEp.airdate));
    calView.innerHTML = '';
    if (!entries.length) { calView.innerHTML = '<p class="cal-no-data">No upcoming episodes for your followed shows.</p>'; return; }

    entries.forEach(({ show, nextEp }) => {
        const card = document.createElement('div'); card.className = 'cal-card';
        const img = document.createElement('img'); img.className = 'cal-poster'; img.src = show.image?.medium || ''; img.loading = 'lazy'; card.appendChild(img);
        const info = document.createElement('div'); info.className = 'cal-info';
        const epStr = `S${String(nextEp.season).padStart(2,'0')}E${String(nextEp.number).padStart(2,'0')}`;
        info.innerHTML = `<div class="cal-show-name">${show.name}</div><div class="cal-ep">${epStr}${nextEp.name?': '+nextEp.name:''} · ${nextEp.airdate||''}</div>`;
        card.appendChild(info);
        const d = new Date(nextEp.airstamp || nextEp.airdate); const days = Math.ceil((d - now) / 864e5);
        const countdown = document.createElement('div'); countdown.className = 'cal-countdown';
        if (days === 0) { countdown.innerHTML = '<div class="cal-days" style="color:var(--green)">TODAY</div>'; card.classList.add('cal-today'); }
        else if (days === 1) { countdown.innerHTML = '<div class="cal-days">TMR</div>'; }
        else { countdown.innerHTML = `<div class="cal-days">${days}</div><div class="cal-days-label">days</div>`; }
        card.appendChild(countdown);
        card.addEventListener('click', () => openModal(show.id));
        calView.appendChild(card);
    });
}

// ===== ADMIN PANEL =====
function populateAdminLists() {
    // Populate delete dropdown with deletable lists
    const sel = document.getElementById('adm-delete-select');
    sel.innerHTML = '<option value="" disabled selected>Select list to delete...</option>';
    Object.keys(appData.userLists).forEach(name => {
        if (['Favourites', 'Watchlist'].includes(name)) return; // Protected
        const o = document.createElement('option'); o.value = name; o.textContent = name;
        sel.appendChild(o);
    });
}

document.getElementById('adm-action').addEventListener('change', function() {
    const action = this.value;
    document.getElementById('adm-new-fields').classList.add('hidden');
    document.getElementById('adm-delete-fields').classList.add('hidden');
    document.getElementById('adm-submit').classList.add('hidden');
    document.getElementById('adm-msg').classList.add('hidden');

    if (action === 'create') {
        document.getElementById('adm-new-fields').classList.remove('hidden');
        document.getElementById('adm-submit').classList.remove('hidden');
    } else if (action === 'delete') {
        document.getElementById('adm-delete-fields').classList.remove('hidden');
        document.getElementById('adm-submit').classList.remove('hidden');
        populateAdminLists();
    }
});

document.getElementById('adm-submit').addEventListener('click', async () => {
    const action = document.getElementById('adm-action').value;
    if (action === 'create') {
        const n = document.getElementById('adm-new-name').value.trim();
        if (!n) { showAdmMsg('Enter a name.', false); return; }
        if (appData.userLists[n]) { showAdmMsg('Already exists.', false); return; }
        appData.userLists[n] = [];
        if (await saveData()) { showAdmMsg(`Created "${n}"!`, true); buildNav(); }
    } else if (action === 'delete') {
        const listName = document.getElementById('adm-delete-select').value;
        if (!listName) { showAdmMsg('Select a list.', false); return; }
        if (!confirm(`Delete "${listName}" and all its shows?`)) return;
        delete appData.userLists[listName];
        if (await saveData()) { showAdmMsg(`Deleted "${listName}".`, true); buildNav(); populateAdminLists(); }
    }
});

function showAdmMsg(msg, ok) {
    const el = document.getElementById('adm-msg'); el.textContent = msg;
    el.className = 'adm-msg ' + (ok ? 'ok' : 'err'); el.classList.remove('hidden');
}

// Refresh all show data
document.getElementById('refresh-all-btn').addEventListener('click', async () => {
    if (!isAdmin) return;
    const btn = document.getElementById('refresh-all-btn');
    if (!confirm(`Refresh all ${Object.keys(appData.showData || {}).length} shows? This may take a minute.`)) return;

    btn.style.opacity = '0.3';
    btn.style.pointerEvents = 'none';
    const ids = Object.keys(appData.showData || {});
    let done = 0;

    for (let i = 0; i < ids.length; i += 8) {
        const batch = ids.slice(i, i + 8);
        await Promise.all(batch.map(id => fetchAndStoreShow(parseInt(id))));
        done += batch.length;
        btn.title = `Refreshing... ${done}/${ids.length}`;
        if (i + 8 < ids.length) await new Promise(r => setTimeout(r, 400));
    }

    await saveData();
    btn.style.opacity = '';
    btn.style.pointerEvents = '';
    btn.title = 'Refresh all show data';
    alert(`Refreshed ${ids.length} shows!`);
});

// Horizontal scroll with mouse wheel for cast
document.addEventListener('wheel', e => {
    const cast = document.getElementById('m-cast');
    if (cast && cast.contains(e.target)) {
        e.preventDefault();
        cast.scrollLeft += e.deltaY;
    }
}, { passive: false });

// ===== SCROLL =====
window.addEventListener('scroll', () => { scrollTop.classList.toggle('visible', window.scrollY > 300); }, { passive: true });
scrollTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// ===== INIT =====
initTheme();
lockBtn.innerHTML = lockSvg;
await loadData();
});
