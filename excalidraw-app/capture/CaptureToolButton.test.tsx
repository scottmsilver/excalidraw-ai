import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";

import { CaptureToolButton } from "./CaptureToolButton";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

// Mock the overlay components to simplify testing
// Note: The real component only renders ONE overlay at a time based on captureMode
vi.mock("./CaptureRectangleOverlay", () => ({
  CaptureRectangleOverlay: ({ isActive, onCaptureComplete }: any) => (
    <div data-testid="rectangle-overlay" data-active={isActive}>
      <button onClick={onCaptureComplete} data-testid="complete-capture">
        Complete
      </button>
    </div>
  ),
}));

vi.mock("./CaptureLassoOverlay", () => ({
  CaptureLassoOverlay: ({ isActive, onCaptureComplete }: any) => (
    <div data-testid="lasso-overlay" data-active={isActive}>
      <button onClick={onCaptureComplete} data-testid="complete-capture-lasso">
        Complete
      </button>
    </div>
  ),
}));

vi.mock("./CapturePolygonOverlay", () => ({
  CapturePolygonOverlay: ({ isActive, onCaptureComplete }: any) => (
    <div data-testid="polygon-overlay" data-active={isActive}>
      <button onClick={onCaptureComplete} data-testid="complete-capture-polygon">
        Complete
      </button>
    </div>
  ),
}));

describe("CaptureToolButton", () => {
  let mockExcalidrawAPI: ExcalidrawImperativeAPI;

  beforeEach(() => {
    mockExcalidrawAPI = {
      getAppState: vi.fn().mockReturnValue({
        activeTool: { type: "selection" },
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 1 },
        offsetLeft: 0,
        offsetTop: 0,
      }),
      setActiveTool: vi.fn(),
      getSceneElements: vi.fn().mockReturnValue([]),
      addFiles: vi.fn(),
      updateScene: vi.fn(),
    } as unknown as ExcalidrawImperativeAPI;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the capture button", () => {
    render(<CaptureToolButton excalidrawAPI={mockExcalidrawAPI} />);

    const button = screen.getByTestId("capture-tool-button");
    expect(button).toBeDefined();
  });

  it("toggles capture mode when button is clicked", () => {
    render(<CaptureToolButton excalidrawAPI={mockExcalidrawAPI} />);

    const button = screen.getByTestId("capture-tool-button");

    // Initially, rectangle overlay should not be active
    expect(screen.getByTestId("rectangle-overlay").dataset.active).toBe("false");

    // Click to activate
    fireEvent.click(button);
    expect(screen.getByTestId("rectangle-overlay").dataset.active).toBe("true");

    // Click to deactivate
    fireEvent.click(button);
    expect(screen.getByTestId("rectangle-overlay").dataset.active).toBe("false");
  });

  it("shows mode switcher when capture mode is active", () => {
    render(<CaptureToolButton excalidrawAPI={mockExcalidrawAPI} />);

    // Mode switcher should not be visible initially
    expect(screen.queryByTitle("Rectangle selection")).toBeNull();

    // Activate capture mode
    fireEvent.click(screen.getByTestId("capture-tool-button"));

    // Mode switcher should now be visible
    expect(screen.getByTitle("Rectangle selection")).toBeDefined();
    expect(screen.getByTitle("Lasso selection")).toBeDefined();
  });

  it("defaults to rectangle mode", () => {
    render(<CaptureToolButton excalidrawAPI={mockExcalidrawAPI} />);

    fireEvent.click(screen.getByTestId("capture-tool-button"));

    // Rectangle overlay should be rendered and active (only one overlay at a time)
    expect(screen.getByTestId("rectangle-overlay").dataset.active).toBe("true");
    expect(screen.queryByTestId("lasso-overlay")).toBeNull();
  });

  it("switches to lasso mode when lasso button is clicked", () => {
    render(<CaptureToolButton excalidrawAPI={mockExcalidrawAPI} />);

    // Activate capture mode
    fireEvent.click(screen.getByTestId("capture-tool-button"));

    // Click lasso mode button
    fireEvent.click(screen.getByTitle("Lasso selection"));

    // Now lasso overlay should be rendered (rectangle no longer rendered)
    expect(screen.queryByTestId("rectangle-overlay")).toBeNull();
    expect(screen.getByTestId("lasso-overlay").dataset.active).toBe("true");
  });

  it("switches back to rectangle mode", () => {
    render(<CaptureToolButton excalidrawAPI={mockExcalidrawAPI} />);

    // Activate and switch to lasso
    fireEvent.click(screen.getByTestId("capture-tool-button"));
    fireEvent.click(screen.getByTitle("Lasso selection"));

    // Switch back to rectangle
    fireEvent.click(screen.getByTitle("Rectangle selection"));

    // Rectangle overlay should now be rendered (lasso no longer rendered)
    expect(screen.getByTestId("rectangle-overlay").dataset.active).toBe("true");
    expect(screen.queryByTestId("lasso-overlay")).toBeNull();
  });

  it("switches to polygon mode when polygon button is clicked", () => {
    render(<CaptureToolButton excalidrawAPI={mockExcalidrawAPI} />);

    // Activate capture mode
    fireEvent.click(screen.getByTestId("capture-tool-button"));

    // Click polygon mode button
    fireEvent.click(screen.getByTitle("Polygon selection"));

    // Now polygon overlay should be rendered
    expect(screen.queryByTestId("rectangle-overlay")).toBeNull();
    expect(screen.queryByTestId("lasso-overlay")).toBeNull();
    expect(screen.getByTestId("polygon-overlay").dataset.active).toBe("true");
  });

  it("deactivates capture mode when capture completes", () => {
    render(<CaptureToolButton excalidrawAPI={mockExcalidrawAPI} />);

    // Activate capture mode
    fireEvent.click(screen.getByTestId("capture-tool-button"));
    expect(screen.getByTestId("rectangle-overlay").dataset.active).toBe("true");

    // Simulate capture completion from overlay
    fireEvent.click(screen.getByTestId("complete-capture"));

    // Should be deactivated
    expect(screen.getByTestId("rectangle-overlay").dataset.active).toBe("false");
  });

  it("applies active styles when capture mode is on", () => {
    render(<CaptureToolButton excalidrawAPI={mockExcalidrawAPI} />);

    const button = screen.getByTestId("capture-tool-button");

    // Check initial state - button should have no special active styling
    expect(button.style.zIndex).toBeFalsy();

    // Activate
    fireEvent.click(button);

    // When active, button has elevated zIndex to appear above overlay
    expect(button.style.zIndex).toBe("1001");
  });

  it("works with null excalidrawAPI", () => {
    // Should not throw
    render(<CaptureToolButton excalidrawAPI={null} />);

    const button = screen.getByTestId("capture-tool-button");
    fireEvent.click(button);

    // Should still toggle capture mode
    expect(screen.getByTestId("rectangle-overlay").dataset.active).toBe("true");
  });
});
