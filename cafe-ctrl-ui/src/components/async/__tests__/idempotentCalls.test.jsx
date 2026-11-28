import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import AsyncButton from "../AsyncButton";
import { api, withIdempotency } from "../../../lib/apiClient";
import { _resetLocksForTests } from "../../../lib/async/actionLocks";

jest.mock("sonner", () => ({ toast: { error: jest.fn(), warning: jest.fn(), success: jest.fn(), message: jest.fn() } }));
jest.mock("@phosphor-icons/react", () => new Proxy({}, { get: (_, name) => (name === "__esModule" ? true : () => null) }));

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  _resetLocksForTests();
  jest.restoreAllMocks();
});

/** The pattern every critical screen uses: one click -> one request carrying the action's Idempotency-Key. */
function CloseBill({ onDone }) {
  return (
    <AsyncButton lockKey="session:42" idempotent
                 onClick={async ({ idempotencyKey }) => { await api.post("/sessions/42/checkout", { adjustment: 0 }, withIdempotency(idempotencyKey)); onDone(); }}>
      Close Bill
    </AsyncButton>
  );
}

test("double clicking Close Bill sends exactly one request, carrying an Idempotency-Key", async () => {
  let resolve;
  const post = jest.spyOn(api, "post").mockImplementation(() => new Promise(r => { resolve = r; }));
  const done = jest.fn();
  render(<CloseBill onDone={done} />);
  const btn = screen.getByRole("button");

  fireEvent.click(btn);
  fireEvent.click(btn);
  fireEvent.keyDown(btn, { key: "Enter", repeat: true });
  await flush();

  expect(post).toHaveBeenCalledTimes(1);
  const [url, , config] = post.mock.calls[0];
  expect(url).toBe("/sessions/42/checkout");
  expect(config.headers["Idempotency-Key"]).toMatch(/^[A-Za-z0-9_-]{8,}$/);

  await act(async () => { resolve({ data: {} }); });
  expect(done).toHaveBeenCalledTimes(1);
});

test("a retry after a network failure re-sends the SAME key (so the server can't do it twice)", async () => {
  const post = jest.spyOn(api, "post")
    .mockImplementationOnce(() => Promise.reject(new Error("Network Error")))
    .mockImplementationOnce(() => Promise.resolve({ data: {} }))
    .mockImplementationOnce(() => Promise.resolve({ data: {} }));
  render(<CloseBill onDone={() => {}} />);
  const btn = screen.getByRole("button");

  fireEvent.click(btn); await flush();
  fireEvent.click(btn); await flush();
  fireEvent.click(btn); await flush(); // a new action after success

  const keys = post.mock.calls.map(c => c[2].headers["Idempotency-Key"]);
  expect(keys[1]).toBe(keys[0]);
  expect(keys[2]).not.toBe(keys[1]);
});

test("withIdempotency refuses to send a critical request without a key", () => {
  expect(() => withIdempotency(undefined)).toThrow(/missing key/);
  expect(withIdempotency("abc12345", { headers: { X: "1" } }).headers).toEqual({ X: "1", "Idempotency-Key": "abc12345" });
});
