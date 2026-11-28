import { useSyncExternalStore } from "react";

/**
 * Shared, synchronous locks for related actions ("session:<id>", "card:<id>", ...).
 * While any action holds a key, every other button using that key is disabled, so staff can't e.g.
 * end a game and close the bill on the same session at the same moment.
 * Acquiring is synchronous, so two clicks in the same tick can never both get the lock.
 */
const held = new Set();
const listeners = new Set();

function notify() {
  listeners.forEach(l => l());
}

const toKeys = (lockKey) => (lockKey == null ? [] : (Array.isArray(lockKey) ? lockKey : [lockKey])).filter(Boolean);

/** Takes every key or none. Returns false if any is already held. */
export function tryAcquire(lockKey) {
  const keys = toKeys(lockKey);
  if (keys.some(k => held.has(k))) return false;
  keys.forEach(k => held.add(k));
  if (keys.length) notify();
  return true;
}

export function release(lockKey) {
  const keys = toKeys(lockKey);
  let changed = false;
  keys.forEach(k => { if (held.delete(k)) changed = true; });
  if (changed) notify();
}

export function isHeld(lockKey) {
  return toKeys(lockKey).some(k => held.has(k));
}

function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** True while some action holds any of the given keys (re-renders when that changes). */
export function useLockHeld(lockKey) {
  const keys = toKeys(lockKey).join("|");
  return useSyncExternalStore(subscribe, () => (keys ? keys.split("|").some(k => held.has(k)) : false));
}

/** Test helper. */
export function _resetLocksForTests() {
  held.clear();
  notify();
}
