"""
chat.py
-------
Streaming multi-turn chat assistant for the Battery Pack Designer.

Provider priority:
  1. Capgemini AI Gateway  — set CAPGEMINI_API_KEY in backend/.env (corporate PC)
  2. Groq                  — embedded key, free, fast (home/personal PC)
  3. OpenRouter            — embedded key, free fallback chain

On corporate networks (Zscaler): put CAPGEMINI_API_KEY in backend/.env.
On other machines: Groq/OpenRouter keys are embedded — no setup needed.
"""

import os
import sys
import json
import urllib.request
import httpx
from pathlib import Path
from typing import AsyncIterator, Optional

# In a PyInstaller frozen exe sys.executable is the .exe itself — .env lives next
# to it.  In dev mode __file__ is backend/app/chat.py — .env is backend/.env.
_ENV_PATH: Path = (
    Path(sys.executable).parent / '.env'
    if getattr(sys, 'frozen', False)
    else Path(__file__).resolve().parent.parent / '.env'
)

# API keys are resolved exclusively from the environment / .env file at runtime.
# Do NOT embed keys in source code.
# Set GROQ_API_KEY and/or OPENROUTER_API_KEY in backend/.env.
_GROQ_EMBEDDED: str = ""
_OPENROUTER_EMBEDDED: str = ""

_CAPGEMINI_URL  = "https://openai.generative.engine.capgemini.com/v1/chat/completions"
_CAPGEMINI_MODEL = "anthropic.claude-sonnet-4-6"

_GROQ_URL       = "https://api.groq.com/openai/v1/chat/completions"
_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

_GROQ_MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
]

_OPENROUTER_MODELS = [
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemma-3-27b-it:free",
    "meta-llama/llama-3.2-3b-instruct:free",
]

# ── Application guide — injected into every system prompt ────────────────────
_APP_GUIDE = """
## Battery Pack Designer — Application Guide

### Purpose
Desktop tool for electrical engineers to size Li-Ion battery packs.
Input: housing dimensions + electrical targets + one cell from the catalogue.
Output: optimal S×P configuration, 3D visualisation, ACCEPT/REJECT verdict.

### S×P algorithm (Auto mode)
  P (Parallel) = ⌈ I_target / I_cell_max ⌉              — current constraint first
  S (Series)   = max( ⌈V_target / V_nom⌉,
                      ⌈E_target / (V_nom × P × C_ah × DoD%)⌉ )  — voltage + energy

  Manual mode: engineer enters S and P directly.
  Engine still validates geometry and targets in both modes.

### Housing axes
  L  (Length)  = series axis     (X in 3D)
  l/W (Width)  = parallel axis   (Z in 3D)
  h/H (Height) = cell stand-up   (Y in 3D)

  Margin formula: margin = (housing_dim − array_dim) / 2
  ACCEPT when all three margins ≥ min_margin (default 15 mm, ENF-02 rule).
  REJECT when at least one margin is below — justification names the binding axis.
  Auto-rotation: engine tries swapping L and W if normal orientation fails.

### Geometry
  Cylindrical:   array_L = S × diameter + (S−1) × gap
                 array_W = P × diameter + (P−1) × gap
                 array_H = hauteur_mm
  Prismatic/Pouch: array_L = S × hauteur_mm + (S−1) × gap + 2 × end_plate
                   array_W = P × largeur_mm  + (P−1) × gap
                   array_H = longueur_mm  (cell stands upright on Y)
  Swelling applied before margin check: array_dim × (1 + swelling_pct / 100).

### Key form fields
  DoD   : Depth of Discharge (%). Usable energy = Total × DoD%. Default 80%.
           Higher DoD → more energy from the same pack, but shorter cycle life.
  Cell gap       : spacing between cells (mm). Adds (N−1)×gap to L and W.
  Min margin     : free space between array face and housing wall. Default 15 mm.
  End plate      : compression plates for prismatic cells. Adds 2× to array L.

### Phase 2 informational metrics (no verdict impact)
  C-rate actual  = I_target / (P × C_ah)
  Derating       = k × (C_actual / C_max)²   (k per chemistry: NMC 0.33, LFP 0.10…)
  Cycle life at DoD = rated_life × (DoD_ref / DoD_actual) ^ exponent
  Lifetime years = cycle_life / (cycles_per_day × 365)

### Fill ratio
  (array_L × array_W × array_H) / (housing_L × housing_l × housing_h) × 100 %
  Above ~85 % usually means very tight margins on at least one axis.

### How to fix a REJECT
  L margin too small → reduce S: lower energy/voltage target, use a higher-voltage
    cell, increase housing L, or reduce end_plate / gap.
  W margin too small → reduce P: use a higher-current cell, lower current target,
    increase housing l, or reduce gap.
  H margin too small → use a shorter cell or increase housing h.
  Fastest shortcut: open the Cell Recommender — it scans all 384 cells and
  returns the top 5 that ACCEPT the current housing, ranked by fill ratio.

### Application features
  Cell Recommender  — "Best matches" in the cell selector; top 5 + 3 near-miss cells
  Compare panel     — compare up to 3 cells side-by-side with the same constraints
  History panel     — every calculation auto-saved; click any entry to restore fully
  Add cell          — manual entry; syncs to Excel source if one is configured
  Import / Sync     — upload .xlsx to replace the entire catalogue
  PDF export        — full engineering report with methodology, schematic, results
  3D viewer         — interactive, fullscreen, layer toggles, 8 camera presets
  GLB / STL / STEP  — 3D geometry export for SolidWorks, Fusion 360, FreeCAD…

### Workflow (first use)
  1. Import your cell Excel catalogue (Import button in the cell selector card).
  2. Select a cell from the dropdown.
  3. Fill in housing dimensions and electrical targets in the Constraints form.
  4. Click Calculate → read the ACCEPT/REJECT verdict.
  5. If REJECT, read the justification and adjust; or use Cell Recommender.
  6. When satisfied, export PDF report or STEP file.
"""

