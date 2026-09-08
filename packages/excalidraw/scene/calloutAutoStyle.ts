import rough from "roughjs/bin/rough";

import {
  applyDarkModeFilter,
  arrayToMap,
  THEME,
  toBrandedType,
} from "@excalidraw/common";
import { ShapeCache } from "@excalidraw/element/shape";
import { syncInvalidIndices } from "@excalidraw/element/fractionalIndex";
import { getContainingFrame } from "@excalidraw/element/frame";
import { resolveCalloutContrast } from "@excalidraw/element/calloutContrast";
import { getCalloutTailPoints } from "@excalidraw/element/callout";

import type { RGB } from "@excalidraw/element/calloutContrast";
import type {
  ExcalidrawCalloutElement,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { renderStaticScene } from "../renderer/staticScene";

import type { RenderableElementsMap } from "./types";
import type {
  AppClassProperties,
  AppState,
  StaticCanvasAppState,
} from "../types";

type Point = readonly [number, number];

/** Synchronous sampling has no pending result that can overwrite a newer scene. */
export class CalloutAutoStyleController {
  private fingerprints = new WeakMap<ExcalidrawCalloutElement, string>();
  private imageIdentities = new WeakMap<object, number>();
  private nextImageIdentity = 1;

  constructor(private sample = sampleCalloutScene) {}

  resolve(
    elements: readonly NonDeletedExcalidrawElement[],
    state: AppState,
    imageCache: AppClassProperties["imageCache"],
    ownerDocument: Document,
    force = false,
  ) {
    if (
      !elements.some(
        (element) => element.type === "callout" && element.calloutAutoStyle,
      ) ||
      (!force &&
        (state.selectedElementsAreBeingDragged ||
          state.isResizing ||
          state.isRotating ||
          state.newElement ||
          state.cursorButton === "down"))
    ) {
      return false;
    }
    const elementsMap = arrayToMap(elements);
    const versionKey = (element: NonDeletedExcalidrawElement) =>
      `${element.id}:${element.version}:${element.versionNonce}`;
    const frameKey = elements
      .filter(
        (element) => element.type === "frame" || element.type === "magicframe",
      )
      .map(versionKey)
      .join(",");
    let lowerKey = "";
    let changed = false;
    for (const element of elements) {
      lowerKey += `${versionKey(element)};`;
      if (element.type === "image" && element.fileId) {
        const image = imageCache.get(element.fileId)?.image;
        if (image && !this.imageIdentities.has(image)) {
          this.imageIdentities.set(image, this.nextImageIdentity++);
        }
        lowerKey += `${image ? this.imageIdentities.get(image) : 0}:${
          (image as HTMLImageElement | undefined)?.naturalWidth || 0
        };`;
      }
      const text =
        element.type === "callout"
          ? elements.find(
              (candidate) =>
                candidate.type === "text" &&
                candidate.containerId === element.id,
            )
          : undefined;
      const sceneKey = `${JSON.stringify(state.frameRendering)}:${
        ownerDocument.fonts?.status || "loaded"
      }:${state.theme}:${state.viewBackgroundColor}:${frameKey}:${lowerKey}:${
        text ? versionKey(text) : state.currentItemFontSize
      }`;
      if (
        element.type !== "callout" ||
        !element.calloutAutoStyle ||
        (!force && this.fingerprints.get(element) === sceneKey)
      ) {
        continue;
      }
      this.fingerprints.set(element, sceneKey);
      const samples = this.sample(
        element,
        elements,
        state,
        imageCache,
        ownerDocument,
      );
      const modes = element.calloutAutoStyle;
      const previous = element.calloutResolvedStyle;
      const preserve = !samples.box.length && previous;
      const result = resolveCalloutContrast({
        ...samples,
        fontSize:
          text?.type === "text" ? text.fontSize : state.currentItemFontSize,
        foreground: modes.foreground
          ? preserve
            ? previous.foreground
            : "auto"
          : element.calloutManualColors?.foreground ??
            applyDarkModeFilter(
              element.strokeColor,
              state.theme === THEME.DARK,
            ),
        background: modes.background
          ? preserve
            ? previous.background
            : "auto"
          : element.calloutManualColors?.background ??
            applyDarkModeFilter(
              element.backgroundColor,
              state.theme === THEME.DARK,
            ),
        opacity: modes.opacity
          ? preserve
            ? previous.backgroundOpacity
            : "auto"
          : element.calloutBackgroundOpacity ?? 100,
        fallbackBackground: applyDarkModeFilter(
          state.viewBackgroundColor,
          state.theme === THEME.DARK,
        ),
        overallOpacity:
          (element.opacity *
            (getContainingFrame(element, elementsMap)?.opacity ?? 100)) /
          100,
        previous: element.calloutResolvedStyle,
      });
      const resolved = preserve
        ? { ...result, halo: modes.foreground ? previous.halo : null }
        : result;
      if (JSON.stringify(previous) !== JSON.stringify(resolved)) {
        // Derived render data: keep geometry/version unchanged, so resolution is
        // captured with the originating edit and never creates an AI/scene undo step.
        Object.assign(element, { calloutResolvedStyle: resolved });
        ShapeCache.delete(element);
        if (text) {
          ShapeCache.delete(text);
        }
        changed = true;
      }
    }
    return changed;
  }
}

/** Sample the composed, lower-z scene, never the callout's own rendered fill. */
export const sampleCalloutScene = (
  callout: ExcalidrawCalloutElement,
  elements: readonly NonDeletedExcalidrawElement[],
  appState: StaticCanvasAppState,
  imageCache: AppClassProperties["imageCache"],
  ownerDocument: Document,
): { box: RGB[]; edge: RGB[] } => {
  const unavailable = { box: [], edge: [] };
  const index = elements.findIndex((element) => element.id === callout.id);
  if (index < 0) {
    return unavailable;
  }
  const lower = elements
    .slice(0, index)
    .filter(
      (element) =>
        !(element.type === "text" && element.containerId === callout.id),
    );
  // Never choose against a placeholder where image pixels will arrive later.
  if (
    lower.some(
      (element) =>
        element.type === "image" &&
        element.fileId &&
        (!imageCache.get(element.fileId) ||
          typeof (imageCache.get(element.fileId)!.image as HTMLImageElement)
            .naturalWidth !== "number"),
    )
  ) {
    return unavailable;
  }
  const world = ([x, y]: Point): Point => {
    const dx = x - callout.width / 2;
    const dy = y - callout.height / 2;
    return [
      callout.x +
        callout.width / 2 +
        dx * Math.cos(callout.angle) -
        dy * Math.sin(callout.angle),
      callout.y +
        callout.height / 2 +
        dx * Math.sin(callout.angle) +
        dy * Math.cos(callout.angle),
    ];
  };
  const box: Point[] = [];
  const edge: Point[] = [];
  for (let x = 0; x < 7; x++) {
    for (let y = 0; y < 7; y++) {
      box.push(
        world([
          callout.width * (0.08 + x * 0.14),
          callout.height * (0.08 + y * 0.14),
        ]),
      );
    }
  }
  const { attachPoint, controlPoint, tipPoint } = getCalloutTailPoints(callout);
  for (let step = 0; step <= 16; step++) {
    const t = step / 16;
    edge.push(
      world([callout.width * t, 0]),
      world([callout.width * t, callout.height]),
      world([0, callout.height * t]),
      world([callout.width, callout.height * t]),
    );
    edge.push(
      world([
        (1 - t) ** 2 * attachPoint[0] +
          2 * (1 - t) * t * controlPoint[0] +
          t ** 2 * tipPoint[0],
        (1 - t) ** 2 * attachPoint[1] +
          2 * (1 - t) * t * controlPoint[1] +
          t ** 2 * tipPoint[1],
      ]),
    );
  }
  const points = [...box, ...edge];
  const minX = Math.min(...points.map((point) => point[0])) - 2;
  const minY = Math.min(...points.map((point) => point[1])) - 2;
  const width = Math.max(...points.map((point) => point[0])) - minX + 2;
  const height = Math.max(...points.map((point) => point[1])) - minY + 2;
  if (![minX, minY, width, height].every(Number.isFinite)) {
    return unavailable;
  }
  const scale = Math.min(1, 512 / Math.max(width, height));
  const canvas = ownerDocument.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width * scale));
  canvas.height = Math.max(1, Math.ceil(height * scale));
  try {
    renderStaticScene({
      canvas,
      rc: rough.canvas(canvas),
      scale,
      elementsMap: toBrandedType<RenderableElementsMap>(arrayToMap(elements)),
      allElementsMap: toBrandedType<NonDeletedSceneElementsMap>(
        arrayToMap(
          syncInvalidIndices(elements.map((element) => ({ ...element }))),
        ),
      ),
      visibleElements: lower,
      appState: {
        ...appState,
        scrollX: -minX,
        scrollY: -minY,
        zoom: { value: 1 as StaticCanvasAppState["zoom"]["value"] },
        shouldCacheIgnoreZoom: false,
      },
      renderConfig: {
        canvasBackgroundColor: appState.viewBackgroundColor || "#ffffff",
        imageCache,
        renderGrid: false,
        renderLinks: false,
        isExporting: true,
        embedsValidationStatus: new Map(),
        elementsPendingErasure: new Set(),
        pendingFlowchartNodes: null,
        theme: appState.theme,
      },
    });
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return unavailable;
    }
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const read = (point: Point): RGB => {
      const x = Math.max(
        0,
        Math.min(canvas.width - 1, Math.round((point[0] - minX) * scale)),
      );
      const y = Math.max(
        0,
        Math.min(canvas.height - 1, Math.round((point[1] - minY) * scale)),
      );
      const offset = (y * canvas.width + x) * 4;
      return [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
    };
    return { box: box.map(read), edge: edge.map(read) };
  } catch {
    return unavailable;
  } finally {
    canvas.width = canvas.height = 1;
  }
};
