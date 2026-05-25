import type { UiState } from '../types.ts';

type Dict = Record<string, string>;

const EN: Dict = {
  'app.title': 'Instruments',
  'search.placeholder': 'Search instrument…',
  'filter.all': 'All',
  'filter.asset_class': 'Asset class',
  'filter.status': 'Status',
  'filter.tradable_now': 'Tradable now',
  'col.symbol': 'Instrument',
  'col.spread': 'Spread',
  'col.status': 'Status',
  'col.min': 'Min',
  'col.leverage': 'Leverage',
  'card.quote': 'Quote',
  'card.costs': 'Costs',
  'card.margin': 'Margin & leverage',
  'card.conditions': 'Trading conditions',
  'card.hours': 'Trading hours',
  'card.spec': 'Specification',
  'card.advanced': 'Advanced',
  'q.bid': 'Bid',
  'q.ask': 'Ask',
  'q.mid': 'Mid',
  'q.spread': 'Current spread',
  'q.typical_spread': 'Typical spread',
  'q.updated': 'Updated',
  'q.source': 'Source',
  'cost.commission': 'Commission',
  'cost.swap_long': 'Swap long',
  'cost.swap_short': 'Swap short',
  'cost.triple': 'Triple swap day',
  'm.from': 'from',
  'm.rate': 'Margin rate',
  'm.maxlev': 'Max leverage',
  'm.currency': 'Margin currency',
  'm.tiers': 'Tiers',
  'cond.min': 'Min volume',
  'cond.max': 'Max volume',
  'cond.step': 'Volume step',
  'cond.contract': 'Contract size',
  'spec.digits': 'Digits',
  'spec.tick_size': 'Tick size',
  'spec.tick_value': 'Tick value',
  'spec.base': 'Base currency',
  'spec.profit': 'Profit currency',
  'hours.next_open': 'Next open',
  'hours.next_close': 'Next close',
  'hours.tz': 'Timezone',
  'hours.holiday': 'Holiday exceptions',
  'state.open_realtime': 'Market open',
  'state.open_delayed': 'Delayed data',
  'state.close_only': 'Close only',
  'state.market_closed': 'Market closed',
  'state.holiday_modified': 'Modified hours',
  'state.halt_or_break': 'Trading halted',
  'state.stale_data': 'Quote stale',
  'msg.delayed': 'Prices delayed by {n}',
  'msg.close_only': 'Only position closing is available right now.',
  'msg.closed': 'Market is closed.',
  'msg.holiday': 'Modified trading hours today due to a holiday.',
  'msg.halt': 'Trading is temporarily halted.',
  'msg.stale': 'Quote is stale; live updates are temporarily unavailable.',
  'msg.empty': 'No instruments match the filters.',
  'msg.loading': 'Loading…',
  'msg.error': 'Failed to load data.',
  'back': 'Back to catalog',
};

const RU: Dict = {
  'app.title': 'Инструменты',
  'search.placeholder': 'Поиск инструмента…',
  'filter.all': 'Все',
  'filter.asset_class': 'Класс актива',
  'filter.status': 'Статус',
  'filter.tradable_now': 'Доступные сейчас',
  'col.symbol': 'Инструмент',
  'col.spread': 'Спред',
  'col.status': 'Статус',
  'col.min': 'Мин',
  'col.leverage': 'Плечо',
  'card.quote': 'Котировка',
  'card.costs': 'Издержки',
  'card.margin': 'Маржа и плечо',
  'card.conditions': 'Условия торговли',
  'card.hours': 'Часы торгов',
  'card.spec': 'Спецификация',
  'card.advanced': 'Расширенные параметры',
  'q.bid': 'Bid',
  'q.ask': 'Ask',
  'q.mid': 'Mid',
  'q.spread': 'Текущий спред',
  'q.typical_spread': 'Типичный спред',
  'q.updated': 'Обновлено',
  'q.source': 'Источник',
  'cost.commission': 'Комиссия',
  'cost.swap_long': 'Своп long',
  'cost.swap_short': 'Своп short',
  'cost.triple': 'День тройного свопа',
  'm.from': 'от',
  'm.rate': 'Маржинальная ставка',
  'm.maxlev': 'Макс. плечо',
  'm.currency': 'Валюта маржи',
  'm.tiers': 'Уровни',
  'cond.min': 'Мин. объём',
  'cond.max': 'Макс. объём',
  'cond.step': 'Шаг объёма',
  'cond.contract': 'Размер контракта',
  'spec.digits': 'Знаков',
  'spec.tick_size': 'Размер тика',
  'spec.tick_value': 'Стоимость тика',
  'spec.base': 'Базовая валюта',
  'spec.profit': 'Валюта прибыли',
  'hours.next_open': 'Следующее открытие',
  'hours.next_close': 'Следующее закрытие',
  'hours.tz': 'Часовой пояс',
  'hours.holiday': 'Праздничные исключения',
  'state.open_realtime': 'Рынок открыт',
  'state.open_delayed': 'Данные задержаны',
  'state.close_only': 'Только закрытие',
  'state.market_closed': 'Рынок закрыт',
  'state.holiday_modified': 'Изменённые часы',
  'state.halt_or_break': 'Торги приостановлены',
  'state.stale_data': 'Котировка устарела',
  'msg.delayed': 'Данные задержаны на {n}',
  'msg.close_only': 'Сейчас доступно только закрытие позиций.',
  'msg.closed': 'Рынок закрыт.',
  'msg.holiday': 'Сегодня изменённые часы торгов из-за праздника.',
  'msg.halt': 'Торги временно приостановлены.',
  'msg.stale': 'Котировка устарела, обновление временно недоступно.',
  'msg.empty': 'Нет инструментов по заданным фильтрам.',
  'msg.loading': 'Загрузка…',
  'msg.error': 'Не удалось загрузить данные.',
  'back': 'Назад к каталогу',
};

const CATALOGS: Record<string, Dict> = { 'en-US': EN, 'ru-RU': RU };

export function pickDict(locale: string): Dict {
  if (CATALOGS[locale]) return CATALOGS[locale]!;
  const lang = locale.toLowerCase().split('-')[0];
  if (lang === 'ru') return RU;
  return EN;
}

export function createT(locale: string) {
  const dict = pickDict(locale);
  return (key: string, vars?: Record<string, string | number>): string => {
    let s = dict[key] ?? EN[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  };
}

export type Translator = ReturnType<typeof createT>;

export function stateLabel(t: Translator, state: UiState): string {
  return t(`state.${state}`);
}
