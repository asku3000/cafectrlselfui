// Player-based pricing helpers shared by every "start a game" form.
// A rate card lists the player counts it is priced for (player_counts, e.g. PS5 [1, 2, 3, 4]).
// More than one count = "player-priced": staff must pick the count (each has its own rate).
// One count (pool table, steering sim: [1]) = nothing to choose; that count is used.

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]; // Date#getDay() order

/** Counts the card is priced for: sorted, distinct, positive whole numbers; [1] when the card lists none. */
export function playerCountsOf(rateCard) {
  const raw = Array.isArray(rateCard?.player_counts) ? rateCard.player_counts : [];
  const pcs = Array.from(new Set(raw.map(Number).filter((n) => Number.isInteger(n) && n > 0))).sort((a, b) => a - b);
  return pcs.length ? pcs : [1];
}

export function isPlayerPriced(rateCard) {
  return playerCountsOf(rateCard).length > 1;
}

/**
 * The player_count to send for a new game: the chosen one for player-priced cards (null until chosen),
 * otherwise the card's only count.
 */
export function playerCountToSend(rateCard, chosen) {
  if (isPlayerPriced(rateCard)) return chosen ? Number(chosen) : null;
  return playerCountsOf(rateCard)[0];
}

const rupees = (n) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Price text for a player count on the entry time's weekday: "₹250/hr", else "₹140 / 30 min"; null if unpriced. */
export function rateText(rateCard, playerCount, startLocal) {
  const when = startLocal ? new Date(startLocal) : new Date();
  const day = WEEKDAYS[(Number.isNaN(when.getTime()) ? new Date() : when).getDay()];
  const slabs = Array.isArray(rateCard?.weekday_prices?.[day]) ? rateCard.weekday_prices[day] : [];
  const priceOf = (slab) => {
    const p = Number(slab?.prices?.[String(playerCount)]);
    return Number.isFinite(p) && p > 0 ? p : null;
  };
  const hourly = slabs.find((s) => Number(s.duration) === 60 && priceOf(s) != null);
  if (hourly) return `${rupees(priceOf(hourly))}/hr`;
  const any = slabs.find((s) => priceOf(s) != null);
  return any ? `${rupees(priceOf(any))} / ${Number(any.duration)} min` : null;
}

export const playersLabel = (n) => `${n} Player${Number(n) === 1 ? "" : "s"}`;
