import React, { createContext, useContext } from "react";
import { useAsyncAction } from "../../lib/async/useAsyncAction";
import AsyncButton from "./AsyncButton";

const FormBusy = createContext({ busy: false, locked: false });

/**
 * A <form> whose submit (button click OR Enter in a field) runs onSubmit(ctx, event) once at a time, with the
 * same lock, timeout, idempotency and error handling as AsyncButton. The entered values live in the caller's
 * state, so they are kept when a submission fails.
 * Put a <SubmitButton> inside; it shows the spinner while the form is submitting.
 */
export default function AsyncForm({ onSubmit, lockKey, idempotent, timeoutMs, onSuccess, onError, errorToast,
                                    timeoutMessage, children, ...formProps }) {
  const action = useAsyncAction(onSubmit, { lockKey, idempotent, timeoutMs, onSuccess, onError, errorToast, timeoutMessage });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (action.busy) return;
    action.run(e);
  };

  return (
    <FormBusy.Provider value={{ busy: action.pending, locked: action.locked }}>
      <form {...formProps} onSubmit={handleSubmit} aria-busy={action.pending || undefined}>
        {children}
      </form>
    </FormBusy.Provider>
  );
}

/** The submit button of an AsyncForm. */
export function SubmitButton({ disabled, ...props }) {
  const { busy, locked } = useContext(FormBusy);
  return <AsyncButton type="submit" loading={busy} disabled={disabled || locked} {...props} />;
}

/** Busy state of the surrounding AsyncForm (e.g. to disable a Cancel button while saving). */
export function useFormBusy() {
  return useContext(FormBusy).busy;
}
