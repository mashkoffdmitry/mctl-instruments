<script setup lang="ts">
import { computed, ref } from 'vue';
import type { InstrumentDetail, MarketState, UiState } from '../types.ts';
import type { Translator } from '../composables/i18n.ts';
import type { Formatter } from '../composables/format.ts';
import { stateLabel } from '../composables/i18n.ts';
import { assetAccent } from '../composables/assets.ts';
import StateBadge from './StateBadge.vue';
import TabList from './TabList.vue';

const props = defineProps<{
  detail: InstrumentDetail;
  market: MarketState | null;
  uiState: UiState;
  t: Translator;
  fmt: Formatter;
}>();

const active = ref('overview');
const tabs = computed(() => [
  { id: 'overview', label: props.t('tab.overview') },
  { id: 'conditions', label: props.t('tab.conditions') },
  { id: 'margin', label: props.t('tab.margin') },
  { id: 'sessions', label: props.t('tab.sessions') },
  { id: 'raw', label: props.t('tab.raw') },
]);

const quote = computed(() => props.market?.quote ?? null);
const tz = computed(() => props.market?.session.display_timezone ?? props.detail.schedule.display_timezone ?? 'UTC');
const accent = computed(() => assetAccent(props.detail.asset_class));
const tc = computed(() => props.detail.trading_conditions);
const m = computed(() => props.detail.margin);
const ex = computed(() => props.detail.execution);

const banner = computed<string | null>(() => {
  const t = props.t;
  switch (props.uiState) {
    case 'open_delayed': return t('msg.delayed', { n: props.fmt.duration(props.detail.price_source.delay_seconds || 0) });
    case 'close_only': return t('msg.close_only');
    case 'market_closed': return t('msg.closed');
    case 'holiday_modified': return t('msg.holiday');
    case 'halt_or_break': return t('msg.halt');
    case 'stale_data': return t('msg.stale');
    default: return null;
  }
});

const bool = (v: boolean) => (v ? props.t('val.allowed') : props.t('val.disabled'));

// Flat key/value dump for the Raw parameters tab.
const rawRows = computed<[string, string][]>(() => {
  const d = props.detail;
  return [
    ['instrument_id', d.instrument_id],
    ['symbol', d.symbol],
    ['asset_class', d.asset_class],
    ['category', d.category],
    ['account_type', d.account_type ?? '—'],
    ['platform', d.platform ?? '—'],
    ['contract_size', d.spec.contract_size],
    ['digits', String(d.spec.digits)],
    ['tick_size', d.spec.tick_size],
    ['tick_value', d.spec.tick_value],
    ['base/profit/margin ccy', `${d.currencies.base_currency} / ${d.currencies.profit_currency} / ${d.currencies.margin_currency}`],
    ['min/max/step volume', `${tc.value.min_volume} / ${tc.value.max_volume} / ${tc.value.volume_step}`],
    ['pricing_model', tc.value.pricing_model],
    ['spread_type', tc.value.spread_type],
    ['typical_spread', `${tc.value.typical_spread.value_pips} (${tc.value.typical_spread.period_label})`],
    ['commission', `${tc.value.commission.amount} ${tc.value.commission.currency} (${tc.value.commission.basis})`],
    ['swap long/short', `${tc.value.swaps.long} / ${tc.value.swaps.short} (${tc.value.swaps.swap_type})`],
    ['triple_swap_day', tc.value.swaps.triple_swap_day],
    ['execution_mode', ex.value.execution_mode],
    ['filling_modes', ex.value.filling_modes.join(', ')],
    ['stop_level / freeze_level', `${ex.value.stop_level} / ${ex.value.freeze_level}`],
    ['short_selling', String(ex.value.short_selling)],
    ['margin_mode', m.value.margin_mode],
    ['margin_rate_from / max_leverage', `${m.value.margin_rate_from} / ${m.value.max_leverage_from}`],
    ['hedged_margin', m.value.hedged_margin],
    ['schedule_timezone', d.schedule.schedule_timezone],
    ['config_updated_at', d.freshness.config_updated_at],
    ['quote_updated_at', d.freshness.quote_updated_at],
  ];
});
</script>

