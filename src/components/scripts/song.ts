/**
 * Client behaviour for /lyrics/[artist]/[song]/ pages:
 *  - view tabs (original / romanization / translation / stacked)
 *  - member-names + adlib toggles (also switches the distribution variant)
 *  - lyrics font size
 *  - version switcher (studio vs live/remix)
 *  - copy-lyrics and share
 *
 * All state is persisted to localStorage so refreshes keep the user's setup.
 */

const LS = {
  view: 'chaereve-view',
  names: 'chaereve-names',
  adlibs: 'chaereve-adlibs',
  font: 'chaereve-font',
} as const;

type View = 'original' | 'romanization' | 'translation' | 'stacked';

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

function activeBlock(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>('[data-version-block]:not([hidden])');
}

export function initSongPage(): void {
  const root = document.querySelector<HTMLElement>('[data-song-root]');
  if (!root) return;

  const lyricsEls = () => Array.from(root.querySelectorAll<HTMLElement>('.lyrics'));

  /* ---------------- view tabs ---------------- */

  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-tab]'));
  const applyView = (view: View) => {
    for (const el of lyricsEls()) el.dataset.view = view;
    for (const tab of tabs) tab.setAttribute('aria-selected', String(tab.dataset.view === view));
  };
  const storedView = read(LS.view);
  if (storedView && ['original', 'romanization', 'translation', 'stacked'].includes(storedView)) {
    applyView(storedView as View);
  }
  tabs.forEach((tab) =>
    tab.addEventListener('click', () => {
      applyView(tab.dataset.view as View);
      write(LS.view, tab.dataset.view ?? 'original');
    }),
  );

  /* ---------------- names / adlibs toggles ---------------- */

  const applyNames = (on: boolean) => {
    for (const el of lyricsEls()) el.dataset.names = on ? 'on' : 'off';
    const btn = root.querySelector<HTMLButtonElement>('[data-toggle="names"]');
    btn?.setAttribute('aria-pressed', String(on));
  };
  const applyAdlibs = (on: boolean) => {
    for (const el of lyricsEls()) el.dataset.adlibs = on ? 'on' : 'off';
    for (const block of root.querySelectorAll<HTMLElement>('[data-version-block]')) {
      const def = block.querySelector<HTMLElement>('[data-dist-variant="default"]');
      const alt = block.querySelector<HTMLElement>('[data-dist-variant="adlibs"]');
      if (def) def.hidden = on;
      if (alt) alt.hidden = !on;
    }
    const btn = root.querySelector<HTMLButtonElement>('[data-toggle="adlibs"]');
    btn?.setAttribute('aria-pressed', String(on));
  };
  const storedNames = read(LS.names);
  if (storedNames !== null) applyNames(storedNames === 'on');
  const storedAdlibs = read(LS.adlibs);
  if (storedAdlibs !== null) applyAdlibs(storedAdlibs === 'on');

  root.querySelector<HTMLButtonElement>('[data-toggle="names"]')?.addEventListener('click', (e) => {
    const el = e.currentTarget as HTMLButtonElement;
    const on = el.getAttribute('aria-pressed') !== 'true';
    applyNames(on);
    write(LS.names, on ? 'on' : 'off');
  });
  root.querySelector<HTMLButtonElement>('[data-toggle="adlibs"]')?.addEventListener('click', (e) => {
    const el = e.currentTarget as HTMLButtonElement;
    const on = el.getAttribute('aria-pressed') !== 'true';
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
  });

  /* ---------------- copy ---------------- */

  const copyBtn = root.querySelector<HTMLButtonElement>('[data-copy]');
  const originalLabel = copyBtn?.textContent ?? 'Copy';
  copyBtn?.addEventListener('click', async () => {
    const block = activeBlock(root);
    const lyrics = block?.querySelector<HTMLElement>('.lyrics');
    if (!lyrics) return;
    const view = lyrics.dataset.view ?? 'original';
    const includeNames = lyrics.dataset.names !== 'off';
    const includeAdlibs = lyrics.dataset.adlibs !== 'off';
    const wanted =
      view === 'stacked'
        ? ['lt-original', 'lt-romanization', 'lt-translation']
        : [`lt-${view}`];
    const lines: string[] = [];
    for (const line of block!.querySelectorAll<HTMLElement>('.lyric-line')) {
      if (!includeAdlibs && line.classList.contains('line-adlib')) continue;
      const parts: string[] = [];
      for (const cls of wanted) {
        const p = line.querySelector<HTMLElement>(`.lyric-text.${cls}`);
        const text = p?.textContent?.trim() ?? '';
        if (text) parts.push(text);
      }
      if (parts.length === 0) continue;
      const name = line.querySelector<HTMLElement>('.member-name')?.textContent?.trim();
      lines.push(includeNames && name ? `${name}: ${parts.join('\n')}` : parts.join('\n'));
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

  /* ---------------- share ---------------- */

  const shareBtn = root.querySelector<HTMLButtonElement>('[data-share]');
  shareBtn?.addEventListener('click', async () => {
    const url = window.location.href;
    const title = document.title;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        /* user cancelled */
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        const label = shareBtn.textContent ?? 'Share';
        shareBtn.textContent = 'Link copied!';
        setTimeout(() => {
          shareBtn.textContent = label;
        }, 1600);
      } catch {
        window.prompt('Share this link:', url);
      }
    }
  });
}
