# 🐾 Quantum Paws Alert Studio

A small After Effects-style editor for building **animated Twitch alerts** that star your dogs, themed around **Star Citizen**
(quantum jumps, HUD panels, comm hails). You design the alerts in the browser, then export **one HTML file** that you add to OBS.

## What you get

- **7 alert types**: Follow, Sub, Resub, Gift Sub, Gift Bomb (community gifts), Cheer, Raid.
- **Ready-made templates** for each one: a quantum warp arrival, a shockwave, a HUD panel that unfolds, a scan line,
  spinning target rings around your dog, typewriter text, floating paw prints, and a jump-out streak at the end.
  - Follow / Cheer star **Dog 1**, Sub / Resub star **Dog 2**, Gift Sub stars **Dog 3**.
  - Gift Bomb and Raid bring out **the whole crew** (all 3 dogs).
- **An editor that works like After Effects:**
  - Layers (dog/image, text, shape, particles) stacked in a timeline. Top layer draws in front.
  - A ⏱ **stopwatch** on every animatable property. Turn it on, move the playhead, change the value, and you get a new keyframe.
  - **Keyframes** (◆) you can drag in time, with easing per keyframe (ease out, overshoot, elastic, bounce, hold...).
  - Drag layer bars to slide them in time, drag their ends to trim them.
  - Drag layers directly on the canvas. Drag property labels left/right to scrub values.
  - Undo/redo, duplicate, hide/lock, reorder by dragging layer names.
- **Effects:** glow, blur, blend modes (Add/Screen), circle/hex/rounded masks for the dog photos,
  HUD panels, corner brackets, dashed rings, and particle effects (quantum warp, starfield, sparks, paw prints, embers).
- **Sound:** built-in sci-fi sounds (quantum jump, comm chirp, incoming hail, red alert klaxon), or upload your own,
  like **recordings of your dogs barking**.
- **Animated dog emotes:** a cartoon dog face layer that animates by itself. It can wink, do a jaw-drop "pog",
  wag its tongue, show heart eyes, or wear a cool visor, with an optional space helmet. You can set the fur, ear and muzzle colors to match your dogs.
- **Animated GIFs / WebPs:** upload your own animated emotes and they play in the alert.
- **Variables** in text: `{user}`, `{months}`, `{tier}`, `{recipient}`, `{count}`, `{bits}`, `{viewers}`, `{message}`.
  Long usernames shrink to fit the panel. Plurals: `{bits:bit|bits}` reads "1 bit" / "500 bits".

## Quick start

1. **Open the editor**: double-click `index.html`, or use your GitHub Pages link. Nothing to install.
2. Under **Crew**, upload a photo of each dog and type their names.
   Tip: square, close-up photos of their faces look best in the round frames.
3. Click through the alert tabs at the top and press **Space** to play each one. Change whatever you like.
4. Click **Export overlay** and pick one of the two ways below.

Your work saves automatically in the browser. Use **Save** to download a backup `.json`, and **Open** to load one.

## Way 1: StreamElements (easiest)

StreamElements is already connected to your Twitch, so **follows, subs, resubs, gift subs, cheers and raids** all work.
You don't need tokens or a channel name.

