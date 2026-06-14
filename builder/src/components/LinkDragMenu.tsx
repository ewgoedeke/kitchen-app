import { useEffect, useRef, useState } from 'react';
import type { NextNodeOption } from '../lib/validation.ts';

type Props = {
  x: number;
  y: number;
  options: NextNodeOption[];
  onPick: (option: NextNodeOption) => void;
  onClose: () => void;
};

export function LinkDragMenu({ x, y, options, onPick, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocus((f) => Math.min(f + 1, filtered.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocus((f) => Math.max(f - 1, 0));
      }
      if (e.key === 'Enter' && filtered[focus]) {
        e.preventDefault();
        onPick(filtered[focus]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filtered, focus, onPick, onClose]);

  return (
    <div
      className="link-drag-menu"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        placeholder="Search transitions…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setFocus(0);
        }}
      />
      {filtered.map((opt, i) => (
        <button
          key={opt.id}
          className={i === focus ? 'focused' : ''}
          onMouseEnter={() => setFocus(i)}
          onClick={() => onPick(opt)}
        >
          {opt.label}
          {opt.trans && (
            <span className="weight-hint"> · {opt.trans}</span>
          )}
        </button>
      ))}
      {!filtered.length && (
        <div style={{ padding: 8, color: 'var(--muted)', fontSize: 12 }}>
          No valid transitions
        </div>
      )}
    </div>
  );
}
