export function segment(
  scores: (number | null)[],
  pars: number[],
  start = 0,
  end = pars.length,
) {
  let total = 0,
    par = 0,
    played = 0;
  for (let i = start; i < Math.min(end, pars.length); i++) {
    if (scores[i] != null) {
      total += scores[i]!;
      par += pars[i];
      played++;
    }
  }
  return { total, toPar: total - par, played };
}
export const relative = (n: number) =>
  n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`;
