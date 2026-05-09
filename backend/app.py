"""
app.py
------
FastAPI backend for RoboMunch – Artist Chatbot (EE471 Mini Project 3).

Endpoints:
  GET  /health           → liveness check
  POST /generate-image   → text-to-image (SD v1-5 or FLUX.1-schnell)
  POST /chat             → chatbot reply (SmolLM2-360M-Instruct)
  POST /reset-chat       → clear conversation history

Usage:
  python app.py
  # or: uvicorn app:app --reload --port 8000
"""

import os
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from image_gen import ImageGenerator
from chatbot import RoboMunchBot

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
USE_FLUX = os.getenv("USE_FLUX", "false").lower() == "true"

# Global model holders (loaded at startup)
img_gen: ImageGenerator = None
chatbot: RoboMunchBot = None


# ---------------------------------------------------------------------------
# Lifespan – load models once at startup
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    global img_gen, chatbot
    print("=" * 60)
    print("🤖 RoboMunch Backend starting up...")
    print("=" * 60)
    img_gen = ImageGenerator(use_flux=USE_FLUX)
    chatbot = RoboMunchBot()
    print("=" * 60)
    print("✅ All models loaded! Server ready.")
    print("=" * 60)
    yield
    print("🛑 RoboMunch shutting down.")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="RoboMunch API",
    description="Artist Chatbot – EE471 Mini Project 3",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # allow frontend from any origin (file://, localhost, etc.)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class PromptRequest(BaseModel):
    prompt: str


class ChatRequest(BaseModel):
    message: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    """Liveness / readiness check."""
    return {
        "status": "ok",
        "model_image": "FLUX.1-schnell" if USE_FLUX else "stable-diffusion-v1-5",
        "model_chat": "SmolLM2-360M-Instruct",
    }


@app.post("/generate-image")
def generate_image(req: PromptRequest):
    """
    Generate an image from a text prompt.
    Returns: { "image": "<base64-encoded PNG>" }
    """
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")
    try:
        img_b64 = img_gen.generate(req.prompt)
        return {"image": img_b64}
    except Exception as e:
        print(f"[ERROR] Image generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)}")


@app.post("/chat")
def chat(req: ChatRequest):
    """
    Send a message to RoboMunch and get a reply.
    Returns: { "reply": "<assistant response>" }
    """
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    try:
        reply = chatbot.chat(req.message)
        return {"reply": reply}
    except Exception as e:
        print(f"[ERROR] Chat failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


@app.post("/reset-chat")
def reset_chat():
    """Clear RoboMunch's conversation history."""
    chatbot.history.clear()
    return {"status": "Chat history cleared."}


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
