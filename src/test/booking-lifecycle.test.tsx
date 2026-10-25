import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoGames, seedBookings } from "@/domain/demo-data";
import type { State } from "@/domain/store";
import { computeGameStatus, paidPlayerCount } from "@/domain/game-logic";

const mocks = vi.hoisted(() => ({
  state: null as unknown as State,
  createBooking: vi.fn(), payBooking: vi.fn(), cancelBooking: vi.fn(), cancelGame: vi.fn(), navigate: vi.fn(),
}));
vi.mock("@/domain/store", () => ({
  useAppState: () => mocks.state,
  useStore: (selector: (state: State) => unknown) => selector(mocks.state),
  viewGame: (state: State, game: State["games"][number]) => {
    const paid = paidPlayerCount(game.id, state.bookings, state.payments);
    return { game, paid, status: computeGameStatus(game, paid, new Date()) };
  },
  createBooking: mocks.createBooking, payBooking: mocks.payBooking,
  cancelBooking: mocks.cancelBooking, cancelGame: mocks.cancelGame, createGame: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({ options, useParams: () => ({ gameId: mocks.state.games[0]!.id, bookingId: mocks.state.bookings[0]!.id }) }),
  useNavigate: () => mocks.navigate,
  useRouter: () => ({ history: { back: vi.fn() } }),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
import { Route as BookingRoute } from "@/routes/bookings.$bookingId";
import { Route as CheckoutRoute } from "@/routes/checkout.$bookingId";
import { Route as DetailsRoute } from "@/routes/book.$gameId";
import { Route as IndexRoute } from "@/routes/index";
import { Route as OrganizerRoute } from "@/routes/organizer";
const BookingPage = BookingRoute.options.component as ComponentType;
const Checkout = CheckoutRoute.options.component as ComponentType;
const Details = DetailsRoute.options.component as ComponentType;
const Index = IndexRoute.options.component as ComponentType;
const Organizer = OrganizerRoute.options.component as ComponentType;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-25T12:00:00Z"));
  const seed = seedBookings();
  mocks.state = { games: [{ ...demoGames[0]! }], bookings: [{ ...seed.bookings[0]!, status: "pending" }], payments: [{ ...seed.payments[0]!, status: "pending" }], refunds: [], fetchedAt: "" };
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("booking lifecycle UI", () => {
  it("does not show a paid receipt or success for a pending booking", () => {
    render(<BookingPage />);
    expect(screen.getByRole("heading", { name: "Booking pending" })).toBeInTheDocument();
    expect(screen.queryByText("You're in!")).not.toBeInTheDocument();
    expect(screen.queryByText(/€7 paid/)).not.toBeInTheDocument();
    expect(screen.getByText(/€7 pending/)).toBeInTheDocument();
  });

  it("keeps completed games in a separate Past Games section", () => {
    vi.setSystemTime(new Date("2026-11-02T00:00:00Z"));
    render(<Index />);
    const past = screen.getByRole("heading", { name: "Past Games" }).closest("section")!;
    expect(past).toHaveTextContent(mocks.state.games[0]!.title);
    expect(screen.getAllByText(mocks.state.games[0]!.title)).toHaveLength(1);
  });

  it.each(["cancelled", "completed"])("disables checkout for %s games", (status) => {
    if (status === "cancelled") mocks.state.games[0]!.cancelledAt = new Date().toISOString();
    else vi.setSystemTime(new Date("2026-11-02T00:00:00Z"));
    render(<Checkout />);
    expect(screen.getByRole("button", { name: /Pay €/ })).toBeDisabled();
  });

  it("does not offer cancellation for a completed booking or game", () => {
    vi.setSystemTime(new Date("2026-11-02T00:00:00Z"));
    const page = render(<BookingPage />);
    expect(screen.queryByRole("button", { name: "Cancel booking" })).not.toBeInTheDocument();
    page.unmount();
    render(<Organizer />);
    expect(screen.queryByRole("button", { name: "Cancel game" })).not.toBeInTheDocument();
  });

  it("re-enables payment after a rejected request", async () => {
    mocks.payBooking.mockRejectedValueOnce(new Error("Network failure"));
    render(<Checkout />);
    fireEvent.click(screen.getByRole("button", { name: /Pay €/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Pay €/ })).toBeEnabled());
    expect(screen.getByText(/Could not confirm payment/)).toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("re-enables booking creation after failure", async () => {
    mocks.createBooking.mockRejectedValueOnce(new Error("Network failure"));
    render(<Details />);
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Test" } });
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Player" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue to payment" }));
    await waitFor(() => expect(mocks.createBooking).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue to payment" })).toBeEnabled());
  });

  it("re-enables booking cancellation after failure", async () => {
    mocks.cancelBooking.mockRejectedValueOnce(new Error("Network failure"));
    render(<BookingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel booking" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
    await waitFor(() => expect(mocks.cancelBooking).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirm cancellation" })).toBeEnabled());
  });

  it("re-enables game cancellation after failure", async () => {
    mocks.cancelGame.mockRejectedValueOnce(new Error("Network failure"));
    render(<Organizer />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel game" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel game & refund all" }));
    await waitFor(() => expect(mocks.cancelGame).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel game & refund all" })).toBeEnabled());
  });
});
