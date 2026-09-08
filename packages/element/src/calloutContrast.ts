import { APCAcontrast, sRGBtoY, fontLookupAPCA } from "apca-w3";
import { colorParsley } from "colorparsley";

export type RGB = readonly [number, number, number];
export type CalloutContrastInput = {
  box: readonly RGB[];
  edge: readonly RGB[];
  fontSize: number;
  foreground: string;
  background: string;
  opacity: "auto" | number;
  fallbackBackground?: string;
  previous?: CalloutContrastResult;
  overallOpacity?: number;
};
export type CalloutContrastResult = {
  foreground: string;
  background: string;
  backgroundOpacity: number;
  halo: string | null;
  minContrast: number;
  targetContrast: number;
  lowContrast: boolean;
  fallback: boolean;
};
const clamp = (value: number) =>
  Math.max(0, Math.min(100, Number.isFinite(value) ? value : 100));
const validSample = (sample: RGB) =>
  sample.length === 3 &&
  sample.every((value) => Number.isFinite(value) && value >= 0 && value <= 255);

export const compositeCalloutColor = (
  color: string,
  backdrop: RGB,
  opacity: number,
): RGB => {
  const rgba = colorParsley(color === "transparent" ? "#0000" : color);
  return composite(rgba, backdrop, clamp(opacity));
};
const composite = (
  rgba: readonly number[],
  backdrop: RGB,
  opacity: number,
): RGB => {
  const alpha = (rgba[3] * opacity) / 100;
  return [
    rgba[0] * alpha + backdrop[0] * (1 - alpha),
    rgba[1] * alpha + backdrop[1] * (1 - alpha),
    rgba[2] * alpha + backdrop[2] * (1 - alpha),
  ];
};
const contrast = (foreground: RGB, background: RGB) =>
  APCAcontrast(sRGBtoY(foreground), sRGBtoY(background));

/** Application policy around the unchanged APCA algorithm; not a conformance claim. */
export const resolveCalloutContrast = (
  input: CalloutContrastInput,
): CalloutContrastResult => {
  const samples = input.box.filter(validSample);
  const fallback = !samples.length;
  const fallbackRGB = colorParsley(input.fallbackBackground || "#ffffff").slice(
    0,
    3,
  ) as unknown as RGB;
  const box = fallback ? [fallbackRGB] : samples;
  const edge = input.edge.filter(validSample);
  // Handwriting faces need more generous sizing than the lookup's reference face.
  const effectiveSize = Math.max(
    1,
    (Number.isFinite(input.fontSize) ? input.fontSize : 20) * 0.8,
  );
  let targetContrast = 60;
  while (
    targetContrast < 106 &&
    Number(fontLookupAPCA(targetContrast)[4]) > effectiveSize
  ) {
    targetContrast++;
  }
  const overall = clamp(input.overallOpacity ?? 100);
  const foregrounds =
    input.foreground === "auto" ? ["#000000", "#ffffff"] : [input.foreground];
  const backgrounds =
    input.background === "auto" ? ["#ffffff", "#000000"] : [input.background];
  const opacities =
    input.opacity === "auto"
      ? fallback
        ? [100]
        : Array.from({ length: 101 }, (_, index) => index)
      : [clamp(input.opacity)];
  let best: CalloutContrastResult | null = null;
  let bestScore = -Infinity;
  for (const foreground of foregrounds) {
    const rgbaForeground = colorParsley(
      foreground === "transparent" ? "#0000" : foreground,
    );
    const edgeContrast = edge.length
      ? Math.min(
          ...edge.map((sample) =>
            Math.abs(
              contrast(composite(rgbaForeground, sample, overall), sample),
            ),
          ),
        )
      : 100;
    const halo =
      input.foreground === "auto" && edgeContrast < 30
        ? foreground === "#000000"
          ? "#ffffff"
          : "#000000"
        : null;
    for (const background of backgrounds) {
      const rgbaBackground = colorParsley(
        background === "transparent" ? "#0000" : background,
      );
      for (const backgroundOpacity of opacities) {
        let minContrast = Infinity;
        for (const sample of box) {
          const fill = composite(
            rgbaBackground,
            sample,
            (backgroundOpacity * overall) / 100,
          );
          const text = composite(rgbaForeground, fill, overall);
          const value = contrast(text, fill);
          if (Math.abs(value) < Math.abs(minContrast)) {
            minContrast = value;
          }
        }
        const lowContrast =
          Math.abs(minContrast) < targetContrast ||
          Number(fontLookupAPCA(Math.abs(minContrast))[4]) > effectiveSize;
        const prior =
          input.previous?.foreground === foreground &&
          input.previous.background === background;
        // Readability first, then minimal obscuring fill. Keep a prior polarity on ties.
        const score = lowContrast
          ? Math.abs(minContrast)
          : 10000 -
            backgroundOpacity * 10 +
            (prior ? 2 : 0) +
            Math.min(edgeContrast, 100) / 100;
        if (score > bestScore) {
          bestScore = score;
          best = {
            foreground,
            background,
            backgroundOpacity,
            halo,
            minContrast,
            targetContrast,
            lowContrast,
            fallback,
          };
        }
        if (!lowContrast) {
          break;
        }
      }
    }
  }
  return best!;
};
