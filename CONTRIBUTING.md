# Omarain

This file is for someone changing Omarain. How to install and use it lives in [README.md](README.md).

Omarain is an Omarchy bar plugin with a wallpaper rain service. Work in this checkout. Do not create a git worktree.

## Layout

`Omarain.qml` is the bar widget and panel. `Service.qml` draws the rain field and fetches weather. Decisions that can be tested without Quickshell belong in `RainModel.js`. `OmarainIcon.qml` draws the bar and hero mark as QML rectangles, not a rasterized SVG. `LookRain.qml` is the chip-hover preview. `read-tilt` reads the accelerometer when the machine exposes one.

The live copy Omarchy loads is `~/.config/omarchy/plugins/vincentritter.omarain`. Copy changed files there and run `omarchy restart shell`. Plugin hot reload of QML is unreliable; a restart is the check that counts.

## Tests

```bash
node --test RainModel.test.js
```

A new decision (mode, intensity, follow weather, look, speed, weather URLs, precipitation) belongs in `RainModel.js` with a test that fails if that decision flips. QML is not unit-tested. Prove UI by using it in the running shell.

Follow weather rains only on current precipitation at the weather widget's location, not a wet outlook. Open-Meteo is the first weather source. Last manual intensity is a separate persisted field; hide the intensity slider while Follow weather is on. The mixed neon look is `candy`. Unknown looks, including `psychedelic`, normalize to theme. Chip hover rain uses `previewFallScale`, not the sim `speedScale`.

## UI

Match the built-in Omarchy panels so the widget feels native: `PanelHero`, `PanelSectionHeader`, `PanelSeparator`, `ToggleSwitch`, `PanelSlider`, `CursorSurface`, `PanelActionButton`. Do not invent form chrome.

The bar and hero mark is `OmarainIcon`. Do not bring back SVG tiles. Look and speed chips overlay `LookRain` on cursor; Candy's underline is a neon stripe. The help mark on the hero opens the about page; do not mention that page in the README.

Keep comments out of QML and JS unless the code cannot express a constraint.

## Persistence

Rain state lives in `~/.local/state/omarchy/omarain.json`. Weather location is `~/.local/state/omarchy/settings/weather.json` and may be missing. Writes go through `mergeState` so a mode change does not drop intensity, resume mode, look, or speed.

## Screenshots

`preview.png` is the panel card. `screenshots/` has the panel and wallpaper rain shots. Recapture on an empty workspace so the terminal is not in the crop. Candy and Heavy make the rain read in a still; restore Theme and Auto afterwards. Do not commit a panel that opens the about page on every click; that is only a local capture trick.

## Git

Atomic commits. One coherent change per commit. Do not attribute commits to a tool.
