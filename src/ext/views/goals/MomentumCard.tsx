import { Bars, type BarDatum } from '@/components/charts';
import { markerStyle } from '@/domain/colors';
import type { FocusArea } from '@/ext/data/types';
import {
  MOMENTUM_TONES, daysSinceLast, momentum, thisWeek, weeklyCounts, type Momentum,
} from '@/ext/domain/momentum';
import { useTx } from '@/ext/i18n';

const TONE_COLORS: Record<string, string> = {
  green: 'green', blue: 'blue', amber: 'orange', red: 'red',
};

export interface MomentumNext {
  /** Live initiatives in this area with nothing open — the louder of the two. */
  noNextAction: number;
  /** Otherwise, the first open task of an active initiative. */
  next: string | null;
}

/**
 * Whether a focus area is actually moving.
 *
 * A goal can read fine on its KPI and have had nothing done about it for a
 * month. This card is the half of the page that catches that.
 */
export function MomentumCard({
  area, completions, floor, now, selected, onSelect, next,
}: {
  area: FocusArea;
  /** When work on this area was completed, from the completed API by label. */
  completions: Date[];
  floor: number;
  now: Date;
  selected: boolean;
  onSelect: () => void;
  next: MomentumNext;
}) {
  const { tx } = useTx();

  const weekly = weeklyCounts(completions, now);
  const since = daysSinceLast(completions, now);
  const mood: Momentum = momentum(weekly, since);
  const week = thisWeek(weekly, floor);

  /* The current week is the one that is still being written, so it is the bar
     that deserves the eye. */
  const bars: BarDatum[] = weekly.map((value, index) => ({
    key: String(index),
    /* "Now", not "This week": eight labels across a card this narrow, and the
       long one is cut off mid-word. Thinning them instead would drop the
       label from the bar that matters most, which is this one. */
    label: index === weekly.length - 1 ? tx('goals.now') : `-${weekly.length - 1 - index}`,
    value,
    current: index === weekly.length - 1,
  }));

  return (
    <button
      className={`card ext-momentum${selected ? ' selected' : ''}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="ext-momenthead">
        <span className="ext-dot" style={markerStyle(area.color)}><span /></span>
        <span className="ext-momentname">{area.short}</span>
        <span
          className={`chip ext-momentchip ${MOMENTUM_TONES[mood]}`}
          style={markerStyle(TONE_COLORS[MOMENTUM_TONES[mood]] ?? 'charcoal')}
        >
          {mood}
        </span>
      </span>

      {area.why && <span className="ext-why">{area.why}</span>}

      <span className="ext-momentbars">
        <Bars
          data={bars}
          height={56}
          emptyLabel={tx('goals.noActions')}
        />
      </span>

      <span className={`ext-hint${week.belowFloor ? ' ext-belowfloor' : ''}`}>
        {tx('goals.thisWeekCount', { count: week.count, floor })}
        {since !== null && ` · ${tx('goals.lastAction', { count: since })}`}
      </span>

      {/* The louder thing wins: an area with initiatives going nowhere does
          not need to be told what the next task is. */}
      <span className={`ext-hint${next.noNextAction > 0 ? ' ext-belowfloor' : ''}`}>
        {next.noNextAction > 0
          ? tx('goals.withoutNext', { count: next.noNextAction })
          : next.next
            ? tx('goals.next', { task: next.next })
            : tx('goals.nothingOpen')}
      </span>
    </button>
  );
}
