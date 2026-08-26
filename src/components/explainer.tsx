'use client';

import type { ReactNode } from 'react';
import { useEffect, useId, useState } from 'react';

// A defined term: the word carries a dotted underline (an editorial "there's a definition here" cue),
// and a plain-language gloss appears on hover, keyboard focus, or tap. Accessible tooltip pattern —
// the term is a real <button> so keyboard and touch users reach it, role="tooltip" + aria-describedby
// hand the gloss to screen readers, the global :focus-visible ring still shows on keyboard focus, and
// Escape dismisses without moving focus (WCAG 1.4.13), re-arming on the next hover/focus. The gloss is
// a floating surface (the sanctioned overlay shadow) that materialises with pop-in and collapses to an
// instant show under reduced-motion. Point-of-use explanation, no clutter until asked.
export function Explainer({ children, def }: { children: ReactNode; def: string }) {
  const id = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [escaped, setEscaped] = useState(false);
  const open = (hovered || focused) && !escaped;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEscaped(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <span
      className="relative inline-block"
      onPointerEnter={() => {
        setHovered(true);
        setEscaped(false);
      }}
      onPointerLeave={() => setHovered(false)}
    >
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        onFocus={() => {
          setFocused(true);
          setEscaped(false);
        }}
        onBlur={() => setFocused(false)}
        className="cursor-help border-b border-dotted border-current/40 font-[inherit] text-[inherit] leading-tight transition-colors hover:border-current"
      >
        {children}
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="pop-in pointer-events-none absolute left-0 top-full z-20 mt-2 w-64 max-w-[calc(100vw-3rem)] rounded-lg border border-border bg-surface p-2.5 text-left text-xs font-normal leading-relaxed text-muted shadow-lg shadow-black/5"
        >
          {def}
        </span>
      )}
    </span>
  );
}
