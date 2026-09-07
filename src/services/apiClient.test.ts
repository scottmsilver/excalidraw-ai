import { agenticEdit, APIError } from "./apiClient";

const event = (name: string, data: unknown) =>
  `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;

const respondWith = (chunks: string[]) => {
  const read = vi.fn();
  for (const chunk of chunks) {
    read.mockResolvedValueOnce({
      done: false,
      value: new TextEncoder().encode(chunk),
    });
  }
  read.mockResolvedValue({ done: true });
  const cancel = vi.fn();
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    body: { getReader: () => ({ read, cancel }) },
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, cancel };
};

afterEach(() => vi.unstubAllGlobals());

describe("AI editing POST stream", () => {
  it("sends clean/annotated images and metadata separately and parses split progress", async () => {
    const progress = {
      step: "processing",
      iterationImage: "data:image/png;base64,interim",
    };
    const result = { imageData: "data:image/png;base64,result", iterations: 1 };
    const stream = event("progress", progress) + event("complete", result);
    const { fetchMock, cancel } = respondWith([
      stream.slice(0, 13),
      stream.slice(13, 57),
      stream.slice(57),
    ]);
    const onProgress = vi.fn();
    const referencePoints = [{ label: "A", x: 10, y: 20 }];
    await expect(
      agenticEdit("clean-image", "Move A", {
        annotatedImage: "annotated-image",
        referencePoints,
        onProgress,
      }),
    ).resolves.toEqual(result);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/agentic/edit");
    expect(request.method).toBe("POST");
    expect(JSON.parse(request.body)).toMatchObject({
      sourceImage: "clean-image",
      annotatedImage: "annotated-image",
      referencePoints,
      prompt: "Move A",
      maxIterations: 3,
    });
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(progress);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("rejects a server error and can complete a subsequent independent request", async () => {
    respondWith([event("error", { message: "Editing failed" })]);
    await expect(agenticEdit("clean", "Edit")).rejects.toThrow(
      new APIError("Editing failed"),
    );
    const result = { imageData: "result", iterations: 1 };
    respondWith([event("complete", result)]);
    await expect(agenticEdit("clean", "Retry")).resolves.toEqual(result);
  });

  it("reports an incomplete stream instead of silently accepting a partial image", async () => {
    respondWith([event("progress", { step: "planning" })]);
    await expect(agenticEdit("clean", "Edit")).rejects.toThrow(
      "SSE stream closed without complete event",
    );
  });
});
