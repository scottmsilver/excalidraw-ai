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
import {
  resolveCalloutContrast,
  compositeCalloutColor,
} from "@excalidraw/element/calloutContrast";
import { isPathALoop } from "@excalidraw/element/utils";
import { getCalloutTailPoints } from "@excalidraw/element/callout";
import { getElementAbsoluteCoords } from "@excalidraw/element/bounds";
import {
  getAutoContrastModes,
  getAutoContrastResolved,
  getAutoContrastManualColors,
  getAutoContrastFillOpacity,
  hasAutoContrastFill,
} from "@excalidraw/element/autoContrast";

import type { RGB } from "@excalidraw/element/calloutContrast";
import type {
  ExcalidrawElement,
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
export class AutoContrastController {
  private fingerprints = new WeakMap<ExcalidrawElement, string>();
  private imageIdentities = new WeakMap<object, number>();
  private nextImageIdentity = 1;

  constructor(private sample = sampleAutoContrastScene) {}

  resolve(
    elements: readonly NonDeletedExcalidrawElement[],
    state: AppState,
    imageCache: AppClassProperties["imageCache"],
    ownerDocument: Document,
    force = false,
  ) {
    if (!elements.some((element) => getAutoContrastModes(element))) {
      return false;
    }
    const elementsMap = arrayToMap(elements);
    const labels = new Map<
      string,
      Extract<NonDeletedExcalidrawElement, { type: "text" }>
    >();
    for (const element of elements) {
      if (element.type === "text" && element.containerId) {
        labels.set(element.containerId, element);
      }
    }
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
      const text = element.type === "text" ? element : labels.get(element.id);
      const modes = getAutoContrastModes(element);
      const parent =
        element.type === "text" && element.containerId
          ? elementsMap.get(element.containerId)
          : undefined;
      const sceneKey = `${JSON.stringify(state.frameRendering)}:${
        ownerDocument.fonts?.status || "loaded"
      }:${state.theme}:${state.viewBackgroundColor}:${frameKey}:${lowerKey}:${
        text ? versionKey(text) : state.currentItemFontSize
      }`;
      if (
        !modes ||
        (parent && getAutoContrastModes(parent)) ||
        (!force && this.fingerprints.get(element) === sceneKey)
      ) {
        lowerKey += `${JSON.stringify(getAutoContrastResolved(element))};`;
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
      const previous = getAutoContrastResolved(element);
      const manualColors = getAutoContrastManualColors(element);
      const hasFill = hasAutoContrastFill(element);
      const loopFill = element.type === "line" && isPathALoop(element.points);
      const solidLoop = loopFill && element.fillStyle === "solid";
      const loopColor = applyDarkModeFilter(
        element.backgroundColor,
        state.theme === THEME.DARK,
      );
      const overallOpacity =
        (element.opacity *
          (getContainingFrame(element, elementsMap)?.opacity ?? 100)) /
        100;
      const preserve = !samples.box.length && previous;
      const result = resolveCalloutContrast({
        ...samples,
        // Closed line paths keep their manual fill; hatched fills expose both
        // artwork and fill-colored pixels, so consider both conservatively.
        ...(loopFill && !solidLoop
          ? {
              box: samples.box.flatMap((sample) => [
                sample,
                compositeCalloutColor(loopColor, sample, overallOpacity),
              ]),
            }
          : {}),
        fontSize:
          text?.type === "text" ? text.fontSize : state.currentItemFontSize,
        foreground: modes.foreground
          ? preserve
            ? previous.foreground
            : "auto"
          : manualColors?.foreground ??
            applyDarkModeFilter(
              element.strokeColor,
              state.theme === THEME.DARK,
            ),
        background: !hasFill
          ? solidLoop
            ? loopColor
            : "transparent"
          : modes.background
          ? preserve
            ? previous.background
            : "auto"
          : manualColors?.background ??
            applyDarkModeFilter(
              element.backgroundColor,
              state.theme === THEME.DARK,
            ),
        opacity: !hasFill
          ? solidLoop
            ? 100
            : 0
          : modes.opacity
          ? preserve
            ? previous.backgroundOpacity
            : "auto"
          : getAutoContrastFillOpacity(element),
        fallbackBackground: applyDarkModeFilter(
          state.viewBackgroundColor,
          state.theme === THEME.DARK,
        ),
        overallOpacity,
        previous,
      });
      if (!hasFill && modes.foreground && result.lowContrast) {
        result.halo = result.foreground === "#000000" ? "#ffffff" : "#000000";
      }
      const resolved = preserve
        ? { ...result, halo: modes.foreground ? previous.halo : null }
        : result;
      if (JSON.stringify(previous) !== JSON.stringify(resolved)) {
        // Derived render data: keep geometry/version unchanged, so resolution is
        // captured with the originating edit and never creates an AI/scene undo step.
        Object.assign(
          element,
          element.type === "callout" && !element.autoContrast
            ? { calloutResolvedStyle: resolved }
            : { autoContrastResolved: resolved },
        );
        ShapeCache.delete(element);
        if (text) {
          ShapeCache.delete(text);
        }
        changed = true;
      }
      lowerKey += `${JSON.stringify(getAutoContrastResolved(element))};`;
    }
    return changed;
  }
}

/** Sample composed lower-z artwork, excluding the annotation and its own label. */
export const sampleAutoContrastScene = (
  callout: ExcalidrawElement,
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
  const [, , , , cx, cy] = getElementAbsoluteCoords(
    callout,
    arrayToMap(elements),
  );
  const world = ([x, y]: Point): Point => {
    const dx = callout.x + x - cx;
    const dy = callout.y + y - cy;
    return [
      cx + dx * Math.cos(callout.angle) - dy * Math.sin(callout.angle),
      cy + dx * Math.sin(callout.angle) + dy * Math.cos(callout.angle),
    ];
  };
  const box: Point[] = [];
  const edge: Point[] = [];
  if (callout.type === "line" || callout.type === "arrow") {
    // Rough's actual center paths include curved segments, elbow bends and
    // arrowheads; sampling a bounding rectangle would miss narrow strokes.
    for (const shape of ShapeCache.generateElementShape(callout, null)) {
      for (const set of shape.sets.filter((set) => set.type === "path")) {
        let previous: Point = [0, 0];
        for (const op of set.ops) {
          const d = op.data;
          if (op.op === "move") {
            previous = [d[0], d[1]];
          } else if (op.op === "lineTo" || op.op === "bcurveTo") {
            const start = previous;
            for (let step = 0; step <= 16; step++) {
              const t = step / 16;
              const u = 1 - t;
              edge.push(
                world(
                  op.op === "lineTo"
                    ? [u * start[0] + t * d[0], u * start[1] + t * d[1]]
                    : [
                        u ** 3 * start[0] +
                          3 * u ** 2 * t * d[0] +
                          3 * u * t ** 2 * d[2] +
                          t ** 3 * d[4],
                        u ** 3 * start[1] +
                          3 * u ** 2 * t * d[1] +
                          3 * u * t ** 2 * d[3] +
                          t ** 3 * d[5],
                      ],
                ),
              );
            }
            previous = op.op === "lineTo" ? [d[0], d[1]] : [d[4], d[5]];
          }
        }
      }
    }
    // Bound work even for long paths with thousands of vertices.
    if (edge.length > 256) {
      const selected = Array.from(
        { length: 256 },
        (_, index) => edge[Math.floor((index * (edge.length - 1)) / 255)],
      );
      edge.splice(0, edge.length, ...selected);
    }
    box.push(...edge);
  } else {
    for (let x = 0; x < 7; x++) {
      for (let y = 0; y < 7; y++) {
        const nx = 0.08 + x * 0.14;
        const ny = 0.08 + y * 0.14;
        if (
          callout.type === "ellipse" &&
          (nx - 0.5) ** 2 + (ny - 0.5) ** 2 > 0.25
        ) {
          continue;
        }
        if (
          callout.type === "diamond" &&
          Math.abs(nx - 0.5) + Math.abs(ny - 0.5) > 0.5
        ) {
          continue;
        }
        box.push(
          world([
            callout.width * (0.08 + x * 0.14),
            callout.height * (0.08 + y * 0.14),
          ]),
        );
      }
    }
    for (let step = 0; step <= 16; step++) {
      const t = step / 16;
      if (callout.type === "ellipse") {
        const angle = t * Math.PI * 2;
        edge.push(
          world([
            (callout.width * (1 + Math.cos(angle))) / 2,
            (callout.height * (1 + Math.sin(angle))) / 2,
          ]),
        );
      } else if (callout.type === "diamond") {
        edge.push(
          world([callout.width * (0.5 + t / 2), (callout.height * t) / 2]),
          world([callout.width * (1 - t / 2), callout.height * (0.5 + t / 2)]),
          world([callout.width * (0.5 - t / 2), callout.height * (1 - t / 2)]),
          world([(callout.width * t) / 2, callout.height * (0.5 - t / 2)]),
        );
      } else {
        edge.push(
          world([callout.width * t, 0]),
          world([callout.width * t, callout.height]),
          world([0, callout.height * t]),
          world([callout.width, callout.height * t]),
        );
      }
      if (callout.type === "callout") {
        const { attachPoint, controlPoint, tipPoint } =
          getCalloutTailPoints(callout);
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
    }
    if (callout.type === "text") {
      edge.push(...box);
    }
  }
  for (const label of elements) {
    if (label.type !== "text" || label.containerId !== callout.id) {
      continue;
    }
    const [left, top, right, bottom, labelCx, labelCy] =
      getElementAbsoluteCoords(label, arrayToMap(elements));
    for (let x = 0; x < 7; x++) {
      for (let y = 0; y < 7; y++) {
        const dx = left + (right - left) * (0.08 + x * 0.14) - labelCx;
        const dy = top + (bottom - top) * (0.08 + y * 0.14) - labelCy;
        const point: Point = [
          labelCx + dx * Math.cos(label.angle) - dy * Math.sin(label.angle),
          labelCy + dx * Math.sin(label.angle) + dy * Math.cos(label.angle),
        ];
        box.push(point);
        // Stroke-only owners have no fill beneath their labels either.
        if (!hasAutoContrastFill(callout)) {
          edge.push(point);
        }
      }
    }
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

// Compatibility for existing callout integrations and regression tests.
export { AutoContrastController as CalloutAutoStyleController };
export const sampleCalloutScene = sampleAutoContrastScene;
