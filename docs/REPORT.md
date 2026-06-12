# SPACE XXXX — The Report of Everything, Ever

*The complete chronicle: every phase, feature, bug, and judgment call from
the first greybox corridor to the goose chase. Maintained alongside
[HANDOFF.md](HANDOFF.md) (current state) and [AAA-PLAN.md](AAA-PLAN.md)
(forward plan). Updated at the end of every working session.*

---

## Vital statistics (as of June 2026)

| | |
|---|---|
| Commits | 19 (each one a chapter; `git log` reads as the diary) |
| Code | ~5,100 lines TS + Solidity across `src/` and `contracts/` |
| Tests | 12 (procgen determinism + asset-library contract) |
| 3D assets | 9 files, all CC0 Quaternius (2 ships, 5 humanoids, animated mannequin + clips) |
| Animation clips | 46 (Universal Animation Library) |
| Procedural content | 26 slogan posters · 28 graffiti tags · 13 terminal lines · 8 ship's-log entries · 8 planet names · 4 goose chases |
| Repo | https://github.com/MCP-G/space-xxxx |

## The pitch

First-person 3D space game: walk a decaying station, board a freighter you
can physically walk into, fly a procedurally generated sector, dock at
outposts, trade/mine/salvage/fight, take contracts (some of which are
deliberate wild goose chases), and — pending one wallet — claim sectors as
on-chain deeds from the Ministry of Immutable Affairs. Douglas Adams tone,
cyber-decay aesthetic, procedural synth score that follows your speed and
mood. Three.js + TypeScript + Vite + Tone.js + Solidity (Base).

## Chronology

### M0 — The vibe gate
Pixel pipeline (low-res render target, palette quantize, Bayer dither,
scanlines, glitch FX, PS1 vertex snap), FP walk controller, greybox
station, procedural acid groove at 124bpm. Decision that shaped everything:
*look and sound first; if walking a corridor doesn't feel right, stop.*
**Bug**: first render was nearly black — the custom post shader skipped
sRGB encoding. One `pow(col, 1/2.2)` later, a game existed.

### M1 — The traversal spine
Port Improbable (hangar open to space, corridor, bar, talking municipal
terminal), walkable ship interior with seat-swap into flight,
arcade-newtonian flight model, seeded sector (asteroids, derelict, nav
beacon), docking both ways, adaptive station/flight music, Guide popups.
The whole loop in one unbroken session, no loading screens.

### M2 — The chain layer
SectorDeed + ShipRegistry ERC-721s (OpenZeppelin, solc-js compile
pipeline), viem client with guest-mode fallback, Form 88-B filing window
with tx lifecycle as bureaucratic correspondence, live sector regeneration
from granted seeds, vitest determinism suite. Contracts still await a
funded Base Sepolia key (owner action).

### M3/M4 — The game part
Seeded per-location markets (arbitrage is real), cargo/credits/persistence,
salvage, loss-prevention drones, click-to-shoot combat, death + Ministry
invoice, engine upgrades via bribed engineer. Then the contracts board:
deliver / clear / salvage missions with rewards and abandonment.

### The feedback loops (owner playtests)
- **"Couldn't find anywhere to dock"** → T-cycled nav targets, screen
  chevron, dock light pillars, landing rings, audio alignment chime that
  sweetens as you line up.
- **"Engineer looks like a cube"** → NPC rebuilds (twice), ending in
  animated mannequins.
- **"Weapons don't work"** → real bug: cockpit shots originated at the
  seat (~1.5m below the crosshair) and blaster range (60m) was *shorter
  than drone engagement range* (90m). Fixed; tracers/sparks/explosions
  added; pulse cannon as second weapon (arms crate, 8 scrap, Q to swap).
- **"Respawned mysteriously"** → drones had killed them mid-explore;
  death is now a full-screen flash plus survival tip. Related: drones used
  to shoot *through walls* — cover detection added.
- **"4x res / more detail"** → 1080p internal (device-capped, `?res=`
  override), mining outpost + derelict interior content, greebled ship.
- **"Stars invisible"** → fog was eating them (`fog:false`). Then
  "crazy smaller" → sub-2px pinpricks in three layers (~9,100 stars).
- **"Photorealism"** → CC0 model integration, shadow mapping, ACES
  tonemap, floating space objects.

