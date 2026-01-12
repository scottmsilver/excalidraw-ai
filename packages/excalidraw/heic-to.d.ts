declare module "heic-to" {
  interface HeicToOptions {
    blob: Blob;
    type: "image/jpeg" | "image/png";
    quality?: number;
  }

  export function heicTo(options: HeicToOptions): Promise<Blob>;
  export function isHeic(blob: Blob): Promise<boolean>;
}
