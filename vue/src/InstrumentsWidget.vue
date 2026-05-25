<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue';
import type { CatalogRow, FilterReference, InstrumentDetail, MarketState, UiState } from './types.ts';
import { createApi, type CatalogParams } from './composables/api.ts';
import { createT, stateLabel } from './composables/i18n.ts';
import { createFormat } from './composables/format.ts';
import { deriveUiState } from './composables/state.ts';
import StateBadge from './components/StateBadge.vue';
import DetailCard from './components/DetailCard.vue';

const props = withDefaults(
  defineProps<{
    apiBase: string;
    locale?: string;
    theme?: 'light' | 'dark' | 'auto';
    displayTimezone?: string;
    initialAssetClass?: string;
    pollMs?: number;
  }>(),
  { locale: 'en-US', theme: 'auto', displayTimezone: 'UTC', initialAssetClass: '', pollMs: 5000 },
);

const emit = defineEmits<{
  (e: 'select-instrument', id: string): void;
  (e: 'error', err: Error): void;
}>();

const api = computed(() => createApi(props.apiBase, props.locale));
const t = computed(() => createT(props.locale));
const fmt = computed(() => createFormat(props.locale, props.displayTimezone));

const filters = reactive({ search: '', asset_class: props.initialAssetClass, status: '', tradable_now: false });
const rows = ref<CatalogRow[]>([]);
const reference = ref<FilterReference | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const selectedId = ref<string | null>(null);
const detail = ref<InstrumentDetail | null>(null);
const market = ref<MarketState | null>(null);
let pollTimer: ReturnType<typeof setInterval> | null = null;

function rowUiState(row: CatalogRow): UiState {
  return deriveUiState(row.status, row.quote, Date.now());
}
const detailUiState = computed<UiState>(() => {
  if (!detail.value) return 'open_realtime';
  const status = market.value
    ? { trading_status: market.value.trading_status, session_state: market.value.session_state, status_reason_code: market.value.status_reason_code }
    : { trading_status: 'enabled' as const, session_state: 'open' as const, status_reason_code: null };
  return deriveUiState(status, market.value?.quote, Date.now());
});

async function loadCatalog(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const params: CatalogParams = { tz: props.displayTimezone, locale: props.locale, limit: 100 };
    if (filters.search) params.search = filters.search;
    if (filters.asset_class) params.asset_class = filters.asset_class;
    if (filters.status) params.status = filters.status;
    if (filters.tradable_now) params.tradable_now = true;
    const res = await api.value.listCatalog(params);
    rows.value = res.data;
  } catch (e) {
    const err = e as Error;
    error.value = t.value('msg.error');
    emit('error', err);
  } finally {
    loading.value = false;
  }
}

async function loadFilters(): Promise<void> {
  try {
    reference.value = (await api.value.getFilters()).data;
  } catch {
    /* non-fatal */
  }
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function refreshMarket(id: string): Promise<void> {
  try {
    market.value = (await api.value.getMarketState(id, props.displayTimezone)).data;
  } catch {
    /* keep last */
  }
}

async function select(id: string): Promise<void> {
  selectedId.value = id;
  detail.value = null;
  market.value = null;
  emit('select-instrument', id);
  try {
    const [d, m] = await Promise.all([
      api.value.getDetail(id, props.displayTimezone),
      api.value.getMarketState(id, props.displayTimezone),
    ]);
    detail.value = d.data;
    market.value = m.data;
  } catch (e) {
    error.value = t.value('msg.error');
    emit('error', e as Error);
    return;
  }
  stopPolling();
  if (props.pollMs > 0) pollTimer = setInterval(() => void refreshMarket(id), props.pollMs);
}

function back(): void {
  selectedId.value = null;
  detail.value = null;
  market.value = null;
  stopPolling();
}

let searchDebounce: ReturnType<typeof setTimeout> | null = null;
watch(
  () => ({ ...filters }),
  () => {
    if (searchDebounce) clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => void loadCatalog(), 200);
  },
);
watch(() => props.locale, () => void loadCatalog());

onMounted(() => {
  void loadFilters();
  void loadCatalog();
});
onBeforeUnmount(stopPolling);

const themeClass = computed(() => (props.theme === 'auto' ? '' : `mi-theme-${props.theme}`));
</script>

<template>
  <div class="mi-root" :class="themeClass">
    <!-- Catalog view -->
    <template v-if="!selectedId">
      <header class="mi-head">
        <h1 class="mi-head__title">{{ t('app.title') }}</h1>
        <div class="mi-controls">
          <input
            v-model="filters.search"
            class="mi-input"
            type="search"
            :placeholder="t('search.placeholder')"
            :aria-label="t('search.placeholder')"
          />
          <select v-model="filters.asset_class" class="mi-select" :aria-label="t('filter.asset_class')">
            <option value="">{{ t('filter.asset_class') }}: {{ t('filter.all') }}</option>
            <option v-for="ac in reference?.asset_classes ?? []" :key="ac.id" :value="ac.id">{{ ac.label }}</option>
          </select>
          <select v-model="filters.status" class="mi-select" :aria-label="t('filter.status')">
            <option value="">{{ t('filter.status') }}: {{ t('filter.all') }}</option>
            <option v-for="s in reference?.statuses ?? []" :key="s.id" :value="s.id">{{ s.label }}</option>
          </select>
          <label class="mi-check">
            <input v-model="filters.tradable_now" type="checkbox" />
            {{ t('filter.tradable_now') }}
          </label>
        </div>
      </header>

      <p v-if="loading" class="mi-muted">{{ t('msg.loading') }}</p>
      <p v-else-if="error" class="mi-error">{{ error }}</p>
      <p v-else-if="rows.length === 0" class="mi-muted">{{ t('msg.empty') }}</p>

      <table v-else class="mi-table">
        <thead>
          <tr>
            <th>{{ t('col.symbol') }}</th>
            <th>{{ t('col.status') }}</th>
            <th class="mi-num">{{ t('col.spread') }}</th>
            <th class="mi-num">{{ t('col.min') }}</th>
            <th class="mi-num">{{ t('col.leverage') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.instrument_id"
            class="mi-row"
            tabindex="0"
            role="button"
            @click="select(row.instrument_id)"
            @keydown.enter="select(row.instrument_id)"
            @keydown.space.prevent="select(row.instrument_id)"
          >
            <td>
              <strong>{{ row.display_symbol }}</strong>
              <span class="mi-row__name">{{ row.display_name }}</span>
              <span class="mi-chip mi-chip--sm">{{ row.asset_class }}</span>
            </td>
            <td><StateBadge :state="rowUiState(row)" :label="stateLabel(t, rowUiState(row))" /></td>
            <td class="mi-num">{{ row.quote ? fmt.num(row.quote.current_spread_pips) : '—' }}</td>
            <td class="mi-num">{{ fmt.num(row.volume_summary.min_volume) }}</td>
            <td class="mi-num">{{ row.margin_summary?.max_leverage_from ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
    </template>

    <!-- Detail view -->
    <template v-else>
      <button type="button" class="mi-back" @click="back">← {{ t('back') }}</button>
      <p v-if="!detail && !error" class="mi-muted">{{ t('msg.loading') }}</p>
      <p v-else-if="error" class="mi-error">{{ error }}</p>
      <DetailCard v-else-if="detail" :detail="detail" :market="market" :ui-state="detailUiState" :t="t" :fmt="fmt" />
    </template>
  </div>
</template>
