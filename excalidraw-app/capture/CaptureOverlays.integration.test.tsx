import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";

import { CaptureRectangleOverlay } from "./CaptureRectangleOverlay";
import { CaptureLassoOverlay } from "./CaptureLassoOverlay";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

describe("CaptureRectangleOverlay Integration", () => {
  let mockExcalidrawAPI: ExcalidrawImperativeAPI;
  let onCaptureComplete: ReturnType<typeof vi.fn>;
  let originalElementsFromPoint: typeof document.elementsFromPoint;

  beforeEach(() => {
    onCaptureComplete = vi.fn();
    mockExcalidrawAPI = {
      getAppState: vi.fn().mockReturnValue({
        activeTool: { type: "selection" },
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 1 },
        offsetLeft: 0,
        offsetTop: 0,
        width: 1000,
        height: 800,
      }),
      setActiveTool: vi.fn(),
      getSceneElements: vi.fn().mockReturnValue([]),
      addFiles: vi.fn().mockResolvedValue(undefined),
      updateScene: vi.fn(),
    } as unknown as ExcalidrawImperativeAPI;

    // Mock elementsFromPoint for isClickOnCaptureUI
    originalElementsFromPoint = document.elementsFromPoint;
    document.elementsFromPoint = vi.fn().mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.elementsFromPoint = originalElementsFromPoint;
  });

  it("renders nothing when not active", () => {
    const { container } = render(
      <CaptureRectangleOverlay
        isActive={false}
        excalidrawAPI={mockExcalidrawAPI}
        onCaptureComplete={onCaptureComplete}
      />,
    );

    expect(container.querySelector("[data-capture-overlay]")).toBeNull();
  });

  it("renders overlay when active", () => {
    const { container } = render(
      <CaptureRectangleOverlay
        isActive={true}
        excalidrawAPI={mockExcalidrawAPI}
        onCaptureComplete={onCaptureComplete}
      />,
    );

    expect(container.querySelector("[data-capture-overlay]")).not.toBeNull();
  });

  it("switches to hand tool when activated", () => {
    render(
      <CaptureRectangleOverlay
        isActive={true}
        excalidrawAPI={mockExcalidrawAPI}
        onCaptureComplete={onCaptureComplete}
      />,
    );

    expect(mockExcalidrawAPI.setActiveTool).toHaveBeenCalledWith({ type: "hand" });
  });

  it("draws selection rectangle on mouse drag", () => {
    const { container } = render(
      <CaptureRectangleOverlay
        isActive={true}
        excalidrawAPI={mockExcalidrawAPI}
        onCaptureComplete={onCaptureComplete}
      />,
    );

    const overlay = container.querySelector("[data-capture-overlay]")!;

    // Start drawing
    fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });

    // Move mouse - should show selection rectangle
    fireEvent.mouseMove(overlay, { clientX: 200, clientY: 200 });

    // Selection rectangle should be visible (has border style)
    const selection = container.querySelector("[data-capture-overlay] > div");
    expect(selection).not.toBeNull();
  });

  it("handles mouse up without crashing", async () => {
    const { container } = render(
      <CaptureRectangleOverlay
        isActive={true}
        excalidrawAPI={mockExcalidrawAPI}
        onCaptureComplete={onCaptureComplete}
      />,
    );

    const overlay = container.querySelector("[data-capture-overlay]")!;

    // Should complete the full mouse interaction cycle without errors
    await act(async () => {
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(overlay, { clientX: 200, clientY: 200 });
      fireEvent.mouseUp(overlay);
    });

    // No assertion needed - test passes if no error thrown
    expect(true).toBe(true);
  });

  it("handles tiny selections without crashing", async () => {
    const { container } = render(
      <CaptureRectangleOverlay
        isActive={true}
        excalidrawAPI={mockExcalidrawAPI}
        onCaptureComplete={onCaptureComplete}
      />,
    );

    const overlay = container.querySelector("[data-capture-overlay]")!;

    // Draw a tiny rectangle - should not crash
    await act(async () => {
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(overlay, { clientX: 105, clientY: 105 });
      fireEvent.mouseUp(overlay);
    });

    // Should not throw
    expect(true).toBe(true);
  });

  it("handles mouse leave during drag without crashing", async () => {
    const { container } = render(
      <CaptureRectangleOverlay
        isActive={true}
        excalidrawAPI={mockExcalidrawAPI}
        onCaptureComplete={onCaptureComplete}
      />,
    );

    const overlay = container.querySelector("[data-capture-overlay]")!;

    // Should handle mouse leaving the overlay area without errors
    await act(async () => {
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(overlay, { clientX: 200, clientY: 200 });
      fireEvent.mouseLeave(overlay);
    });

    // No assertion needed - test passes if no error thrown
    expect(true).toBe(true);
  });

  it("cancels on Escape key", async () => {
    render(
      <CaptureRectangleOverlay
        isActive={true}
        excalidrawAPI={mockExcalidrawAPI}
        onCaptureComplete={onCaptureComplete}
      />,
    );

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(onCaptureComplete).toHaveBeenCalled();
  });

  it("handles rapid clicks without crashing", async () => {
    const { container } = render(
      <CaptureRectangleOverlay
        isActive={true}
        excalidrawAPI={mockExcalidrawAPI}
        onCaptureComplete={onCaptureComplete}
      />,
    );

    const overlay = container.querySelector("[data-capture-overlay]")!;

    // Rapid clicks
    await act(async () => {
      for (let i = 0; i < 5; i++) {
        fireEvent.mouseDown(overlay, { clientX: 100 + i * 10, clientY: 100 });
        fireEvent.mouseUp(overlay, { clientX: 100 + i * 10, clientY: 100 });
      }
    });

    // Should not crash
    expect(true).toBe(true);
  });

  it("ignores clicks on capture UI elements", async () => {
    // Create a button that simulates capture UI
    const captureButton = document.createElement("button");
    captureButton.setAttribute("data-testid", "capture-tool-button");
    document.body.appendChild(captureButton);

    // Mock that we're clicking on capture UI
    (document.elementsFromPoint as ReturnType<typeof vi.fn>).mockReturnValue([captureButton]);

    const { container } = render(
      <CaptureRectangleOverlay
        isActive={true}
        excalidrawAPI={mockExcalidrawAPI}
        onCaptureComplete={onCaptureComplete}
      />,
    );

    const overlay = container.querySelector("[data-capture-overlay]")!;

    await act(async () => {
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(overlay, { clientX: 200, clientY: 200 });
    });

    // Should not start drawing when clicking on UI - no selection rectangle
    const selection = container.querySelector("[data-capture-overlay] > div");
    expect(selection).toBeNull();

    document.body.removeChild(captureButton);
  });
});

