export const HELP_SECTIONS = [
  {
    id: "overview",
    title: "Overview",
    body: `
Aura Core is a mastering analysis environment.

It does NOT modify audio.
It analyzes loudness, dynamics, stereo image and target compliance in real time.
`,
  },

  {
    id: "workflow",
    title: "4-Step Workflow",
    body: `
1. Upload your master
2. Play audio
3. Compare Average LUFS vs Target
4. Fix issues shown in Feedback Report
`,
  },

  {
    id: "meters",
    title: "Reading the Meters",
    body: `
LUFS:
Integrated loudness measurement.

Target:
Streaming platform loudness goal.

True Peak:
Maximum reconstructed peak level.

Stereo:
Width and phase correlation.
`,
  },

  {
    id: "issues",
    title: "Common Issues",
    body: `
Too Loud → limiter overuse
Too Quiet → headroom unused
Low Correlation → mono problems
`,
  },

  {
    id: "glossary",
    title: "Glossary",
    body: `
LUFS — Loudness Units relative to Full Scale
TP — True Peak
Correlation — Phase similarity L/R
`,
  },
];