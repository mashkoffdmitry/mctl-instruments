import { createApp, h, ref } from 'vue';
import InstrumentsWidget from '../src/index.ts';

// Demo: mount the widget against the same-origin API (served by the proxy),
// with a small locale/theme switcher so the i18n + theming is visible.
const locale = ref<'en-US' | 'ru-RU'>('ru-RU');
const theme = ref<'auto' | 'light' | 'dark'>('auto');

const apiBase = import.meta.env.DEV ? 'https://labs-instruments-proxy.mctl.ai' : '';

createApp({
  setup() {
    return () =>
      h('div', { style: 'max-width:1080px;margin:0 auto;font-family:system-ui' }, [
        h('div', { style: 'display:flex;gap:12px;align-items:center;padding:12px 16px' }, [
          h('strong', 'mctl-instruments demo'),
          h('span', { style: 'margin-left:auto' }),
          h(
            'button',
            { onClick: () => (locale.value = locale.value === 'ru-RU' ? 'en-US' : 'ru-RU') },
            () => `lang: ${locale.value}`,
          ),
          h(
            'button',
            { onClick: () => (theme.value = theme.value === 'dark' ? 'light' : 'dark') },
            () => `theme: ${theme.value}`,
          ),
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
