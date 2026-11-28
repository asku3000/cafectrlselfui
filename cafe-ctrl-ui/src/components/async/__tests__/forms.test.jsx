import React, { useState } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { toast } from "sonner";
import AsyncForm, { SubmitButton } from "../AsyncForm";
import { Button } from "../../ui/button";
import { _resetLocksForTests } from "../../../lib/async/actionLocks";

jest.mock("sonner", () => ({ toast: { error: jest.fn(), warning: jest.fn(), success: jest.fn(), message: jest.fn() } }));
jest.mock("@phosphor-icons/react", () => new Proxy({}, { get: (_, name) => (name === "__esModule" ? true : () => null) }));

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => { _resetLocksForTests(); jest.clearAllMocks(); });

/** Shaped like the Staff / Plan / Game type dialogs: values live in state, Cancel is a plain Button. */
function NameForm({ save, onCancel = () => {} }) {
  const [name, setName] = useState("");
  return (
    <AsyncForm onSubmit={() => save(name)} data-testid="form">
      <input aria-label="name" value={name} onChange={e => setName(e.target.value)} />
      <Button variant="outline" onClick={onCancel}>Cancel</Button>
      <SubmitButton>Save</SubmitButton>
    </AsyncForm>
  );
}

test("Enter pressed twice (and Enter + click) submits once while the first save is running", async () => {
  let resolve;
  const save = jest.fn(() => new Promise(r => { resolve = r; }));
  render(<NameForm save={save} />);
  const input = screen.getByLabelText("name");
  fireEvent.change(input, { target: { value: "Snooker" } });

  fireEvent.submit(screen.getByTestId("form"));    // Enter in the field
  fireEvent.submit(screen.getByTestId("form"));    // Enter again
  fireEvent.click(screen.getByRole("button", { name: /save/i }));
  await flush();

  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith("Snooker");
  const btn = screen.getByRole("button", { name: /save/i });
  expect(btn).toBeDisabled();
  expect(btn).toHaveAttribute("aria-busy", "true");

  await act(async () => { resolve(); });
  expect(screen.getByRole("button", { name: /save/i })).not.toBeDisabled();
});

test("a failed save shows the error toast, keeps what was typed and can be submitted again", async () => {
  const save = jest.fn()
    .mockRejectedValueOnce({ response: { status: 400, data: { detail: "Name already exists" } } })
    .mockResolvedValueOnce();
  render(<NameForm save={save} />);
  const input = screen.getByLabelText("name");
  fireEvent.change(input, { target: { value: "PS5" } });

  fireEvent.submit(screen.getByTestId("form"));
  await flush();
  expect(toast.error).toHaveBeenCalledTimes(1);
  expect(input).toHaveValue("PS5");
  expect(screen.getByRole("button", { name: /save/i })).not.toBeDisabled();

  fireEvent.submit(screen.getByTestId("form"));
  await flush();
  expect(save).toHaveBeenCalledTimes(2);
});

test("Cancel (a plain Button) inside a form does not submit it", async () => {
  const save = jest.fn();
  const cancel = jest.fn();
  render(<NameForm save={save} onCancel={cancel} />);
  const cancelBtn = screen.getByRole("button", { name: /cancel/i });
  expect(cancelBtn).toHaveAttribute("type", "button");
  fireEvent.click(cancelBtn);
  await flush();
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(save).not.toHaveBeenCalled();
});

test("required fields are still checked by the browser before submitting", async () => {
  const save = jest.fn();
  function Required() {
    return (
      <AsyncForm onSubmit={save}>
        <input aria-label="email" required defaultValue="" />
        <SubmitButton>Sign in</SubmitButton>
      </AsyncForm>
    );
  }
  render(<Required />);
  expect(screen.getByRole("button", { name: /sign in/i }).closest("form")).not.toHaveAttribute("novalidate");
});