_SYSTEM_PROMPT = (
    "You are the AI assistant embedded in the Battery Pack Designer, "
    "a desktop application for electrical engineers at Capgemini Engineering. "
    "You have expert knowledge of Li-Ion pack pre-design and of every feature "
    "in this specific application.\n\n"
    "Rules:\n"
    "- Be concise and precise — 2 to 4 sentences unless a list is clearly better.\n"
    "- Always quote specific numbers from the current design context when relevant.\n"
    "- When verdict is REJECT: state the binding constraint first, then the fix. Skip theory.\n"
    "- When asked about cells: use CATALOGUE data (counts, chemistries, top energy density).\n"
    "- When asked about past work: reference RECENT CALCULATIONS if available.\n"
    "- Suggest Cell Recommender when the user is stuck on a REJECT with no obvious fix.\n"
    "- Suggest Compare panel when the user wants to evaluate multiple cell options.\n"
    "- Do not use bullet points for fewer than 3 items — use inline prose instead.\n"
    "- Do not invent cell specifications — only reference cells in the catalogue context.\n\n"
    + _APP_GUIDE
)


# ── Key resolution ────────────────────────────────────────────────────────────

def _load_env() -> None:
    try:
        from dotenv import load_dotenv
        load_dotenv(dotenv_path=_ENV_PATH)
    except ImportError:
        pass


def _capgemini_key() -> Optional[str]:
    _load_env()
    return os.environ.get("CAPGEMINI_API_KEY", "").strip() or None


def _groq_key() -> Optional[str]:
    _load_env()
    return os.environ.get("GROQ_API_KEY", "").strip() or None


def _openrouter_key() -> Optional[str]:
    _load_env()
    return os.environ.get("OPENROUTER_API_KEY", "").strip() or None


def _make_client(proxy: Optional[str]) -> httpx.AsyncClient:
    # verify=True (default) — truststore.inject_into_ssl() in main.py already
    # injects the Windows certificate store so Zscaler corporate CAs are trusted.
    return httpx.AsyncClient(timeout=60.0, proxy=proxy)


# ── Context builder ───────────────────────────────────────────────────────────

def build_context(
    cell=None,
    form_data: Optional[dict] = None,
    result_data: Optional[dict] = None,
    catalog_summary: Optional[str] = None,
    recent_history: Optional[str] = None,
) -> Optional[str]:
    parts = []

    if cell:
        parts.append(
            f"SELECTED CELL: {cell.nom} | {cell.type_cellule} | "
            f"{cell.chimie or 'unknown chemistry'}"
        )
        parts.append(
            f"  {cell.capacite_ah} Ah | {cell.tension_nominale} V | "
            f"I_max {cell.courant_max_a} A | {cell.masse_g} g"
        )
        ct = (cell.type_cellule or "").lower()
        if ct == "cylindrical":
            parts.append(
                f"  Diameter {cell.diameter_mm} mm × Height {cell.hauteur_mm} mm"
            )
        else:
            parts.append(
                f"  L×W×H: {cell.longueur_mm}×{cell.largeur_mm}×{cell.hauteur_mm} mm"
            )
        if cell.cycle_life:
            parts.append(
                f"  Rated cycle life: {cell.cycle_life} cycles "
                f"@ {cell.dod_reference_pct}% DoD"
            )

    if form_data:
        parts.append(
            f"CONSTRAINTS: Housing {form_data.get('housing_l')}×"
            f"{form_data.get('housing_l_small')}×{form_data.get('housing_h')} mm | "
            f"E={form_data.get('energie_cible_wh')} Wh | "
            f"V={form_data.get('tension_cible_v')} V | "
            f"I={form_data.get('courant_cible_a')} A | "
            f"DoD={form_data.get('depth_of_discharge')}% | "
            f"margin≥{form_data.get('marge_mm')} mm | "
            f"gap={form_data.get('cell_gap_mm')} mm"
        )

    if result_data:
        m = result_data.get('marges_reelles') or {}
        parts.append(
            f"RESULT: {result_data.get('nb_serie')}S×{result_data.get('nb_parallele')}P | "
            f"{result_data.get('verdict')} | "
            f"fill={result_data.get('taux_occupation_pct')}%"
        )
        parts.append(
            f"  Margins L/W/H: {m.get('L')}/{m.get('W')}/{m.get('H')} mm"
        )
        parts.append(f"  Justification: {result_data.get('justification')}")
        if result_data.get('lifetime_years'):
            parts.append(
                f"  Lifetime: {result_data.get('lifetime_years')} yr | "
                f"C-rate: {result_data.get('c_rate_actual')}C"
            )

    if catalog_summary:
        parts.append(catalog_summary)
    if recent_history:
        parts.append(recent_history)

    return "\n".join(parts) if parts else None


