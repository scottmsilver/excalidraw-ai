import { restoreElements } from "@excalidraw/excalidraw/data/restore";

import { newCalloutElement } from "../src/newElement";

const create = () => newCalloutElement({ type: "callout", x: 0, y: 0 });

describe("callout appearance persistence", () => {
  it("does not inherit a faded overall opacity for a new Auto callout", () => {
    expect(
      newCalloutElement({ type: "callout", x: 0, y: 0, opacity: 20 }).opacity,
    ).toBe(100);
  });
  it("defaults new callouts to three independent Auto fields", () => {
    const element = create();
    expect(element.calloutAutoStyle).toEqual({
      foreground: true,
      background: true,
      opacity: true,
    });
    expect(element.calloutBackgroundOpacity).toBe(100);
    expect(element.opacity).toBe(100);
  });
  it("does not enable Auto when restoring a legacy callout", () => {
    const { calloutAutoStyle, calloutBackgroundOpacity, ...legacy } = create();
    const [restored] = restoreElements(
      [
        {
          ...legacy,
          strokeColor: "#123456",
          backgroundColor: "#abcdef",
          opacity: 40,
        },
      ],
      null,
    );
    expect(restored).toMatchObject({
      strokeColor: "#123456",
      backgroundColor: "#abcdef",
      opacity: 40,
    });
    expect(restored).not.toHaveProperty("calloutAutoStyle");
  });
  it("roundtrips Auto locks and independent fill opacity", () => {
    const element = {
      ...create(),
      calloutAutoStyle: { foreground: true, background: false, opacity: true },
      calloutBackgroundOpacity: 37,
    };
    const [restored] = restoreElements(
      JSON.parse(JSON.stringify([element])),
      null,
    );
    expect(restored).toMatchObject({
      calloutAutoStyle: element.calloutAutoStyle,
      calloutBackgroundOpacity: 37,
    });
  });
  it("normalizes malformed optional appearance data on import", () => {
    const [restored] = restoreElements(
      [
        {
          ...create(),
          calloutAutoStyle: { foreground: "yes", background: true, opacity: 0 },
          calloutBackgroundOpacity: 900,
          calloutResolvedStyle: { foreground: 42 },
        } as any,
      ],
      null,
    );
    expect(restored).toMatchObject({
      calloutAutoStyle: { foreground: false, background: true, opacity: false },
      calloutBackgroundOpacity: 100,
    });
    expect(restored).toHaveProperty("calloutResolvedStyle", undefined);
  });
});
