import { resolveCalloutContrast } from "../src/calloutContrast";

const black = [0, 0, 0] as const;
const white = [255, 255, 255] as const;
const base = {
  fontSize: 20,
  foreground: "auto" as const,
  background: "auto" as const,
  opacity: "auto" as const,
};

describe("sampled callout contrast", () => {
  it("chooses dark foreground only after receiving light samples", () => {
    const result = resolveCalloutContrast({
      ...base,
      box: [white],
      edge: [white],
    });
    expect(result.foreground).toBe("#000000");
    expect(result.backgroundOpacity).toBe(0);
    expect(result.lowContrast).toBe(false);
  });
  it("chooses light foreground on dark samples", () => {
    const result = resolveCalloutContrast({
      ...base,
      box: [black],
      edge: [black],
    });
    expect(result.foreground).toBe("#ffffff");
    expect(result.backgroundOpacity).toBe(0);
    expect(result.lowContrast).toBe(false);
  });
  it("raises fill opacity for mixed artwork and adds a contrasting edge halo", () => {
    const result = resolveCalloutContrast({
      ...base,
      box: [white, black],
      edge: [white, black],
    });
    expect(result.backgroundOpacity).toBeGreaterThan(0);
    expect(result.lowContrast).toBe(false);
    expect(result.halo).not.toBeNull();
    expect(Math.abs(result.minContrast)).toBeGreaterThanOrEqual(
      result.targetContrast,
    );
  });
  it("composites candidate fill rather than measuring its opaque color", () => {
    const result = resolveCalloutContrast({
      ...base,
      foreground: "#000000",
      background: "#ffffff",
      opacity: 10,
      box: [black],
      edge: [black],
    });
    expect(result.backgroundOpacity).toBe(10);
    expect(result.lowContrast).toBe(true);
  });
  it("respects manual color locks while allowing Auto opacity", () => {
    const result = resolveCalloutContrast({
      ...base,
      foreground: "#000000",
      background: "#ffffff",
      box: [black],
      edge: [white],
    });
    expect(result.foreground).toBe("#000000");
    expect(result.background).toBe("#ffffff");
    expect(result.backgroundOpacity).toBeGreaterThan(0);
    expect(result.lowContrast).toBe(false);
    expect(result.halo).toBeNull();
  });
  it("uses more contrast for smaller text and preserves signed polarity", () => {
    const small = resolveCalloutContrast({
      ...base,
      fontSize: 16,
      box: [[128, 128, 128]],
      edge: [],
    });
    const large = resolveCalloutContrast({
      ...base,
      fontSize: 48,
      box: [[128, 128, 128]],
      edge: [],
    });
    expect(small.targetContrast).toBeGreaterThan(large.targetContrast);
    const light = resolveCalloutContrast({ ...base, box: [black], edge: [] });
    expect(light.minContrast).toBeLessThan(0);
  });
  it("uses an opaque fallback when samples are unavailable", () => {
    const result = resolveCalloutContrast({
      ...base,
      box: [],
      edge: [],
      fallbackBackground: "#ffffff",
    });
    expect(result.fallback).toBe(true);
    expect(result.backgroundOpacity).toBe(100);
    expect(result.foreground).toBe("#000000");
  });
  it("is deterministic and keeps an equally suitable previous polarity", () => {
    const input = { ...base, box: [black, white], edge: [white] };
    const first = resolveCalloutContrast(input);
    expect(resolveCalloutContrast({ ...input, previous: first })).toEqual(
      first,
    );
  });
});
