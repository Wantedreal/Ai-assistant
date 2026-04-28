"""
explainer.py
------------
AI chemistry explainer using OpenRouter (openrouter.ai).
Uses a free model — no billing required, one key embedded in the build
serves the entire team.

Key lookup order:
  1. OPENROUTER_API_KEY environment variable (or backend/.env)
  2. _EMBEDDED_KEY constant below — set this before building the .exe

Free model used: meta-llama/llama-3.1-8b-instruct:free
Rate limit on free tier: ~200 requests/day per key (ample for internal use).
"""

import os
from typing import Optional

import httpx

# ── Embedded key for the production build ─────────────────────────────────────
# Set OPENROUTER_API_KEY in backend/.env (preferred) or replace the empty string
# below before running build-full.bat.  Never commit a live key here.
_EMBEDDED_KEY: str = ""

# Model fallback chain — tried in order until one responds without 429.
# All are free on OpenRouter. Best reasoning first.
_MODELS = [
    "meta-llama/llama-3.3-70b-instruct:free",   # best reasoning
    "google/gemma-3-27b-it:free",                # strong Google model
    "nvidia/nemotron-3-super-120b-a12b:free",    # NVIDIA 120B
    "qwen/qwen3-next-80b-a3b-instruct:free",     # Qwen 80B
    "google/gemma-3-12b-it:free",                # reliable mid-size
    "openai/gpt-oss-20b:free",                   # OpenAI OSS
    "meta-llama/llama-3.2-3b-instruct:free",     # fast last resort
]

_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

_SYSTEM_PROMPT = (
    "You are an expert battery engineer specialising in Li-Ion pack design. "
    "Given the user's design constraints, the S×P configuration obtained, "
    "the actual pack dimensions, and the ACCEPT/REJECT verdict, "
    "write 2-3 sentences that directly analyse this specific design. "
    "Address: whether the pack fits the housing and which margin is the tightest, "
    "and whether the energy and voltage targets are met. "
    "If REJECT, state clearly which constraint is the binding one. "
    "Do NOT mention C-rate, derating, cycle life, or lifetime years. "
    "Use plain engineering language — no bullet points, no headers, plain prose only."
)


def _get_key() -> str:
    # 1. Environment variable / .env file
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass
    key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if key:
        return key

    # 2. Embedded constant (set before building .exe)
    if _EMBEDDED_KEY:
        return _EMBEDDED_KEY

    raise ValueError(
        "No OpenRouter API key found. "
        "Either set OPENROUTER_API_KEY in backend/.env "
        "or set _EMBEDDED_KEY in app/explainer.py before building."
    )


def build_user_prompt(
    cell_nom: str,
    chimie: Optional[str],
    capacite_ah: float,
    tension_nominale: float,
    courant_max_a: float,
    # constraints
    energie_cible_wh: Optional[float],
    tension_cible_v: Optional[float],
    courant_cible_a: float,
    depth_of_discharge: float,
    housing_l: Optional[float],
    housing_l_small: Optional[float],
    housing_h: Optional[float],
    # results
    nb_serie: int,
    nb_parallele: int,
    verdict: str,
    justification: Optional[str],
    tension_totale_v: Optional[float],
    energie_reelle_wh: Optional[float],
    pack_l_mm: Optional[float],
    pack_w_mm: Optional[float],
    pack_h_mm: Optional[float],
    margin_l_mm: Optional[float],
    margin_w_mm: Optional[float],
    margin_h_mm: Optional[float],
) -> str:
    def _fmt(v, unit="", d=1):
        return f"{v:.{d}f} {unit}".strip() if v is not None else "unknown"

    lines = [
        "=== Cell ===",
        f"Cell: {cell_nom}  |  Chemistry: {chimie or 'unknown'}",
        f"Capacity: {_fmt(capacite_ah, 'Ah', 2)}  |  Voltage: {_fmt(tension_nominale, 'V', 3)}",
        f"Max discharge current: {_fmt(courant_max_a, 'A', 1)}",
        "",
        "=== Design constraints ===",
        f"Housing (L × W × H): {_fmt(housing_l, 'mm', 0)} × {_fmt(housing_l_small, 'mm', 0)} × {_fmt(housing_h, 'mm', 0)}",
        f"Target energy: {_fmt(energie_cible_wh, 'Wh', 0)}",
        f"Target voltage: {_fmt(tension_cible_v, 'V', 0)}",
        f"Target current: {_fmt(courant_cible_a, 'A', 1)}",
        f"Depth of discharge: {depth_of_discharge:.0f} %",
        "",
        "=== Calculation result ===",
        f"Configuration: {nb_serie}S × {nb_parallele}P  →  verdict: {verdict}",
    ]

    if justification:
        lines.append(f"Rejection reason: {justification}")

    lines += [
        f"Pack voltage achieved: {_fmt(tension_totale_v, 'V', 1)}",
        f"Pack energy achieved: {_fmt(energie_reelle_wh, 'Wh', 0)}",
        f"Pack dimensions (L × W × H): {_fmt(pack_l_mm, 'mm', 1)} × {_fmt(pack_w_mm, 'mm', 1)} × {_fmt(pack_h_mm, 'mm', 1)}",
        f"Margins (L / W / H): {_fmt(margin_l_mm, 'mm', 1)} / {_fmt(margin_w_mm, 'mm', 1)} / {_fmt(margin_h_mm, 'mm', 1)}",
    ]

    return "\n".join(lines)


_LANG_INSTRUCTIONS = {
    "fr": "Réponds en français.",
}


def explain(prompt_text: str, lang: str = "en") -> str:
    """
    Send the prompt to OpenRouter and return the plain-text explanation.
    Tries each model in _MODELS in order; skips to the next on 429 (rate limit).
    Raises ValueError if no API key is configured.
    Raises RuntimeError if all models are rate-limited.
    """
    key = _get_key()
    headers = {
        "Authorization": f"Bearer {key}",
        "HTTP-Referer": "https://battery-pack-designer",
        "X-Title": "Battery Pack Designer",
        "Content-Type": "application/json",
    }

    lang_instruction = _LANG_INSTRUCTIONS.get(lang, "")
    system = f"{_SYSTEM_PROMPT} {lang_instruction}".strip()

    last_error = None
    for model in _MODELS:
        # Merge system into user — works across all providers including
        # Google AI Studio (Gemma) which rejects a separate system role.
        combined = f"{system}\n\n---\n\n{prompt_text}"
        response = httpx.post(
            _OPENROUTER_URL,
            headers=headers,
            json={
                "model": model,
                "messages": [
                    {"role": "user", "content": combined},
                ],
                "max_tokens": 800,
            },
            timeout=30.0,
        )

        if response.status_code == 429 or response.status_code >= 500:
            last_error = f"{model} HTTP {response.status_code}"
            continue  # try next model

        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"].strip()

    raise RuntimeError(
        f"All free models are currently rate-limited. Try again in a minute. "
        f"Last: {last_error}"
    )
