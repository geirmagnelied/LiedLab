// Favorittprosjekt kjem fyrst i alle prosjektlister/nedtrekksmenyar (stabil sortering:
// elles uendra rekkjefølgje), og får ei ★ framfor namnet i vanlege <select>-val.
export function favorittForst(projects) {
  const liste = projects || []
  return [...liste.filter(p => p.favorite), ...liste.filter(p => !p.favorite)]
}
export const prosjektValTekst = (p) => (p.favorite ? '★ ' : '') + p.name
