import { createApp, h, ref, watchEffect } from 'vue';
import InstrumentsWidget from '../src/index.ts';

// Demo harness: mounts the widget against the same-origin API with a small
// locale/theme switcher so i18n + theming are visible.
const locale = ref<'en-US' | 'ru-RU'>('ru-RU');
const theme = ref<'auto' | 'light' | 'dark'>('dark');

const apiBase = import.meta.env.DEV ? 'https://labs-instruments-proxy.mctl.ai' : '';

// Theme the whole page (around the widget), not just the widget card.
watchEffect(() => {
  const dark = theme.value !== 'light';
  document.body.style.margin = '0';
  document.body.style.minHeight = '100vh';
  document.body.style.background = dark ? '#0a0b0d' : '#f1ede4';
  document.body.style.color = dark ? '#e6e7e9' : '#15181d';
  document.body.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
});

const toggleBtn = (label: string, onClick: () => void) =>
  h(
    'button',
    {
      onClick,
      style:
        'background:transparent;border:1px solid currentColor;border-radius:4px;padding:5px 12px;' +
        'font:inherit;font-size:13px;color:inherit;cursor:pointer;opacity:0.85',
    },
    label,
  );

createApp({
  setup() {
    return () =>
      h('div', { style: 'max-width:1120px;margin:0 auto;padding:18px 16px' }, [
        h('div', { style: 'display:flex;gap:10px;align-items:center;margin-bottom:14px' }, [
          h('strong', { style: 'font-size:14px;letter-spacing:-0.01em' }, 'mctl-instruments'),
          h('span', { style: 'color:#6b7079;font-size:13px' }, 'demo'),
          h('span', { style: 'margin-left:auto' }),
          toggleBtn(`lang: ${locale.value}`, () => (locale.value = locale.value === 'ru-RU' ? 'en-US' : 'ru-RU')),
          toggleBtn(`theme: ${theme.value}`, () => (theme.value = theme.value === 'dark' ? 'light' : 'dark')),
        ]),
        h(InstrumentsWidget, {
          apiBase,
          locale: locale.value,
          theme: theme.value,
          displayTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          onError: (e: Error) => console.error('[demo] widget error', e),
        }),
      ]);
  },
}).mount('#app');
