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
- **After Effects-style quality:**
  - **Motion blur:** fast-moving layers are blurred along their path, like After Effects' motion blur switch.
  - **Bloom glow:** a soft, layered glow instead of a flat drop shadow.
  - **Light sweep:** a shine that passes across a layer (CC Light Sweep).
  - **Glitch:** RGB split plus displaced slices.
  - **Text animators:** letter-by-letter effects (decode/scramble, fade up, pop, slide in, wave) and gradient text.
- **After Effects-style animation tools:**
  - **Anchor point, stretch X/Y (squash and stretch), and skew.**
  - **Parent & Link:** a layer follows another layer's position, rotation and scale.
  - **Wiggle:** the wiggle() expression, on any property.
  - **Graph editor:** drag bezier handles to shape a keyframe's easing, or use presets. **F9** applies Easy Ease.
- **Animated dog emotes:** a cartoon dog face layer that animates by itself. It can wink, do a jaw-drop "pog",
  wag its tongue, show heart eyes, or wear a cool visor, with an optional space helmet. You can set the fur, ear and muzzle colors to match your dogs.
- **Animated GIFs / WebPs:** upload your own animated emotes and they play in the alert.
- **Variables** in text: `{user}`, `{months}`, `{tier}`, `{recipient}`, `{count}`, `{bits}`, `{viewers}`, `{message}`.
  Long usernames shrink to fit the panel. Plurals: `{bits:bit|bits}` reads "1 bit" / "500 bits".

## Quick start

1. **Open the editor**: double-click `index.html`, or use your GitHub Pages link. Nothing to install.
2. Under **Crew**, upload a photo of each dog and type their names.
   Tip: square, close-up photos of their faces look best in the round frames.
   Got photos with the background removed (transparent PNGs)? They're detected automatically and shown as
   **cut-outs** with no round frame, with the glow following your dog's outline. Untick **Cut-out** on the dog to put it back in the frame.
   Free ways to remove a background: tap and hold the dog in the iPhone Photos app ("Copy subject"), Windows Photos/Paint ("Remove background"), or remove.bg.
3. Click through the alert tabs at the top and press **Space** to play each one. Change whatever you like.
4. Click **Export overlay** and pick one of the two ways below.

Your work saves automatically in the browser. Use **Save** to download a backup `.json`, and **Open** to load one.

## Recommended: Streamer.bot

Streamer.bot is the simplest setup now. It sees every follow, sub, gift, cheer (including repeats), raid and
channel point redeem, and the overlay file is just a local OBS source, so a big video doesn't matter.
See **Way 1b: Streamer.bot** below. StreamElements still works if you ever need it.

