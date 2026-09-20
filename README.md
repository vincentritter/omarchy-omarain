# Omarain

Omarain is a blissful rain overlay on the Omarchy wallpaper, for a bit of ambiance. Small squares fall in front of the current background and kick a few specks sideways when they hit the bottom edge. Most drops use the theme foreground at two opacities; a thinner slice uses the accent, the way Omarchy's screensaver throws a few brighter glyphs through the rain.

![Omarain over the wallpaper](screenshots/rain.png)

It sits on Hyprland’s bottom layer, so windows and the bar stay above it. The surface does not take clicks. Double-clicking the desktop still opens the wallpaper picker.

If the machine exposes an accelerometer (IIO or Apple SMC `position`), tilting the chassis leans the rain.

## Use

Left-click the bar icon to open the panel. The switch turns rain off and on, restoring the last mode. Right-click the icon to do the same without opening the panel.

Follow weather rains at the weather widget's location while it is raining outside. If that location is missing, Omarain asks geojs for an IP location, then Open-Meteo for the current conditions. The panel also sets intensity, speed, and look. Candy is mixed neon; Matrix can fall as glyphs.

![Omarain panel](preview.png)

## Install

```bash
omarchy plugin add https://github.com/vincentritter/omarchy-omarain.git --enable
```

That lands in `~/.config/omarchy/plugins/vincentritter.omarain`. Omarain complements [Tinytray](https://github.com/vincentritter/omarchy-tinytray): rain on the wallpaper, widgets in the drawer. Host it there, or leave it on the right of the bar.

## Remove

```bash
omarchy plugin remove vincentritter.omarain --yes
```

Disable without removing with `omarchy plugin disable vincentritter.omarain`. `~/.local/state/omarchy/omarain.json` is left in place so a later install can restore intensity, look, and speed.

## Tests

From the checkout:

```bash
node --test RainModel.test.js
```

Omarain is [MIT](LICENSE) licensed. It needs Omarchy.

Built by [Vincent Ritter](https://vincentritter.com?ts=omarain).
