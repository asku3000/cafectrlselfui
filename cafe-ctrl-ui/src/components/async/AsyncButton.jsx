import React from "react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { useAsyncAction } from "../../lib/async/useAsyncAction";
import Spinner from "./Spinner";

/**
 * A Button whose onClick may be async. While it runs the button is disabled, shows the shared spinner over the
 * (kept, invisible) label so its width never changes, sets aria-busy, and ignores further clicks / Enter / Space.
 *
 * Props (besides normal Button props):
 *  - onClick(ctx, event): the action; ctx.idempotencyKey is set when `idempotent` is true.
 *  - lockKey: string | string[]; buttons sharing a key lock together.
 *  - idempotent, timeoutMs, onSuccess, onError, errorToast, timeoutMessage: see useAsyncAction.
 *  - loading: externally controlled busy state (e.g. a form's submit button).
 *  - loadingText: optional text shown with the spinner (screen readers always get "Working…").
 */
const AsyncButton = React.forwardRef(function AsyncButton(
  { onClick, lockKey, idempotent, timeoutMs, onSuccess, onError, errorToast, timeoutMessage,
    loading: externalLoading = false, loadingText, disabled, children, className, type = "button", onKeyDown, ...props },
  ref,
) {
  const action = useAsyncAction(onClick || (() => undefined),
    { lockKey, idempotent, timeoutMs, onSuccess, onError, errorToast, timeoutMessage });
  const busy = externalLoading || action.pending;
  const blocked = busy || action.locked;

  const handleClick = (e) => {
    if (blocked) {
      e.preventDefault();
      return;
    }
    if (!onClick) return; // e.g. a submit button: the form handles it
    action.run(e);
  };

  const handleKeyDown = (e) => {
    // Holding Enter / Space fires repeated clicks; ignore repeats and anything while busy
    if ((e.key === "Enter" || e.key === " ") && (e.repeat || blocked)) e.preventDefault();
    onKeyDown?.(e);
  };

  return (
    <Button
      ref={ref}
      type={type}
      {...props}
      className={cn("relative", className)}
      disabled={disabled || blocked}
      aria-busy={busy || undefined}
      aria-disabled={disabled || blocked || undefined}
      data-loading={busy ? "true" : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <span className={cn("inline-flex items-center justify-center gap-2", busy && "invisible")}>{children}</span>
      {busy && (
        <span className="absolute inset-0 flex items-center justify-center gap-2">
          <Spinner />
          {loadingText ? <span className="truncate">{loadingText}</span> : <span className="sr-only">Working…</span>}
        </span>
      )}
    </Button>
  );
});

export default AsyncButton;
