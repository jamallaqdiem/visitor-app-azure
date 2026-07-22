import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ErrorBoundary from "../ErrorBoundary";

// A problematic dummy component designed to trigger a runtime rendering crash
const ProblemChild = () => {
  throw new Error("Test rendering crash");
};

describe("ErrorBoundary Component", () => {
  let originalLocation: Location;

  beforeEach(() => {
    // Prevent the React console.error alarms from cluttering clean terminal test logs
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Save the original window.location reference before modifying it
    originalLocation = window.location;
  });

  afterEach(() => {
    // Securely restore the window object back to its default state after every test run
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
  });

  it("Happy Path: renders children normally when there are no errors", () => {
    render(
      <ErrorBoundary>
        <div data-testid="happy-child">Everything is fine</div>
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("happy-child")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("Fault Isolation: catches rendering crashes and shows fallback UI", () => {
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Return to Dashboard")).toBeInTheDocument();
  });

  it("Dual-Action: increments retryCount on click and upgrades to hard location reload", () => {
    const locationMock = {
      href: "",
    };

    // Safely re-define location properties on the existing window object
    // to preserve internal React focus and event handlers.
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: locationMock,
    });

    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>,
    );

    // First Click: Executes a soft recovery attempt (increments the retry state counter)
    const firstActionButton = screen.getByRole("button", {
      name: /return to dashboard/i,
    });
    fireEvent.click(firstActionButton);

    // UI Verification: The button dynamically upgrades its warning context text
    expect(screen.getByText("Force Hard Reload")).toBeInTheDocument();

    // Second Click: Detects retryCount > 0 and escalates execution to a full network window reload
    const secondActionButton = screen.getByText("Force Hard Reload");
    fireEvent.click(secondActionButton);

    // Verify dual-action security engine attempted to reset the document root path
    expect(locationMock.href).toBe("/");
  });
});
