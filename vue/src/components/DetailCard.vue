<script setup lang="ts">
import { computed } from 'vue';
import type { InstrumentDetail, MarketState, UiState } from '../types.ts';
import type { Translator } from '../composables/i18n.ts';
import type { Formatter } from '../composables/format.ts';
import { stateLabel } from '../composables/i18n.ts';
import StateBadge from './StateBadge.vue';
import AccordionSection from './AccordionSection.vue';

const props = defineProps<{
  detail: InstrumentDetail;
  market: MarketState | null;
  uiState: UiState;
  t: Translator;
  fmt: Formatter;
}>();

const quote = computed(() => props.market?.quote ?? null);
const tz = computed(() => props.market?.session.display_timezone ?? props.detail.schedule.display_timezone ?? 'UTC');

const banner = computed<string | null>(() => {
  const t = props.t;
  switch (props.uiState) {
    case 'open_delayed':
      return t('msg.delayed', { n: props.fmt.duration(props.detail.price_source.delay_seconds || 0) });
    case 'close_only':
      return t('msg.close_only');
    case 'market_closed':
      return t('msg.closed');
    case 'holiday_modified':
      return t('msg.holiday');
    case 'halt_or_break':
      return t('msg.halt');
    case 'stale_data':
      return t('msg.stale');
    default:
      return null;
  }
});
</script>

<template>
  <article class="mi-detail">
    <header class="mi-detail__hero">
      <div class="mi-detail__title">
        <h2>{{ detail.display_symbol }}</h2>
        <span class="mi-detail__name">{{ detail.display_name }}</span>
        <span class="mi-chip">{{ detail.asset_class }}</span>
        <span class="mi-chip">{{ detail.category }}</span>
        <StateBadge :state="uiState" :label="stateLabel(t, uiState)" />
      </div>
      <p v-if="banner" class="mi-detail__banner" :class="`mi-detail__banner--${uiState}`" aria-live="polite">
        {{ banner }}
      </p>
      <p class="mi-detail__source">
        {{ t('q.source') }}: {{ detail.price_source.source_label }} · {{ t('q.updated') }}
        {{ fmt.dateTime(detail.freshness.quote_updated_at) }}
      </p>
    </header>

    <div class="mi-cards">
      <!-- Quote -->
      <div class="mi-card">
        <h3>{{ t('card.quote') }}</h3>
        <dl class="mi-kv">
          <div><dt>{{ t('q.bid') }}</dt><dd>{{ quote ? fmt.num(quote.bid) : '—' }}</dd></div>
          <div><dt>{{ t('q.ask') }}</dt><dd>{{ quote ? fmt.num(quote.ask) : '—' }}</dd></div>
          <div><dt>{{ t('q.mid') }}</dt><dd>{{ quote ? fmt.num(quote.mid) : '—' }}</dd></div>
          <div>
            <dt>{{ t('q.spread') }}</dt>
            <dd>{{ quote ? fmt.num(quote.current_spread_pips) : '—' }} pips</dd>
          </div>
        </dl>
      </div>

      <!-- Costs -->
      <div class="mi-card">
        <h3>{{ t('card.costs') }}</h3>
        <dl class="mi-kv">
          <div>
            <dt>{{ t('q.typical_spread') }}</dt>
            <dd>
              {{ fmt.num(detail.trading_conditions.typical_spread.value_pips) }} pips
              <small>({{ detail.trading_conditions.typical_spread.period_label }})</small>
            </dd>
          </div>
          <div>
            <dt>{{ t('cost.commission') }}</dt>
            <dd>{{ fmt.num(detail.trading_conditions.commission.amount) }} {{ detail.trading_conditions.commission.currency }}</dd>
          </div>
          <div><dt>{{ t('cost.swap_long') }}</dt><dd>{{ fmt.num(detail.trading_conditions.swaps.long) }}</dd></div>
          <div><dt>{{ t('cost.swap_short') }}</dt><dd>{{ fmt.num(detail.trading_conditions.swaps.short) }}</dd></div>
        </dl>
      </div>

      <!-- Margin -->
      <div class="mi-card">
        <h3>{{ t('card.margin') }}</h3>
        <dl class="mi-kv">
          <div><dt>{{ t('m.rate') }}</dt><dd>{{ t('m.from') }} {{ fmt.num(detail.margin.margin_rate_from) }}</dd></div>
          <div><dt>{{ t('m.maxlev') }}</dt><dd>{{ t('m.from') }} {{ detail.margin.max_leverage_from }}</dd></div>
          <div><dt>{{ t('m.currency') }}</dt><dd>{{ detail.currencies.margin_currency }}</dd></div>
        </dl>
      </div>
    </div>

    <AccordionSection :title="t('card.conditions')" :default-open="true">
      <dl class="mi-kv mi-kv--wide">
        <div><dt>{{ t('cond.min') }}</dt><dd>{{ fmt.num(detail.trading_conditions.min_volume) }}</dd></div>
        <div><dt>{{ t('cond.max') }}</dt><dd>{{ fmt.num(detail.trading_conditions.max_volume) }}</dd></div>
        <div><dt>{{ t('cond.step') }}</dt><dd>{{ fmt.num(detail.trading_conditions.volume_step) }}</dd></div>
        <div><dt>{{ t('cond.contract') }}</dt><dd>{{ fmt.num(detail.spec.contract_size) }}</dd></div>
      </dl>
    </AccordionSection>

    <AccordionSection :title="t('card.hours')" :default-open="uiState === 'market_closed' || uiState === 'holiday_modified'">
      <dl class="mi-kv mi-kv--wide">
        <div><dt>{{ t('hours.next_open') }}</dt><dd>{{ fmt.dateTime(detail.schedule.next_open_at) }}</dd></div>
        <div><dt>{{ t('hours.next_close') }}</dt><dd>{{ fmt.dateTime(detail.schedule.next_close_at) }}</dd></div>
        <div><dt>{{ t('hours.tz') }}</dt><dd>{{ tz }} ({{ detail.schedule.schedule_timezone }})</dd></div>
      </dl>
      <ul v-if="detail.schedule.holiday_exceptions.length" class="mi-holidays">
        <li v-for="h in detail.schedule.holiday_exceptions" :key="h.date">
          {{ h.date }} — {{ h.name }}
          <template v-if="h.early_close"> ({{ h.early_close }})</template>
        </li>
      </ul>
    </AccordionSection>

    <AccordionSection :title="t('card.spec')">
      <dl class="mi-kv mi-kv--wide">
        <div><dt>{{ t('spec.digits') }}</dt><dd>{{ detail.spec.digits }}</dd></div>
        <div><dt>{{ t('spec.tick_size') }}</dt><dd>{{ fmt.num(detail.spec.tick_size) }}</dd></div>
        <div><dt>{{ t('spec.tick_value') }}</dt><dd>{{ fmt.num(detail.spec.tick_value) }}</dd></div>
        <div><dt>{{ t('spec.base') }}</dt><dd>{{ detail.currencies.base_currency }}</dd></div>
        <div><dt>{{ t('spec.profit') }}</dt><dd>{{ detail.currencies.profit_currency }}</dd></div>
      </dl>
    </AccordionSection>

    <AccordionSection :title="t('card.advanced')">
      <p class="mi-muted">{{ detail.disclosures.spread }}</p>
      <p class="mi-muted">{{ detail.disclosures.financing }}</p>
      <div class="mi-tags">
        <span v-for="tag in detail.tags" :key="tag" class="mi-chip mi-chip--sm">{{ tag }}</span>
      </div>
    </AccordionSection>
  </article>
</template>
