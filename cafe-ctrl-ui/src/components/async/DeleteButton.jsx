import React from "react";
import { Trash } from "@phosphor-icons/react";
import { Button } from "../ui/button";
import ConfirmAction from "./ConfirmAction";
import { useLockHeld } from "../../lib/async/actionLocks";

/**
 * Trash icon -> "Delete X?" confirmation -> onDelete({ idempotencyKey }) with the shared loader and a per-item lock.
 * The dialog stays open (with the error toast) if the delete fails, and closes only once it succeeded.
 *
 *  <DeleteButton what={`operator ${u.name}`} lockKey={`staff:${u.id}`} onDelete={() => remove(u.id)} />
 */
export default function DeleteButton({ what, description, lockKey, onDelete, idempotent = true, size = 16,
                                       className, testId, confirmTestId }) {
  const busy = useLockHeld(lockKey);
  return (
    <ConfirmAction
      trigger={
        <Button size="icon" variant="ghost" className={className} disabled={busy} aria-label={`Delete ${what}`} data-testid={testId}>
          <Trash size={size} />
        </Button>
      }
      title={`Delete ${what}?`}
      description={description || "This can't be undone."}
      confirmLabel="Delete"
      destructive
      onConfirm={onDelete}
      lockKey={lockKey}
      idempotent={idempotent}
      confirmTestId={confirmTestId || (testId ? `${testId}-confirm` : "delete-confirm")}
    />
  );
}