## Way 1: StreamElements

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
| Shape the curve yourself | Easing → **Custom curve (graph)**, then drag the yellow handles |
| Easy Ease | Select a keyframe ◆ and press **F9** |
| Wiggle a property | Click **∿** next to it, then set **Hz** (how often) and **Amount** (how far) |
| Make a layer follow another | **Parent** at the top of the inspector. The layer won't jump. |
| Motion blur / glow / sweep / glitch | The **Effects** section of the inspector |
| Playback stutters while editing | Untick **Full quality** next to Play (exports aren't affected) |
| Show a layer's keyframes | ▸ arrow next to the layer name |
| Rename a layer | Double-click its name in the timeline |
| Move or resize the whole alert | Alert settings → **Move all X/Y**, **Scale all** |
| Use one design for every alert | Alert settings → **Copy design to all** (keeps each alert's own wording) |

### Render quality

Exports default to **High**: motion blur plus bloom glow. If OBS ever stutters while you're playing Star Citizen,
export again with **Export overlay → Options → Render quality → Standard**. Standard uses the old lightweight glow
and no motion blur. Everything else, including decoding text, sweeps, glitches and emotes, stays the same.

## Standard alert: the dog at his desk (master clip)

`video/desk-dog.webm` is the master look: the dog at his desk facing you, grinning and waving a paw, a seamless 6 s
loop (green screen removed, nothing else changed). Follow, Sub, Resub, Gift Sub, Donation and Redeem
use it, with the words in a white speech bubble beside his head. **Cheer** is the same scene with coins raining down, and
**Bezo's Bucks** has him putting on a bald cap, both colour-matched to the master.

**Raid** uses `video/raid-dog.webm`: he holds up a sign that reads *WELCOME RAIDERS!*, the raider's name and how many
pilots they brought (the words follow the sign), then *Let's throw some ass!* pops up in his bubble. To change the
sign, click the **Sign text** layer on the Raid tab.

**Gift Bomb** uses `video/gift-dog.webm`: wrapped gift boxes pop up all over his desk while he looks around excited.
(The clip's green gift box was recoloured purple so removing the green screen doesn't erase it.)

**Halloween:** `video/halloween-iroh.webm` is Iroh in his vampire cape at the desk with a jack-o'-lantern, a seamless
5.5 s loop with a transparent background. In OBS add a **Media Source** (Local File, tick **Loop**), or a **Browser**
source pointing at `halloween.html` on your GitHub Pages site (1920 x 1080; it sits in the bottom-left corner).

New clips should match this one: give your video generator a frame of it as the first frame or reference image.
The older typing dog is still under **Alert settings → Template → Typing dog (side view)**.

## Older look: the typing dog video

Every alert type starts from your **typing dog video**: the cartoon dog in the red headband, with the green screen
keyed out, at his computer. He types, then winks and smiles at the camera (5.6 seconds). When its speech bubble pops up, the alert's words type into it, and they follow the
bubble as it pops in, wiggles and pops out:

| Alert | The dog says |
| --- | --- |
| Follow | **{user}** just followed! |
| Sub | **{user}** subscribed! Welcome to the Big Dogs! |
| Resub | **{user}** resubbed for 14 months! *(plus a small bubble with their message)* |
| Gift Sub | **{user}** gifted a sub to {recipient}! |
| Gift Bomb | **{user}** gifted 10 subs! |
| Cheer | **{user}** cheered 500 bits! *(plus their message)* |
| Redeem | **{user}** used Bezos Money! *(plus their message)* |
| Raid | **{user}** is raiding! Let's throw some ass! |

To change the words, click the **Bubble text** layer. He sits in the bottom-right corner (the monitor's cut-off edge lines up with the screen edge); move it with
**Alert settings → Move all X/Y** or **Scale all**.

### Cheer: the coin rain dog

Cheers play `video/coin-dog.webm`: coins rain down while he grins and winks, with the words in a bubble beside his
head. The clip is colour-matched to the master desk clip (same coat colours, speckles kept). It plays the Bits sound.

## Paint & redraw (fix the art yourself)

Click a **video** layer, then **Open paint tools** in the inspector (right). You paint straight onto the video, and the
fixes play in your overlay too (nothing is re-rendered):

| Brush | What it does |
|---|---|
| **Recolor** | changes the colour but keeps his drawn shading and lines (use it with the palette) |
| **Smooth** | blurs what's under it: wipes out spots and blotches |
| **Cover dark spots** | covers anything darker than the colour (e.g. Coat tan over speckles) |
| **Darken lines / shadow** | deepens ink and shadows |
| **Paint** / **Erase** | plain colour / cut the video away |
| **Move fix** | drag the fix at another frame; it glides between the frames you set (like position keyframes) |
| **Eyedropper** | pick any colour on the canvas, the guide picture included |

- **Fixes:** every stroke goes in a *fix* that shows for a stretch of the video (**Start here**, **End here**, **This frame
  only**, **Whole video**). Because he moves, use **Move fix** every half second or so to keep it on him.
- **Drawing guide:** the **Dog palette** swatches (tan, cream, grizzle, saddle, ink, headband red...; **+** adds your own),
  and a **Guide picture**: another dog video or your photos (add them with **+ Image**), shown beside the video or
  traced over it. Scrub a guide video to the frame you want to copy.
- **Hold: before** shows the video without your fixes. **[** and **]** change the brush size. Ctrl+Z undoes.
- **Stay inside his outline** (on by default) keeps paint off the transparent background.

### Bezo's Bucks (Prime subs)

Prime subs and Prime resubs play the **Bezo's Bucks** alert instead of Sub/Resub: the desk dog grins, pulls a bald cap
on over his headband and shows it off (`video/prime-cap-dog.webm`, colour-matched to the master), while his bubble
says *{user} subbed with Bezo's Bucks!* (plus their resub message). It plays the Sub sound. Untick **Enabled** on its
tab and Prime subs go back to the normal Sub/Resub alerts. Test with `!testalert prime`. The older side-view bald cap
clip is under **Template → Typing dog (side view)**.

### Alert sounds

Your StreamElements sound bites are in `sounds/` and already set on each alert (**Alert settings → Sound file**):

| Sound | Alerts |
|---|---|
| `follower.mp3` | Follow |
| `sub.ogg` | Sub, Resub, Bezo's Bucks, Gift Sub, Gift Bomb |
| `bits.mp3` | Cheer (coin rain) |
| `donation.mp3` | Donation |
| `raid.mp3` | Raid |

Redeem (off by default) has no sound bite. The video's own typing sounds play on top. To hear only the sound bite,
click the dog video layer and set **Video sound volume** to 0.

### Donation alert

Streamer.bot passes on tips from **Streamlabs, StreamElements, Ko-fi and TipeeeStream** if that service is
connected under **Integrations** in Streamer.bot. The bubble shows *{user} donated {amount}!* plus their message.

- **Other looks:** pick one under **Alert settings → Template** (*Typing dog video*, *Cartoon doodle dog* or
  *Star Citizen HUD*), then click **Use template**.
- **Your own videos:** use **+ Video** in the media library, add a **Video** layer and pick the clip. If it has a green
  background, tick **Green screen key** and adjust **Key tolerance** until the green is gone.
- **The file:** `video/typing-dog-trimmed.webm` already has the green removed (transparent background, with sound).
  Other cuts: `video/typing-dog.webm` is the full 10-second clip, `video/typing-dog-faded.webm` fades the computer
  out, and `video/dog-bust.webm` is just him from the chest up. The
  editor loads it automatically when you open it from its web address (GitHub Pages). On a double-clicked copy,
  add it once with **+ Video**.
- **StreamElements:** the video makes the alert code about 2 MB, too big to paste. Use **Code won't save?**, the tiny
  code plus `alerts.json` on GitHub. The **Streamer.bot** and **OBS file** exports have no size problem.

## Redeem alert and the cartoon dog

The **Redeem** alert is for channel point rewards. It's **off** by default because another tool (like Tangia) already announces redeems; tick **Alert settings → Enabled** on the Redeem tab to use it. A hand-drawn cartoon of your dog pops up in the bottom-left corner
and "says" it in a speech bubble: **so_hey** used **Bezos Money!**. A smaller bubble underneath shows the viewer's
message, only when they typed one. The bubble outlines wobble a few times a second, like a hand-drawn GIF.

- **Change the cartoon:** the **Cartoon dog** layer has settings for fur, dark fur, muzzle, chest, inner ears, eyes,
  ear style (perky or floppy), vest and harness colors, line thickness, and how wobbly the lines are. To make your other
  dogs, add another **Cartoon dog** layer (button above the canvas) and change the colors.
  - **Pose:** *Idle* blinks, twitches an ear, bobs and tilts. *Excited* bounces with happy eyes and an open mouth.
  - **Talking:** animate this 0 to 1 to make the mouth flap.
- **Colored words:** wrap them like `[c=#e8405a]{user}[/c] used {reward}!`.
- **Hide a layer when there's no message:** Effects → **Show → Only if there is a {message}**.
- **Where redeems come from:** **Streamer.bot**, which sees channel point rewards (export with the Streamer.bot tab).
  StreamElements custom widgets may not get channel point events. Test with `!testalert redeem`.

### The cartoon as image files

`art/` has the cartoon on its own as looping animations with transparent backgrounds. Use them anywhere: Discord,
StreamElements' image alerts, stream panels.

| File | What it is |
| --- | --- |
| `art/dog-idle.webp` / `.gif` | Blinking, ear twitch, gentle bob |
| `art/dog-talking.webp` / `.gif` | Mouth flapping |
| `art/dog-excited.webp` / `.gif` | Bouncy, happy eyes |
| `art/dog-*.png` | A still frame of each |

The `.webp` files have smooth transparent edges. The `.gif` files work everywhere but have hard edges.

## Perfect Landing (Stream Deck alert)

`perfect-landing/` has a separate, self-playing **PERFECT LANDING** alert with the Ironclad touching down.
You fire it with a Stream Deck key through Streamer.bot. Setup steps are in [perfect-landing/README.md](perfect-landing/README.md).

## ASOP Transition (scene transition)

A first-person walk up to the Goopa Troopas ASOP terminal. The camera pushes in to a close-up of the masked crew member, then dissolves to the stream.
It comes as an OBS **Stinger** video with a transparent background (`asop-transition/asop-transition.webm`, transition point **2450 ms**)
and as a browser source. Setup is in [asop-transition/README.md](asop-transition/README.md).

## Files

```
index.html        the editor
css/editor.css    editor styles
js/runtime.js     animation engine, sounds, and Twitch connections (also embedded in exported overlays)
js/templates.js   the built-in Star Citizen / dog templates
js/editor.js      editor UI: timeline, keyframes, inspector, export
sounds/           alert sound bites (follower, sub, bits, donation, raid)
video/            the typing dog video cuts
perfect-landing/  the Perfect Landing Stream Deck alert (index.html + ironclad.webp)
```
