"""
image_gen.py
------------
Text-to-Image generation for RoboMunch.
Uses Stable Diffusion v1-5 (CPU/MPS/CUDA) or FLUX.1-schnell (CUDA only).

Model refs:
  SD v1-5  : https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5
  FLUX schnell: https://huggingface.co/black-forest-labs/FLUX.1-schnell
"""

import io
import base64
import torch
from PIL import Image


def get_device() -> str:
    """Auto-detect best available device."""
    if torch.cuda.is_available():
        return "cuda"
    # MPS (Apple Silicon): use CPU for image gen to avoid OOM + black image issues
    # Chatbot uses MPS; keeping image gen on CPU avoids memory conflicts.
    return "cpu"


class ImageGenerator:
    """
    Wraps either StableDiffusionPipeline or FluxPipeline.
    Decides which to load based on `use_flux` flag and device availability.
    """

    def __init__(self, use_flux: bool = False):
        self.device = get_device()
        self.use_flux = use_flux and self.device == "cuda"  # FLUX only on CUDA
        print(f"[ImageGen] Device: {self.device} | Model: {'FLUX.1-schnell' if self.use_flux else 'SD v1-5'}")
        self._load_pipeline()

    def _load_pipeline(self):
        if self.use_flux:
            from diffusers import FluxPipeline
            print("[ImageGen] Loading FLUX.1-schnell ...")
            self.pipe = FluxPipeline.from_pretrained(
                "black-forest-labs/FLUX.1-schnell",
                torch_dtype=torch.bfloat16
            )
            self.pipe.enable_model_cpu_offload()
        else:
            from diffusers import StableDiffusionPipeline
            print("[ImageGen] Loading Stable Diffusion v1-5 ...")
            # Use float16 on MPS/CUDA to halve memory usage
            dtype = torch.float32 if self.device == "cpu" else torch.float16
            self.pipe = StableDiffusionPipeline.from_pretrained(
                "stable-diffusion-v1-5/stable-diffusion-v1-5",
                torch_dtype=dtype,
                safety_checker=None,
                requires_safety_checker=False,
            )
            self.pipe = self.pipe.to(self.device)
            # Reduce peak memory: process attention in slices
            self.pipe.enable_attention_slicing()

        print("[ImageGen] Pipeline ready ✓")

    def generate(self, prompt: str) -> str:
        """
        Generate an image from the text prompt.
        Returns a base64-encoded PNG string.
        """
        print(f"[ImageGen] Generating: {prompt[:60]}...")
        if self.use_flux:
            result = self.pipe(
                prompt,
                guidance_scale=0.0,
                num_inference_steps=4,
                max_sequence_length=256,
                generator=torch.Generator("cpu").manual_seed(42),
            )
        else:
            result = self.pipe(
                prompt,
                num_inference_steps=20,
                guidance_scale=7.5,
            )

        image: Image.Image = result.images[0]

        # Encode to base64 PNG
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        img_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
        print("[ImageGen] Done ✓")
        return img_b64
