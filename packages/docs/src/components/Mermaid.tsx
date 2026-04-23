import { useEffect, useId, useRef, useState } from 'react';

declare global {
  interface Window {
    mermaid?: {
      initialize: (config: Record<string, unknown>) => void;
      render: (id: string, source: string) => Promise<{ svg: string }>;
    };
  }
}

const SCRIPT_ID = 'jk-mermaid-cdn';
const SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';

let loadPromise: Promise<void> | null = null;
function ensureLoaded(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();
    if (window.mermaid) return resolve();
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => {
      const dark =
        typeof window !== 'undefined' &&
        document.documentElement.dataset.theme === 'dark';
      window.mermaid?.initialize({
        startOnLoad: false,
        theme: dark ? 'dark' : 'default',
        securityLevel: 'loose',
        flowchart: {
          // Don't squeeze the diagram into the column width — let it
          // grow horizontally and scroll if it overflows. Without
          // useMaxWidth: false, mermaid scales SVGs down to fit, which
          // makes long node labels collapse into unreadable narrow
          // columns inside Starlight's content area.
          useMaxWidth: false,
          htmlLabels: true,
          nodeSpacing: 60,
          rankSpacing: 70,
          padding: 12,
        },
        sequence: {
          useMaxWidth: false,
        },
      });
      resolve();
    };
    s.onerror = () => reject(new Error(`Failed to load ${SCRIPT_SRC}`));
    document.head.append(s);
  });
  return loadPromise;
}

/**
 * Lightweight mermaid diagram renderer. Loads the mermaid runtime from
 * jsdelivr the first time any <Mermaid> mounts, then renders subsequent
 * diagrams using the cached global. Use as:
 *
 *   <Mermaid client:only="react" code={`
 *     graph TD
 *       A --> B
 *   `} />
 *
 * `code` is a prop (not children) because Astro client:only islands don't
 * reliably preserve template-literal text nodes through hydration.
 */
export default function Mermaid({ code }: { code: string }) {
  const reactId = useId();
  const id = `mermaid-${reactId.replace(/[^a-z0-9]/gi, '')}`;
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const source = (code ?? '').trim();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!source) {
        if (!cancelled) setError('No diagram source supplied');
        return;
      }
      try {
        await ensureLoaded();
        if (cancelled || !ref.current) return;
        const { svg } = await window.mermaid!.render(id, source);
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = svg;
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, id]);

  if (error) {
    return (
      <pre style={{ color: 'crimson', fontSize: '0.85rem' }}>
        Mermaid render failed: {error}
      </pre>
    );
  }
  return (
    <div
      ref={ref}
      className="jk-mermaid"
      style={{ overflowX: 'auto', textAlign: 'center', margin: '1rem 0' }}
    />
  );
}
