# SPACE XXXX — AAA Transition Plan

> The objective: take every asset, system, and setting from "impressive jam
> game" to "AAA-acceptable feel" (or as close as a web-deployed Three.js
> game can honestly get), built on a **reusable, object-based asset library**
> so complex assets are defined once, tweaked anywhere, reused everywhere.

---

## 0. What "AAA-acceptable feel" means here (definition of done)

A web game cannot match a $200M console title on raw asset density. It CAN
match the *feel* signals players actually read:

| Signal | Standard we adopt |
|---|---|
| Lighting | Physically-based, area-appropriate exposure, baked+realtime mix, bloom on emissives |
| Materials | PBR everywhere: albedo/roughness/metalness/normal, no flat-color boxes visible in hero areas |
| Animation | Nothing alive is static: idle/walk/talk cycles, procedural secondary motion |
| Motion | Camera and object easing — nothing snaps; everything arrives |
| Audio | Mixed buses, reverb zones, sidechained music, every interaction voiced by SFX |
| UI | Diegetic-first, animated transitions, consistent type system |
| Performance | 60fps at 1080p internal on an M-series Mac, 30fps floor on integrated GPUs |
| Cohesion | One art bible; every asset passes the same review checklist |

**The vibe stays**: Douglas Adams humour, synth soundtrack, chain-as-bureaucracy.
AAA polish on the craft, not sanitization of the soul.

---

## 1. Architecture: the reusable asset library (`src/lib/`)

The core deliverable underpinning everything. All world-building moves out of
ad-hoc `box(...)` calls into a data-driven prefab system.

```
src/lib/
├── registry/
│   ├── AssetRegistry.ts     # central catalogue: id → definition; lazy loads
│   ├── Prefab.ts            # data-driven object: geometry/model + materials
│   │                        #   + colliders + lights + guide text + tags
│   └── manifest.json        # every asset: source, license, budget, status
├── materials/
│   ├── MaterialLibrary.ts   # named PBR presets: 'hull-worn', 'deck-plate',
│   │                        #   'neon-trim', 'glass-canopy'… one place to tune
│   └── textures/            # KTX2-compressed texture sets per preset
├── models/
│   ├── ModelCache.ts        # GLTF load-once + clone-many (SkeletonUtils),
│   │                        #   Draco/KTX2 decoders, normalize + shadow setup
│   └── poses.ts             # bone-pose / animation-retarget helpers
├── vfx/
│   ├── VfxLibrary.ts        # tracers, sparks, explosions, engine trails,
│   │                        #   warp lines, atmosphere shimmer — pooled
│   └── shaders/             # shared shader chunks (snap, dissolve, hologram)
├── audio/
│   ├── SfxLibrary.ts        # named synth recipes (zap, whomp, chime, servo)
│   └── MusicSystem.ts       # stem-based adaptive engine (extracted/grown
│                            #   from AudioDirector)
├── actors/
│   ├── Character.ts         # NPC: model + animation state machine
│   │                        #   (idle/walk/talk/work) + lookAt + schedule
│   └── Vehicle.ts           # ship/drone base: hull model + thruster VFX +
│                            #   audio + damage states
└── world/
    ├── Interior.ts          # room grammar: walls/floors/doors from layout
    │                        #   data, auto-colliders, auto-lightmap zones
    └── Dressing.ts          # clutter scatter: crates/pipes/signage placed
                             #   by rules ("industrial", "bar", "wreck")
```

**Rules:**
1. **Nothing is built twice.** A drone is `registry.spawn('drone-loss-prevention')`;
   a tweaked variant is the same prefab with overrides `{tint, hp, speed}`.
2. **Data over code.** Prefabs are declarative objects (eventually JSON) —
   designers (or future-you) tweak without touching systems.
3. **Budgets in the manifest.** Each asset lists tri-count, texture MB,
   draw calls. CI fails if a scene exceeds its budget.
4. **License ledger.** Every external asset's source + license recorded in
   `manifest.json` (CC0 Quaternius sets already in `public/models/`).

Migration order: materials → models → vfx → actors → world. Each system
extracted from existing working code, not rewritten blind.

---

## 2. Asset upgrade tracks

### 2.1 Characters (highest visible win)
- Replace static Quaternius modular GLBs with the **animated** equivalents
  (Quaternius Universal Animation Library is CC0 and retargets onto the same
  rigs; Mixamo as backup source).
- `Character` actor: animation state machine (idle ↔ walk ↔ talk ↔ work),
  head-tracking lookAt toward the player within 4m, blink/breath secondary
  motion.
- Schedules: bartender wipes the bar; engineer kneels at crates; patron
  raises a glass. 30-second loops are enough — life, not AI.