describe("CaptureLassoOverlay Integration", () => {
  let mockExcalidrawAPI: ExcalidrawImperativeAPI;
  let onCaptureComplete: ReturnType<typeof vi.fn>;
  let originalElementsFromPoint: typeof document.elementsFromPoint;

  beforeEach(() => {
    onCaptureComplete = vi.fn();
    mockExcalidrawAPI = {
      getAppState: vi.fn().mockReturnValue({
        activeTool: { type: "selection" },
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 1 },
        offsetLeft: 0,
        offsetTop: 0,
        width: 1000,
        height: 800,
      }),
      setActiveTool: vi.fn(),
      getSceneElements: vi.fn().mockReturnValue([]),
      addFiles: vi.fn().mockResolvedValue(undefined),
      updateScene: vi.fn(),
    } as unknown as ExcalidrawImperativeAPI;

    originalElementsFromPoint = document.elementsFromPoint;
    document.elementsFromPoint = vi.fn().mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.elementsFromPoint = originalElementsFromPoint;
  });

  it("renders nothing when not active", () => {
    const { container } = render(
      <CaptureLassoOverlay
        isActive={false}
        excalidrawAPI={mockExcalidrawAPI}
        onCaptureComplete={onCaptureComplete}
      />,
    );

    expect(container.querySelector("[data-capture-overlay]")).toBeNull();
  });

  it("renders overlay when active", () => {
    const { container } = render(
      <CaptureLassoOverlay
        isActive={true}
        excalidrawAPI={mockExcalidrawAPI}
        onCaptureComplete={onCaptureComplete}
      />,
    );

    expect(container.querySelector("[data-capture-overlay]")).not.toBeNull();
  });

  it("draws lasso path as SVG polygon on mouse drag", () => {
    const { container } = render(
      <CaptureLassoOverlay
        isActive={true}
        excalidrawAPI={mockExcalidrawAPI}
        onCaptureComplete={onCaptureComplete}
      />,
    );

    const overlay = container.querySelector("[data-capture-overlay]")!;

    // Start drawing
    fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });

    // Draw a path with multiple points
    fireEvent.mouseMove(overlay, { clientX: 150, clientY: 100 });
    fireEvent.mouseMove(overlay, { clientX: 200, clientY: 150 });
    fireEvent.mouseMove(overlay, { clientX: 150, clientY: 200 });

    // SVG polygon should be visible
    const polygon = container.querySelector("polygon");
    expect(polygon).not.toBeNull();
  });

  it("polygon points update as mouse moves", () => {
    const { container } = render(
      <CaptureLassoOverlay
        isActive={true}
        excalidrawAPI={mockExcalidrawAPI}
        onCaptureComplete={onCaptureComplete}
      />,
    );

    const overlay = container.querySelector("[data-capture-overlay]")!;

    fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(overlay, { clientX: 150, clientY: 100 });

    const polygon1 = container.querySelector("polygon");
    const points1 = polygon1?.getAttribute("points");

    fireEvent.mouseMove(overlay, { clientX: 200, clientY: 150 });

    const polygon2 = container.querySelector("polygon");
    const points2 = polygon2?.getAttribute("points");

    // Points should have changed
    expect(points2).not.toBe(points1);
    expect(points2!.length).toBeGreaterThan(points1!.length);
  });

  it("clears lasso path on mouse up", async () => {
    const { container } = render(
      <CaptureLassoOverlay
        isActive={true}
        excalidrawAPI={mockExcalidrawAPI}
        onCaptureComplete={onCaptureComplete}
      />,
    );

    const overlay = container.querySelector("[data-capture-overlay]")!;

    await act(async () => {
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(overlay, { clientX: 200, clientY: 100 });
      fireEvent.mouseMove(overlay, { clientX: 200, clientY: 200 });
      fireEvent.mouseMove(overlay, { clientX: 100, clientY: 200 });
      fireEvent.mouseUp(overlay);
    });

    // Polygon should be cleared
    const polygon = container.querySelector("polygon");
    expect(polygon).toBeNull();
  });

  it("handles tiny lasso without crashing", async () => {
    const { container } = render(
      <CaptureLassoOverlay
        isActive={true}
        excalidrawAPI={mockExcalidrawAPI}
        onCaptureComplete={onCaptureComplete}
      />,
    );

    const overlay = container.querySelector("[data-capture-overlay]")!;

    await act(async () => {
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(overlay, { clientX: 102, clientY: 100 });
      fireEvent.mouseMove(overlay, { clientX: 102, clientY: 102 });
      fireEvent.mouseUp(overlay);
    });

    // Should not crash
    expect(true).toBe(true);
  });

  it("handles mouse leave during lasso drawing", async () => {
    const { container } = render(
      <CaptureLassoOverlay
        isActive={true}
        excalidrawAPI={mockExcalidrawAPI}
        onCaptureComplete={onCaptureComplete}
      />,
    );

    const overlay = container.querySelector("[data-capture-overlay]")!;

    await act(async () => {
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(overlay, { clientX: 200, clientY: 100 });
      fireEvent.mouseMove(overlay, { clientX: 200, clientY: 200 });
      fireEvent.mouseLeave(overlay);
    });

    // Polygon should be cleared on mouse leave
    const polygon = container.querySelector("polygon");
    expect(polygon).toBeNull();
  });

  it("handles complex drawing path without crashing", async () => {
    const { container } = render(
      <CaptureLassoOverlay
        isActive={true}
        excalidrawAPI={mockExcalidrawAPI}
        onCaptureComplete={onCaptureComplete}
      />,
    );

    const overlay = container.querySelector("[data-capture-overlay]")!;

    // Draw a complex figure-8 pattern
    await act(async () => {
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 150 });
      for (let i = 0; i < 36; i++) {
        const angle = (i / 36) * Math.PI * 2;
        const x = 150 + Math.sin(angle) * 50;
        const y = 150 + Math.cos(angle) * 50;
        fireEvent.mouseMove(overlay, { clientX: x, clientY: y });
      }
      fireEvent.mouseUp(overlay);
    });

    // Should not crash
    expect(true).toBe(true);
  });

  it("cancels on Escape key", async () => {
    render(
      <CaptureLassoOverlay
        isActive={true}
        excalidrawAPI={mockExcalidrawAPI}
        onCaptureComplete={onCaptureComplete}
      />,
    );

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(onCaptureComplete).toHaveBeenCalled();
  });
});

