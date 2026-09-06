import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TutorialModal } from "../TutorialModal";

describe("TutorialModal Component", () => {
  it("renders the first step by default", () => {
    render(<TutorialModal onClose={vi.fn()} />);

    expect(screen.getByText("Step 1: Always Search First")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 8")).toBeInTheDocument();
  });

  it("navigates forward when clicking 'Next Step'", () => {
    render(<TutorialModal onClose={vi.fn()} />);

    const nextButton = screen.getByRole("button", { name: /next step/i });
    fireEvent.click(nextButton);

    expect(
      screen.getByText("Step 2: Registering a Visitor"),
    ).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 8")).toBeInTheDocument();
  });

  it("navigates backward when clicking 'Previous'", () => {
    render(<TutorialModal onClose={vi.fn()} />);

    // Go to step 2 first
    fireEvent.click(screen.getByRole("button", { name: /next step/i }));
    expect(
      screen.getByText("Step 2: Registering a Visitor"),
    ).toBeInTheDocument();

    // Go back to step 1
    fireEvent.click(screen.getByRole("button", { name: /previous/i }));
    expect(screen.getByText("Step 1: Always Search First")).toBeInTheDocument();
  });

  it("shows 'Finish Training' button on the final step and triggers onClose", () => {
    const handleClose = vi.fn();
    render(<TutorialModal onClose={handleClose} />);

    // Click Next 7 times to reach Step 8
    const nextButton = screen.getByRole("button", { name: /next step/i });
    for (let i = 0; i < 7; i++) {
      fireEvent.click(nextButton);
    }

    expect(
      screen.getByText("Step 8: Permanent Data Deletion"),
    ).toBeInTheDocument();

    // Verify Finish Training button is present and clickable
    const finishButton = screen.getByRole("button", {
      name: /finish training/i,
    });
    expect(finishButton).toBeInTheDocument();

    fireEvent.click(finishButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
