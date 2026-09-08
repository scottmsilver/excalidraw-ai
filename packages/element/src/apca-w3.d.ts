declare module "apca-w3" {
  export function sRGBtoY(rgb: readonly number[]): number;
  export function APCAcontrast(
    textLuminance: number,
    backgroundLuminance: number,
  ): number;
  export function calcAPCA(
    text: string | readonly number[],
    background: string | readonly number[],
  ): number;
  export function fontLookupAPCA(contrast: number): (number | string)[];
}
declare module "colorparsley" {
  export function colorParsley(color: string): [number, number, number, number];
}