describe("Overlay coordinate handling", () => {
  let onCaptureComplete: ReturnType<typeof vi.fn>;
  let originalElementsFromPoint: typeof document.elementsFromPoint;

  beforeEach(() => {
    onCaptureComplete = vi.fn();
    originalElementsFromPoint = document.elementsFromPoint;
    document.elementsFromPoint = vi.fn().mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.elementsFromPoint = originalElementsFromPoint;
  });

  it("rectangle works with zoom", () => {
    const mockAPI = {
      getAppState: vi.fn().mockReturnValue({
        activeTool: { type: "selection" },
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 2 }, // 2x zoom
        offsetLeft: 0,
        offsetTop: 0,
        width: 1000,
        height: 800,
      }),
      setActiveTool: vi.fn(),
      getSceneElements: vi.fn().mockReturnValue([]),
      addFiles: vi.fn().mockResolvedValue(undefined),
      updateScene: vi.fn(),
    } as unknown as ExcalidrawImperativeAPI;

    const { container } = render(
      <CaptureRectangleOverlay
        isActive={true}
        excalidrawAPI={mockAPI}
        onCaptureComplete={onCaptureComplete}
      />,
    );

    const overlay = container.querySelector("[data-capture-overlay]")!;

    fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(overlay, { clientX: 200, clientY: 200 });

    // Selection should render (coordinate conversion shouldn't crash)
    const selection = container.querySelector("[data-capture-overlay] > div");
    expect(selection).not.toBeNull();
  });

  it("rectangle works with scroll offset", () => {
    const mockAPI = {
      getAppState: vi.fn().mockReturnValue({
        activeTool: { type: "selection" },
        scrollX: -500, // scrolled
        scrollY: -300,
        zoom: { value: 1 },
        offsetLeft: 0,
        offsetTop: 0,
        width: 1000,
        height: 800,
      }),
      setActiveTool: vi.fn(),
      getSceneElements: vi.fn().mockReturnValue([]),
      addFiles: vi.fn().mockResolvedValue(undefined),
      updateScene: vi.fn(),
    } as unknown as ExcalidrawImperativeAPI;

    const { container } = render(
      <CaptureRectangleOverlay
        isActive={true}
        excalidrawAPI={mockAPI}
        onCaptureComplete={onCaptureComplete}
      />,
    );

    const overlay = container.querySelector("[data-capture-overlay]")!;

    fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(overlay, { clientX: 200, clientY: 200 });

    const selection = container.querySelector("[data-capture-overlay] > div");
    expect(selection).not.toBeNull();
  });

  it("lasso works with zoom and scroll combined", () => {
    const mockAPI = {
      getAppState: vi.fn().mockReturnValue({
        activeTool: { type: "selection" },
        scrollX: -200,
        scrollY: -100,
        zoom: { value: 1.5 },
        offsetLeft: 0,
        offsetTop: 0,
        width: 1000,
        height: 800,
      }),
      setActiveTool: vi.fn(),
      getSceneElements: vi.fn().mockReturnValue([]),
      addFiles: vi.fn().mockResolvedValue(undefined),
      updateScene: vi.fn(),
    } as unknown as ExcalidrawImperativeAPI;

    const { container } = render(
      <CaptureLassoOverlay
        isActive={true}
        excalidrawAPI={mockAPI}
        onCaptureComplete={onCaptureComplete}
      />,
    );

    const overlay = container.querySelector("[data-capture-overlay]")!;

    fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(overlay, { clientX: 200, clientY: 100 });
    fireEvent.mouseMove(overlay, { clientX: 200, clientY: 200 });

    const polygon = container.querySelector("polygon");
    expect(polygon).not.toBeNull();
  });
});
