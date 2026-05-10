# 🎨🤖 RoboMunch – AI Artist Chatbot

**EE471 – Modern Software Development Practices and Technologies**  
Mini Project 3 | Izmir Institute of Technology

---

## Overview

**RoboMunch** is an AI-powered artist chatbot that:

- 🖼️ **Generates images** from text prompts using **Stable Diffusion v1-5** (CPU/MPS/CUDA) or **FLUX.1-schnell** (CUDA)
- 💬 **Chats** with you using **SmolLM2-360M-Instruct** (lightweight, runs on CPU)
- 🎤 **Listens** to your voice via the **Web Speech API** (browser-native, no setup needed)

---

## Project Structure

```
mini_project_3/
├── backend/
│   ├── app.py           # FastAPI server (endpoints: /generate-image, /chat, /health)
│   ├── image_gen.py     # Stable Diffusion v1-5 / FLUX.1-schnell pipeline
│   ├── chatbot.py       # SmolLM2-360M-Instruct chat pipeline
│   └── requirements.txt
├── frontend/
│   ├── index.html       # Two-panel UI (Paint Studio + Chat)
│   ├── style.css        # Dark theme, animations, responsive layout
│   └── script.js        # Fetch API, Web Speech API, DOM updates
└── README.md
```

---

## Setup & Run

### 1. Create Virtual Environment

```bash
cd mini_project_3
python3 -m venv venv
source venv/bin/activate        # Mac/Linux
# venv\Scripts\activate         # Windows
```

### 2. Install Dependencies

```bash
pip install -r backend/requirements.txt
```

> **Note:** First run downloads models from HuggingFace (~4 GB for SD v1-5, ~24 GB for FLUX).

### 3. Start the Backend

```bash
cd backend
python app.py
# Server starts at http://localhost:8000
```

To use **FLUX.1-schnell** instead (GPU required):
```bash
USE_FLUX=true python app.py
```

### 4. Open the Frontend

Open `frontend/index.html` directly in your browser, **or** serve it:

```bash
cd frontend
python3 -m http.server 3000
# Then visit http://localhost:3000
```

---

## Models Used

| Component | Model | HuggingFace |
|-----------|-------|------------|
| Text-to-Image (default) | Stable Diffusion v1-5 | [stable-diffusion-v1-5](https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5) |
| Text-to-Image (GPU) | FLUX.1-schnell | [FLUX.1-schnell](https://huggingface.co/black-forest-labs/FLUX.1-schnell) |
| Chatbot | SmolLM2-360M-Instruct | [SmolLM2-360M-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct) |
| Speech-to-Text | Web Speech API | Browser built-in |

---

## Demo Flow (as required by the project)

1. Open the app → RoboMunch greets you
2. **Chat:** Ask *"Suggest a cool digital art prompt!"*
3. RoboMunch replies with a detailed prompt
4. **Chat:** Ask *"Give me the exact prompt I can copy"*
5. RoboMunch provides a copyable prompt
6. Copy → paste into **Prompt Input** → click **Paint!**
7. Image appears in the Image Output Box
8. Use **🎤 Voice** button to ask one more question by voice

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/health` | Check server & model status |
| `POST` | `/generate-image` | `{"prompt": "..."}` → `{"image": "<base64>"}` |
| `POST` | `/chat` | `{"message": "..."}` → `{"reply": "..."}` |
| `POST` | `/reset-chat` | Clear conversation history |

---

## Device Support

| Device | SD v1-5 | FLUX.1-schnell |
|--------|---------|---------------|
| NVIDIA CUDA GPU | ✅ Fast (~5-10s) | ✅ Very fast (1-4 steps) |
| Apple Silicon (MPS) | ✅ Medium (~30-60s) | ❌ Not supported |
| CPU only | ✅ Slow (~2-5 min) | ❌ Not practical |


file:///Users/ozgesemiz/Desktop/mini_project_3/frontend/index.htmlmd