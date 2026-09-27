export type ImageProvider = "gemini" | "openai";

export const IMAGE_PROVIDER_STORAGE_KEY = "aiImageProvider";

export function getImageProviderPreference(): ImageProvider {
  try {
    return window.localStorage.getItem(IMAGE_PROVIDER_STORAGE_KEY) === "openai"
      ? "openai"
      : "gemini";
  } catch {
    return "gemini";
  }
}

export function setImageProviderPreference(provider: ImageProvider): void {
  try {
    window.localStorage.setItem(IMAGE_PROVIDER_STORAGE_KEY, provider);
  } catch {
    // Storage can be unavailable in private browsing; the next edit uses Gemini.
  }
}
