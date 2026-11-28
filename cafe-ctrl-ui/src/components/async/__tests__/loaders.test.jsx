import React, { useState } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import PageState from "../PageState";
import { useLoadStatus } from "../../../lib/async/useAsyncData";

jest.mock("sonner", () => ({ toast: { error: jest.fn(), warning: jest.fn(), success: jest.fn(), message: jest.fn() } }));
jest.mock("@phosphor-icons/react", () => new Proxy({}, { get: (_, name) => (name === "__esModule" ? true : () => null) }));

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

/** Shaped like the setup pages: the loader fills page state, PageState shows loading / error / empty. */
function Rows({ fetchRows, dep = 0, pollMs }) {
  const [rows, setRows] = useState([]);
  const { reload, ...status } = useLoadStatus(async ({ isStale }) => {
    const data = await fetchRows(dep);
    if (!isStale()) setRows(data);
  }, [dep], { pollMs });
  return (
    <PageState loading={status.loading} error={status.error} data={status.loaded ? rows : undefined} onRetry={reload} emptyText="No rows yet.">
      <ul>{rows.map(r => <li key={r}>{r}</li>)}</ul>
    </PageState>
  );
}

test("nothing flashes for fast loads; a skeleton appears only after 300 ms", async () => {
  let resolve;
  render(<Rows fetchRows={() => new Promise(r => { resolve = r; })} />);
  expect(screen.queryByTestId("page-skeleton")).not.toBeInTheDocument();
  act(() => { jest.advanceTimersByTime(299); });
  expect(screen.queryByTestId("page-skeleton")).not.toBeInTheDocument();
  act(() => { jest.advanceTimersByTime(2); });
  expect(screen.getByTestId("page-skeleton")).toBeInTheDocument();

  await act(async () => { resolve(["PS5-1"]); });
  expect(screen.queryByTestId("page-skeleton")).not.toBeInTheDocument();
  expect(screen.getByText("PS5-1")).toBeInTheDocument();
});

test("a failed load shows the error with Try again, and retrying loads the list", async () => {
  const fetchRows = jest.fn()
    .mockRejectedValueOnce({ response: { status: 500, data: { detail: "Database is down" } } })
    .mockResolvedValueOnce(["PS5-1"]);
  render(<Rows fetchRows={fetchRows} />);
  await flush();
  expect(screen.getByTestId("page-error")).toHaveTextContent("Database is down");

  fireEvent.click(screen.getByRole("button", { name: /try again/i }));
  await flush();
  expect(screen.queryByTestId("page-error")).not.toBeInTheDocument();
  expect(screen.getByText("PS5-1")).toBeInTheDocument();
});

test("an empty list shows the empty message", async () => {
  render(<Rows fetchRows={() => Promise.resolve([])} />);
  await flush();
  expect(screen.getByTestId("page-empty")).toHaveTextContent("No rows yet.");
});

test("a slow answer for an earlier filter never overwrites the newer one", async () => {
  const pending = {};
  const fetchRows = (dep) => new Promise(r => { pending[dep] = r; });
  const { rerender } = render(<Rows fetchRows={fetchRows} dep={1} />);
  rerender(<Rows fetchRows={fetchRows} dep={2} />);
  await act(async () => { pending[2](["for day 2"]); });
  await act(async () => { pending[1](["for day 1"]); }); // the old request finishes last
  expect(screen.getByText("for day 2")).toBeInTheDocument();
  expect(screen.queryByText("for day 1")).not.toBeInTheDocument();
});

test("polling keeps the list on screen; a failed refresh shows a 'couldn't refresh' banner, not an empty page", async () => {
  const fetchRows = jest.fn()
    .mockResolvedValueOnce(["PS5-1"])
    .mockRejectedValueOnce(new Error("Network Error"))
    .mockResolvedValueOnce(["PS5-1", "PS5-2"]);
  render(<Rows fetchRows={fetchRows} pollMs={15000} />);
  await flush();
  expect(screen.getByText("PS5-1")).toBeInTheDocument();

  await act(async () => { jest.advanceTimersByTime(15000); });
  await flush();
  expect(screen.getByText("PS5-1")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(/couldn't refresh/i);
  expect(screen.queryByTestId("page-skeleton")).not.toBeInTheDocument();

  await act(async () => { jest.advanceTimersByTime(15000); });
  await flush();
  expect(screen.getByText("PS5-2")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("a reload after a save keeps the old rows on screen (no skeleton flash)", async () => {
  let n = 0;
  const fetchRows = () => (++n === 1 ? Promise.resolve(["A"]) : new Promise(() => {}));
  function WithSave() {
    const [rows, setRows] = useState([]);
    const { reload, ...status } = useLoadStatus(async () => setRows(await fetchRows()));
    return (
      <>
        <button onClick={reload}>saved</button>
        <PageState loading={status.loading} error={status.error} data={status.loaded ? rows : undefined}>
          {rows.map(r => <span key={r}>{r}</span>)}
        </PageState>
      </>
    );
  }
  render(<WithSave />);
  await flush();
  fireEvent.click(screen.getByText("saved"));
  act(() => { jest.advanceTimersByTime(1000); });
  expect(screen.getByText("A")).toBeInTheDocument();
  expect(screen.queryByTestId("page-skeleton")).not.toBeInTheDocument();
});
