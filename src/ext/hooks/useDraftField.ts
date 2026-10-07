import { useEffect, useRef, useState } from 'react';

export interface DraftOptions<T> {
  /** Reads the typed text. Return null when it is not yet something to save. */
  parse: (text: string) => T | null;
  /** Called with a valid value. Never called with an invalid one. */
  commit: (value: T) => void;
  /** 'blur' saves when the field is left, 'change' on every valid keystroke. */
  commitOn?: 'blur' | 'change';
}

export interface Draft {
  value: string;
  valid: boolean;
  onChange: (text: string) => void;
  onBlur: () => void;
  onFocus: () => void;
  /** Enter saves and Escape puts back what was there. */
  onKeyDown: (event: React.KeyboardEvent) => void;
}

/**
 * A field that keeps what was typed and saves only what is valid.
 *
 * Without this, an input bound straight to stored state is unusable for
 * anything with rules: clearing a title to retype it writes an empty title,
 * and typing a negative number means passing through "-", which parses as
 * nothing and reverts under the cursor.
 *
 * So the text being typed and the value being stored are two different things.
 * The draft is whatever was typed; it is committed when it parses, and the
 * caller never sees a value that does not.
 */
export function useDraftField<T>(stored: string, options: DraftOptions<T>): Draft {
  const { parse, commit, commitOn = 'blur' } = options;
  const [text, setText] = useState(stored);
  const [focused, setFocused] = useState(false);
  const latest = useRef({ parse, commit });
  latest.current = { parse, commit };

  /* A sync from another device changes the stored value underneath an open
     page, and the field should show it — unless it is the field being typed
     in, where replacing the text mid-word is the worst of both. */
  useEffect(() => {
    if (!focused) setText(stored);
  }, [stored, focused]);

  const parsed = latest.current.parse(text);

  const save = () => {
    const value = latest.current.parse(text);
    if (value === null) {
      setText(stored); // nothing valid to save: put back what was there
      return;
    }
    latest.current.commit(value);
  };

  return {
    value: text,
    valid: parsed !== null,
    onChange: (next) => {
      setText(next);
      if (commitOn !== 'change') return;
      const value = latest.current.parse(next);
      if (value !== null) latest.current.commit(value);
    },
    onFocus: () => setFocused(true),
    onBlur: () => {
      setFocused(false);
      if (commitOn === 'blur') save();
    },
    onKeyDown: (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        save();
        (event.target as HTMLElement).blur();
      }
      if (event.key === 'Escape') {
        setText(stored);
        (event.target as HTMLElement).blur();
      }
    },
  };
}

/** The commonest rule: a name that is not blank. */
export const nonEmpty = (text: string): string | null => text.trim() || null;

/** A number, which may be negative or fractional but must be a number. */
export const numeric = (text: string): number | null => {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
};
