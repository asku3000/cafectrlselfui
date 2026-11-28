import React, { useState } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { toast } from "sonner";
import AsyncButton from "../AsyncButton";
import AsyncForm, { SubmitButton } from "../AsyncForm";
import ConfirmAction from "../ConfirmAction";
import PageState from "../PageState";
import { Button } from "../../ui/button";
import { _resetLocksForTests, isHeld } from "../../../lib/async/actionLocks";

jest.mock("sonner", () => ({ toast: { error: jest.fn(), warning: jest.fn(), success: jest.fn(), message: jest.fn() } }));
// Icons are irrelevant here; avoid loading the icon package's ESM build in Jest
jest.mock("@phosphor-icons/react", () => new Proxy({}, { get: (_, name) => (name === "__esModule" ? true : () => null) }));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const flush = () => act(async () => { await Promise.resolve(); });
const apiError = (status, detail) => Object.assign(new Error(detail), { response: { status, data: { detail } } });

beforeEach(() => {
  _resetLocksForTests();
  jest.clearAllMocks();
  jest.useRealTimers();
});

// ---------------------------------------------------------------- AsyncButton

test("a fast double / triple click triggers the action only once", async () => {
  const d = deferred();
  const action = jest.fn(() => d.promise);
  render(<AsyncButton onClick={action}>Close Bill</AsyncButton>);
  const btn = screen.getByRole("button");

  fireEvent.click(btn);
  fireEvent.click(btn); // same tick: React hasn't re-rendered yet, the ref lock must stop it
  fireEvent.click(btn);
  await flush();

  expect(action).toHaveBeenCalledTimes(1);
  expect(btn).toBeDisabled();
  expect(btn).toHaveAttribute("aria-busy", "true");
  expect(screen.getByTestId("spinner")).toBeInTheDocument();

  await act(async () => { d.resolve("ok"); });
  expect(btn).not.toBeDisabled();
  expect(btn).not.toHaveAttribute("aria-busy");
  fireEvent.click(btn);
  await flush();
  expect(action).toHaveBeenCalledTimes(2); // usable again after it finished
});

test("the label stays in the DOM while loading, so the width doesn't jump", async () => {
  const d = deferred();
  render(<AsyncButton onClick={() => d.promise}>Recharge card</AsyncButton>);
  fireEvent.click(screen.getByRole("button"));
  await flush();
  expect(screen.getByText("Recharge card")).toHaveClass("invisible");
  expect(screen.getByText("Working…")).toHaveClass("sr-only");
  await act(async () => { d.resolve(); });
});

test("re-enables after an error and shows the normal error toast", async () => {
  const action = jest.fn(() => Promise.reject(apiError(409, "Card has only ₹50.00")));
  render(<AsyncButton onClick={action}>Pay</AsyncButton>);
  const btn = screen.getByRole("button");
  fireEvent.click(btn);
  await flush();
  await flush();
  expect(toast.error).toHaveBeenCalledWith("Card has only ₹50.00");
  expect(btn).not.toBeDisabled();
});

test("re-enables after the timeout so a button can never stay stuck", async () => {
  jest.useFakeTimers();
  const action = jest.fn(() => new Promise(() => {})); // never answers
  render(<AsyncButton onClick={action} timeoutMs={1000}>Start</AsyncButton>);
  const btn = screen.getByRole("button");
  fireEvent.click(btn);
  await flush();
  expect(btn).toBeDisabled();
  await act(async () => { jest.advanceTimersByTime(1000); });
  await flush();
  expect(btn).not.toBeDisabled();
  expect(toast.warning).toHaveBeenCalled();
});

test("held Enter / Space repeats are ignored", async () => {
  const d = deferred();
  const action = jest.fn(() => d.promise);
  render(<AsyncButton onClick={action}>Save</AsyncButton>);
  const btn = screen.getByRole("button");
  const repeat = fireEvent.keyDown(btn, { key: "Enter", repeat: true });
  expect(repeat).toBe(false); // default prevented
  await act(async () => { d.resolve(); });
});

test("related buttons on the same item lock together", async () => {
  const d = deferred();
  const endGame = jest.fn(() => d.promise);
  const pay = jest.fn(() => Promise.resolve());
  render(<>
    <AsyncButton onClick={endGame} lockKey="session:1">End</AsyncButton>
    <AsyncButton onClick={pay} lockKey="session:1">Pay</AsyncButton>
    <AsyncButton onClick={pay} lockKey="session:2">Other session</AsyncButton>
  </>);
  const [end, payBtn, other] = screen.getAllByRole("button");

  fireEvent.click(end);
  fireEvent.click(payBtn); // same tick: the shared lock is already held
  await flush();
  expect(endGame).toHaveBeenCalledTimes(1);
  expect(pay).not.toHaveBeenCalled();
  expect(payBtn).toBeDisabled();
  expect(payBtn).not.toHaveAttribute("aria-busy"); // locked, but not the one working
  expect(other).not.toBeDisabled();

  await act(async () => { d.resolve(); });
  expect(payBtn).not.toBeDisabled();
});

