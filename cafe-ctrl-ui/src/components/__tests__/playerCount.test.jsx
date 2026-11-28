import React, { useState } from "react";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import PlayerCountField from "../PlayerCountField";
import { playerCountsOf, isPlayerPriced, playerCountToSend, rateText } from "../../lib/playerPricing";
import { api } from "../../lib/apiClient";
import { _resetLocksForTests } from "../../lib/async/actionLocks";
import SessionsListPage from "../../pages/SessionsListPage";

jest.mock("sonner", () => ({ toast: Object.assign(jest.fn(), { error: jest.fn(), warning: jest.fn(), success: jest.fn(), message: jest.fn() }) }));
jest.mock("@phosphor-icons/react", () => new Proxy({}, { get: (_, name) => (name === "__esModule" ? true : () => null) }));
jest.mock("lucide-react", () => new Proxy({}, { get: (_, name) => (name === "__esModule" ? true : () => null) }));
jest.mock("../../lib/notifications", () => ({
  playChime: jest.fn(), pushNotify: jest.fn(), ensureNotificationPermission: jest.fn(),
  ensureMutedFlag: () => true, setMuted: jest.fn(),
}));
jest.mock("../membership/MembershipCardPicker", () => () => null);
jest.mock("../DateTimePicker", () => ({ value }) => <input readOnly aria-label="entry time" value={value || ""} />);
jest.mock("react-router-dom", () => ({ Link: ({ children }) => <a href="#x">{children}</a> }), { virtual: true });

// Radix Select needs these in jsdom
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
  window.HTMLElement.prototype.hasPointerCapture = jest.fn(() => false);
  window.HTMLElement.prototype.releasePointerCapture = jest.fn();
});

const flush = () => act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const priced = (hourly, half) => Object.fromEntries(DAYS.map(d => [d, [
  { duration: 30, prices: half }, { duration: 60, prices: hourly },
]]));
const PS5 = { id: "rc-ps5", player_counts: [1, 2, 3, 4],
  weekday_prices: priced({ 1: 100, 2: 250, 3: 330, 4: 400 }, { 1: 60, 2: 140, 3: 180, 4: 220 }) };
const POOL = { id: "rc-pool", player_counts: [1], weekday_prices: priced({ 1: 120 }, { 1: 70 }) };
const HALF_HOUR_ONLY = { id: "rc-half", player_counts: [1, 2],
  weekday_prices: Object.fromEntries(DAYS.map(d => [d, [{ duration: 30, prices: { 1: 60, 2: 140 } }]])) };

async function choose(trigger, optionText) {
  fireEvent.keyDown(trigger, { key: "Enter" });
  await flush();
  fireEvent.click(await screen.findByRole("option", { name: optionText }));
  await flush();
}

beforeEach(() => { _resetLocksForTests(); jest.restoreAllMocks(); });

// ---------------- pricing helpers ----------------

test("player-priced = the rate card offers more than one player count", () => {
  expect(playerCountsOf(PS5)).toEqual([1, 2, 3, 4]);
  expect(isPlayerPriced(PS5)).toBe(true);
  expect(isPlayerPriced(POOL)).toBe(false);
  expect(playerCountsOf({ player_counts: null })).toEqual([1]);      // legacy card
  expect(playerCountsOf({ player_counts: [3, "2", 2, 0, -1, 2.5] })).toEqual([2, 3]);
});

test("what gets sent: the chosen count (none until chosen) for PS5, the only count for pool", () => {
  expect(playerCountToSend(PS5, null)).toBeNull();
  expect(playerCountToSend(PS5, 3)).toBe(3);
  expect(playerCountToSend(POOL, null)).toBe(1);
});

test("rate text uses the entry day's hourly price per player count, or the slab when there is no hourly one", () => {
  expect(rateText(PS5, 1, "2026-11-30T10:00")).toBe("₹100/hr");
  expect(rateText(PS5, 2, "2026-11-30T10:00")).toBe("₹250/hr");
  expect(rateText(PS5, 4, "2026-11-30T10:00")).toBe("₹400/hr");
  expect(rateText(HALF_HOUR_ONLY, 2, "2026-11-30T10:00")).toBe("₹140 / 30 min");
  expect(rateText(PS5, 5, "2026-11-30T10:00")).toBeNull();
});

