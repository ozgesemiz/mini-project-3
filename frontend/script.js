/**
 * script.js – RoboMunch Frontend Logic
 * EE471 Mini Project 3 – Artist Chatbot
 *
 * Features:
 *  - paintImage()      → POST /generate-image → show image
 *  - sendMessage()     → POST /chat           → append chat bubble
 *  - toggleVoice()     → Web Speech API       → transcript to chat input
 *  - resetChat()       → POST /reset-chat     → clear history & UI
 *  - downloadImage()   → download current artwork
 *  - clearImage()      → reset image panel
 *  - checkHealth()     → GET /health          → update status dot
 */

"use strict";

// ─── Config ────────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:8000";

// ─── State ─────────────────────────────────────────────────────────────────
let isGenerating  = false;
let isSending     = false;
let isListening   = false;
let recognition   = null;
let currentImgB64 = null;

// ─── On load ────────────────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  checkHealth();
  setInterval(checkHealth, 15000); // poll every 15 s
});

// ─── Health check ───────────────────────────────────────────────────────────
async function checkHealth() {
  const dot   = document.getElementById("status-dot");
  const label = document.getElementById("status-label");
  try {
    const res  = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      dot.className   = "status-dot online";
      label.textContent = `Online · ${data.model_image}`;
    } else {
      throw new Error("not ok");
    }
  } catch {
    dot.className   = "status-dot offline";
    label.textContent = "Offline – start backend";
  }
}

// ─── Image Generation ───────────────────────────────────────────────────────
async function paintImage() {
  if (isGenerating) return;

  const prompt = document.getElementById("prompt-input").value.trim();
  if (!prompt) {
    showToast("✏️ Please enter a prompt first!", "error");
    document.getElementById("prompt-input").focus();
    return;
  }

  isGenerating = true;
  setImageLoading(true);
  disableBtn("paint-btn", true);

  try {
    const res = await fetch(`${API_BASE}/generate-image`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ prompt }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Image generation failed");
    }

    const data = await res.json();
    currentImgB64 = data.image;
    displayImage(`data:image/png;base64,${data.image}`);
    showToast("🎨 Masterpiece ready!", "success");

  } catch (err) {
    console.error("[paintImage]", err);
    showToast(`❌ ${err.message}`, "error");
    setImageLoading(false);
    showPlaceholder();
  } finally {
    isGenerating = false;
    disableBtn("paint-btn", false);
  }
}

function setImageLoading(on) {
  document.getElementById("image-placeholder").style.display = on ? "none"  : "flex";
  document.getElementById("image-loading").style.display     = on ? "flex"  : "none";
  document.getElementById("generated-image").style.display   = on ? "none"  : "";
}

function showPlaceholder() {
  document.getElementById("image-placeholder").style.display = "flex";
  document.getElementById("image-loading").style.display     = "none";
  document.getElementById("generated-image").style.display   = "none";
  document.getElementById("image-actions").style.display     = "none";
  document.getElementById("image-output-box").classList.remove("has-image");
}

function displayImage(src) {
  const img = document.getElementById("generated-image");
  img.src = src;
  img.style.display = "block";
  document.getElementById("image-loading").style.display     = "none";
  document.getElementById("image-placeholder").style.display = "none";
  document.getElementById("image-actions").style.display     = "flex";
  document.getElementById("image-output-box").classList.add("has-image");
}

function downloadImage() {
  if (!currentImgB64) return;
  const a    = document.createElement("a");
  a.href     = `data:image/png;base64,${currentImgB64}`;
  a.download = `robomunch-art-${Date.now()}.png`;
  a.click();
  showToast("⬇️ Downloading...", "success");
}

function clearImage() {
  currentImgB64 = null;
  document.getElementById("generated-image").src = "";
  showPlaceholder();
  document.getElementById("prompt-input").value = "";
}

// ─── Chat ───────────────────────────────────────────────────────────────────
async function sendMessage() {
  if (isSending) return;

  const input   = document.getElementById("chat-input");
  const message = input.value.trim();
  if (!message) {
    input.focus();
    return;
  }

  isSending = true;
  disableBtn("send-btn", true);

  // Show user bubble immediately
  appendMessage("user", message);
  input.value = "";

  // Show typing indicator
  const typingId = showTyping();

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ message }),
    });

    removeTyping(typingId);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Chat request failed");
    }

    const data = await res.json();
    appendMessage("bot", data.reply);
    scrollChat();

  } catch (err) {
    console.error("[sendMessage]", err);
    removeTyping(typingId);
    appendMessage("bot", `⚠️ Oops! I couldn't respond: ${err.message}`);
    showToast("❌ Chat error", "error");
  } finally {
    isSending = false;
    disableBtn("send-btn", false);
    input.focus();
  }
}

