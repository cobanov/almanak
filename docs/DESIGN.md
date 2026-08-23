# Design direction

Three directions, explored properly, then one chosen. The brief seeded one of
them; it survived, but not unchanged, and the reasons are below.

## What the design has to serve

Facts from [`ARCHIVE-FORMAT.md`](ARCHIVE-FORMAT.md) that a palette and a type
scale actually have to answer to:

- **Six years, not fifteen.** 2020–2026. There is no decade to zoom out to.
- **Mostly fragments.** 60% of records are one side of a conversation, median
  74 characters. Whatever the design does, it will spend most of its time
  rendering very short text with pieces missing.
- **Mostly Turkish.** 77%. Every face must carry `ı İ ş Ş ğ Ğ ç Ç ö Ö ü Ü`
  properly, and the dotted/dotless i pair must be visually distinct at body
  size or Turkish readers lose a real distinction.
- **The silences matter.** The brief says the gaps are usually the most
  interesting thing in an archive. The design should make absence legible
  rather than treating it as empty space to fill.
- **Some of it is inferred.** Era labels come from changepoint detection and
  TF-IDF. The design needs a way to say "this is a guess" that is not a
  tooltip nobody reads.
- **Numbers are everywhere.** Counts, dates, percentages, durations. Tabular
  figures are a requirement, not a refinement.

---

## Direction 1 — Ground glass

*A records room. The archive is film, and you are at the reader.*

You are not scrolling a feed; you are working a machine that holds someone's
holdings. The scrubber is the advance mechanism, tweets are frames passing
through a lit gate, the gallery is a contact sheet, the analysis panels are the
registrar's cards. Institutional, tactile, slightly cold — the temperature of a
room where records are kept properly.

**Palette — Ground glass**

| Hex | Role |
|---|---|
| `#12100E` | Film base. Warm black, the colour of acetate, not neutral UI black. |
| `#1E2321` | Ground glass shadow. Cool green-grey, the screen with no light behind it. |
| `#C8D0C4` | Projected light. Pale green-white; primary text. |
| `#E8B96A` | Tungsten. The lamp. Current frame and active state **only**. |
| `#7A8C82` | Verdigris. Secondary text, oxidized fittings. |
| `#8E3B2F` | Oxide. Deletions, destructive actions, decay. |

Light mode is not this inverted. It is **the lamp off and the film on a light
table**: a diffuse `#EDEFE8` ground, frames sitting dark on it, tungsten
replaced by the deeper `#9A6B1F` of a loupe's edge. Same room, different hour.

**Type — Redaction / IBM Plex Sans / IBM Plex Mono**

*Redaction* (Kaphar & Betts) is drawn in degradation grades — the same letters
rendered as if printed and reprinted until they break down. That is the risk in
this direction, and its justification: **the type degrades in proportion to how
inferred the content is.** A confirmed fact is set in Redaction 10. An
auto-detected era label is set in Redaction 35, visibly coarser. The design
tells you what it is guessing without a badge or a footnote.

*IBM Plex Sans* carries body text: institutional lineage, unfussy, and a
genuinely well-drawn Turkish set. *IBM Plex Mono* handles every number, with
tabular figures throughout.

**Signature:** the film gate — the current position is lit by tungsten while
frames fall off into darkness on either side, so moving the scrubber feels like
advancing a reel rather than paginating a list.