<template>
  <article class="mi-detail">
    <header class="mi-detail__hero" :style="{ '--row-accent': accent }">
      <div class="mi-detail__title">
        <span class="mi-detail__tick" aria-hidden="true"></span>
        <h2>{{ detail.display_symbol }}</h2>
        <span class="mi-detail__name">{{ detail.display_name }}</span>
        <span class="mi-chip">{{ detail.asset_class }}</span>
        <span class="mi-chip">{{ detail.category }}</span>
        <StateBadge :state="uiState" :label="stateLabel(t, uiState)" />
      </div>
      <div v-if="quote" class="mi-price">
        <div class="mi-price__pair">
          <span class="mi-price__lbl">{{ t('q.bid') }}</span><span class="mi-price__v mi-mono">{{ fmt.num(quote.bid) }}</span>
        </div>
        <div class="mi-price__pair">
          <span class="mi-price__lbl">{{ t('q.ask') }}</span><span class="mi-price__v mi-mono">{{ fmt.num(quote.ask) }}</span>
        </div>
        <div class="mi-price__pair">
          <span class="mi-price__lbl">{{ t('q.spread') }}</span><span class="mi-price__v mi-mono">{{ fmt.num(quote.current_spread_pips) }}</span>
        </div>
      </div>
      <p v-if="banner" class="mi-detail__banner" :class="`mi-detail__banner--${uiState}`" aria-live="polite">{{ banner }}</p>
      <p class="mi-detail__source">
        {{ t('q.source') }}: {{ detail.price_source.source_label }} · {{ t('meta.updated') }}
        {{ fmt.dateTime(detail.freshness.quote_updated_at) }} {{ tz }}
      </p>
    </header>

    <TabList v-model="active" :tabs="tabs" />

    <div role="tabpanel" class="mi-panel">
      <!-- Overview -->
      <dl v-if="active === 'overview'" class="mi-kv mi-kv--wide">
        <div><dt>{{ t('spec.base') }}</dt><dd>{{ detail.currencies.base_currency }}</dd></div>
        <div><dt>{{ t('spec.profit') }}</dt><dd>{{ detail.currencies.profit_currency }}</dd></div>
        <div><dt>{{ t('cond.contract') }}</dt><dd class="mi-mono">{{ fmt.num(detail.spec.contract_size) }}</dd></div>
        <div><dt>{{ t('spec.digits') }}</dt><dd class="mi-mono">{{ detail.spec.digits }}</dd></div>
        <div><dt>{{ t('spec.tick_size') }}</dt><dd class="mi-mono">{{ fmt.num(detail.spec.tick_size) }}</dd></div>
        <div><dt>{{ t('spec.tick_value') }}</dt><dd class="mi-mono">{{ fmt.num(detail.spec.tick_value) }}</dd></div>
        <div><dt>{{ t('m.maxlev') }}</dt><dd class="mi-mono">{{ detail.margin.max_leverage_from }}</dd></div>
      </dl>

      <!-- Trading conditions -->
      <dl v-else-if="active === 'conditions'" class="mi-kv mi-kv--wide">
        <div><dt>{{ t('cond.min') }} / {{ t('cond.max') }}</dt><dd class="mi-mono">{{ fmt.num(tc.min_volume) }} / {{ fmt.num(tc.max_volume) }}</dd></div>
        <div><dt>{{ t('cond.step') }}</dt><dd class="mi-mono">{{ fmt.num(tc.volume_step) }}</dd></div>
        <div><dt>{{ t('q.typical_spread') }}</dt><dd class="mi-mono">{{ fmt.num(tc.typical_spread.value_pips) }}</dd></div>
        <div><dt>{{ t('cost.commission') }}</dt><dd class="mi-mono">{{ fmt.num(tc.commission.amount) }} {{ tc.commission.currency }}</dd></div>
        <div><dt>{{ t('cost.swap_long') }}</dt><dd class="mi-mono">{{ fmt.num(tc.swaps.long) }}</dd></div>
        <div><dt>{{ t('cost.swap_short') }}</dt><dd class="mi-mono">{{ fmt.num(tc.swaps.short) }}</dd></div>
        <div><dt>{{ t('cost.triple') }}</dt><dd>{{ tc.swaps.triple_swap_day }}</dd></div>
        <div><dt>{{ t('exec.mode') }}</dt><dd>{{ ex.execution_mode }}</dd></div>
        <div><dt>{{ t('exec.filling') }}</dt><dd>{{ ex.filling_modes.join(', ') }}</dd></div>
        <div><dt>{{ t('exec.stop_level') }}</dt><dd class="mi-mono">{{ ex.stop_level }}</dd></div>
        <div><dt>{{ t('exec.freeze_level') }}</dt><dd class="mi-mono">{{ ex.freeze_level }}</dd></div>
        <div><dt>{{ t('exec.orders') }}</dt><dd>{{ bool(ex.limit_stop_orders_allowed) }}</dd></div>
        <div><dt>{{ t('exec.short') }}</dt><dd>{{ bool(ex.short_selling) }}</dd></div>
      </dl>

      <!-- Margin -->
      <dl v-else-if="active === 'margin'" class="mi-kv mi-kv--wide">
        <div><dt>{{ t('m.mode') }}</dt><dd>{{ m.margin_mode }}</dd></div>
        <div><dt>{{ t('m.maxlev') }}</dt><dd class="mi-mono">{{ m.max_leverage_from }}</dd></div>
        <div><dt>{{ t('m.rate') }}</dt><dd class="mi-mono">{{ fmt.num(m.margin_rate_from) }}</dd></div>
        <div><dt>{{ t('m.currency') }}</dt><dd>{{ m.margin_currency }}</dd></div>
        <div><dt>{{ t('m.initial') }}</dt><dd>{{ m.initial_margin.value ?? t('val.auto') }}</dd></div>
        <div><dt>{{ t('m.maintenance') }}</dt><dd>{{ m.maintenance_margin.value ?? t('val.auto') }}</dd></div>
        <div><dt>{{ t('m.hedged') }}</dt><dd class="mi-mono">{{ m.hedged_margin }}</dd></div>
      </dl>

      <!-- Sessions -->
      <div v-else-if="active === 'sessions'">
        <table class="mi-sessions">
          <tbody>
            <tr v-for="iv in detail.schedule.regular_intervals" :key="iv.day">
              <th scope="row">{{ iv.day }}</th>
              <td class="mi-mono">{{ iv.open }}–{{ iv.close }}</td>
            </tr>
          </tbody>
        </table>
        <p class="mi-muted">{{ t('hours.tz') }}: {{ detail.schedule.schedule_timezone }}</p>
        <ul v-if="detail.schedule.holiday_exceptions.length" class="mi-holidays">
          <li v-for="h in detail.schedule.holiday_exceptions" :key="h.date">
            {{ h.date }} — {{ h.name }}<template v-if="h.early_close"> ({{ h.early_close }})</template>
          </li>
        </ul>
      </div>

      <!-- Raw parameters -->
      <table v-else class="mi-raw">
        <tbody>
          <tr v-for="[k, v] in rawRows" :key="k"><th scope="row">{{ k }}</th><td class="mi-mono">{{ v }}</td></tr>
        </tbody>
      </table>
    </div>

    <p class="mi-disclaimer">{{ t('meta.disclaimer') }}</p>
  </article>
</template>