function handleChatKey(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

function appendMessage(role, text) {
  const chatBox = document.getElementById("chat-output");

  const wrapper = document.createElement("div");
  wrapper.className = `chat-message ${role === "user" ? "user-message" : "bot-message"}`;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  if (role === "user") {
  avatar.textContent = "👤";
} else {
  avatar.innerHTML = '<img src="image 30.png" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" alt="RoboMunch"/>';
}

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  // Convert newlines to <br> and handle basic markdown bold (**text**)
  const formatted = escapeHtml(text)
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>");

  bubble.innerHTML = `<p>${formatted}</p>`;

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  chatBox.appendChild(wrapper);
  scrollChat();
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showTyping() {
  const chatBox = document.getElementById("chat-output");
  const id      = `typing-${Date.now()}`;

  const wrapper = document.createElement("div");
  wrapper.className = "chat-message bot-message typing-indicator";
  wrapper.id = id;

  wrapper.innerHTML = `
    <div class="message-avatar">🤖</div>
    <div class="message-bubble">
      <div class="typing-dots">
        <span></span><span></span><span></span>
      </div>
    </div>`;

  chatBox.appendChild(wrapper);
  scrollChat();
  return id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function scrollChat() {
  const chatBox = document.getElementById("chat-output");
  chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: "smooth" });
}

async function resetChat() {
  try {
    await fetch(`${API_BASE}/reset-chat`, { method: "POST" });
  } catch { /* ignore if server is down */ }

  const chatBox = document.getElementById("chat-output");
  chatBox.innerHTML = "";

  // Re-add welcome message
  appendBotWelcome();
  showToast("↺ Conversation cleared", "success");
}

function appendBotWelcome() {
  const chatBox = document.getElementById("chat-output");
  const wrapper = document.createElement("div");
  wrapper.className = "chat-message bot-message";
  wrapper.id = "welcome-msg";
  wrapper.innerHTML = `
    <div class="message-avatar">🤖</div>
    <div class="message-bubble">
      <p>Hey there! I'm <strong>RoboMunch</strong> 🎨✨</p>
      <p>I'm your creative AI artist companion! Ask me to suggest an image prompt, discuss art styles, or just chat. Then paint what I describe!</p>
      <p><em>Try: "Suggest a cool prompt for a fantasy landscape!"</em></p>
    </div>`;
  chatBox.appendChild(wrapper);
}

// ─── Voice Input (Web Speech API) ──────────────────────────────────────────
function toggleVoice() {
  if (isListening) {
    stopVoice();
  } else {
    startVoice();
  }
}

function startVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    showToast("🎤 Voice input not supported in this browser. Try Chrome.", "error");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang        = "en-US";
  recognition.continuous  = false;
  recognition.interimResults = true;

  recognition.onstart = () => {
    isListening = true;
    document.getElementById("voice-btn").classList.add("recording");
    document.getElementById("voice-status").style.display = "flex";
    document.getElementById("chat-input").placeholder = "Listening...";
  };

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    document.getElementById("chat-input").value = transcript;
  };

  recognition.onend = () => {
    stopVoice();
    // Auto-focus so user can edit if needed
    document.getElementById("chat-input").focus();
  };

  recognition.onerror = (event) => {
    console.error("[Voice]", event.error);
    stopVoice();
    if (event.error !== "aborted") {
      showToast(`🎤 Voice error: ${event.error}`, "error");
    }
  };

  recognition.start();
}

function stopVoice() {
  isListening = false;
  if (recognition) {
    try { recognition.stop(); } catch { /* ignore */ }
    recognition = null;
  }
  document.getElementById("voice-btn").classList.remove("recording");
  document.getElementById("voice-status").style.display = "none";
  document.getElementById("chat-input").placeholder = "Type or speak your message...";
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function disableBtn(id, on) {
  document.getElementById(id).disabled = on;
}

let toastTimer = null;
function showToast(message, type = "") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className   = `toast ${type} show`;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = `toast ${type}`;
  }, 3000);
}
