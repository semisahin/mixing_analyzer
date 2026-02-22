# PROJECT CONTEXT – AURA CORE

## Framework
- Next.js (App Router)
- React (Functional Components only)
- TypeScript
- "use client" component

## Styling
- TailwindCSS only
- No inline style changes unless absolutely necessary
- Dark futuristic UI (default)
- **Theme support: Dark + Light mode**
- Emerald accent color (#10b981 family) (default accent)
- Rounded 3rem containers
- Heavy typography (uppercase, tracking, mono fonts for meters)

Do NOT redesign the UI unless explicitly requested.  
Do NOT simplify the visual structure.

---

# APPLICATION PURPOSE

Aura Core is a browser-based audio analysis dashboard inspired bei youlean loudness meter.

Main Features:
- Audio upload
- Real-time playback
- LUFS calculation (live + average)
- **Short-Term LUFS (3s window)**
- **Momentary LUFS (400ms window)**
- RMS dB
- True Peak dBFS
- **Dynamic Range (Peak - RMS)**
- Stereo Goniometer
- Waveform rendering
- Upload history tracking
- **Theme Toggle (Dark/Light) with persistence (localStorage)**

This is NOT a generic audio player.  
It is a mastering analysis tool.

---

# STATE MACHINE

type Stage = "upload" | "loading" | "dashboard"

Rules:
- Never remove stage logic
- Never merge stages
- Never change stage flow unless asked

---

# DSP ARCHITECTURE

Audio processing uses:
- Web Audio API
- AudioContext
- AnalyserNode
- ChannelSplitter
- requestAnimationFrame loop

Important:
- Do NOT refactor DSP logic unless explicitly requested.
- Do NOT change LUFS calculation formula.
- Do NOT remove running average logic (lufsStatsRef).
- Do NOT convert to external audio libraries.
- **Short-Term/Momentary are time-based windows (not frame-count based).**
- **No DSP memory leaks allowed: rAF must be cancelled + AudioContext must be closed on cleanup.**
- **Never create multiple MediaElementSource bindings for the same <audio> element without cleanup.**

---

# PERFORMANCE RULES

- No unnecessary re-renders
- No heavy recalculations inside React state
- Keep refs for DSP
- Keep animation loop stable
- Never introduce memory leaks
- **Avoid double decode/render for waveform (use lastWaveUrlRef or equivalent guard).**
- **Canvas scaling must not stack transforms (reset transform before DPR scale).**

---

# FILE MODIFICATION RULES

When modifying code:
1. Only change what is explicitly requested.
2. Do NOT restructure the entire component.
3. Do NOT rename main component.
4. Do NOT move logic into external files unless asked.
5. If unsure → ask before changing architecture.

If improvement requires structural change:
→ Explain first.  
→ Wait for confirmation.

---

# UI COMPONENT RULES

FeedbackModule:
- Must remain reusable
- No redesign
- No prop renaming

Waveform:
- Canvas-based
- Vertical amplitude bars
- Click + drag seeking must remain
- **Must render correctly on HiDPI (devicePixelRatio) without scale stacking**
- **Must support theme background (dark/light)**

Goniometer:
- Glow effect must remain
- L/R stereo visualization must remain
- No simplification to basic chart

---

# THEME SYSTEM

## Modes
- **Dark mode (default)**
- **Light mode**
- **Theme must persist (localStorage, key: `aura_theme`)**
- **Theme toggle must not affect stage flow or DSP logic**

## Future: Accent Color Picker
- Add a UI panel/modal for accent selection (future-ready)
- User can choose any accent color **except pure black or pure white**
- Must enforce contrast safety:
  - Block `#000000` and `#ffffff`
  - Block colors too close to black/white (contrast threshold) to keep readability
- Prefer implementation via a single CSS variable (e.g. `--accent`) to avoid widespread class rewrites
- Inline style is allowed **only** for setting CSS variables (as “absolutely necessary”)

---

# FEATURE ENHANCEMENTS – FUTURE-READY

🧠 Analysis & Intelligence

 Intelligent mastering feedback (Interpret LUFS/DR/Peak values)

 Streaming normalization warning (Spotify / Apple / YouTube impact)

 Mix fatigue detection (low dynamic variation detection)

 Personal loudness comparison (compare with previous uploads)

📈 Metering & Visualization

 Loudness timeline (LUFS / RMS / Peak over time)

 Dynamic range timeline visualization

 True Peak event markers on timeline

 Loudness heatmap overlay on waveform

 Safe / Warning / Clipping color indicators

🎧 Streaming Simulation

 Platform preview toggle (Spotify / Apple Music / YouTube)

 Simulated gain reduction display

 Post-normalization LUFS preview

🌊 Waveform Enhancements

 Zoomable waveform

 Loudness zone coloring (-23 / -16 / -14 LUFS ranges)

 Snap-to-peak / transient seeking

 Section markers (intro / verse / chorus detection)

👁️ Stereo & Spatial Analysis

 Stereo balance meter

 Phase correlation meter

 Mono compatibility warning

 Dynamic goniometer glow reactions

⚡ UX & Workflow

 Mastering Mode (minimal focused UI)

 Peak flash feedback animation

 Contextual warnings in FeedbackModule

 Upload history comparison view

🎨 Theme System (Future-ready)

 Accent color picker panel

 Contrast validation (block near black/white)

 Per-module accent glow support

🚀 Performance / Engine (optional future)

 GPU optimized canvas rendering

 Shared analysis buffer (avoid recalculation)

 Background analysis worker (Web Worker)

---

# OUTPUT FORMAT RULES FOR AI

When generating code:
- Return only the changed parts unless full rewrite is requested
- Clearly comment where changes were made
- Do not remove existing functionality

When explaining:
- Be concise
- No beginner explanations
- Assume developer-level understanding

---

# FORBIDDEN

- No UI redesign
- No switching to external libraries
- No converting to server components
- No removing TypeScript types
- No replacing Tailwind
- **No allowing accent color to be pure black or pure white**