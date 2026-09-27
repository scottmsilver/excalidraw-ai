import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { vi } from "vitest";

import { executeAgenticEdit } from "../../services/agenticService";
import { setImageProviderPreference } from "../../services/imageProviderPreference";
import { aiLogService } from "../../../excalidraw-app/ai/aiLogService";

import {
  AIManipulationProvider,
  useAIManipulation,
} from "../../providers/AIManipulationProvider";

import { ManipulationDialog } from "./ManipulationDialog";

import type { AgenticEditResult } from "../../services/agenticService";
import type { AIManipulationContextValue } from "../../providers/AIManipulationProvider";

vi.mock("../../services/agenticService", () => ({
  executeAgenticEdit: vi.fn(),
}));

let context: AIManipulationContextValue;
function Harness() {
  context = useAIManipulation();
  return (
    <ManipulationDialog
      isOpen
      onClose={() => {}}
      onResult={() => {}}
      referencePoints={[]}
      cleanImageBlob={new Blob(["image"])}
      annotatedImageBlob={null}
    />
  );
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  localStorage.clear();
  aiLogService.clearLog();
});

it("shows a missing OpenAI key error through the AI log path", async () => {
  setImageProviderPreference("openai");
  vi.mocked(executeAgenticEdit).mockRejectedValue(
    new Error("OPENAI_API_KEY is not configured"),
  );
  render(
    <AIManipulationProvider>
      <Harness />
    </AIManipulationProvider>,
  );
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Make it blue" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  await act(async () => {
    await Promise.resolve();
  });
  expect(aiLogService.getLog()).toContainEqual(
    expect.objectContaining({
      step: "error",
      error: expect.objectContaining({
        message: "OPENAI_API_KEY is not configured",
      }),
    }),
  );
});

it.each(["accept", "reject", "reset"])(
  "ignores stream events after early %s and preserves a newer request",
  async (action) => {
    let finish!: (result: AgenticEditResult) => void;
    vi.mocked(executeAgenticEdit).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    vi.mocked(executeAgenticEdit).mockImplementationOnce(
      () => new Promise(() => {}),
    );
    render(
      <AIManipulationProvider>
        <Harness />
      </AIManipulationProvider>,
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Make it blue" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    const first = vi.mocked(executeAgenticEdit).mock.calls[0][0];
    act(() =>
      first.onProgress?.({ step: "planning", message: "First request" }),
    );
    expect(context.progress?.message).toBe("First request");
    act(() => {
      if (action === "accept") {
        context.acceptResult(0);
      } else if (action === "reject") {
        context.rejectResult();
      } else {
        context.resetEditState();
      }
    });
    act(() =>
      first.onProgress?.({
        step: "planning",
        message: "Stale request",
        iterationImage: "stale",
      }),
    );
    expect(context.progress).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    const second = vi.mocked(executeAgenticEdit).mock.calls[1][0];
    act(() =>
      second.onProgress?.({ step: "planning", message: "New request" }),
    );
    await act(async () => {
      finish({
        imageData: "old-image",
        iterations: 1,
        finalPrompt: "old prompt",
      });
    });
    expect(context.isProcessing).toBe(true);
    expect(context.progress?.message).toBe("New request");
  },
);
