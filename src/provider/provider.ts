import type {
  AccountConditions,
  AccountType,
  AssetClass,
  Category,
  InstrumentRecord,
  Platform,
  QuoteMode,
  TradingStatus,
} from '../domain/types.ts';

// Dimensions that vary the returned conditions (account/platform).
export interface Dimensions {
  account_type?: AccountType;
  platform?: Platform;
}

export interface CatalogQuery extends Dimensions {
  search?: string;
  asset_class?: AssetClass;
  category?: Category;
  status?: TradingStatus;
  tradable_now?: boolean;
  quote_mode?: QuoteMode;
  tags?: string[];
  jurisdiction?: string;
  sort?: string;
  limit: number;
  cursor?: string;
}

export interface CatalogPage {
  items: InstrumentRecord[];
  next_cursor: string | null;
}

export interface FilterReference {
  asset_classes: { id: AssetClass; label: string; sorting_order: number }[];
  categories: { id: Category; asset_class: AssetClass; label: string }[];
  statuses: { id: TradingStatus; label: string }[];
  quote_modes: { id: QuoteMode; label: string }[];
  tags: { id: string; label: string }[];
}

// The single seam between the API surface and the data source.
// Phase 1 is backed by fixtures; Phase 3 swaps in a real broker adapter
// behind the same interface without touching the routes.
export interface Provider {
  listCatalog(query: CatalogQuery): Promise<CatalogPage>;
  getInstrument(id: string, dims?: Dimensions): Promise<InstrumentRecord | null>;
  getFilterReference(): FilterReference;
  // Bearer-scoped personalized conditions (null when instrument unknown).
  getAccountConditions(id: string, token: string): Promise<AccountConditions | null>;
}
