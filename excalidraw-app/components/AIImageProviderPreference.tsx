import { RadioGroup } from "@excalidraw/excalidraw/components/RadioGroup";
import { MainMenu } from "@excalidraw/excalidraw/index";
import React, { useState } from "react";

import {
  getImageProviderPreference,
  setImageProviderPreference,
} from "../../src/services/imageProviderPreference";

import type { ImageProvider } from "../../src/services/imageProviderPreference";

export const AIImageProviderPreference = () => {
  const [provider, setProvider] = useState(getImageProviderPreference);

  const chooseProvider = (value: ImageProvider) => {
    setImageProviderPreference(value);
    setProvider(value);
  };

  return (
    <MainMenu.ItemCustom>
      <span id="ai-image-provider-label">AI image provider</span>
      <RadioGroup<ImageProvider>
        name="ai-image-provider"
        value={provider}
        onChange={chooseProvider}
        choices={[
          { value: "gemini", label: "Gemini", ariaLabel: "Gemini" },
          {
            value: "openai",
            label: "OpenAI (Sunburst)",
            ariaLabel: "OpenAI (Sunburst)",
          },
        ]}
      />
    </MainMenu.ItemCustom>
  );
};
