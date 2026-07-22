import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { navigate } from '@/router';
import { useDialogChrome } from '@/hooks/useDialogChrome';
import {
  paletteItems,
  searchItems,
  suggestions,
  type PaletteAction,
  type PaletteItem,
} from '@/engine/palette';
import { SearchIcon } from '@/shell/icons';
import type { Store } from '@/domain/types';

/**
 * The command palette — one surface for jumping anywhere and running the common
 * actions (Document 3 §4).
 *
 * Selection is tracked with aria-activedescendant rather than by moving DOM
 * focus onto rows: focus never leaves the input, so the user can keep typing
 * while arrowing. This is the standard combobox/listbox pairing.
 */
export function CommandPalette({
  store,
  open,
  onClose,
  onAction,
}: {
  store: Store;
  open: boolean;
  onClose: () => void;
  onAction: (action: PaletteAction) => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const baseId = useId();

  useDialogChrome(open, onClose, ref);

  const results = useMemo(() => {
    if (!open) return [];
    const q = query.trim();
    // No query is not an empty search — it's the moment to suggest.
    return q === '' ? suggestions(store) : searchItems(paletteItems(store), q);
  }, [open, query, store]);

  // Every open starts clean; a palette that remembers last week's query is
  // answering a question the user isn't asking.
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
    }
  }, [open]);

  // Re-typing re-ranks, so the old index would point at an unrelated row.
  useEffect(() => setSelected(0), [query]);

  // Keep the active row visible when arrowing past the fold.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selected, open]);

  if (!open) return null;

  const optionId = (i: number) => `${baseId}-opt-${i}`;
  const listId = `${baseId}-list`;

  const run = (item: PaletteItem) => {
    onClose();
    if (item.target.type === 'route') navigate(item.target.hash);
    else onAction(item.target.action);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = results[selected];
      if (item) run(item);
    }
  };

  // Group headings are rendered inline as the group changes, so the list stays
  // a single flat listbox for the arrow keys while still reading as sections.
  let lastGroup: string | null = null;

  return (
    <div
      className="palette-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette" ref={ref}>
        <div className="palette-search">
          <SearchIcon />
          <input
            className="palette-input"
            type="text"
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={results.length > 0 ? optionId(selected) : undefined}
            aria-autocomplete="list"
            aria-label="Search courses, topics and actions"
            placeholder="What do you want to study?"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>

        {results.length === 0 ? (
          <div className="palette-empty">
            <p>
              No matches for <strong>{query.trim()}</strong>
            </p>
            <p className="palette-empty-hint">Try a course name, a topic, or an action like “Add a course”.</p>
          </div>
        ) : (
          <ul className="palette-list" role="listbox" id={listId} ref={listRef}>
            {results.map((item, i) => {
              const heading = item.group !== lastGroup ? item.group : null;
              lastGroup = item.group;
              return (
                <li key={item.id} className="palette-row-wrapper">
                  {heading && (
                    <div className="palette-group group-label" role="presentation">
                      {heading}
                    </div>
                  )}
                  <div
                    id={optionId(i)}
                    data-index={i}
                    role="option"
                    aria-selected={i === selected}
                    className={`palette-item ${i === selected ? 'active' : ''}`}
                    onMouseMove={() => setSelected(i)}
                    onClick={() => run(item)}
                  >
                    <span className="palette-label">{item.label}</span>
                    {item.hint && <span className="palette-hint">{item.hint}</span>}
                    {item.meta && <span className="palette-meta mono-num">{item.meta}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="palette-foot">
          <span>
            <kbd className="delta-chip flat">↑</kbd>
            <kbd className="delta-chip flat">↓</kbd> to navigate
          </span>
          <span>
            <kbd className="delta-chip flat">↵</kbd> to select
          </span>
          <span>
            <kbd className="delta-chip flat">esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}
