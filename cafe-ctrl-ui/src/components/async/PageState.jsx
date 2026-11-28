import React from "react";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { formatApiError } from "../../lib/apiClient";
import { useDelayedFlag } from "../../lib/async/useAsyncData";
import Spinner from "./Spinner";
import { WarningCircle, Tray } from "@phosphor-icons/react";

/**
 * Standard loading / error / empty wrapper for screens and lists.
 *  - First load: nothing for 300 ms (fast loads don't flicker), then skeleton rows (or a spinner).
 *  - Error with nothing to show: message + Retry.  Error while showing older data: a small banner + Retry.
 *  - Loaded but empty: the empty message.
 */
export default function PageState({ loading, error, data, isEmpty, onRetry, emptyText = "Nothing here yet.",
                                    emptyIcon: EmptyIcon = Tray, skeletonRows = 3, variant = "skeleton", children }) {
  const hasData = data !== undefined && data !== null;
  const showLoader = useDelayedFlag(loading && !hasData, 300);
  const empty = hasData && (typeof isEmpty === "function" ? isEmpty(data) : Array.isArray(data) ? data.length === 0 : !!isEmpty);

  if (!hasData && loading) {
    if (!showLoader) return <div aria-busy="true" className="min-h-[2rem]" />;
    return variant === "spinner" ? (
      <div role="status" aria-busy="true" className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
        <Spinner /> <span>Loading…</span>
      </div>
    ) : (
      <div role="status" aria-busy="true" className="space-y-2" data-testid="page-skeleton">
        <span className="sr-only">Loading…</span>
        {Array.from({ length: skeletonRows }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (error && !hasData) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center" data-testid="page-error">
        <WarningCircle size={28} weight="duotone" className="text-destructive" />
        <div className="text-sm">Couldn't load this: {formatApiError(error)}</div>
        {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>}
      </div>
    );
  }

  return (
    <>
      {error && hasData && (
        <div role="alert" className="mb-3 flex items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          <span>Couldn't refresh: {formatApiError(error)}</span>
          {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>}
        </div>
      )}
      {empty ? (
        <div className="flex items-center gap-3 text-muted-foreground py-6" data-testid="page-empty">
          <EmptyIcon size={28} weight="duotone" /> {emptyText}
        </div>
      ) : children}
    </>
  );
}
