import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useCaptureOverlay } from "./useCaptureOverlay";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

describe("useCaptureOverlay", () => {
  let mockExcalidrawAPI: ExcalidrawImperativeAPI;
  let onCaptureComplete: ReturnType<typeof vi.fn>;

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
      addFiles: vi.fn(),
      updateScene: vi.fn(),
    } as unknown as ExcalidrawImperativeAPI;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns isDrawing as false initially", () => {
    const { result } = renderHook(() =>
      useCaptureOverlay({
        isActive: false,
        excalidrawAPI: mockExcalidrawAPI,
        onCaptureComplete,
      }),
    );

    expect(result.current.isDrawing).toBe(false);
  });

  it("switches to hand tool when activated", () => {
    renderHook(() =>
      useCaptureOverlay({
        isActive: true,
        excalidrawAPI: mockExcalidrawAPI,
        onCaptureComplete,
      }),
    );

    expect(mockExcalidrawAPI.setActiveTool).toHaveBeenCalledWith({ type: "hand" });
  });

  it("restores previous tool when deactivated without completing", () => {
    const { rerender } = renderHook(
      ({ isActive }) =>
        useCaptureOverlay({
          isActive,
          excalidrawAPI: mockExcalidrawAPI,
          onCaptureComplete,
        }),
      { initialProps: { isActive: true } },
    );

    // Clear the initial setActiveTool call
    vi.clearAllMocks();

    // Deactivate
    rerender({ isActive: false });

    expect(mockExcalidrawAPI.setActiveTool).toHaveBeenCalledWith({ type: "selection" });
  });

  it("startDrawing sets isDrawing to true and returns coords", () => {
    const { result } = renderHook(() =>
      useCaptureOverlay({
        isActive: true,
        excalidrawAPI: mockExcalidrawAPI,
        onCaptureComplete,
      }),
    );

    let coords: { x: number; y: number } | null = null;
    act(() => {
      coords = result.current.startDrawing(100, 200);
    });

    expect(result.current.isDrawing).toBe(true);
    expect(coords).toEqual({ x: 100, y: 200 });
  });

  it("getSceneCoords converts screen to scene coordinates", () => {
    const { result } = renderHook(() =>
      useCaptureOverlay({
        isActive: true,
        excalidrawAPI: mockExcalidrawAPI,
        onCaptureComplete,
      }),
    );

    const coords = result.current.getSceneCoords(100, 200);
    expect(coords).toEqual({ x: 100, y: 200 });
  });

  it("getScreenBounds converts scene bounds to screen bounds", () => {
    const { result } = renderHook(() =>
      useCaptureOverlay({
        isActive: true,
        excalidrawAPI: mockExcalidrawAPI,
        onCaptureComplete,
      }),
    );

    const bounds = result.current.getScreenBounds({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });

    expect(bounds).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });
  });

  it("getScreenPoints converts array of scene points to screen points", () => {
    const { result } = renderHook(() =>
      useCaptureOverlay({
        isActive: true,
        excalidrawAPI: mockExcalidrawAPI,
        onCaptureComplete,
      }),
    );

    const screenPoints = result.current.getScreenPoints([
      [10, 20],
      [30, 40],
    ]);

    expect(screenPoints).toEqual([
      [10, 20],
      [30, 40],
    ]);
  });

  it("getScreenPoints returns empty array for empty input", () => {
    const { result } = renderHook(() =>
      useCaptureOverlay({
        isActive: true,
        excalidrawAPI: mockExcalidrawAPI,
        onCaptureComplete,
      }),
    );

    const screenPoints = result.current.getScreenPoints([]);
    expect(screenPoints).toEqual([]);
  });

  it("calls onCaptureComplete when Escape is pressed", () => {
    renderHook(() =>
      useCaptureOverlay({
        isActive: true,
        excalidrawAPI: mockExcalidrawAPI,
        onCaptureComplete,
      }),
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(onCaptureComplete).toHaveBeenCalled();
  });

  it("does not respond to Escape when not active", () => {
    renderHook(() =>
      useCaptureOverlay({
        isActive: false,
        excalidrawAPI: mockExcalidrawAPI,
        onCaptureComplete,
      }),
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(onCaptureComplete).not.toHaveBeenCalled();
  });

  it("returns null appState when excalidrawAPI is null", () => {
    const { result } = renderHook(() =>
      useCaptureOverlay({
        isActive: true,
        excalidrawAPI: null,
        onCaptureComplete,
      }),
    );

    expect(result.current.appState).toBeNull();
  });

  it("getSceneCoords returns null when excalidrawAPI is null", () => {
    const { result } = renderHook(() =>
      useCaptureOverlay({
        isActive: true,
        excalidrawAPI: null,
        onCaptureComplete,
      }),
    );

    const coords = result.current.getSceneCoords(100, 200);
    expect(coords).toBeNull();
  });
});
