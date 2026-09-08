import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import { exportToSvg } from "@excalidraw/utils";

import { newElement, newTextElement } from "../src/newElement";
import { generateRoughOptions, ShapeCache } from "../src/shape";
import { newLinearElement, newArrowElement } from "../src/newElement";
import { getCalloutTextColor } from "../src/calloutAppearance";

const resolved = {
  foreground: "#ffffff",
  background: "#000000",
  backgroundOpacity: 37,
  halo: "#000000",
  minContrast: 90,
  targetContrast: 90,
  lowContrast: false,
  fallback: false,
};

describe("shared Auto contrast appearance", () => {
  it("exports standalone text with its resolved foreground and opposite halo", async () => {
    const text = {
      ...newTextElement({ x: 0, y: 0, text: "Readable" }),
      autoContrastResolved: resolved,
    };
    const svg = await exportToSvg({
      elements: [text],
      appState: { exportWithDarkMode: true },
      files: {},
    });
    expect(svg.querySelector("text")?.getAttribute("fill")).toBe("#ffffff");
    expect(svg.querySelector("text")?.getAttribute("stroke")).toBe("#000000");
    expect(svg.querySelector("text")?.getAttribute("paint-order")).toBe(
      "stroke fill",
    );
  });
  it("uses the resolved foreground for filled arrowheads", () => {
    const element = {
      ...newArrowElement({
        type: "arrow",
        x: 0,
        y: 0,
        points: [
          [0, 0],
          [100, 100],
        ] as any,
        endArrowhead: "triangle",
      }),
      autoContrastResolved: { ...resolved, halo: null },
    };
    const shapes = ShapeCache.generateElementShape(element, null);
    expect(shapes.at(-1)!.options.fill).toBe("#ffffff");
  });
  it("adds a wider stroke-only halo to Auto lines", () => {
    const element = {
      ...newLinearElement({
        type: "line",
        x: 0,
        y: 0,
        points: [
          [0, 0],
          [100, 100],
        ] as any,
      }),
      autoContrastResolved: resolved,
    };
    const shapes = ShapeCache.generateElementShape(element, null);
    expect(shapes).toHaveLength(2);
    expect(shapes[0].options.stroke).toBe(resolved.halo);
    expect(shapes[0].options.strokeWidth).toBeGreaterThan(
      shapes[1].options.strokeWidth,
    );
    expect(shapes[0].options.fill).toBeUndefined();
  });
  it.each(["rectangle", "ellipse", "diamond"] as const)(
    "renders resolved %s colors and only fades the fill",
    (type) => {
      const element = {
        ...newElement({ type, x: 0, y: 0 }),
        autoContrastResolved: resolved,
      };
      expect(generateRoughOptions(element, false, true)).toMatchObject({
        stroke: "#ffffff",
        fill: "rgba(0, 0, 0, 0.37)",
      });
    },
  );
  it("uses standalone text resolution and inherits owner resolution for labels", () => {
    const owner = {
      ...newElement({ type: "rectangle", x: 0, y: 0 }),
      autoContrastResolved: resolved,
    };
    const text = {
      ...newTextElement({ x: 0, y: 0, text: "Label" }),
      autoContrastResolved: resolved,
    };
    expect(getCalloutTextColor(text, new Map())).toBe("#ffffff");
    expect(
      getCalloutTextColor(
        { ...text, containerId: owner.id },
        new Map([[owner.id, owner]]),
      ),
    ).toBe("#ffffff");
  });
  it("sanitizes shared optional data without activating old shapes", () => {
    const element = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    expect(restoreElements([element], null)[0]).not.toHaveProperty(
      "autoContrast",
    );
    const [restored] = restoreElements(
      [
        {
          ...element,
          autoContrast: { foreground: "yes", background: true, opacity: 0 },
          fillOpacity: 900,
          autoContrastResolved: { foreground: 42 },
        } as any,
      ],
      null,
    );
    expect(restored).toMatchObject({
      autoContrast: { foreground: false, background: true, opacity: false },
      fillOpacity: 100,
    });
    expect(restored.autoContrastResolved).toBeUndefined();
  });
});
