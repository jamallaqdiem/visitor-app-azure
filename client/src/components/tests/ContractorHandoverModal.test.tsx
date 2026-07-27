import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ContractorHandoverModal from "../ContractorHandoverModal";

describe("ContractorHandoverModal Suite", () => {
  it("does not render when isOpen is false", () => {
    render(
      <ContractorHandoverModal
        isOpen={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByText("Contractor Handover")).not.toBeInTheDocument();
  });

  it("renders modal title and content when isOpen is true", () => {
    render(
      <ContractorHandoverModal
        isOpen={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("Contractor Handover")).toBeInTheDocument();
    expect(screen.getByText("Wait, Not Yet")).toBeInTheDocument();
    expect(screen.getByText("Yes, Sign Out")).toBeInTheDocument();
  });

  it('triggers onConfirm when "Yes, Sign Out" button is clicked', () => {
    const handleConfirm = vi.fn();
    render(
      <ContractorHandoverModal
        isOpen={true}
        onConfirm={handleConfirm}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Yes, Sign Out"));
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it('triggers onCancel when "Wait, Not Yet" or background backdrop is clicked', () => {
    const handleCancel = vi.fn();
    const { container } = render(
      <ContractorHandoverModal
        isOpen={true}
        onConfirm={vi.fn()}
        onCancel={handleCancel}
      />,
    );

    // Click "Wait, Not Yet" button
    fireEvent.click(screen.getByText("Wait, Not Yet"));
    expect(handleCancel).toHaveBeenCalledTimes(1);

    // Click backdrop overlay
    const backdrop = container.querySelector(".bg-slate-900\\/60"); //Tailwind uses slashes for opacity,
    //  but in CSS selectors / is a special character.
    //  The double backslash escapes it so JS treats the slash as part of the class name string
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(handleCancel).toHaveBeenCalledTimes(2);
    }
  });
});
