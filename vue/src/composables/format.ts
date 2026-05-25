// Intl-based, locale-sensitive formatting. Raw values stay machine-safe
// (decimal strings); we only format for display.

export function createFormat(locale: string, displayTz: string) {
  const dateTime = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: 'short',
    timeZone: displayTz,
  });
  const timeOnly = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: displayTz,
  });

  return {
    /** Format a numeric decimal string by locale, preserving its own precision. */
    num(value: string): string {
      const n = Number(value);
      if (!Number.isFinite(n)) return value;
      const decimals = value.includes('.') ? value.split('.')[1]!.length : 0;
      return new Intl.NumberFormat(locale, {
        minimumFractionDigits: Math.min(decimals, 8),
        maximumFractionDigits: Math.min(decimals, 8),
      }).format(n);
    },
    dateTime(iso: string | null): string {
      if (!iso) return '—';
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? '—' : dateTime.format(d);
    },
    time(iso: string | null): string {
      if (!iso) return '—';
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? '—' : timeOnly.format(d);
    },
    /** Human duration from seconds, e.g. "15 min", "8 h". */
    duration(seconds: number): string {
      if (seconds < 60) return `${Math.round(seconds)} s`;
      if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
      return `${Math.round(seconds / 3600)} h`;
    },
  };
}

export type Formatter = ReturnType<typeof createFormat>;