### R1 — The asset library spine (AAA plan)
`src/lib/`: MaterialLibrary (named PBR surfaces, override variants),
ModelCache (load-once/clone-many, normalization, preload), AssetRegistry
with procedural/model prefabs + manifest (source/license/budget ledger).
Drone migrated as proof-of-pattern. Contract locked by tests.

### R2 — Living characters
Found the Universal Animation Library as CC0 glTF (46 clips + its own
mannequin — no retargeting needed). `Character` actor: clip state machines,
waypoint patrols, greet-the-player turns. Cast of six: kneeling engineer,
idle bartender, board-talking passenger, patrolling suit guy, seated
patron, and THE RAVER (six shifts and counting).

### The decay pass
Full scripted playtest (all flows pass) plus `lib/world/Decay.ts`: feed it
collider boxes, it classifies walls/floors (ceiling-pair detection) and
litters them with pooled canvas decals — Ministry posters, robot graffiti
with spray drips, grime — and six garbage prefabs (cans, bottles, crumpled
reports, dead datapads, cable tangles, lost towels). Cyber decay became a
load-bearing aesthetic.

### Canopy, windows, cinematics
Pilot-POV glass canopy with frame struts (first attempt mirror-balled the
galaxy; tuned to clear). `lib/world/Windows.ts`: framed star-view viewports
on every structure ("view simulated for morale purposes"). Letterboxed
dock/undock cutscenes: camera cranes around the ship as it glides onto the
pad, music ducks, stingers in A (rising arp + riser for undock, descending
add9 resolve for dock). Plot armor during shots, after drones shot the
protagonist to 44% during a landing.

### Planets & geese (this session)
Procedural planets per sector (2-3): banded canvas textures, storms,
optional rings, rim lights, Adams names (BRUNCH, TAXHAVEN IX, THE LONG
QUEUE...) — nav-targetable, fog-exempt, slowly rotating. Wild goose chase
contracts: multi-hop investigations ("TRACK: A SMELL (CATEGORY 4)") whose
quarry keeps relocating, ending in a paid punchline. Embellishments:
thruster flares that stretch with the burn, neon bar sign with a loose
connection, breathing atmosphere field, +20 content lines.

### The sweet-spot pass
Frame rate had collapsed under 1080p + ~20 lights + decal sprawl, and
props flickered in and out of existence. The flicker was the beloved PS1
vertex-snap shader: at hi-res its clip-space quantization annihilated
small geometry (and subtly mangled skinned characters). Retired. Z-fights
fixed with polygon offsets, windows merged to one draw call each, shadows
halved, and the pipeline gained adaptive resolution that hunts the
smooth/detailed sweet spot automatically (540p–1080p, pinned ?res= wins).

## Engineering lessons worth keeping

1. **Tone.js `bpm.rampTo` hard-freezes the tab.** Set `bpm.value`
   discretely. (Cost: one full evening of debugging a frozen browser.)
2. **Hidden tabs park rAF *and* clamp setInterval.** Scripted browser
   tests must drive the loop synchronously (`__game.step(ms)`).
3. **Custom post shaders skip three.js color management** — encode sRGB
   (and later, tonemap) yourself.
4. **Never downscale a dithered frame** (moiré). Internal target ≤ canvas
   device pixels, always.
5. **Fog eats everything beyond its far plane** — stars, planets:
   `fog: false`.
5b. **Stylization shaders don't survive resolution changes.** Vertex snap
   tuned for 270p destroyed small props at 1080p. Re-audit every
   aesthetic hack when the target resolution moves.
6. **GLTFLoader sanitizes node names** (`UpperArm.L` → `UpperArmL`) and
   bone rest-poses make rotation axes empirical questions.
7. **Collider-driven dressing scales.** Walls and floors are data; decay,
   windows, and whatever comes next are functions over that data.

## Open items

- Deploy contracts to Base Sepolia (needs owner's funded key — the only
  blocker the codebase cannot remove itself).
- Async multiplayer indexer (hosting decision pending).
- R3 per AAA-PLAN: Interior/Dressing rebuild of hero spaces, bloom/SSAO,
  audio buses + reverb zones.
- Unique character meshes on the UAL skeleton (de-mannequin the cast).
- Known quirks: bar patron arguably stands on his stool; wreck-field pad
  is cramped; pulse slugs are dodgeable at range (by design, allegedly).
