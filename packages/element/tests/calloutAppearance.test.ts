import { THEME } from "@excalidraw/common";

import { newCalloutElement } from "../src/newElement";
import { ShapeCache } from "../src/shape";

describe("resolved callout drawing", () => {
  it("makes only the body fill translucent and keeps resolved colors in dark mode", () => {
    const callout = {
      ...newCalloutElement({ type: "callout", x: 0, y: 0, roughness: 0 }),
      calloutResolvedStyle: {
        foreground: "#ffffff",
        background: "#000000",
        backgroundOpacity: 37,
        halo: null,
        minContrast: -90,
        targetContrast: 90,
        lowContrast: false,
        fallback: false,
      },
    };
    const shapes = ShapeCache.generateElementShape(callout, {
      theme: THEME.DARK,
      isExporting: true,
      canvasBackgroundColor: "#ffffff",
      embedsValidationStatus: new Map(),
    });
    expect(shapes[0].options.fill).toBe("rgba(0, 0, 0, 0.37)");
    expect(shapes.every((shape) => shape.options.stroke === "#ffffff")).toBe(
      true,
    );
    expect(shapes[1].options.fill).toBeUndefined();
  });
  it("adds a stroke-only halo behind the original shapes", () => {
    const callout = {
      ...newCalloutElement({ type: "callout", x: 0, y: 0 }),
      calloutResolvedStyle: {
        foreground: "#000000",
        background: "#ffffff",
        backgroundOpacity: 80,
        halo: "#ffffff",
        minContrast: 90,
        targetContrast: 90,
        lowContrast: false,
        fallback: false,
      },
    };
    const shapes = ShapeCache.generateElementShape(callout, null);
    expect(shapes[0].options.stroke).toBe("#ffffff");
    expect(shapes[0].options.fill).toBeUndefined();
    expect(shapes[0].sets.every((set) => set.type === "path")).toBe(true);
    expect(shapes.at(-1)!.options.stroke).toBe("#000000");
  });
});
