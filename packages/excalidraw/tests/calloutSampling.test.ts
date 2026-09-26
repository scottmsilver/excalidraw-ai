import { vi } from "vitest";

import {
  newCalloutElement,
  newElement,
  newFrameElement,
  newImageElement,
  newLinearElement,
  newTextElement,
} from "@excalidraw/element";

import { getDefaultAppState as defaults } from "../appState";
import { renderStaticScene } from "../renderer/staticScene";
import {
  CalloutAutoStyleController,
  sampleCalloutScene,
} from "../scene/calloutAutoStyle";

vi.mock("../renderer/staticScene", () => ({ renderStaticScene: vi.fn() }));
const getDefaultAppState = () => ({
  ...defaults(),
  width: 800,
  height: 600,
  offsetLeft: 0,
  offsetTop: 0,
});

describe("callout artwork sampling", () => {
  it("contrasts closed line strokes against their existing manual fill", () => {
    const line = Object.assign(
      newLinearElement({
        type: "line",
        x: 0,
        y: 0,
        points: [
          [0, 0],
          [100, 0],
          [100, 100],
          [0, 0],
        ] as any,
        backgroundColor: "#000000",
        fillStyle: "solid",
      }),
      { autoContrast: { foreground: true, background: false, opacity: false } },
    );
    const sampler = () => ({
      box: [[255, 255, 255] as const],
      edge: [[255, 255, 255] as const],
    });
    new CalloutAutoStyleController(sampler).resolve(
      [line],
      getDefaultAppState(),
      new Map(),
      document,
    );
    expect(line).toHaveProperty("autoContrastResolved.foreground", "#ffffff");
    expect(line.backgroundColor).toBe("#000000");
  });
  it("keeps text fill transparent and adds a halo when color alone misses its target", () => {
    const sampler = vi.fn(() => ({
      box: [[127, 127, 127] as const],
      edge: [[127, 127, 127] as const],
    }));
    const text = Object.assign(
      newTextElement({ x: 10, y: 10, text: "Readable", fontSize: 20 }),
      { autoContrast: { foreground: true, background: false, opacity: false } },
    );
    new CalloutAutoStyleController(sampler).resolve(
      [text],
      getDefaultAppState(),
      new Map(),
      document,
    );
    expect(text).toHaveProperty("autoContrastResolved.backgroundOpacity", 0);
    expect((text as any).autoContrastResolved.halo).not.toBeNull();
  });

  it("invalidates downstream Auto when lower resolved pixels change without a version bump", () => {
    const sampler = vi.fn(() => ({
      box: [[255, 255, 255] as const],
      edge: [],
    }));
    const lower = Object.assign(newElement({ type: "rectangle", x: 0, y: 0 }), {
      autoContrast: { foreground: true, background: true, opacity: true },
    });
    const upper = Object.assign(
      newElement({ type: "rectangle", x: 10, y: 10 }),
      { autoContrast: { foreground: true, background: true, opacity: true } },
    );
    const controller = new CalloutAutoStyleController(sampler);
    const state = getDefaultAppState();
    controller.resolve([lower, upper], state, new Map(), document);
    expect(sampler).toHaveBeenCalledTimes(2);
    controller.resolve([lower, upper], state, new Map(), document);
    expect(sampler).toHaveBeenCalledTimes(2);
    Object.assign(lower, {
      autoContrastResolved: {
        ...(lower as any).autoContrastResolved,
        foreground: "#ff0000",
      },
    });
    controller.resolve([lower, upper], state, new Map(), document);
    expect(sampler).toHaveBeenCalledTimes(3);
  });
  it("includes the bound label area when sampling an arrow", () => {
    const arrow = newLinearElement({
      type: "arrow",
      x: 100,
      y: 100,
      width: 100,
      height: 0,
      points: [
        [0, 0],
        [100, 0],
      ] as any,
    });
    const label = newTextElement({
      x: 100,
      y: 100,
      text: "A label extending beyond its arrow",
      fontSize: 20,
      fontFamily: 1,
      textAlign: "center",
      verticalAlign: "middle",
      containerId: arrow.id,
    });
    Object.assign(arrow, { boundElements: [{ id: label.id, type: "text" }] });
    const withoutLabel = sampleCalloutScene(
      arrow,
      [arrow],
      getDefaultAppState(),
      new Map(),
      document,
    );
    const withLabel = sampleCalloutScene(
      arrow,
      [arrow, label],
      getDefaultAppState(),
      new Map(),
      document,
    );
    expect(withLabel.box.length).toBeGreaterThan(withoutLabel.box.length);
    expect(withLabel.edge.length).toBeGreaterThan(withoutLabel.edge.length);
  });
  it("resolves opt-in rectangles continuously without changing their versions", () => {
    let black = false;
    const sampler = vi.fn(() => ({
      box: [black ? ([0, 0, 0] as const) : ([255, 255, 255] as const)],
      edge: [],
    }));
    const controller = new CalloutAutoStyleController(sampler);
    const rectangle = Object.assign(
      newElement({ type: "rectangle", x: 10, y: 10 }),
      { autoContrast: { foreground: true, background: true, opacity: true } },
    );
    const state = { ...getDefaultAppState(), cursorButton: "down" as const };
    const version = rectangle.version;
    expect(controller.resolve([rectangle], state, new Map(), document)).toBe(
      true,
    );
    expect(rectangle).toHaveProperty(
      "autoContrastResolved.foreground",
      "#000000",
    );
    black = true;
    controller.resolve(
      [rectangle],
      { ...state, viewBackgroundColor: "#000000" },
      new Map(),
      document,
    );
    expect(rectangle).toHaveProperty(
      "autoContrastResolved.foreground",
      "#ffffff",
    );
    expect(rectangle.version).toBe(version);
  });

  it("does not activate old manual shapes", () => {
    const sampler = vi.fn(() => ({
      box: [[255, 255, 255] as const],
      edge: [],
    }));
    const rectangle = newElement({ type: "rectangle", x: 10, y: 10 });
    expect(
      new CalloutAutoStyleController(sampler).resolve(
        [rectangle],
        getDefaultAppState(),
        new Map(),
        document,
      ),
    ).toBe(false);
    expect(sampler).not.toHaveBeenCalled();
  });

  it("resamples when frame clipping changes without an element edit", () => {
    const sampler = vi.fn(() => ({
      box: [[255, 255, 255] as const],
      edge: [[255, 255, 255] as const],
    }));
    const controller = new CalloutAutoStyleController(sampler);
    const callout = newCalloutElement({ type: "callout", x: 10, y: 10 });
    const state = getDefaultAppState();
    controller.resolve([callout], state, new Map(), document);
    controller.resolve(
      [callout],
      {
        ...state,
        frameRendering: {
          ...state.frameRendering,
          clip: !state.frameRendering.clip,
        },
      },
      new Map(),
      document,
    );
    expect(sampler).toHaveBeenCalledTimes(2);
  });
  it("resamples replaced image pixels even when the file ID and dimensions stay the same", () => {
    const sampler = vi.fn(() => ({
      box: [[255, 255, 255] as const],
      edge: [[255, 255, 255] as const],
    }));
    const controller = new CalloutAutoStyleController(sampler);
    const image = newImageElement({
      type: "image",
      x: 0,
      y: 0,
      fileId: "same-image" as any,
    });
    const callout = newCalloutElement({ type: "callout", x: 10, y: 10 });
    const imageCache = new Map([
      [
        image.fileId!,
        {
          image: document.createElement("img"),
          mimeType: "image/png" as const,
        },
      ],
    ]);
    controller.resolve(
      [image, callout],
      getDefaultAppState(),
      imageCache,
      document,
    );
    imageCache.set(image.fileId!, {
      image: document.createElement("img"),
      mimeType: "image/png",
    });
    controller.resolve(
      [image, callout],
      getDefaultAppState(),
      imageCache,
      document,
    );
    expect(sampler).toHaveBeenCalledTimes(2);
  });
  it("preserves Auto fields on unavailable pixels even with a manual foreground lock", () => {
    const sampler = vi.fn(
      (): {
        box: [number, number, number][];
        edge: [number, number, number][];
      } => ({ box: [[0, 0, 0]], edge: [[0, 0, 0]] }),
    );
    const controller = new CalloutAutoStyleController(sampler);
    const callout = newCalloutElement({
      type: "callout",
      x: 0,
      y: 0,
      strokeColor: "#ffffff",
      calloutAutoStyle: { foreground: false, background: true, opacity: true },
    });
    controller.resolve([callout], getDefaultAppState(), new Map(), document);
    const before = callout.calloutResolvedStyle!;
    sampler.mockReturnValue({ box: [], edge: [] });
    controller.resolve(
      [callout],
      getDefaultAppState(),
      new Map(),
      document,
      true,
    );
    expect(callout.calloutResolvedStyle).toMatchObject({
      foreground: "#ffffff",
      background: before.background,
      backgroundOpacity: before.backgroundOpacity,
      fallback: true,
    });
  });
  it("retains a containing frame above its children in renderer lookup maps", () => {
    const frame = newFrameElement({ x: 0, y: 0, width: 100, height: 100 });
    const below = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      frameId: frame.id,
    });
    const callout = newCalloutElement({ type: "callout", x: 10, y: 10 });
    sampleCalloutScene(
      callout,
      [below, callout, frame],
      getDefaultAppState(),
      new Map(),
      document,
    );
    const args = vi.mocked(renderStaticScene).mock.calls.at(-1)![0];
    expect(args.allElementsMap.get(frame.id)).toMatchObject({ id: frame.id });
    expect(args.elementsMap.get(frame.id)).toMatchObject({ id: frame.id });
    expect(args.visibleElements).toEqual([below]);
  });
  it("resolves during interactions without repeating unchanged work or adding undo changes", () => {
    const sampler = vi.fn(() => ({
      box: [[255, 255, 255] as const],
      edge: [[255, 255, 255] as const],
    }));
    const controller = new CalloutAutoStyleController(sampler);
    const callout = newCalloutElement({ type: "callout", x: 0, y: 0 });
    const version = callout.version;
    const state = getDefaultAppState();
    expect(
      controller.resolve(
        [callout],
        { ...state, selectedElementsAreBeingDragged: true },
        new Map(),
        document,
      ),
    ).toBe(true);
    expect(sampler).toHaveBeenCalledTimes(1);
    expect(controller.resolve([callout], state, new Map(), document)).toBe(
      false,
    );
    expect(callout.calloutResolvedStyle?.foreground).toBe("#000000");
    expect(callout.version).toBe(version);
    expect(controller.resolve([callout], state, new Map(), document)).toBe(
      false,
    );
    expect(sampler).toHaveBeenCalledTimes(1);
  });
  it("renders only artwork below the callout, without its bound text or overlays", () => {
    const below = newElement({ type: "rectangle", x: 0, y: 0 });
    const callout = newCalloutElement({
      type: "callout",
      x: 10,
      y: 10,
      width: 100,
      height: 80,
    });
    const above = newElement({ type: "rectangle", x: 0, y: 0 });
    const result = sampleCalloutScene(
      callout,
      [below, callout, above],
      getDefaultAppState(),
      new Map(),
      document,
    );
    expect(renderStaticScene).toHaveBeenCalledWith(
      expect.objectContaining({
        visibleElements: [below],
        renderConfig: expect.objectContaining({
          renderGrid: false,
          isExporting: true,
          renderLinks: false,
        }),
      }),
    );
    expect(result.box.length).toBeGreaterThan(25);
    expect(result.edge.length).toBeGreaterThan(20);
  });
  it("bounds raster allocation even for an enormous callout", () => {
    const callout = newCalloutElement({
      type: "callout",
      x: 0,
      y: 0,
      width: 1e6,
      height: 1e6,
    });
    sampleCalloutScene(
      callout,
      [callout],
      getDefaultAppState(),
      new Map(),
      document,
    );
    const args = vi.mocked(renderStaticScene).mock.calls.at(-1)![0];
    expect(args.canvas.width).toBeLessThanOrEqual(512);
    expect(args.canvas.height).toBeLessThanOrEqual(512);
  });
  it("returns unavailable samples when the canvas cannot be read", () => {
    const callout = newCalloutElement({ type: "callout", x: 0, y: 0 });
    const read = vi
      .spyOn(CanvasRenderingContext2D.prototype, "getImageData")
      .mockImplementation(() => {
        throw new Error("tainted");
      });
    try {
      const result = sampleCalloutScene(
        callout,
        [callout],
        getDefaultAppState(),
        new Map(),
        document,
      );
      expect(result.box).toEqual([]);
    } finally {
      read.mockRestore();
    }
  });
});
