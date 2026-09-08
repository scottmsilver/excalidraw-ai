import { act, cleanup, renderHook } from "@testing-library/react";
import { vi } from "vitest";

import { executeAgenticEdit } from "../services/agenticService";

import {
  AIManipulationProvider,
  useAIManipulation,
} from "./AIManipulationProvider";

import type { AgenticEditResult } from "../services/agenticService";
import type { AIProgressEvent } from "../services/types";

// Keep the provider, mode/marker hooks, and edit hook real. Only replace the
// network boundary so these tests never use an API key or contact production.
vi.mock("../services/agenticService", () => ({
  executeAgenticEdit: vi.fn(),
}));

const editedImage = {
  imageData: "data:image/png;base64,edited",
  iterations: 2,
  finalPrompt: "Move A to B",
};

const setup = () =>
  renderHook(() => useAIManipulation(), { wrapper: AIManipulationProvider });

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("AI manipulation provider integration", () => {
  it("keeps placed markers and the original scene snapshot across dialog review", () => {
    const { result } = setup();
    const snapshot = [{ id: "original-image", type: "image" }];
    act(() => {
      result.current.enterAIMode();
      result.current.setElementsSnapshot(snapshot);
      result.current.addPoint(-50, 125);
    });
    act(() => result.current.addPoint(200, 300));
    expect(result.current.referencePoints).toMatchObject([
      { label: "A", x: -50, y: 125 },
      { label: "B", x: 200, y: 300 },
    ]);

    act(() => {
      result.current.openDialog();
      result.current.addIterationImage(editedImage.imageData);
      result.current.enterReviewMode();
    });
    expect(result.current.isReviewing).toBe(true);
    act(() => result.current.closeDialog());
    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.isReviewing).toBe(false);
    expect(result.current.iterationImages).toEqual([]);
    expect(result.current.referencePointCount).toBe(2);
    expect(result.current.elementsSnapshot).toEqual(snapshot);
    expect(result.current.elementsSnapshot).not.toBe(snapshot);
  });

  it.each(["acceptResult", "rejectResult"] as const)(
    "%s clears review images so they cannot leak into the next edit",
    (action) => {
      const { result } = setup();
      act(() => {
        result.current.setIsProcessing(true);
        result.current.addIterationImage("first");
        result.current.addIterationImage("second");
      });
      expect(result.current.isProcessing).toBe(true);
      act(() => result.current.enterReviewMode());
      expect(result.current.isProcessing).toBe(false);
      expect(result.current.iterationImages).toEqual(["first", "second"]);
      act(() => result.current[action](1));
      expect(result.current.isReviewing).toBe(false);
      expect(result.current.iterationImages).toEqual([]);
    },
  );

  it("forwards images and current markers and exposes streaming progress until completion", async () => {
    let complete!: (value: AgenticEditResult) => void;
    vi.mocked(executeAgenticEdit).mockImplementation(
      () => new Promise((resolve) => (complete = resolve)),
    );
    const { result } = setup();
    act(() => result.current.addPoint(10, 20));
    const clean = new Blob(["clean"], { type: "image/png" });
    const annotated = new Blob(["annotated"], { type: "image/png" });
    let pending!: Promise<string>;
    act(() => {
      pending = result.current.executeEdit("Move A to B", clean, annotated);
    });
    expect(result.current.isProcessing).toBe(true);
    const request = vi.mocked(executeAgenticEdit).mock.calls[0][0];
    expect(request).toMatchObject({
      cleanImageBlob: clean,
      annotatedImageBlob: annotated,
      command: "Move A to B",
      referencePoints: [{ label: "A", x: 10, y: 20 }],
    });
    const progress = {
      step: "processing",
      message: "Editing image",
    } as AIProgressEvent;
    act(() => request.onProgress?.(progress));
    expect(result.current.progress).toEqual(progress);
    await act(async () => {
      complete(editedImage);
      expect(await pending).toBe(editedImage.imageData);
    });
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.error).toBeNull();
    act(() => result.current.resetEditState());
    expect(result.current.progress).toBeNull();
  });

  it("clears processing after an API error and allows a successful retry", async () => {
    const failure = new Error("Image service unavailable");
    vi.mocked(executeAgenticEdit)
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(editedImage);
    const { result } = setup();
    const image = new Blob(["clean"]);
    await act(async () => {
      await expect(result.current.executeEdit("Edit", image)).rejects.toBe(
        failure,
      );
    });
    expect(result.current.error).toBe(failure);
    expect(result.current.isProcessing).toBe(false);
    await act(async () => {
      await expect(result.current.executeEdit("Retry", image)).resolves.toBe(
        editedImage.imageData,
      );
    });
    expect(result.current.error).toBeNull();
    expect(result.current.isProcessing).toBe(false);
  });
});
