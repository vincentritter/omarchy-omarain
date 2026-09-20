# Omarain

Omarain is a quiet wallpaper overlay for Omarchy. Small squares fall in front of the current background and kick a few specks sideways when they hit the bottom edge. Most drops are the theme foreground at two opacities; a thinner slice uses the accent, the same way the screensaver throws a few brighter glyphs through a TTE rain.

It sits on Hyprland’s bottom layer, so windows and the bar stay above it. The surface does not take clicks. Double-clicking the desktop still opens the wallpaper picker.

If the machine exposes an accelerometer (IIO or Apple SMC `position`), tilting the chassis leans the rain.

The bar widget sets intensity (Off, Light, Steady, Heavy, Torrential, Auto), fall speed (Calm, Natural, Hyper-gravity), and look (Theme, Psychedelic, Matrix, Amber). Psychedelic is a mixed neon field. Auto stays dry unless the forecast is actually precipitating, then turns the volume up or down from Open-Meteo, using the same location the weather widget uses. Right-click the icon to turn rain off and on, restoring the last intensity. Left-click opens the panel.

## Install

The repo is private, so clone it over SSH and enable the plugin:

```bash
omarchy plugin add git@github.com:vincentritter/omarchy-omarain.git --enable
```

That lands in `~/.config/omarchy/plugins/vincentritter.omarain`. Host the widget in Tinytray, or leave it on the right of the bar. Disable with `omarchy plugin disable vincentritter.omarain`. Remove with `omarchy plugin remove vincentritter.omarain`.

## Tests

```bash
node --test RainModel.test.js
```