```
┌──────────────────────────────────────────────────────────────────────┐
│  holdings ▸ your_handle             10,090 records   2020 — 2026    ⚙ │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│      ░░░░░░░░           ┏━━━━━━━━━━━━━━━━┓          ░░░░░░░░         │
│      ░ frame ░          ┃                ┃          ░ frame ░        │
│      ░ −1    ░          ┃   14 Mar 2023  ┃          ░ +1    ░        │
│      ░       ░          ┃                ┃          ░       ░        │
│      ░░░░░░░░           ┃  bir adaya     ┃          ░░░░░░░░         │
│                         ┃  düşsem yanıma ┃                           │
│                         ┃  alacağım…     ┃                           │
│                         ┃                ┃                           │
│                         ┃  ♥ 493   ↻ 21  ┃   ← tungsten lights only  │
│                         ┗━━━━━━━━━━━━━━━━┛      the frame in the gate│
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  ┌ the pytorch years ─────┐      ┌ quiet ┐   ┌ ~inferred~ ────────┐  │
│  ▁▂▃▅▇█▇▅▃▂▁▂▃▅▇█▇▆▄▃▂▁▁▁▁▁▁▁▁▁▁▂▁▁▁▁▁▁▁▂▃▄▅▆▇█▇▅▃▂▁▂▃▄▅▆▇▆▅▄▃▂▁  │
│  ░░░░ replies band, dimmed and separate ░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  └────┬────┴────┬────┴────┬────┴────┬────┴────┬────┴────┬────┘       │
│      2020      2021      2022      2023      2024      2025          │
│                                    ▲ 84 days silent — the longest    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Direction 2 — Strip chart

*The archive as a continuous trace on a chart recorder.*

Time advances on a drum, posting volume is an ink pen, and silence is a flat
line. The operator annotates the margin. Everything is graticule, trace and
handwriting.

**Palette — Recorder**

| Hex | Role |
|---|---|
| `#E6EAE3` | Recorder paper. Pale grey-green, deliberately not cream. |
| `#C9D2C6` | Graticule. The printed grid. |
| `#16211E` | Ink. Text and rules. |
| `#2F5D50` | Pen green. The primary trace. |
| `#2A4B8D` | Pen blue. Second series — replies, secondary trace. |
| `#8A9691` | Pencil. Operator annotations, inferred labels. |

Two pens rather than one accent: recorders genuinely ran multiple colours, and
it gives the reply band its own channel without inventing a decorative hue.

**Type — Archivo Expanded / Source Serif 4 / Roboto Mono**

Archivo Expanded reads as instrument-panel lettering: wide, industrial,
engraved. Source Serif 4 is the log book. Roboto Mono is the printout.

**Signature:** silences are the loudest thing on the page — the trace drops to
a flat line and the gap's duration is set in the margin in pencil, exactly the
way an operator would mark an event.

```
┌──────────────────────────────────────────────────────────────────────┐
│ ALMANAK              CHART No. 1          10,090 REC.      2020–2026 │
├───┬──────────────────────────────────────────────────────────────────┤
│400┼┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄│
│   │              ╱╲                    ╱╲                            │
│300┼┄┄┄┄┄┄┄┄┄┄┄┄╱┄┄╲┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╱┄┄╲┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄│
│   │       ╱╲  ╱    ╲      ╱╲        ╱     ╲    ╱╲                    │
│200┼┄┄┄┄┄┄╱┄┄╲╱┄┄┄┄┄┄╲┄┄┄┄╱┄┄╲┄┄┄┄┄╱┄┄┄┄┄┄┄╲┄┄╱┄┄╲┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄│
│   │  ╱╲ ╱             ╲╱      ╲   ╱          ╲╱    ╲                 │
│100┼┄╱┄┄╲┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╲╱┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╲┄┄┄┄┄┄┄┄┄┄┄┄┄┄│
│  0┼╱┄┄┄┄┄╲┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄─────────┄┄┄┄╲┄┄┄┄┄┄┄┄┄┄┄┄│
│   └─┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴──  │
│    2020      2021      2022      2023   ⌇84 days⌇ 2025      2026     │
│                                          ⌇silent⌇                    │
├──────────────────────────────────────────────────────────────────────┤
│ 14 MAR 2023 · 09:41 · iPhone                              ♥493  ↻21  │
│ bir adaya düşsem yanıma alacağım 3 şey:                              │
│ — sağlam ekran…                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Direction 3 — Conservator's table

*The archive as damaged material being mounted.*

Sixty per cent of this archive is half a conversation. Rather than paper over
that, this direction makes loss the organizing idea: a reply is mounted with
the shape of its missing parent left as a visible void, the way a conservator
leaves a loss unfilled rather than inventing what was there.

**Palette — Mount**

| Hex | Role |
|---|---|
| `#1A1A1D` | Mount board. Cool dark neutral. |
| `#D8D4CC` | Tissue. Warm grey primary text — greyer than paper, never cream. |
| `#8C8880` | Fibre. Secondary text. |
| `#5B7C99` | Conservation blue. Repairs, links, active state. |
| `#9C7A3F` | Foxing. Age spots — degraded or inferred data. |
| `#B5493F` | Loss. Missing content, deletions. |

**Type — Spectral / Public Sans / JetBrains Mono**

