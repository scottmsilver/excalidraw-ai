import { beforeEach, expect, it, vi } from "vitest";

import { agenticEdit, generateImage, inpaint } from "./apiClient";
import { setImageProviderPreference } from "./imageProviderPreference";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

it("sends the saved provider with an agentic edit", async () => {
  setImageProviderPreference("openai");
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      'event: complete\ndata: {"imageData":"edited","iterations":1,"finalPrompt":"blue"}\n\n',
      {
        headers: { "Content-Type": "text/event-stream" },
      },
    ),
  );
  await agenticEdit("source", "blue", { imageProvider: "openai" });
  expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toMatchObject({
    imageProvider: "openai",
  });
});

it("sends the provider with direct and inpaint edits", async () => {
  setImageProviderPreference("openai");
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response('{"imageData":"edited","raw":{}}'))
    .mockResolvedValueOnce(
      new Response(
        'event: complete\ndata: {"imageData":"edited","iterations":1,"finalPrompt":"blue"}\n\n',
      ),
    );
  await generateImage("source", "blue", { model: "gemini" });
  await inpaint("source", "mask", "blue");
  expect(
    JSON.parse(fetchMock.mock.calls[0][1]?.body as string).imageProvider,
  ).toBe("openai");
  expect(
    JSON.parse(fetchMock.mock.calls[1][1]?.body as string).imageProvider,
  ).toBe("openai");
});
