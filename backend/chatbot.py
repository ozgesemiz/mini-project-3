"""
chatbot.py
----------
RoboMunch conversational AI using SmolLM2-360M-Instruct.
Lightweight enough to run on CPU / Apple Silicon MPS.

Model ref: https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct
"""

import torch
from transformers import AutoTokenizer, AutoModelForCausalLM


SYSTEM_PROMPT = (
    "You are RoboMunch, a helpful AI artist chatbot. "
    "You help users by suggesting image generation prompts and discussing art styles. "
    "Always respond in clear, plain English sentences. "
    "Keep your answer under 3 sentences."
)


class RoboMunchBot:
    """
    Wraps HuggingFaceTB/SmolLM2-360M-Instruct for chat completions.
    Maintains a rolling conversation history (last 3 turns).
    """

    MODEL_ID = "HuggingFaceTB/SmolLM2-360M-Instruct"

    def __init__(self):
        print(f"[Chatbot] Loading {self.MODEL_ID} ...")
        self.tokenizer = AutoTokenizer.from_pretrained(self.MODEL_ID)
        self.device = "mps" if torch.backends.mps.is_available() else "cpu"
        self.model = AutoModelForCausalLM.from_pretrained(
            self.MODEL_ID,
            dtype=torch.float32,
        ).to(self.device)
        self.model.eval()
        self.history: list[dict] = []
        print(f"[Chatbot] Ready ✓  (device={self.device})")

    def chat(self, user_message: str) -> str:
        """
        Send a message to RoboMunch and get a reply.
        Maintains rolling context (last 3 user/assistant pairs).
        """
        # Build message list with system prompt
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        # Keep last 6 messages (3 turns) for context window
        messages.extend(self.history[-6:])
        messages.append({"role": "user", "content": user_message})

        # Apply chat template → tokenize
        encoded = self.tokenizer.apply_chat_template(
            messages,
            tokenize=True,
            add_generation_prompt=True,
            return_tensors="pt",
        )
        # Newer transformers may return BatchEncoding (dict-like) instead of a plain tensor
        if isinstance(encoded, torch.Tensor):
            input_ids = encoded.to(self.device)
        else:
            input_ids = encoded["input_ids"].to(self.device)

        prompt_len = input_ids.shape[-1]

        with torch.no_grad():
            output_ids = self.model.generate(
                input_ids,
                max_new_tokens=150,
                do_sample=True,
                temperature=0.7,
                top_p=0.9,
                top_k=50,
                repetition_penalty=1.4,
                no_repeat_ngram_size=4,
                pad_token_id=self.tokenizer.eos_token_id,
                eos_token_id=self.tokenizer.eos_token_id,
            )

        # Decode only newly generated tokens
        new_tokens = output_ids[0][prompt_len:]
        reply = self.tokenizer.decode(new_tokens, skip_special_tokens=True).strip()

        # Fallback if reply is empty or garbage
        if not reply or len(reply) < 3:
            reply = "I'm not sure how to respond to that. Try asking me to suggest an art prompt!"

        # Update history
        self.history.append({"role": "user", "content": user_message})
        self.history.append({"role": "assistant", "content": reply})

        print(f"[Chatbot] User: {user_message[:60]}")
        print(f"[Chatbot] Reply: {reply[:100]}")
        return reply
