import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { toast } from "sonner";
import DeleteButton from "../DeleteButton";
import AsyncButton from "../AsyncButton";
import { api, deleteIfExists, withIdempotency } from "../../../lib/apiClient";
import { _resetLocksForTests } from "../../../lib/async/actionLocks";

jest.mock("sonner", () => ({ toast: { error: jest.fn(), warning: jest.fn(), success: jest.fn(), message: jest.fn() } }));
jest.mock("@phosphor-icons/react", () => new Proxy({}, { get: (_, name) => (name === "__esModule" ? true : () => null) }));

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => { _resetLocksForTests(); jest.clearAllMocks(); jest.restoreAllMocks(); });

test("the trash icon only asks; nothing is deleted until Delete is confirmed", async () => {
  const onDelete = jest.fn().mockResolvedValue();
  render(<DeleteButton what="PS5-1" lockKey="resource:1" onDelete={onDelete} testId="del" />);

  fireEvent.click(screen.getByTestId("del"));
  expect(await screen.findByText("Delete PS5-1?")).toBeInTheDocument();
  expect(onDelete).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
  await flush();
  expect(onDelete).not.toHaveBeenCalled();
});

test("double clicking Delete deletes once, and the dialog closes only after it succeeded", async () => {
  let resolve;
  const onDelete = jest.fn(() => new Promise(r => { resolve = r; }));
  render(<DeleteButton what="PS5-1" lockKey="resource:1" onDelete={onDelete} testId="del" />);
  fireEvent.click(screen.getByTestId("del"));
  const confirm = await screen.findByTestId("del-confirm");

  fireEvent.click(confirm);
  fireEvent.click(confirm);
  await flush();
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Delete PS5-1?")).toBeInTheDocument(); // still open while running
  expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
  expect(screen.getByTestId("del")).toBeDisabled();               // the row's trash icon is locked too

  await act(async () => { resolve(); });
  await flush();
  expect(screen.queryByText("Delete PS5-1?")).not.toBeInTheDocument();
});

test("a failed delete keeps the dialog open with the error so it can be retried", async () => {
  const onDelete = jest.fn()
    .mockRejectedValueOnce({ response: { status: 409, data: { detail: "Resource is in use" } } })
    .mockResolvedValueOnce();
  render(<DeleteButton what="PS5-1" lockKey="resource:1" onDelete={onDelete} testId="del" />);
  fireEvent.click(screen.getByTestId("del"));
  fireEvent.click(await screen.findByTestId("del-confirm"));
  await flush();

  expect(toast.error).toHaveBeenCalledWith("Resource is in use");
  expect(screen.getByText("Delete PS5-1?")).toBeInTheDocument();
  fireEvent.click(screen.getByTestId("del-confirm"));
  await flush();
  expect(onDelete).toHaveBeenCalledTimes(2);
});

test("other buttons on the same item are locked while its delete runs", async () => {
  let resolve;
  const onDelete = jest.fn(() => new Promise(r => { resolve = r; }));
  render(<>
    <DeleteButton what="PS5-1" lockKey="resource:1" onDelete={onDelete} testId="del" />
    <AsyncButton lockKey="resource:1" onClick={() => {}} data-testid="edit">Edit</AsyncButton>
    <AsyncButton lockKey="resource:2" onClick={() => {}} data-testid="other">Other</AsyncButton>
  </>);
  fireEvent.click(screen.getByTestId("del"));
  fireEvent.click(await screen.findByTestId("del-confirm"));
  await flush();
  expect(screen.getByTestId("edit")).toBeDisabled();
  expect(screen.getByTestId("other")).not.toBeDisabled();
  await act(async () => { resolve(); });
  expect(screen.getByTestId("edit")).not.toBeDisabled();
});

test("deleteIfExists: 404 means it was already gone (no error), other failures are thrown", async () => {
  const del = jest.spyOn(api, "delete")
    .mockResolvedValueOnce({})
    .mockRejectedValueOnce({ response: { status: 404 } })
    .mockRejectedValueOnce({ response: { status: 500 } });
  await expect(deleteIfExists("/x/1")).resolves.toBe(true);
  await expect(deleteIfExists("/x/1")).resolves.toBe(false);
  await expect(deleteIfExists("/x/1")).rejects.toEqual({ response: { status: 500 } });
  expect(del).toHaveBeenCalledTimes(3);
});

test("a delete sends an Idempotency-Key, and a retry after a network error re-sends the same key", async () => {
  const del = jest.spyOn(api, "delete")
    .mockRejectedValueOnce(new Error("Network Error"))
    .mockResolvedValueOnce({});
  const remove = ({ idempotencyKey }) => deleteIfExists("/resources/1", withIdempotency(idempotencyKey));
  render(<DeleteButton what="PS5-1" lockKey="resource:1" onDelete={remove} testId="del" />);
  fireEvent.click(screen.getByTestId("del"));
  fireEvent.click(await screen.findByTestId("del-confirm"));
  await flush();
  fireEvent.click(screen.getByTestId("del-confirm")); // dialog stayed open after the failure: retry
  await flush();
  const keys = del.mock.calls.map(c => c[1].headers["Idempotency-Key"]);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toMatch(/^[A-Za-z0-9_-]{8,}$/);
  expect(keys[1]).toBe(keys[0]);
});
