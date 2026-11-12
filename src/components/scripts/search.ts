/**
 * Client-side search for /search/.
 *
 * The whole index (title/artist/members/album/lyrics/romanization/translation)
 * is built at build time (src/pages/search-index.json.ts) and fetched once.
 * Matching is accent-insensitive (the index is pre-normalised) and supports
 * AND of tokens plus the artist / language / category / year / member filters.
 */
import { searchArtists, searchMembers, searchSongs, type SearchFilters, type SearchIndex, type ScoredSong } from '../../lib/search-core';

const DEBOUNCE_MS = 200;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface State {
  q: string;
  artistId: string;
  language: string;
  categoryId: string;
  year: string;
  memberId: string;
}

function stateFromUrl(): State {
  const params = new URLSearchParams(window.location.search);
  return {
    q: params.get('q') ?? '',
    artistId: params.get('artist') ?? '',
    language: params.get('language') ?? '',
    categoryId: params.get('category') ?? '',
    year: params.get('year') ?? '',
    memberId: params.get('member') ?? '',
  };
}

function urlFor(state: State): string {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.artistId) params.set('artist', state.artistId);
  if (state.language) params.set('language', state.language);
  if (state.categoryId) params.set('category', state.categoryId);
  if (state.year) params.set('year', state.year);
  if (state.memberId) params.set('member', state.memberId);
  const qs = params.toString();
  return `/search/${qs ? `?${qs}` : ''}`;
}

