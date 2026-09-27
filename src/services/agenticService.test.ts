import { beforeEach, expect, it, vi } from "vitest";

import { agenticEdit } from "./apiClient";
import { executeAgenticEdit } from "./agenticService";
import {
  IMAGE_PROVIDER_STORAGE_KEY,
  getImageProviderPreference,
  setImageProviderPreference,
} from "./imageProviderPreference";

vi.mock("./apiClient", () => ({
  agenticEdit: vi.fn(),
  generateImage: vi.fn(),
  inpaint: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

it("defaults to Gemini and rejects an unknown saved provider", () => {
  expect(getImageProviderPreference()).toBe("gemini");
  localStorage.setItem(IMAGE_PROVIDER_STORAGE_KEY, "unknown");
  expect(getImageProviderPreference()).toBe("gemini");
});

it("persists the chosen provider", () => {
  setImageProviderPreference("openai");
  expect(localStorage.getItem(IMAGE_PROVIDER_STORAGE_KEY)).toBe("openai");
  expect(getImageProviderPreference()).toBe("openai");
});

it("sends the provider selected when the edit starts", async () => {
  setImageProviderPreference("openai");
  vi.mocked(agenticEdit).mockResolvedValue({
    imageData: "data:image/png;base64,edited",
    iterations: 1,
    finalPrompt: "blue",
  });
  const pending = executeAgenticEdit({
    cleanImageBlob: new Blob(["source"], { type: "image/png" }),
    referencePoints: [],
    command: "blue",
  });
  setImageProviderPreference("gemini");
  await pending;
  expect(agenticEdit).toHaveBeenCalledWith(
    expect.any(String),
    "blue",
    expect.objectContaining({ imageProvider: "openai" }),
  );
});

it("keeps the server configuration error for the AI error UI", async () => {
  setImageProviderPreference("openai");
  vi.mocked(agenticEdit).mockRejectedValue(
    new Error("OPENAI_API_KEY is not configured"),
  );
  await expect(
    executeAgenticEdit({
      cleanImageBlob: new Blob(["source"], { type: "image/png" }),
      referencePoints: [],
      command: "blue",
    }),
  ).rejects.toThrow("OPENAI_API_KEY is not configured");
});
