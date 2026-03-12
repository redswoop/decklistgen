/**
 * Direct ComfyUI client for card image cleaning via Flux Klein 9B.
 *
 * Replaces the framehouse dependency. Builds the Klein workflow,
 * submits to ComfyUI, waits via WebSocket, fetches the output.
 */

import WebSocket from "ws";

const COMFYUI_URL = (process.env.COMFYUI_URL ?? "http://localhost:8188").replace(/\/+$/, "");
const FLUX_W = 736;
const FLUX_H = 1024;
const FALLBACK_PROMPT =
  "Expand the image of the subject, and remove all of the text, footers, " +
  "and headers in the image, and then add a thin silver border with rounded " +
  "edges around it, behind the subject";

interface WorkflowNode {
  inputs: Record<string, unknown>;
  class_type: string;
  _meta?: { title: string };
}

type Workflow = Record<string, WorkflowNode>;

function buildKleinWorkflow(
  prompt: string,
  seed: number,
  width: number,
  height: number,
  imageBase64: string,
): Workflow {
  const workflow: Workflow = {};

  // Output
  workflow["9"] = {
    inputs: { filename_prefix: "Klein_Compose", images: ["75:65", 0] },
    class_type: "SaveImage",
    _meta: { title: "Save Image" },
  };

  // Seed
  workflow["99"] = {
    inputs: { seed },
    class_type: "Seed (rgthree)",
    _meta: { title: "Seed" },
  };

  // Resolution
  workflow["100"] = {
    inputs: {
      mode: "Manual",
      latent_type: "latent_128x16",
      width,
      height,
      auto_detect: false,
      rescale_mode: "resolution",
      rescale_value: 1.40625,
      batch_size: 1,
    },
    class_type: "ResolutionMaster",
    _meta: { title: "Resolution Master" },
  };

  // Sampler select
  workflow["75:61"] = {
    inputs: { sampler_name: "euler" },
    class_type: "KSamplerSelect",
  };

  // Scheduler
  workflow["75:62"] = {
    inputs: { steps: 6, width: ["75:81", 0], height: ["75:81", 1] },
    class_type: "Flux2Scheduler",
  };

  // VAE Decode (output)
  workflow["75:65"] = {
    inputs: { samples: ["75:64", 0], vae: ["75:72", 0] },
    class_type: "VAEDecode",
  };

  // Random noise
  workflow["75:73"] = {
    inputs: { noise_seed: ["99", 0] },
    class_type: "RandomNoise",
  };

  // Model loaders
  workflow["75:70"] = {
    inputs: { unet_name: "flux-2-klein-9b-fp8.safetensors", weight_dtype: "default" },
    class_type: "UNETLoader",
  };
  workflow["75:71"] = {
    inputs: { clip_name: "qwen_3_8b_fp8mixed.safetensors", type: "flux2", device: "default" },
    class_type: "CLIPLoader",
  };
  workflow["75:72"] = {
    inputs: { vae_name: "flux2-vae.safetensors" },
    class_type: "VAELoader",
  };

  // Text encoding
  workflow["75:74"] = {
    inputs: { text: prompt, clip: ["75:71", 0] },
    class_type: "CLIPTextEncode",
  };

  // Negative conditioning
  workflow["75:82"] = {
    inputs: { conditioning: ["75:74", 0] },
    class_type: "ConditioningZeroOut",
  };

  // Main sampler
  workflow["75:64"] = {
    inputs: {
      noise: ["75:73", 0],
      guider: ["75:63", 0],
      sampler: ["75:61", 0],
      sigmas: ["75:62", 0],
      latent_image: ["100", 4],
    },
    class_type: "SamplerCustomAdvanced",
  };

  // Load image (base64)
  workflow["img1"] = {
    inputs: {
      base64_data: imageBase64,
      image_output: "Hide",
      save_prefix: "Klein_input_1",
    },
    class_type: "easy loadImageBase64",
  };

  // Scale image
  workflow["75:99"] = {
    inputs: {
      image: ["img1", 0],
      megapixels: 1,
      multiple_of: 16,
      resize_mode: "crop",
      upscale_method: "lanczos",
    },
    class_type: "ImageScaleToTotalPixelsX",
  };

  // Get image size
  workflow["75:81"] = {
    inputs: { image: ["75:99", 0] },
    class_type: "GetImageSize",
  };

  // VAE Encode
  workflow["75:79:78"] = {
    inputs: { pixels: ["75:99", 0], vae: ["75:72", 0] },
    class_type: "VAEEncode",
  };

  // Reference latent (positive)
  workflow["75:79:77"] = {
    inputs: { conditioning: ["75:74", 0], latent: ["75:79:78", 0] },
    class_type: "ReferenceLatent",
  };

  // Reference latent (negative)
  workflow["75:79:76"] = {
    inputs: { conditioning: ["75:82", 0], latent: ["75:79:78", 0] },
    class_type: "ReferenceLatent",
  };

  // CFG Guider
  workflow["75:63"] = {
    inputs: {
      cfg: 1,
      model: ["75:70", 0],
      positive: ["75:79:77", 0],
      negative: ["75:79:76", 0],
    },
    class_type: "CFGGuider",
  };

  return workflow;
}

