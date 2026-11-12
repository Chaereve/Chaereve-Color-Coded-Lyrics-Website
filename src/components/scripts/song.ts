/**
 * Client behaviour for /lyrics/[artist]/[song]/ pages (CCL-style layout):
 *  - member-names + adlib toggles (adlibs also switch the distribution variant)
 *  - lyrics font size
 *  - version switcher (studio vs live/remix) — swaps lyrics blocks AND the
 *    distribution panel
 *  - copy-lyrics
 *
 * All state is persisted to localStorage so refreshes keep the user's setup.
 */

const LS = {
  names: 'chaereve-names',
  adlibs: 'chaereve-adlibs',
  font: 'chaereve-font',
} as const;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function activeBlock(root: HTMLElement, attr: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[${attr}]:not([hidden])`);
}

export function initSongPage(): void {
  const root = document.querySelector<HTMLElement>('[data-song-root]');
  if (!root) return;

  const lyricsEls = () => Array.from(root.querySelectorAll<HTMLElement>('.lyrics'));

  /* ---------------- names toggle ---------------- */

  const applyNames = (on: boolean) => {
    for (const el of lyricsEls()) el.dataset.names = on ? 'on' : 'off';
    root.querySelector<HTMLButtonElement>('[data-toggle="names"]')?.setAttribute('aria-pressed', String(on));
  };
  const storedNames = read(LS.names);
  if (storedNames !== null) applyNames(storedNames === 'on');
  root.querySelector<HTMLButtonElement>('[data-toggle="names"]')?.addEventListener('click', (e) => {
    const on = (e.currentTarget as HTMLButtonElement).getAttribute('aria-pressed') !== 'true';
    applyNames(on);
    write(LS.names, on ? 'on' : 'off');
  });

  /* ---------------- adlibs toggle (lyrics + distribution variant) ---------------- */

  const applyAdlibs = (on: boolean) => {
    for (const el of lyricsEls()) el.dataset.adlibs = on ? 'on' : 'off';
    const dist = activeBlock(root, 'data-version-distribution');
    if (dist) {
      const def = dist.querySelector<HTMLElement>('[data-dist-variant="default"]');
      const alt = dist.querySelector<HTMLElement>('[data-dist-variant="adlibs"]');
      if (def) def.hidden = on; // include adlibs -> show the adlib-inclusive variant
      if (alt) alt.hidden = !on;
    }
    root.querySelector<HTMLButtonElement>('[data-toggle="adlibs"]')?.setAttribute('aria-pressed', String(on));
  };
  const storedAdlibs = read(LS.adlibs);
  if (storedAdlibs !== null) applyAdlibs(storedAdlibs === 'on');
  root.querySelector<HTMLButtonElement>('[data-toggle="adlibs"]')?.addEventListener('click', (e) => {
    const on = (e.currentTarget as HTMLButtonElement).getAttribute('aria-pressed') !== 'true';
    applyAdlibs(on);
    write(LS.adlibs, on ? 'on' : 'off');
  });

  /* ---------------- font size ---------------- */

  const sizes: Record<string, string> = { sm: '16px', md: '17px', lg: '20px' };
  const applyFont = (size: string) => {
    const px = sizes[size] ?? '17px';
    for (const el of lyricsEls()) el.style.setProperty('--lyrics-size', px);
    for (const btn of root.querySelectorAll<HTMLButtonElement>('[data-fontsize]')) {
      btn.setAttribute('aria-pressed', String(btn.dataset.fontsize === size));
    }
  };
  const storedFont = read(LS.font);
  applyFont(storedFont && sizes[storedFont] ? storedFont : 'md');
  root.querySelectorAll<HTMLButtonElement>('[data-fontsize]').forEach((btn) =>
    btn.addEventListener('click', () => {
      applyFont(btn.dataset.fontsize ?? 'md');
      write(LS.font, btn.dataset.fontsize ?? 'md');
    }),
  );

  /* ---------------- version switcher ---------------- */

  const select = root.querySelector<HTMLSelectElement>('[data-version-select]');
  select?.addEventListener('change', () => {
    const id = select.value;
    for (const block of root.querySelectorAll<HTMLElement>('[data-version-block]')) {
      block.hidden = block.dataset.versionId !== id;
    }
    for (const dist of root.querySelectorAll<HTMLElement>('[data-version-distribution]')) {
      dist.hidden = dist.dataset.versionDistribution !== id;
    }
    // Re-apply the adlib state so the newly visible distribution variant is right.
    const adlibsBtn = root.querySelector<HTMLButtonElement>('[data-toggle="adlibs"]');
    applyAdlibs(adlibsBtn ? adlibsBtn.getAttribute('aria-pressed') === 'true' : false);
  });

  /* ---------------- copy (original block of the active version) ---------------- */

  const copyBtn = root.querySelector<HTMLButtonElement>('[data-copy]');
  const originalLabel = copyBtn?.textContent ?? 'Copy';
  copyBtn?.addEventListener('click', async () => {
    const block = activeBlock(root, 'data-version-block');
    const lyrics = block?.querySelector<HTMLElement>('.lyrics');
    if (!lyrics) return;
    const includeNames = lyrics.dataset.names !== 'off';
    const includeAdlibs = lyrics.dataset.adlibs !== 'off';
    const lines: string[] = [];
    const original = lyrics.querySelector<HTMLElement>('.lyrics-block[data-block="original"]');
    for (const line of original?.querySelectorAll<HTMLElement>('.lyric-line') ?? []) {
      if (!includeAdlibs && line.classList.contains('line-adlib')) continue;
      const text = line.querySelector<HTMLElement>('.lyric-text')?.textContent?.trim() ?? '';
      if (!text || text.startsWith('(missing)')) continue;
      const name = line.querySelector<HTMLElement>('.member-name')?.textContent?.trim();
      lines.push(includeNames && name ? `${name}: ${text}` : text);
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      if (copyBtn) {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.textContent = originalLabel;
        }, 1600);
      }
    } catch {
      window.prompt('Copy the lyrics below (automatic copy is unavailable):', lines.join('\n'));
    }
  });
}
