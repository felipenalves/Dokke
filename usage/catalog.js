const ORDER = ["claude", "codex", "antigravity", "grok"];

export function createProviderCatalog({ providers = [] } = {}) {
  const byId = new Map();
  for (const provider of Array.isArray(providers) ? providers : []) {
    if (!provider || typeof provider.id !== "string" || typeof provider.normalize !== "function") continue;
    if (!byId.has(provider.id)) byId.set(provider.id, provider);
  }
  return [...byId.values()].sort((left, right) => {
    const a = ORDER.indexOf(left.id);
    const b = ORDER.indexOf(right.id);
    return (a < 0 ? ORDER.length : a) - (b < 0 ? ORDER.length : b) || left.id.localeCompare(right.id);
  });
}

export { ORDER as PROVIDER_ORDER };
