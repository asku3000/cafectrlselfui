import React, { useState } from "react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "../ui/alert-dialog";
import AsyncButton from "./AsyncButton";

/**
 * A confirmation dialog whose Confirm button runs onConfirm(ctx) with the shared loader + lock.
 * The dialog closes only after success; on failure it stays open (with the app's error toast) so staff can
 * retry or cancel. It can't be dismissed while the action is running.
 *
 *  <ConfirmAction trigger={<Button>Delete</Button>} title="Delete resource?" description="..."
 *                 confirmLabel="Delete" destructive onConfirm={...} lockKey="resource:1" idempotent />
 */
export default function ConfirmAction({ trigger, title, description, children, confirmLabel = "Confirm",
                                        cancelLabel = "Cancel", destructive = false, onConfirm, onSuccess,
                                        lockKey, idempotent, timeoutMs, confirmTestId }) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);

  const confirm = async (ctx) => {
    setRunning(true);
    try {
      const result = await onConfirm(ctx);
      setOpen(false);
      return result;
    } finally {
      setRunning(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!running) setOpen(v); }}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent onEscapeKeyDown={(e) => running && e.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={running}>{cancelLabel}</AlertDialogCancel>
          <AsyncButton onClick={confirm} onSuccess={onSuccess} lockKey={lockKey} idempotent={idempotent} timeoutMs={timeoutMs}
                       variant={destructive ? "destructive" : "default"} data-testid={confirmTestId || "confirm-action"}>
            {confirmLabel}
          </AsyncButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
