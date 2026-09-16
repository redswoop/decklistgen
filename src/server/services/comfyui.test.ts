import { describe, it, expect } from "bun:test";
import { buildKleinWorkflow } from "./comfyui.js";

describe("buildKleinWorkflow", () => {
  const wf = buildKleinWorkflow("clean the card", 42, "AAAA");

  it("does not use ResolutionMaster (that node now rejects the old widget set)", () => {
    const types = Object.values(wf).map((n) => n.class_type);
    expect(types).not.toContain("ResolutionMaster");
  });

  it("sizes the empty latent from the input image via EmptyFlux2LatentImage", () => {
    expect(wf["75:66"]?.class_type).toBe("EmptyFlux2LatentImage");
    expect(wf["75:66"].inputs.width).toEqual(["75:81", 0]);
    expect(wf["75:66"].inputs.height).toEqual(["75:81", 1]);
    expect(wf["75:64"].inputs.latent_image).toEqual(["75:66", 0]);
  });

  it("wires prompt, seed, and base64 image into the Klein 9B edit path", () => {
    expect(wf["75:74"].inputs.text).toBe("clean the card");
    expect(wf["99"].inputs.seed).toBe(42);
    expect(wf["img1"].inputs.base64_data).toBe("AAAA");
    expect(wf["75:70"].inputs.unet_name).toBe("flux-2-klein-9b-fp8.safetensors");
    expect(wf["9"].class_type).toBe("SaveImage");
  });
});
