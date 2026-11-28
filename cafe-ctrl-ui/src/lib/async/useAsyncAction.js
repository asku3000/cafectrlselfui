import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { formatApiError, newRequestId } from "../apiClient";
import { tryAcquire, release, useLockHeld } from "./actionLocks";

export const DEFAULT_TIMEOUT_MS = 30000;

export class ActionTimeoutError extends Error {
  constructor() {
    super("This is taking longer than expected.");
    this.name = "ActionTimeoutError";
  }
}

/**
 * A server answer that means "this attempt is over, don't replay it": validation errors, conflicts, not found...
 * After such an answer a retry is a NEW action and gets a new idempotency key. Network errors, timeouts and
 * 5xx keep the key, so retrying replays the original request and the server returns the first result.
 */
export function isDefinitiveFailure(err) {
  const s = err?.response?.status;
  return s != null && s >= 400 && s < 500 && s !== 408 && s !== 429;
}

/**
 * Runs an async action once at a time.
 *  - The lock is a ref set synchronously on the first call, so double clicks / repeated Enter are ignored.
 *  - Optional lockKey (string or array) also locks every other action sharing the key (see actionLocks).
 *  - idempotent: passes { idempotencyKey } to the action; the key is kept for safe retries until success or a
 *    definitive server answer (see isDefinitiveFailure).
 *  - Gives up waiting after timeoutMs (button becomes usable again and staff are told to check before retrying).
 *  - Errors show the app's normal toast unless errorToast is false; nothing is lost, so the user can retry.
 *  - If the component unmounts mid-request, locks are released and no state is updated.
 *
 * The action is called as fn({ idempotencyKey }, ...args). run() resolves to its result, or undefined if the
 * call was ignored (already running) or failed.
 */
export function useAsyncAction(fn, options = {}) {
  const {
    lockKey,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    idempotent = false,
    onSuccess,
    onError,
    errorToast = true,
    timeoutMessage,
  } = options;

  const fnRef = useRef(fn);
  const optsRef = useRef(options);
  fnRef.current = fn;
  optsRef.current = options;

  const runningRef = useRef(false);
  const mountedRef = useRef(true);
  const keyRef = useRef(null);
  const heldKeyRef = useRef(null);
  const [pending, setPending] = useState(false);
  const lockedElsewhere = useLockHeld(lockKey);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (heldKeyRef.current) release(heldKeyRef.current);
      heldKeyRef.current = null;
      runningRef.current = false;
    };
  }, []);

  const run = useCallback(async (...args) => {
    if (runningRef.current) return undefined;
    const key = optsRef.current.lockKey;
    if (!tryAcquire(key)) return undefined;
    runningRef.current = true;
    heldKeyRef.current = key;
    setPending(true);

    if (optsRef.current.idempotent && !keyRef.current) keyRef.current = newRequestId();
    const ctx = { idempotencyKey: keyRef.current };

    let timer;
    const timeout = new Promise((_, reject) => {
      const ms = optsRef.current.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      if (ms > 0) timer = setTimeout(() => reject(new ActionTimeoutError()), ms);
    });

    try {
      const result = await Promise.race([Promise.resolve().then(() => fnRef.current(ctx, ...args)), timeout]);
      keyRef.current = null; // the action is done; the next click is a new action
      if (mountedRef.current) optsRef.current.onSuccess?.(result);
      return result;
    } catch (err) {
      if (isDefinitiveFailure(err)) keyRef.current = null;
      if (mountedRef.current) {
        if (err instanceof ActionTimeoutError) {
          toast.warning(optsRef.current.timeoutMessage || (optsRef.current.idempotent
            ? "This is taking longer than expected. Check whether it went through; trying again is safe."
            : "This is taking longer than expected. Check whether it went through before trying again."));
        } else if (optsRef.current.errorToast !== false) {
          toast.error(formatApiError(err));
        }
        optsRef.current.onError?.(err);
      }
      return undefined;
    } finally {
      clearTimeout(timer);
      if (heldKeyRef.current === key) {
        release(key);
        heldKeyRef.current = null;
      }
      runningRef.current = false;
      if (mountedRef.current) setPending(false);
    }
  }, []);

  /** Forget the idempotency key (e.g. the form was reopened for a new action). */
  const resetKey = useCallback(() => { keyRef.current = null; }, []);

  return { run, pending, locked: lockedElsewhere && !pending, busy: pending || lockedElsewhere, resetKey };
}
