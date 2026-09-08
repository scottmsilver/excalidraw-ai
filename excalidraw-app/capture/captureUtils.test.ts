import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  getBoundsFromPoints,
  screenToScene,
  sceneToScreen,
  isClickOnCaptureUI,
} from "./captureUtils";

import type { AppState } from "@excalidraw/excalidraw/types";

describe("captureUtils", () => {
  describe("getBoundsFromPoints", () => {
    it("returns zero bounds for empty array", () => {
      const bounds = getBoundsFromPoints([]);
      expect(bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });

    it("calculates bounds for single point", () => {
      const bounds = getBoundsFromPoints([[10, 20]]);
      expect(bounds).toEqual({ x: 10, y: 20, width: 0, height: 0 });
    });

    it("calculates bounds for two points (rectangle corners)", () => {
      const bounds = getBoundsFromPoints([
        [10, 20],
        [110, 120],
      ]);
      expect(bounds).toEqual({ x: 10, y: 20, width: 100, height: 100 });
    });

    it("calculates bounds regardless of point order", () => {
      const bounds = getBoundsFromPoints([
        [110, 120],
        [10, 20],
      ]);
      expect(bounds).toEqual({ x: 10, y: 20, width: 100, height: 100 });
    });

    it("calculates bounds for polygon points", () => {
      const bounds = getBoundsFromPoints([
        [0, 0],
        [100, 50],
        [50, 100],
        [0, 50],
      ]);
      expect(bounds).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    });

    it("handles negative coordinates", () => {
      const bounds = getBoundsFromPoints([
        [-50, -50],
        [50, 50],
      ]);
      expect(bounds).toEqual({ x: -50, y: -50, width: 100, height: 100 });
    });
  });

  describe("screenToScene", () => {
    it("converts viewport coords to scene coords with no scroll/zoom", () => {
      const appState = {
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 1 },
        offsetLeft: 0,
        offsetTop: 0,
        width: 1000,
        height: 800,
      } as AppState;

      const result = screenToScene(100, 200, appState);
      expect(result.x).toBe(100);
      expect(result.y).toBe(200);
    });

    it("accounts for scroll offset", () => {
      const appState = {
        scrollX: -100,
        scrollY: -50,
        zoom: { value: 1 },
        offsetLeft: 0,
        offsetTop: 0,
        width: 1000,
        height: 800,
      } as AppState;

      const result = screenToScene(100, 200, appState);
      expect(result.x).toBe(200); // 100 - (-100)
      expect(result.y).toBe(250); // 200 - (-50)
    });

    it("accounts for zoom", () => {
      const appState = {
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 2 },
        offsetLeft: 0,
        offsetTop: 0,
        width: 1000,
        height: 800,
      } as AppState;

      const result = screenToScene(100, 200, appState);
      expect(result.x).toBe(50); // 100 / 2
      expect(result.y).toBe(100); // 200 / 2
    });
  });

  describe("sceneToScreen", () => {
    it("converts scene coords to viewport coords with no scroll/zoom", () => {
      const appState = {
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 1 },
        offsetLeft: 0,
        offsetTop: 0,
        width: 1000,
        height: 800,
      } as AppState;

      const result = sceneToScreen(100, 200, appState);
      expect(result.x).toBe(100);
      expect(result.y).toBe(200);
    });

    it("accounts for scroll offset", () => {
      const appState = {
        scrollX: -100,
        scrollY: -50,
        zoom: { value: 1 },
        offsetLeft: 0,
        offsetTop: 0,
        width: 1000,
        height: 800,
      } as AppState;

      const result = sceneToScreen(200, 250, appState);
      expect(result.x).toBe(100); // 200 + (-100)
      expect(result.y).toBe(200); // 250 + (-50)
    });
  });

  describe("isClickOnCaptureUI", () => {
    let originalElementsFromPoint: typeof document.elementsFromPoint;

    beforeEach(() => {
      document.body.innerHTML = "";
      // Store original and create mock since jsdom doesn't implement elementsFromPoint
      originalElementsFromPoint = document.elementsFromPoint;
      document.elementsFromPoint = vi.fn().mockReturnValue([]);
    });

    afterEach(() => {
      document.elementsFromPoint = originalElementsFromPoint;
    });

    it("returns false when no capture UI elements exist", () => {
      (document.elementsFromPoint as ReturnType<typeof vi.fn>).mockReturnValue([]);
      const result = isClickOnCaptureUI(100, 100);
      expect(result).toBe(false);
    });

    it("returns true when clicking on capture tool button", () => {
      const button = document.createElement("button");
      button.setAttribute("data-testid", "capture-tool-button");
      document.body.appendChild(button);

      (document.elementsFromPoint as ReturnType<typeof vi.fn>).mockReturnValue([button]);

      const result = isClickOnCaptureUI(50, 50);
      expect(result).toBe(true);
    });

    it("returns true when clicking on mode switcher", () => {
      const switcher = document.createElement("div");
      switcher.setAttribute("data-capture-mode-switcher", "");
      document.body.appendChild(switcher);

      (document.elementsFromPoint as ReturnType<typeof vi.fn>).mockReturnValue([switcher]);

      const result = isClickOnCaptureUI(50, 50);
      expect(result).toBe(true);
    });

    it("returns true when clicking on child of capture UI", () => {
      const button = document.createElement("button");
      button.setAttribute("data-testid", "capture-tool-button");
      const child = document.createElement("span");
      button.appendChild(child);
      document.body.appendChild(button);

      (document.elementsFromPoint as ReturnType<typeof vi.fn>).mockReturnValue([child, button]);

      const result = isClickOnCaptureUI(50, 50);
      expect(result).toBe(true);
    });
  });
});
