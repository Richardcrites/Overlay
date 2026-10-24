# 🖥️ ASOP Transition

A first-person scene transition for Star Citizen. You walk down a ship corridor, with head bob and footsteps, up to the
**Goopa Troopas ASOP terminal**. The terminal pings, the camera pushes into the glowing screen, and the screen
dissolves line by line to reveal your stream. It takes about 3.3 seconds, and the sound is included.

```
asop-transition/asop-transition.webm   the transition as a video with a transparent background (for OBS Stinger)
asop-transition/index.html             the same animation as a browser page (for Stream Deck / Streamer.bot)
asop-transition/asop.webp              your terminal art
```

## Option A: OBS Stinger transition (recommended)

This makes it a real scene transition. OBS swaps scenes while the terminal screen covers the view.

1. Download `asop-transition.webm` and keep it somewhere permanent.
2. In OBS, find the **Scene Transitions** dock and click **+** → **Stinger**. Name it `ASOP`.
3. Set **Video File** to `asop-transition.webm`.
4. Set **Transition Point Type** to **Time (milliseconds)** and **Transition Point** to **2450**.
   That's the moment the screen fully covers the view.
5. Set **Audio Monitoring** to **Monitor and Output** if you want to hear it yourself too. Click **OK**.

To use it:
- **For every scene change:** pick `ASOP` as the transition in the Scene Transitions dock.
- **Only for certain scenes:** right-click a scene → **Transition Override** → `ASOP`. Switching *to* that scene uses it.
- **From your Stream Deck:** the OBS Studio plugin's **Scene** action switches scenes with whatever transition applies,
  so a scene with the `ASOP` override plays it from one key.

## Option B: Browser source (Stream Deck / Streamer.bot)

Use this to play it on top of the current scene without switching scenes. It works the same way as Perfect Landing.

1. Add a **Browser** source → tick **Local file** → pick `asop-transition/index.html` → **1920 × 1080**.
   If you use GitHub Pages, you can use the URL `https://richardcrites.github.io/overlay/asop-transition/` instead.
2. Tick **Control audio via OBS**, **Shutdown source when not visible** and **Refresh browser when scene becomes active**.
3. Hide the source. Showing it plays the transition once.
   From Stream Deck, use the OBS plugin's **Source visibility** action, or a Streamer.bot action that shows the source,
   waits 3.5 s, and hides it again.

Alternatively, add `?streamerbot=1` to the URL. The page then waits for a Streamer.bot **Custom** WebSocket event
containing the word `asop`, the same setup as Perfect Landing's `perfect-landing` trigger.

| Option | What it does | Default |
| --- | --- | --- |
| `volume=0.5` | Sound volume, 0 to 1 | `0.8` |
| `sound=0` | No sound | on |
| `streamerbot=1` | Wait for Streamer.bot instead of playing when shown | off |
| `host=` / `port=` | Streamer.bot WebSocket server | `127.0.0.1` / `8080` |
| `trigger=asop` | Word the Streamer.bot event must contain | `asop` |
| `loop=1` / `bg=1` | Replay forever / show a pretend stream behind (for previewing) | off |

To preview it, open `index.html?bg=1&loop=1` in a browser and click the page to hear it.

## Changing it

The timing and look are at the top of the script in `index.html`: `T_WALK` (arrival), `T_PUSH` (screen fills the view),
`T_END` (fully dissolved). To use different art, replace `asop.webp` and adjust `SCREEN`, the blue screen's position
in the image, in pixels. If you change anything, the `.webm` needs to be rendered again. Ask Claude to re-render it.
