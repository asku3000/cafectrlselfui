import React from "react";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { isPlayerPriced, playerCountsOf, playersLabel, rateText } from "../lib/playerPricing";

/**
 * "Number of players" for starting a game. Only shown for player-priced resources (rate card with more than one
 * player count). Starts EMPTY on purpose: staff must pick the count, and the rate for it is shown to double-check.
 * Resources with a single count (pool, steering) render nothing; their count is sent automatically.
 */
export default function PlayerCountField({ rateCard, value, onChange, startTime, testId = "players" }) {
  if (!rateCard || !isPlayerPriced(rateCard)) return null;
  const chosen = value ? Number(value) : null;
  const rate = chosen ? rateText(rateCard, chosen, startTime) : null;
  const hintId = `${testId}-hint`;

  return (
    <div>
      <Label>Number of Players <span className="text-destructive">*</span></Label>
      <Select value={chosen ? String(chosen) : ""} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger data-testid={testId} aria-describedby={hintId} aria-invalid={!chosen || undefined}>
          <SelectValue placeholder="Select players" />
        </SelectTrigger>
        <SelectContent>
          {playerCountsOf(rateCard).map((pc) => (
            <SelectItem key={pc} value={String(pc)} data-testid={`${testId}-option-${pc}`}>{playersLabel(pc)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {chosen ? (
        <p id={hintId} className="mt-1 text-sm font-semibold text-primary" data-testid={`${testId}-rate`}>
          {playersLabel(chosen)} — {rate || "no price set for this day"}
        </p>
      ) : (
        <p id={hintId} className="mt-1 text-sm text-destructive" data-testid={`${testId}-required`}>
          Choose the number of players — each count has its own rate.
        </p>
      )}
    </div>
  );
}
