import { addReferenceMarkers } from "./referencePointImage";

describe("reference marker image export", () => {
  const points = [{ x: 73, y: 91, label: "AA", index: 6 }];

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("preserves the original blob without decoding when there are no markers", async () => {
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);
    const original = new Blob(["original"]);
    expect(await addReferenceMarkers(original, [])).toBe(original);
    expect(decode).not.toHaveBeenCalled();
  });

  it("draws labels at image coordinates and retains original dimensions", async () => {
    const bitmap = Object.assign(document.createElement("canvas"), {
      width: 320,
      height: 240,
      close: vi.fn(),
    });
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    const text = vi.spyOn(CanvasRenderingContext2D.prototype, "fillText");
    const result = new Blob(["marked"], { type: "image/png" });
    const encode = vi
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation(function (this: HTMLCanvasElement, callback) {
        expect(this.width).toBe(320);
        expect(this.height).toBe(240);
        callback(result);
      });
    expect(await addReferenceMarkers(new Blob(), points)).toBe(result);
    expect(text).toHaveBeenCalledWith("AA", 73, 91, 24);
    expect(encode).toHaveBeenCalledWith(expect.any(Function), "image/png");
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it("reports encoding failure instead of silently submitting unmarked guidance", async () => {
    const bitmap = Object.assign(document.createElement("canvas"), {
      close: vi.fn(),
    });
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback) => callback(null),
    );
    await expect(addReferenceMarkers(new Blob(), points)).rejects.toThrow(
      "Unable to export reference markers",
    );
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });
});
