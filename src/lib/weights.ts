export function toMilligrams(grams: number) {
  return Math.round(grams * 1000);
}

export function formatGrams(grams: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(grams);
}