test("idempotency key: kept for a safe retry after a network error, new after success or a definitive answer", async () => {
  const keys = [];
  const outcomes = [
    () => Promise.reject(new Error("Network Error")), // no response: retry must replay the same key
    () => Promise.resolve("ok"),
    () => Promise.reject(apiError(400, "Invalid")),     // definitive: next attempt is a new action
    () => Promise.resolve("ok"),
  ];
  const action = jest.fn(({ idempotencyKey }) => { keys.push(idempotencyKey); return outcomes[keys.length - 1](); });
  render(<AsyncButton onClick={action} idempotent>Recharge</AsyncButton>);
  const btn = screen.getByRole("button");
  for (let i = 0; i < 4; i++) {
    fireEvent.click(btn);
    await flush();
    await flush();
  }
  expect(keys).toHaveLength(4);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
  expect(keys[2]).not.toBe(keys[1]);
  expect(keys[3]).not.toBe(keys[2]);
});

test("closing the screen mid-request releases the lock without React warnings", async () => {
  const d = deferred();
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  const { unmount } = render(<AsyncButton onClick={() => d.promise} lockKey="card:9">Adjust</AsyncButton>);
  fireEvent.click(screen.getByRole("button"));
  await flush();
  expect(isHeld("card:9")).toBe(true);
  unmount();
  expect(isHeld("card:9")).toBe(false);
  await act(async () => { d.resolve(); });
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});

// ---------------------------------------------------------------- AsyncForm

function CardForm({ onSubmit }) {
  const [amount, setAmount] = useState("");
  return (
    <AsyncForm onSubmit={onSubmit}>
      <input aria-label="amount" value={amount} onChange={e => setAmount(e.target.value)} />
      <SubmitButton>Save</SubmitButton>
    </AsyncForm>
  );
}

test("Enter-key double submit sends the form only once and the submit button shows the loader", async () => {
  const d = deferred();
  const submit = jest.fn(() => d.promise);
  render(<CardForm onSubmit={submit} />);
  const form = screen.getByLabelText("amount").closest("form");
  fireEvent.submit(form); // what pressing Enter in a field does
  fireEvent.submit(form);
  await flush();
  expect(submit).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /save/i }));
  await flush();
  expect(submit).toHaveBeenCalledTimes(1);
  await act(async () => { d.resolve(); });
  expect(screen.getByRole("button", { name: /save/i })).not.toBeDisabled();
});

test("entered values are kept when the submission fails", async () => {
  const submit = jest.fn(() => Promise.reject(apiError(400, "Enter a valid amount")));
  render(<CardForm onSubmit={submit} />);
  fireEvent.change(screen.getByLabelText("amount"), { target: { value: "500.25" } });
  fireEvent.submit(screen.getByLabelText("amount").closest("form"));
  await flush();
  await flush();
  expect(toast.error).toHaveBeenCalledWith("Enter a valid amount");
  expect(screen.getByLabelText("amount")).toHaveValue("500.25");
  expect(screen.getByRole("button", { name: /save/i })).not.toBeDisabled();
});

// ---------------------------------------------------------------- ConfirmAction

test("a confirmation dialog closes only after success", async () => {
  const fail = deferred();
  let attempt = 0;
  const onConfirm = jest.fn(() => (++attempt === 1 ? fail.promise : Promise.resolve()));
  render(<ConfirmAction trigger={<Button>Void bill</Button>} title="Void this bill?" confirmLabel="Void" destructive onConfirm={onConfirm} />);

  fireEvent.click(screen.getByRole("button", { name: "Void bill" }));
  const confirm = screen.getByTestId("confirm-action");
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  await flush();
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(confirm).toBeDisabled();

  await act(async () => { fail.reject(apiError(400, "Only a billed session can be voided")); });
  await flush();
  expect(screen.getByText("Void this bill?")).toBeInTheDocument(); // still open after failure
  expect(toast.error).toHaveBeenCalledWith("Only a billed session can be voided");

  fireEvent.click(screen.getByTestId("confirm-action"));
  await flush();
  await flush();
  expect(onConfirm).toHaveBeenCalledTimes(2);
  expect(screen.queryByText("Void this bill?")).not.toBeInTheDocument(); // closed after success
});

// ---------------------------------------------------------------- PageState

test("page loader waits 300 ms before showing, then skeleton; error offers retry; empty state", async () => {
  jest.useFakeTimers();
  const { rerender } = render(<PageState loading data={undefined}>content</PageState>);
  expect(screen.queryByTestId("page-skeleton")).not.toBeInTheDocument();
  await act(async () => { jest.advanceTimersByTime(299); });
  expect(screen.queryByTestId("page-skeleton")).not.toBeInTheDocument();
  await act(async () => { jest.advanceTimersByTime(1); });
  expect(screen.getByTestId("page-skeleton")).toBeInTheDocument();

  const retry = jest.fn();
  rerender(<PageState loading={false} error={apiError(500, "Server down")} data={undefined} onRetry={retry}>content</PageState>);
  expect(screen.getByTestId("page-error")).toHaveTextContent("Server down");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(retry).toHaveBeenCalled();

  rerender(<PageState loading={false} data={[]} emptyText="No cards yet.">content</PageState>);
  expect(screen.getByTestId("page-empty")).toHaveTextContent("No cards yet.");

  rerender(<PageState loading={false} data={[1]}>content</PageState>);
  expect(screen.getByText("content")).toBeInTheDocument();
});
