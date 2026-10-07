import { useState, type ReactNode } from 'react';
import { Icon } from '@/components/Icon';
import { Select } from '@/components/Select';
import { markerStyle } from '@/domain/colors';
import { useData } from '@/hooks/useData';
import { useDraftField, nonEmpty } from '@/ext/hooks/useDraftField';
import { useTx } from '@/ext/i18n';

/**
 * The small pieces the three Manage tabs share.
 *
 * Each is here because it appears on more than one tab, not because it is
 * generic: anything the whole app would want belongs in src/components.
 */

/**
 * Remove, then Confirm.
 *
 * Everything removable on this page takes something else with it — a stage
 * moves its customers, a goal deletes its KPIs — and none of it is undoable
 * from a toast yet, so the second click is the safety net.
 */
export function TwoStepRemove({ onRemove, label }: { onRemove: () => void; label?: string }) {
  const { tx } = useTx();
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button className="btn sm quiet" onClick={() => setArmed(true)}>
        {label ?? tx('manage.remove')}
      </button>
    );
  }
  return (
    <span className="ext-confirm">
      <button className="btn sm ext-danger" onClick={onRemove}>{tx('manage.confirm')}</button>
      <button
        className="iconbtn"
        aria-label={tx('manage.cancel')}
        onClick={() => setArmed(false)}
      >
        <Icon name="close" size="sm" />
      </button>
    </span>
  );
}

/** A text field bound to a draft, so what is typed survives being invalid. */
export function DraftInput({
  value, onCommit, ariaLabel, placeholder, className, parse = nonEmpty,
}: {
  value: string;
  onCommit: (next: string) => void;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
  parse?: (text: string) => string | null;
}) {
  const draft = useDraftField(value, { parse, commit: onCommit });
  return (
    <input
      className={`textfield ${className ?? ''}${draft.valid ? '' : ' ext-invalid'}`}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={draft.value}
      onChange={(event) => draft.onChange(event.target.value)}
      onFocus={draft.onFocus}
      onBlur={draft.onBlur}
      onKeyDown={draft.onKeyDown}
    />
  );
}

/** A card that opens, with a summary of what is inside it while it is shut. */
export function Disclosed({
  title, summary, children, defaultOpen = false,
}: {
  title: string;
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="card ext-disclosed">
      <button className="ext-disclosed-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="ext-disclosed-title">{title}</span>
        {!open && <span className="ext-disclosed-sum">{summary}</span>}
        <Icon name={open ? 'caret-up' : 'caret'} size="sm" />
      </button>
      {open && <div className="ext-disclosed-body">{children}</div>}
    </section>
  );
}

export interface NamedRow { id: string; name: string }

/**
 * A list of named things that can be renamed, added to and removed from.
 *
 * The CSM and Stage editors are the same list with different trimmings, so
 * the extras go in `rowExtra` rather than in a second copy of this.
 */
export function NameList({
  rows, onRename, onAdd, onRemove, addPlaceholder, duplicate, rowExtra, countOf, canRemove,
}: {
  rows: NamedRow[];
  onRename: (id: string, name: string) => void;
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
  addPlaceholder: string;
  /** Says whether a name clashes; the caller knows what it is comparing against. */
  duplicate: (name: string, selfId?: string) => boolean;
  rowExtra?: (row: NamedRow, index: number) => ReactNode;
  countOf?: (row: NamedRow) => number;
  canRemove?: (row: NamedRow) => boolean;
}) {
  const { tx } = useTx();
  const [draft, setDraft] = useState('');
  const clash = duplicate(draft);
  const canAdd = draft.trim().length > 0 && !clash;

  const add = () => {
    if (!canAdd) return;
    onAdd(draft.trim());
    setDraft('');
  };

  return (
    <div className="ext-namelist">
      {rows.map((row, index) => (
        <div className="ext-namerow" key={row.id}>
          {rowExtra?.(row, index)}
          <DraftInput
            value={row.name}
            ariaLabel={tx('manage.name')}
            parse={(text) => {
              const name = text.trim();
              return name && !duplicate(name, row.id) ? name : null;
            }}
            onCommit={(name) => onRename(row.id, name)}
          />
          {countOf && <span className="ext-count">{countOf(row)}</span>}
          {canRemove?.(row) !== false && <TwoStepRemove onRemove={() => onRemove(row.id)} />}
        </div>
      ))}

      <div className="ext-namerow ext-addrow">
        <input
          className={`textfield${clash ? ' ext-invalid' : ''}`}
          placeholder={addPlaceholder}
          aria-label={addPlaceholder}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') add(); }}
        />
        <button className="btn sm" disabled={!canAdd} onClick={add}>{tx('manage.add')}</button>
      </div>
      {clash && <p className="ext-error">{tx('manage.duplicate')}</p>}
    </div>
  );
}

/** A coloured dot standing for a stage's tone or a customer's colour. */
export const Dot = ({ color, onClick, label }: {
  color: string; onClick?: () => void; label?: string;
}) => (onClick
  ? (
    <button className="ext-dot" style={markerStyle(color)} onClick={onClick} aria-label={label}>
      <span />
    </button>
  )
  : <span className="ext-dot" style={markerStyle(color)}><span /></span>);

/**
 * Where tasks this page creates should go.
 *
 * SPEC does not ask for this, but something has to set it: the default is
 * null, which means the Inbox, and nobody wants their initiatives filed there.
 */
export function ProjectField({ label, value, onChange }: {
  label: string;
  value: string | null;
  onChange: (projectId: string | null) => void;
}) {
  const { snapshot } = useData();
  const { tx } = useTx();
  const inbox = snapshot.user?.inbox_project_id ?? '';

  const options = [
    { value: '', label: tx('manage.inbox'), icon: 'inbox' as const },
    ...Object.values(snapshot.projects)
      .filter((project) => !project.is_deleted && project.id !== inbox)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((project) => ({ value: project.id, label: project.name, marker: project.color })),
  ];

  return (
    <div className="ext-projectfield">
      <Select
        label={label}
        value={value ?? ''}
        options={options}
        onChange={(next) => onChange(next || null)}
      />
    </div>
  );
}