# ── Streaming ─────────────────────────────────────────────────────────────────

async def stream_chat(
    messages: list,
    context: Optional[str] = None,
    lang: str = "en",
    provider: str = "auto",
) -> AsyncIterator[str]:
    """
    Yield raw SSE lines ("data: {...}\\n\\n").
    provider: "auto" tries Capgemini → Groq → OpenRouter in order.
              "capgemini" | "groq" | "openrouter" forces that provider only.
    """
    lang_suffix = " Réponds en français." if lang == "fr" else ""
    system_content = _SYSTEM_PROMPT + lang_suffix
    if context:
        system_content += f"\n\n### Current design state\n{context}"

    sys_proxies = urllib.request.getproxies()
    proxy = sys_proxies.get("https") or sys_proxies.get("http")

    errors: list[str] = []

    # ── 1. Capgemini AI Gateway (corporate PC with CAPGEMINI_API_KEY in .env) ──
    ck = _capgemini_key()
    if ck and provider == "capgemini":
        print(f"[chat] trying capgemini/{_CAPGEMINI_MODEL}", flush=True)
        try:
            full_messages_cap = [{"role": "system", "content": system_content}] + messages
            payload_cap = {
                "model": _CAPGEMINI_MODEL,
                "messages": full_messages_cap,
                "stream": True,
                "max_tokens": 1024,
                "temperature": 0.3,
            }
            headers_cap = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {ck}",
            }
            async with _make_client(proxy) as client:
                async with client.stream(
                    "POST", _CAPGEMINI_URL, headers=headers_cap, json=payload_cap
                ) as resp:
                    if resp.status_code not in (200,):
                        body = await resp.aread()
                        raise Exception(f"HTTP {resp.status_code}: {body[:200].decode(errors='replace')}")
                    async for line in resp.aiter_lines():
                        if line.startswith("data: "):
                            yield line + "\n\n"
            return
        except Exception as exc:
            err = f"capgemini/{_CAPGEMINI_MODEL}: {type(exc).__name__}: {exc}"
            print(f"[chat] skip: {err}", flush=True)
            errors.append(err)

    # ── 2. Groq + OpenRouter (home / personal PC) ─────────────────────────────
    attempts: list[tuple[str, str, str]] = []
    if provider != "capgemini":
        gk = _groq_key()
        if gk and provider in ("auto", "groq"):
            for m in _GROQ_MODELS:
                attempts.append(("groq", m, gk))
        ok = _openrouter_key()
        if ok and provider in ("auto", "openrouter"):
            for m in _OPENROUTER_MODELS:
                attempts.append(("openrouter", m, ok))
    if not attempts and provider == "capgemini" and not ck:
        yield 'data: {"error": "Capgemini key not configured. Add CAPGEMINI_API_KEY to backend/.env"}\n\n'
        return

    if not attempts:
        yield 'data: {"error": "No API key found. Add ANTHROPIC_API_KEY to backend/.env"}\n\n'
        return

    full_messages = [{"role": "system", "content": system_content}] + messages

    for provider, model, key in attempts:
        url = _GROQ_URL if provider == "groq" else _OPENROUTER_URL
        headers: dict = {"Content-Type": "application/json"}
        if provider == "groq":
            headers["Authorization"] = f"Bearer {key}"
        else:
            headers.update({
                "Authorization": f"Bearer {key}",
                "HTTP-Referer": "https://battery-pack-designer",
                "X-Title": "Battery Pack Designer",
            })

        payload = {
            "model": model,
            "messages": full_messages,
            "stream": True,
            "max_tokens": 1024,
            "temperature": 0.3,
        }

        try:
            print(f"[chat] trying {provider}/{model} proxy={proxy}", flush=True)
            async with _make_client(proxy) as client:
                async with client.stream(
                    "POST", url, headers=headers, json=payload
                ) as resp:
                    if resp.status_code in (429, 503):
                        err = f"{provider}/{model}: HTTP {resp.status_code}"
                        print(f"[chat] skip: {err}", flush=True)
                        errors.append(err)
                        continue
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if line.startswith("data: "):
                            yield line + "\n\n"
            return
        except Exception as exc:
            err = f"{provider}/{model}: {type(exc).__name__}: {exc}"
            print(f"[chat] skip: {err}", flush=True)
            errors.append(err)
            continue

    summary = errors[0] if errors else "unknown"
    print(f"[chat] ALL FAILED. First error: {summary}", flush=True)
    yield f'data: {{"error": "AI unavailable. Error: {summary}"}}\n\n'
