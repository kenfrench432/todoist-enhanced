import { useEffect, useState } from 'react';
import { setNote } from '@/ext/data/actions';
import { useExt } from '@/ext/data/store';
import { PROMPTS } from '@/ext/domain/objectives';
import type { Cadence } from '@/ext/domain/periods';
import { useTx } from '@/ext/i18n';

/**
 * The two questions a period opens and closes with, and somewhere to answer
 * them.
 *
 * The notes are kept per period key, so coming back to last week finds last
 * week's. Saving is the ext store's own debounce, not a Save button: this is
 * a notebook, not a form.
 */
export function PlanReview({ cadence, periodKey }: { cadence: Cadence; periodKey: string }) {
  const { tx } = useTx();
  const stored = useExt((state) => state.data.notes[periodKey] ?? '');
  const update = useExt((state) => state.update);
  const [text, setText] = useState(stored);

  /* Changing period swaps which note is being written, and a sync can change
     one underneath. Keyed by the period so the textarea follows. */
  useEffect(() => setText(stored), [periodKey, stored]);

  return (
    <section className="card ext-planreview">
      <div className="ext-prompts">
        <p className="ext-prompt">
          <strong>{tx('objectives.plan')}</strong> {PROMPTS[cadence].start}
        </p>
        <p className="ext-prompt">
          <strong>{tx('objectives.review')}</strong> {PROMPTS[cadence].end}
        </p>
      </div>
      <textarea
        className="textfield ext-notes"
        aria-label={tx('objectives.notes')}
        placeholder={tx('objectives.notesPlaceholder')}
        rows={3}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          update((current) => setNote(current, periodKey, event.target.value));
        }}
      />
    </section>
  );
}
