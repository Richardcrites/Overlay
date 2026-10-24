# 🛬 Perfect Landing

A self-playing alert for Star Citizen. The Ironclad comes down with its engines firing and touches down. The screen shakes,
dust blows out, and **PERFECT LANDING** slams onto the screen with a HUD bar reading `IRONCLAD · TOUCHDOWN CONFIRMED · 0.00 m/s`.
After a few seconds the ship lifts off and everything clears away. The sound effects are generated in the page, so there are no audio files.

Files (keep them in the same folder):

```
perfect-landing/index.html     the alert
perfect-landing/ironclad.webp  the ship with its background removed
```

To preview it, open `index.html?bg=1&loop=1` in a browser. Click the page to hear the sound.

## Step 1: Add it to OBS

1. Add a **Browser** source and name it `Perfect Landing`.
2. Tick **Local file** and pick `perfect-landing/index.html`.
   If you use GitHub Pages, you can use the URL `https://richardcrites.github.io/overlay/perfect-landing/` instead.
3. Set the size to **1920 × 1080**.
4. Tick **Control audio via OBS**, **Shutdown source when not visible** and **Refresh browser when scene becomes active**.
5. Click **OK**, then click the 👁 eye next to the source to **hide** it.

If you fly in several scenes, put the source in one scene and add that scene to the others as a *Scene* source.
Then you only need one copy.

## Step 2: Make a Streamer.bot action

First connect Streamer.bot to OBS. In Streamer.bot, go to **Stream Apps → OBS**, right-click → **Add**.
Use port `4455` and your OBS WebSocket password, found in OBS under **Tools → WebSocket Server Settings**.

1. Open **Actions** → right-click → **Add**, and name it `Perfect Landing`.
2. Add these three sub-actions in this order (right-click in **Sub-Actions**):
   - **OBS → Sources → Set Source Visibility State**: choose your scene and `Perfect Landing`, set to **Visible**.
   - **Core → Delay**: `8500` ms.
   - **OBS → Sources → Set Source Visibility State**: same scene and source, set to **Hidden**.

Showing the source starts the alert, and hiding it resets it for next time.

Optional: add a **Command** trigger such as `!landing` so your mods can fire it from chat too.

## Step 3: Put it on a Stream Deck key

1. Install the **Streamer.bot** plugin from the Elgato Stream Deck store.
2. In Streamer.bot: **Servers/Clients → WebSocket Server**, tick **Auto Start**, and click **Start Server**. The plugin connects through it.
3. In the Stream Deck app, drag the Streamer.bot action key onto a button and choose **Perfect Landing**.

Press the key and the alert plays.

## Other way: keep the source always on

If you don't want to show and hide the source, the page can listen to Streamer.bot directly instead.

1. In the Browser source, untick **Local file**. In **URL**, type the file's full path with `?streamerbot=1` on the end,
   for example `file:///C:/Overlay/perfect-landing/index.html?streamerbot=1`. Use forward slashes `/`.
2. Leave the source visible all the time. It stays invisible until it's triggered.
3. In your `Perfect Landing` action, replace the three sub-actions with **Core → C# → Execute C# Code**, paste this, and click **Compile**:

   ```csharp
   using System;

   public class CPHInline
   {
       public bool Execute()
       {
           CPH.WebsocketBroadcastJson("{\"alert\":\"perfect-landing\"}");
           return true;
       }
   }
   ```

This uses the Streamer.bot WebSocket server from Step 3 (`127.0.0.1:8080` by default, with authentication **off**).
If you changed the port, add `&port=YOURPORT` to the address. This mode needs the local file, not the GitHub Pages URL.

## Options

Add options after `index.html`, starting with `?` and separated by `&`. For example: `index.html?hold=8&volume=0.5`

| Option | What it does | Default |
| --- | --- | --- |
| `hold=8` | Seconds before the ship lifts off. Add the extra seconds to the Streamer.bot delay too. | `6.5` |
| `volume=0.5` | Sound volume, 0 to 1 | `0.8` |
| `sound=0` | No sound | on |
| `caption=YOUR TEXT` | Changes the HUD bar text. `caption=0` hides it. | `IRONCLAD · TOUCHDOWN CONFIRMED · 0.00 m/s` |
| `streamerbot=1` | Wait for Streamer.bot instead of playing when the source loads | off |
| `host=` / `port=` | Streamer.bot WebSocket server address | `127.0.0.1` / `8080` |
| `trigger=word` | The word the Streamer.bot event must contain | `perfect-landing` |
| `loop=1` | Replay forever (for testing) | off |
| `bg=1` | Dark background (for testing in a browser) | off |