export function initSearch(): void {
  const root = document.querySelector<HTMLElement>('[data-search-root]');
  if (!root) return;

  const input = root.querySelector<HTMLInputElement>('[data-search-input]');
  const results = root.querySelector<HTMLElement>('[data-search-results]');
  const count = root.querySelector<HTMLElement>('[data-search-count]');
  const artistSel = root.querySelector<HTMLSelectElement>('[data-filter="artist"]');
  const languageSel = root.querySelector<HTMLSelectElement>('[data-filter="language"]');
  const categorySel = root.querySelector<HTMLSelectElement>('[data-filter="category"]');
  const yearSel = root.querySelector<HTMLSelectElement>('[data-filter="year"]');
  const memberSel = root.querySelector<HTMLSelectElement>('[data-filter="member"]');

  let index: SearchIndex | null = null;
  let state: State = stateFromUrl();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const filters: () => SearchFilters = () => ({
    artistId: state.artistId || undefined,
    language: state.language || undefined,
    categoryId: state.categoryId || undefined,
    year: state.year || undefined,
    memberId: state.memberId || undefined,
  });

  function songHtml(r: ScoredSong): string {
    const matchedLabel: Record<string, string> = {
      title: 'title', artist: 'artist', members: 'member', album: 'album',
      lyrics: 'lyrics', romanization: 'romanization', translation: 'translation', filter: 'filters',
    };
    return `<li>
      <a class="search-row" href="${escapeHtml(r.song.url)}">
        ${r.song.cover
          ? `<img src="${escapeHtml(r.song.cover)}" alt="" loading="lazy" width="84" height="55" />`
          : `<span class="search-row-fallback flex items-center justify-center text-xl font-bold" style="color:var(--muted)" aria-hidden="true">${escapeHtml(r.song.title.charAt(0))}</span>`}
        <span class="min-w-0">
          <span class="search-row-title">${escapeHtml(r.song.title)}</span>
          <span class="meta block truncate">
            ${escapeHtml(r.song.artist)}${r.song.album ? ` · ${escapeHtml(r.song.album)}` : ''}${r.song.year ? ` · ${escapeHtml(r.song.year)}` : ''}
          </span>
          <span class="meta block">
            ${state.q ? `Matched in: <strong>${matchedLabel[r.matchedIn] ?? r.matchedIn}</strong>` : 'Newest first'}
          </span>
        </span>
      </a>
    </li>`;
  }

  function render(): void {
    if (!index || !results) return;
    const songs = searchSongs(index, state.q, filters(), 50);
    const artists = searchArtists(index, state.q, 5);
    const members = searchMembers(index, state.q, 5);

    const parts: string[] = [];
    if (state.q.trim()) {
      if (artists.length > 0) {
        parts.push(`<p class="meta mb-2">Artists &amp; members</p>
          <ul class="mb-4 flex flex-wrap gap-2">
            ${artists.map((a) => `<li><a class="badge hover:border-accent hover:text-accent" href="${escapeHtml(a.url)}">${escapeHtml(a.name)}</a></li>`).join('')}
            ${members.map((m) => `<li><a class="badge hover:border-accent hover:text-accent" href="${escapeHtml(m.url)}"><span class="swatch mr-1" style="background:${escapeHtml(m.color)}"></span>${escapeHtml(m.name)} <span class="text-muted">(${escapeHtml(m.artist)})</span></a></li>`).join('')}
          </ul>`);
      }
    }
    parts.push(`<ul class="space-y-2">
      ${songs.map(songHtml).join('')}
      ${songs.length === 0 ? `<li class="surface p-4 text-[0.9375rem] text-muted">No results${state.q ? ` for “${escapeHtml(state.q)}”` : ''}. Try fewer keywords — search is accent-insensitive.</li>` : ''}
    </ul>`);
    results.innerHTML = parts.join('');
    if (count) {
      count.textContent = songs.length === 0 ? '0 songs' : `${songs.length} song${songs.length === 1 ? '' : 's'}` + (songs.length === 50 ? ' (showing first 50)' : '');
    }
  }

  function syncInputs(): void {
    if (input) input.value = state.q;
    if (artistSel) artistSel.value = state.artistId;
    if (languageSel) languageSel.value = state.language;
    if (categorySel) categorySel.value = state.categoryId;
    if (yearSel) yearSel.value = state.year;
    if (memberSel) memberSel.value = state.memberId;
  }

  function apply(next: Partial<State>, push = true): void {
    state = { ...state, ...next };
    if (push) window.history.replaceState(null, '', urlFor(state));
    syncInputs();
    render();
  }

  // Populate filter options from the index.
  function populate(): void {
    if (!index) return;
    if (artistSel) artistSel.innerHTML = `<option value="">All artists</option>` + index.artists.map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`).join('');
    if (languageSel) languageSel.innerHTML = `<option value="">All languages</option>` + index.languages.map((l) => `<option value="${escapeHtml(l.id)}">${escapeHtml(l.name)}</option>`).join('');
    if (categorySel) categorySel.innerHTML = `<option value="">All categories</option>` + index.categories.map((cat) => `<option value="${escapeHtml(cat.id)}">${escapeHtml(cat.name)}</option>`).join('');
    if (yearSel) yearSel.innerHTML = `<option value="">All years</option>` + index.years.map((y) => `<option value="${escapeHtml(y)}">${escapeHtml(y)}</option>`).join('');
    if (memberSel) memberSel.innerHTML = `<option value="">All members</option>` + index.members.map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)} — ${escapeHtml(m.artist)}</option>`).join('');
  }

  input?.addEventListener('input', () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => apply({ q: input!.value }), DEBOUNCE_MS);
  });

  const filterEvents: [HTMLSelectElement | null, (v: string) => Partial<State>, string][] = [
    [artistSel, (v) => ({ artistId: v }), 'artist'],
    [languageSel, (v) => ({ language: v }), 'language'],
    [categorySel, (v) => ({ categoryId: v }), 'category'],
    [yearSel, (v) => ({ year: v }), 'year'],
    [memberSel, (v) => ({ memberId: v }), 'member'],
  ];
  for (const [sel, map] of filterEvents) {
    sel?.addEventListener('change', () => apply(map(sel.value)));
  }

  const clearBtn = root.querySelector<HTMLButtonElement>('[data-search-clear]');
  clearBtn?.addEventListener('click', () => apply({ q: '', artistId: '', language: '', categoryId: '', year: '', memberId: '' }));

  window.addEventListener('popstate', () => {
    state = stateFromUrl();
    syncInputs();
    render();
  });

  fetch('/search-index.json', { headers: { accept: 'application/json' } })
    .then((res) => (res.ok ? (res.json() as Promise<SearchIndex>) : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((data) => {
      index = data;
      populate();
      syncInputs();
      render();
    })
    .catch(() => {
      if (results) {
        results.innerHTML = `<p class="surface p-4 text-[0.9375rem] text-danger">The search index could not be loaded.</p>`;
      }
    });
}