// ---------------- the field ----------------

function Field({ card, initial = null }) {
  const [v, setV] = useState(initial);
  return <PlayerCountField rateCard={card} value={v} onChange={setV} startTime="2026-11-30T10:00" testId="pc" />;
}

test("the dropdown starts empty with a placeholder and asks for a choice", () => {
  render(<Field card={PS5} />);
  const trigger = screen.getByTestId("pc");
  expect(trigger).toHaveTextContent("Select players");
  expect(trigger).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByTestId("pc-required")).toHaveTextContent("Choose the number of players");
  expect(screen.queryByTestId("pc-rate")).not.toBeInTheDocument();
});

test("choosing a count shows its rate next to the dropdown", async () => {
  render(<Field card={PS5} />);
  await choose(screen.getByTestId("pc"), "2 Players");
  expect(screen.getByTestId("pc")).toHaveTextContent("2 Players");
  expect(screen.getByTestId("pc-rate")).toHaveTextContent("2 Players — ₹250/hr");
  expect(screen.queryByTestId("pc-required")).not.toBeInTheDocument();
});

test("resources without player pricing don't show the field", () => {
  const { container } = render(<Field card={POOL} />);
  expect(container).toBeEmptyDOMElement();
});

// ---------------- the real Start dialog ----------------

function mockLiveSessionsApi() {
  jest.spyOn(api, "get").mockImplementation((url) => Promise.resolve({ data:
    url === "/resources" ? [
      { id: "ps5-1", name: "1 - Ps5", rate_card_id: "rc-ps5" },
      { id: "pool-1", name: "1 - Pool", rate_card_id: "rc-pool" },
    ] : url === "/rate-cards" ? [PS5, POOL] : [] }));
  return jest.spyOn(api, "post").mockResolvedValue({ data: {} });
}

async function openStart(resourceTestId, customer = "Asha") {
  render(<SessionsListPage />);
  await flush();
  fireEvent.click(screen.getByTestId(resourceTestId));
  await flush();
  fireEvent.change(screen.getByTestId("new-cust-name"), { target: { value: customer } });
  return screen.getByRole("dialog");
}

test("Start is blocked on a PS5 until the number of players is chosen (click and Enter)", async () => {
  const post = mockLiveSessionsApi();
  const dialog = await openStart("resource-ps5-1");
  const start = within(dialog).getByTestId("new-cust-start-btn");
  expect(within(dialog).getByTestId("new-cust-players")).toHaveTextContent("Select players");
  expect(start).toBeDisabled();

  fireEvent.click(start);
  fireEvent.submit(start.closest("form")); // Enter in a field
  await flush();
  expect(post).not.toHaveBeenCalled();

  await choose(within(dialog).getByTestId("new-cust-players"), "3 Players");
  expect(within(dialog).getByTestId("new-cust-players-rate")).toHaveTextContent("3 Players — ₹330/hr");
  expect(start).not.toBeDisabled();
  fireEvent.click(start);
  await flush();
  expect(post).toHaveBeenCalledTimes(1);
  const [url, body, config] = post.mock.calls[0];
  expect(url).toBe("/sessions");
  expect(body.player_count).toBe(3);
  expect(config.headers["Idempotency-Key"]).toBeTruthy(); // double-submit protection still in place
});

test("a pool table starts without asking for players (its only count is sent)", async () => {
  const post = mockLiveSessionsApi();
  const dialog = await openStart("resource-pool-1");
  expect(within(dialog).queryByTestId("new-cust-players")).not.toBeInTheDocument();
  const start = within(dialog).getByTestId("new-cust-start-btn");
  expect(start).not.toBeDisabled();
  fireEvent.click(start);
  await flush();
  expect(post).toHaveBeenCalledTimes(1);
  expect(post.mock.calls[0][1].player_count).toBe(1);
});
