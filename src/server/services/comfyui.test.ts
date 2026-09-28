import { describe, it, expect } from "bun:test";
import { buildKleinWorkflow, FLUX_W, FLUX_H } from "./comfyui.js";

describe("buildKleinWorkflow", () => {
  const wf = buildKleinWorkflow("clean the card", 42, "AAAA");

  it("does not use ResolutionMaster (that node now rejects the old widget set)", () => {
    const types = Object.values(wf).map((n) => n.class_type);
    expect(types).not.toContain("ResolutionMaster");
  });

  it("generates onto a fixed portrait card canvas, not the input image size", () => {
    expect(wf["75:66"]?.class_type).toBe("EmptyFlux2LatentImage");
    expect(wf["75:66"].inputs.width).toBe(FLUX_W);
    expect(wf["75:66"].inputs.height).toBe(FLUX_H);
    expect(wf["75:62"].inputs.width).toBe(FLUX_W);
    expect(wf["75:62"].inputs.height).toBe(FLUX_H);
    expect(wf["75:64"].inputs.latent_image).toEqual(["75:66", 0]);
  });

  it("uses a card-shaped canvas Klein can sample (portrait, multiples of 16)", () => {
    expect(FLUX_H).toBeGreaterThan(FLUX_W);
    expect(FLUX_W % 16).toBe(0);
    expect(FLUX_H % 16).toBe(0);
    expect(Math.abs(FLUX_W / FLUX_H - 63 / 87)).toBeLessThan(0.01);
  });

  it("still feeds the scaled input image in as the reference latent", () => {
    expect(wf["75:79:78"].inputs.pixels).toEqual(["75:99", 0]);
    expect(wf["75:79:77"].inputs.latent).toEqual(["75:79:78", 0]);
  });

  it("wires prompt, seed, and base64 image into the Klein 9B edit path", () => {
    expect(wf["75:74"].inputs.text).toBe("clean the card");
    expect(wf["99"].inputs.seed).toBe(42);
    expect(wf["img1"].inputs.base64_data).toBe("AAAA");
    expect(wf["75:70"].inputs.unet_name).toBe("flux-2-klein-9b-fp8.safetensors");
    expect(wf["9"].class_type).toBe("SaveImage");
  });
});