async function submitPrompt(workflow: Workflow, clientId: string): Promise<string> {
  const body = {
    prompt: workflow,
    client_id: clientId,
    extra_data: { extra_pnginfo: { prompt: workflow } },
  };

  const resp = await fetch(`${COMFYUI_URL}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ComfyUI prompt failed: ${resp.status} ${text}`);
  }

  const result = (await resp.json()) as { prompt_id: string };
  return result.prompt_id;
}

interface OutputImages {
  [nodeId: string]: {
    images?: Array<{ filename: string; subfolder: string; type: string }>;
  };
}

async function fetchOutputImage(filename: string, subfolder = ""): Promise<Buffer> {
  const params = new URLSearchParams({ filename, type: "output" });
  if (subfolder) params.set("subfolder", subfolder);

  const resp = await fetch(`${COMFYUI_URL}/view?${params}`);
  if (!resp.ok) throw new Error(`Failed to fetch ComfyUI output: ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

/**
 * Clean a card image using ComfyUI + Klein 9B.
 * Takes base64 PNG input, returns base64 PNG of the cleaned (fully generated) image.
 *
 * Connects WebSocket first, then submits prompt, to avoid missing messages.
 */
export async function cleanCardImage(
  imageBase64: string,
  seed = 42,
  prompt?: string,
): Promise<string> {
  const workflow = buildKleinWorkflow(
    prompt ?? FALLBACK_PROMPT,
    seed,
    FLUX_W,
    FLUX_H,
    imageBase64,
  );

  const clientId = `dlg-${crypto.randomUUID()}`;
  const wsUrl = COMFYUI_URL.replace(/^http/, "ws");
  const timeoutMs = 180_000;

  return new Promise<string>((resolve, reject) => {
    const ws = new WebSocket(`${wsUrl}/ws?clientId=${clientId}`);
    let resolved = false;
    let promptId: string | null = null;
    const outputs: OutputImages = {};

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.close();
        reject(new Error(`ComfyUI timeout after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    const finish = async (success: boolean, error?: Error) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      ws.close();

      if (!success) {
        reject(error ?? new Error("Unknown ComfyUI error"));
        return;
      }

      try {
        const saveNode = outputs["9"];
        if (!saveNode?.images?.length) {
          throw new Error("No output image from ComfyUI");
        }
        const { filename, subfolder } = saveNode.images[0];
        const imageBuffer = await fetchOutputImage(filename, subfolder);
        resolve(imageBuffer.toString("base64"));
      } catch (e: any) {
        reject(e);
      }
    };

    ws.on("open", async () => {
      // WebSocket is connected — now submit the prompt
      try {
        promptId = await submitPrompt(workflow, clientId);
      } catch (e: any) {
        finish(false, e);
      }
    });

    ws.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "executed" && msg.data?.node && msg.data?.output) {
          outputs[msg.data.node] = msg.data.output;
        } else if (msg.type === "executing" && !msg.data?.node && msg.data?.prompt_id === promptId) {
          finish(true);
        } else if (msg.type === "execution_error") {
          finish(false, new Error(msg.data?.exception_message ?? "ComfyUI execution error"));
        }
      } catch {}
    });

    ws.on("error", (err: Error) => finish(false, err));
    ws.on("close", () => {
      if (!resolved) {
        // WS closed before completion — try fetching from history as fallback
        if (promptId) {
          fetch(`${COMFYUI_URL}/history/${promptId}`)
            .then(r => r.json())
            .then((data: any) => {
              if (data[promptId!]?.status?.completed) {
                Object.assign(outputs, data[promptId!].outputs ?? {});
                finish(true);
              } else {
                finish(false, new Error("WebSocket closed before completion"));
              }
            })
            .catch(() => finish(false, new Error("WebSocket closed before completion")));
        } else {
          finish(false, new Error("WebSocket closed before prompt submitted"));
        }
      }
    });
  });
}

export async function ping(): Promise<boolean> {
  try {
    const resp = await fetch(`${COMFYUI_URL}/system_stats`, {
      signal: AbortSignal.timeout(5000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export { COMFYUI_URL, FLUX_W, FLUX_H };