- Stretch: simple dialogue trees at the terminal/bar (text UI exists).

### 2.2 Ships
- Player hull: keep Imperial; add **thruster VFX** (engine trail mesh +
  light flare keyed to thrust), landing gear animation, cockpit interior
  dressing pass (the downloaded hull deserves a matching dash).
- Drone: replace procedural build with a modeled drone (Quaternius Mech/
  Drone packs) wired into the same CombatSystem brain.
- Damage states: decals/smoke VFX at <50% hull, electrical arcing at <25%.

### 2.3 Station & interiors
- Rebuild Port Improbable through `Interior` + `Dressing`: trim sheets,
  PBR deck plates, signage decals, volumetric-feel light shafts (cheated
  with billboards), animated doors with servo SFX.
- Modular kit so the M2+ procedural interiors (derelict rooms, future
  stations) assemble from the same catalogue — procedural AND AAA-dressed.

### 2.4 Space & POIs
- Skybox: pre-rendered nebula/starfield cubemap (tiny stars baked in,
  parallax dust layer in front) replacing raw Points for the far field.
- Asteroids: 3-4 sculpted rock GLBs instanced with scale/rotation variety +
  normal maps; keep the deterministic placement.
- Per-POI lighting identity: derelict = sickly green flicker, mine = warm
  worklights, beacon = clean white, wreck field = cold blue.

### 2.5 Rendering
- Postprocessing chain (selective, performance-gated): **bloom** (emissives,
  engine glow, neon), **SSAO** (interiors), vignette + filmic grain
  (replaces most of the dither's job), FXAA/TAA at the upscale.
- Lightmap-bake pass for static interiors (offline, shipped as textures).
- LOD + instancing for asteroid fields and greebles; frustum-aware drone AI.
- Keep `?res=` ladder and add an auto-quality probe (drop post effects
  before resolution).

### 2.6 Audio
- Bus architecture: music / sfx / ambience / UI through one mixer with
  ducking (music dips under dialogue chimes and explosions).
- Convolution reverb zones: hangar (big metal), corridor (tight), bar
  (damped), derelict (cavernous), space (dry + radio-filtered).
- Footstep material switching (deck plate vs pad grating).
- Master loudness pass (-14 LUFS target, true-peak limiting).

### 2.7 UI/UX
- One type system (currently monospace-everywhere is close — formalize
  sizes/weights), animated panel transitions (slide/scan-line reveal),
  cockpit HUD projected as in-world canopy elements when flying.
- Controller + remappable keys; settings menu (audio sliders, res ladder,
  reduced-flash accessibility mode for the glitch effects).

---

## 3. Milestones

| Milestone | Scope | Exit criteria |
|---|---|---|
| **R1 — Library spine** | AssetRegistry, MaterialLibrary, ModelCache, manifest; migrate ship + drones + 1 room onto it | Same game, zero regressions, all tests green, prefab spawn API proven |
| **R2 — Living characters** | Animated NPC pipeline, Character state machines, schedules | No static humanoid anywhere; bar feels inhabited |
| **R3 — Hero spaces** | Station interior rebuild, postprocessing chain, audio buses + reverb zones | Hangar + bar pass the art-bible checklist at 60fps |
| **R4 — Space pass** | Skybox, instanced asteroids, POI lighting identities, ship VFX | Flight sequence is screenshot-worthy at any moment |
| **R5 — Ship it** | Quality probe, settings UI, perf budgets in CI, contracts deployed to Base Sepolia, itch.io/Vercel deploy | Strangers can play it and nobody apologizes |

Each milestone ends with: playtest, screenshot set, perf capture, commit tag.

---

## 4. Risks & honest constraints

- **Web ceiling**: no nanite, no raytracing; we win on lighting, motion and
  cohesion, not asset density. Set expectations accordingly.
- **CC0 supply**: free assets cap fidelity ~"stylized pro". True AAA texture
  density means buying packs (Quixel/KitBash3D, ~$50–300) or commissioning.
  Decision point at R3.
- **Solo content cost**: the library is what makes this survivable — every
  hour invested in prefabs pays back across all five milestones.
- **Chain deploy** still blocked on a funded Base Sepolia key (owner action,
  ~5 minutes, see `contracts/README.md`).

---

## 5. Immediate next actions (R1 kickoff)

1. `src/lib/registry/` scaffolding + manifest with the 7 existing models.
2. Extract MaterialLibrary from the palette constants (one source of truth).
3. ModelCache with clone-many (drones currently reload nothing — fine — but
   NPC variants will need it).
4. Port CombatSystem's drone build to a prefab as the proof-of-pattern.
5. Download Quaternius animated character pack; retarget idle/walk onto
   existing NPCs.