1. In the export window, click **Copy alert code**.
2. Go to [StreamElements → My overlays](https://streamelements.com/dashboard/overlays). Open your overlay, or create a new one at 1920×1080.
3. Click **+** → **Static / Custom** → **Custom widget**.
4. On the left, click **Open editor** → **JS** tab → select everything (Ctrl+A) → paste (Ctrl+V) → **Done**.
5. Under **Position, size & style**, set the widget to **1920 × 1080** at **0, 0**.
6. Click the overlay's **Save** button (top right). Clicking **Done** in the code editor is not enough on its own.
7. If that overlay isn't in OBS yet, copy its link (🔗 at the top) into an OBS **Browser** source.

To test, click **Emulate** in the StreamElements editor, or type `!testalert all` in your chat.

**Updating later:** click **Copy alert code** again and paste it over the JS tab. Your OBS setup doesn't change.

### If StreamElements won't save the code

Use the tiny version. It's under **Code won't save?** in the export window. The code you paste is about 500 characters, and your designs load from your GitHub Pages site:

1. Click **Download alerts.json**.
2. On GitHub: your repo → **Add file** → **Upload files** → drop in `alerts.json`. Put it in the same folder as `index.html`, on the branch your Pages site uses. Click **Commit changes**.
3. Enter your Pages address, click **Copy tiny code**, paste it into the StreamElements JS tab, then click **Done** and **Save**.

To update a design after that, just upload a new `alerts.json`. It can take up to 10 minutes to show up. Then refresh the source in OBS.

When a gift bomb arrives, you get one "Gift Bomb" alert instead of one alert per gifted sub.

## Way 1b: Streamer.bot

Streamer.bot is logged into Twitch as you, so it sees **every** follow, sub, resub, gift sub, gift bomb, cheer and raid.
That includes the same viewer cheering 1 bit over and over. You don't need to build any Streamer.bot actions.

1. In Streamer.bot: **Platforms → Twitch**, connect your **Broadcaster** account.
2. **Servers/Clients → WebSocket Server**: tick **Auto Start** and click **Start Server**. The default is `127.0.0.1:8080`.
   It's already on if you use Perfect Landing.
3. In the editor: **Export overlay → Streamer.bot → Download overlay.html**.
4. In OBS: add a **Browser** source → tick **Local file** → pick the file → **1920 × 1080** → tick **Control audio via OBS**.
5. Type `!testalert all` in your chat to test it (works for you and your mods).

When OBS loads the source, a small "Connected to Streamer.bot" message shows in the bottom-left for a few seconds.
If it says "Waiting for Streamer.bot", the WebSocket server isn't started.

If you turned on authentication for the WebSocket server, enter the password under **Streamer.bot connection settings**.
Change the address and port there too if they aren't the defaults.

**Don't run the dog alerts in StreamElements at the same time,** or every alert plays twice.
If you'd rather keep StreamElements for everything else, use Way 1 and tick
**"Also catch cheers through Streamer.bot"** instead. Cheers then come from both, and each one still plays only once.

## Way 2: OBS file (no StreamElements)

1. In the export window, open the **OBS file** tab. Type your Twitch channel name and click **Download overlay.html**.
2. In **OBS**: add a **Browser** source → tick **Local file** → pick `quantum-paws-overlay.html` →
   size **1920 × 1080** → tick **Control audio via OBS**.
3. Type `!testalert all` in your Twitch chat to see every alert (works for you and your mods).

After changing a design, export again and replace the old file. In OBS, right-click the source → **Refresh**.

In this mode, subs, gifts, cheers and raids are read from your Twitch chat anonymously.
Follow alerts need a Twitch token. Set one up as below, or just use Way 1.

### Turning on follow alerts in an OBS file (optional, about 5 minutes)

Twitch only shares follower events with a logged-in token that has the `moderator:read:followers` scope.

1. Go to <https://dev.twitch.tv/console/apps> → **Register Your Application**.
   - Name: anything, for example `quantum-paws-alerts`
   - OAuth Redirect URL: the exact address you open the editor at, for example `https://richardcrites.github.io/overlay/`
     (or `http://localhost:8000/` if you run `python3 -m http.server 8000` in this folder)
   - Category: Broadcaster Suite, Client Type: Public
2. Copy the **Client ID**.
3. Open the editor at that exact address. Twitch login doesn't work from a double-clicked file.
4. Click **Export overlay** → **OBS file** → **Follow alerts** → paste the Client ID → **Connect with Twitch**.
5. Download the overlay again.

Tokens expire after a while. If follow alerts stop working, connect again and re-export.
**Don't share the exported file:** it contains your token.

## Editor cheat sheet

| Action | How |
| --- | --- |
| Play / pause | `Space` |
| Go to start / end | `Home` / `End` |
| Step one frame | `,` / `.` |
| Undo / redo | `Ctrl+Z` / `Ctrl+Shift+Z` (or `Ctrl+Y`) |
| Duplicate layer | `Ctrl+D` |
| Delete layer or selected keyframe | `Delete` |
| Nudge layer | Arrow keys (`Shift` = 10px) |
| Move only horizontally or vertically | Hold `Shift` while dragging on the canvas |
| Animate a property | Click ⏱, move the playhead, change the value |
| Add/remove a keyframe at the playhead | ◇ / ◆ next to the property |
| Change easing | Click a keyframe ◆ in the timeline → **Easing to next** |
| Show a layer's keyframes | ▸ arrow next to the layer name |
| Rename a layer | Double-click its name in the timeline |
| Move or resize the whole alert | Alert settings → **Move all X/Y**, **Scale all** |
| Use one design for every alert | Alert settings → **Copy design to all** (keeps each alert's own wording) |

## Perfect Landing (Stream Deck alert)

`perfect-landing/` has a separate, self-playing **PERFECT LANDING** alert with the Ironclad touching down.
You fire it with a Stream Deck key through Streamer.bot. Setup steps are in [perfect-landing/README.md](perfect-landing/README.md).

## Files

```
index.html        the editor
css/editor.css    editor styles
js/runtime.js     animation engine, sounds, and Twitch connections (also embedded in exported overlays)
js/templates.js   the built-in Star Citizen / dog templates
js/editor.js      editor UI: timeline, keyframes, inspector, export
perfect-landing/  the Perfect Landing Stream Deck alert (index.html + ironclad.webp)
```
