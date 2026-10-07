import { useCallback, useState } from 'react';
import type { CustomerFilters, CustomerPeriod, CustomerSort } from '@/ext/domain/customers';
import { NO_FILTERS } from '@/ext/domain/customers';

/**
 * How a page is being looked at right now, kept on this device.
 *
 * Deliberately **not** in the extension document. The period, the switches and
 * the filters are a look at the moment — the same reasoning upstream gives for
 * keeping its own filters local — and putting them in the document would mean
 * a Todoist comment written every time a switch is flicked. The custom order
 * stays in the document, because deciding what order customers go in is a
 * decision about the data rather than about this morning.
 */
export interface CustomersViewPrefs {
  period: CustomerPeriod;
  showEngagements: boolean;
  showEmpty: boolean;
  excluded: string[];
  filters: CustomerFilters;
  sort: CustomerSort;
}

export const DEFAULT_CUSTOMERS_PREFS: CustomersViewPrefs = {
  period: 'week',
  showEngagements: true,
  showEmpty: false,
  excluded: [],
  filters: NO_FILTERS,
  sort: 'az',
};

const KEY = 'ext:customers:view';

/**
 * Reads the stored prefs, falling back to the defaults.
 *
 * Every access is guarded: storage throws in a private window and can be
 * blocked outright, and a page that will not render because it could not read
 * a remembered switch is a worse page than one that opens on its defaults.
 */
function read(): CustomersViewPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_CUSTOMERS_PREFS;
    const stored = JSON.parse(raw) as Partial<CustomersViewPrefs>;
    return {
      ...DEFAULT_CUSTOMERS_PREFS,
      ...stored,
      filters: { ...NO_FILTERS, ...(stored.filters ?? {}) },
    };
  } catch {
    return DEFAULT_CUSTOMERS_PREFS;
  }
}

export function useCustomersViewPrefs(): [
  CustomersViewPrefs, (patch: Partial<CustomersViewPrefs>) => void,
] {
  const [prefs, setPrefs] = useState<CustomersViewPrefs>(read);

  const set = useCallback((patch: Partial<CustomersViewPrefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* Not remembered next time, which is the whole cost of it failing. */
      }
      return next;
    });
  }, []);

  return [prefs, set];
}
