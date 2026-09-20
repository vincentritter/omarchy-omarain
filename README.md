# Omarain

Omarain is a quiet wallpaper overlay for Omarchy. Small squares fall in front of the current background and kick a few specks sideways when they hit the bottom edge. Most drops are the theme foreground at two opacities; a thinner slice uses the accent, the same way the screensaver throws a few brighter glyphs through a TTE rain.

It sits on Hyprland’s bottom layer, so windows and the bar stay above it. The surface does not take clicks. Double-clicking the desktop still opens the wallpaper picker.

If the machine exposes an accelerometer (IIO or Apple SMC `position`), tilting the chassis leans the rain.

Left-click the bar icon to open the panel. The switch turns rain off and on, restoring the last mode. Follow weather keeps the field dry unless the forecast is actually precipitating, then sets volume from Open-Meteo using the same location the weather widget uses. Intensity is Light, Steady, Heavy, or Torrential; while Follow weather is on, that slider holds the last manual level and the forecast owns the rain. Speed is Calm, Natural, or Hyper-gravity. Look is Theme, Psychedelic, Matrix, or Amber. Psychedelic is a mixed neon field. Matrix can fall as glyphs instead of pixels. Right-click the icon to turn rain off and on without opening the panel.

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