Spectral has enough voice to carry a display role without the high-contrast
serif look the brief rules out. Public Sans is neutral and reads well at 74
characters. JetBrains Mono handles data.

**Signature:** the missing parent — every reply renders above an empty mount
the exact size of the tweet X did not give you, labelled with the handle it
was addressed to.

```
┌──────────────────────────────────────────────────────────────────────┐
│  almanak                              10,090 items · 2020–2026   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ╭┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈╮             │
│   ┊  not in the archive — @user_k, 14 Mar 2023        ┊  ← the void  │
│   ┊  open on x.com ↗                                  ┊             │
│   ╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈╯             │
│      │                                                               │
│   ┌──┴───────────────────────────────────────────────────┐           │
│   │ evet aynen, tam da bunu düşünüyordum                 │           │
│   │ 14 Mar 2023 · 09:41                        ♥ 2   ↻ 0 │           │
│   └──────────────────────────────────────────────────────┘           │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  ▁▂▃▅▇█▇▅▃▂▁▂▃▅▇█▇▆▄▃▂▁▁▁▁▁▁▁▁▁▁▂▁▁▁▁▁▁▁▂▃▄▅▆▇█▇▅▃▂▁▂▃▄▅▆▇▆▅▄▃▂▁    │
│   2020      2021      2022      2023      2024      2025      2026   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Critique

**Strip chart is rejected.** It is the best of the three at the timeline and
the worst at everything else. A chart recorder has no answer for a contact
sheet of 2,697 photographs, and forcing the gallery onto graticule paper would
be metaphor applied as wallpaper. It also drifts toward a pale-ground data
dashboard, which is close to the generic look the brief rules out. Its genuinely
good idea — treating silence as the loudest mark on the track, annotated in the
margin — is worth keeping, and is kept.

**Conservator's table is rejected as a whole direction.** Its central insight is
correct and important: this archive really is fragmentary, and a design that
pretends otherwise is lying about the data. But an entire application built
around loss is a sad room to spend an evening in, and it risks reading as broken
rather than considered — particularly on the import screen, where a first-time
visitor has no way to tell "designed to show absence" from "failed to load."
Its one strong device — rendering the missing parent as a visible, labelled
void rather than silently dropping it — is portable, and is grafted onto the
chosen direction.

**Ground glass is chosen.** It is the only one of the three whose metaphor
holds across every view the brief specifies: gate for the timeline, contact
sheet for the gallery, registrar's cards for analysis, holdings for the
multi-archive screen. It gives motion exactly one home, which matches the
brief's instruction that motion be orchestrated in one place and quiet
everywhere else. Its light mode is a genuinely different room rather than an
inverted palette. And the Redaction degradation grades solve a real problem the
brief poses — how to show that an era label is inferred — with typography
instead of a badge, which is the kind of structural device that encodes
something true rather than decorating.

**What gets grafted in:**

- From Strip chart: silence is a first-class mark. The longest gaps are
  annotated directly on the track with their duration, not buried in a panel.
- From Conservator's table: a reply renders its missing parent as a labelled
  void with a link out, rather than appearing as an orphaned fragment.

**The one risk being taken:** type that degrades with confidence. If it reads as
a rendering bug rather than a signal, it fails, and the fallback is a plain
`inferred` label in Plex Mono. This gets judged on a real screen at M2, not
argued about now.

## Constraints that hold regardless

- Tabular figures everywhere a number appears. Units never wrap away from their
  number. A percentage always carries its denominator.
- The display face is used sparingly — era labels, section heads, the archive
  poster. Never for body text, never for data.
- Motion lives in the scrubber. Everything else changes state without
  animating. `prefers-reduced-motion` removes inertia and keeps every function.
- Dark and light are both designed. Neither is derived by inversion.
- On small screens the scrubber becomes a vertical drag along the right edge —
  the gate stays, rotated. It is not hidden.
- Visible keyboard focus on every interactive element, real contrast ratios
  checked against WCAG AA, alt text on media derived from the carrying tweet.
- Copy is sentence case, active voice, plain verbs. No exclamation marks. Empty
  states name an action. Errors say what happened and what to do next.

## Open, to settle at M2

- **Turkish coverage in Redaction must be verified** before it ships. If
  `ı İ ş ğ` are missing or badly drawn, the display face falls back to IBM Plex
  Sans Condensed and the degradation device moves to opacity plus letterspacing.
- Every face is self-hosted. No font requests leave the machine.
