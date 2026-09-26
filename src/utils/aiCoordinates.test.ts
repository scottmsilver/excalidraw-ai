import {
  canvasToImage,
  getViewportFromAppState,
  imageRegionToScreen,
  imageToCanvas,
  screenToCanvas,
} from "./coordinateTransforms";
import { extractShapesFromElements } from "./shapeExtractor";

describe("AI annotation coordinates", () => {
  const bounds = { minX: -200, minY: 50, exportPadding: 10 };

  it("keeps a marker at the same scene position through export and a zoomed viewport", () => {
    const viewport = getViewportFromAppState({
      scrollX: 300,
      scrollY: -25,
      zoom: { value: 2 },
    });
    // A click at (250, 150) represents scene (-175, 100), which is 25px
    // from the cropped image's left edge and 50px from its top, plus padding.
    const marker = screenToCanvas({ x: 250, y: 150 }, viewport);
    expect(marker).toEqual({ x: -175, y: 100 });
    expect(canvasToImage(marker, bounds)).toEqual({ x: 35, y: 60 });
    expect(imageToCanvas({ x: 35, y: 60 }, bounds)).toEqual(marker);
    expect(
      imageRegionToScreen({ x1: 35, y1: 60, x2: 85, y2: 90 }, bounds, viewport),
    ).toEqual({ x1: 250, y1: 150, x2: 350, y2: 210 });
  });

  it("sends arrow points in the same exported image space as reference markers", () => {
    const arrow = {
      type: "arrow",
      x: -175,
      y: 100,
      width: 50,
      height: 30,
      strokeColor: "#ff0000",
      strokeWidth: 2,
      backgroundColor: "transparent",
      points: [
        [0, 0],
        [25, 15],
        [50, 30],
      ],
      roundness: null,
      startArrowhead: null,
      endArrowhead: "arrow",
    };
    const shapes = extractShapesFromElements(
      [arrow, { ...arrow, isDeleted: true }, { type: "image", x: -200, y: 50 }],
      bounds,
    );
    expect(shapes).toHaveLength(1);
    expect(shapes[0]).toMatchObject({
      boundingBox: { x: 35, y: 60, width: 50, height: 30 },
      startPoint: { x: 35, y: 60 },
      endPoint: { x: 85, y: 90 },
      points: [
        { x: 35, y: 60 },
        { x: 60, y: 75 },
        { x: 85, y: 90 },
      ],
      hasStartArrowhead: false,
      hasEndArrowhead: true,
    });
  });
});
