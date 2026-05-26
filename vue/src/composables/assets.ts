// Asset-class → mctl neon accent. Used for chips + row left-border accents so
// the catalog reads at a glance.
const ACCENTS: Record<string, string> = {
  forex: 'var(--mctl-accent-cyan)',
  crypto: 'var(--mctl-accent-lime)',
  indices: 'var(--mctl-accent-lilac)',
  shares: 'var(--mctl-accent-vermilion)',
  metals: 'var(--mctl-accent-amber)',
  commodities: 'var(--mctl-accent-amber)',
};

export function assetAccent(assetClass: string): string {
  return ACCENTS[assetClass] ?? 'var(--mctl-accent-cyan)';
}
