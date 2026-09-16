import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import QtQuick
import qs.Commons
import qs.Ui
import "RainModel.js" as RainModel

Item {
  id: root

  property var shell: null
  property var manifest: null

  readonly property string home: Quickshell.env("HOME")
  readonly property string stateDir: home + "/.local/state/omarchy"
  readonly property string modePath: stateDir + "/omarain.json"
  readonly property string weatherPath: home + "/.local/state/omarchy/settings/weather.json"

  property string mode: "auto"
  property var weatherCode: null
  property var location: ({ name: "", latitude: null, longitude: null })
  property bool modeLoaded: false
  property bool pendingWeatherRefresh: false
  property int configTick: 0

  function seedFor(screen) {
    var name = String(screen && screen.name ? screen.name : "screen")
    var n = 0
    for (var i = 0; i < name.length; i++) n = (n * 33 + name.charCodeAt(i)) >>> 0
    return n + (screen ? Math.round(screen.width || 0) : 0)
  }

  function fillFor(role, alpha) {
    var base = role === "accent" ? Color.accent : Color.foreground
    return Util.alpha(base, alpha)
  }

  function bumpConfig() {
    root.configTick++
  }

  function setMode(next) {
    var mode = RainModel.normalizeMode(next)
    if (mode === root.mode) {
      persistMode()
      return
    }
    root.mode = mode
    root.bumpConfig()
    persistMode()
  }

  function persistMode() {
    if (!root.modeLoaded) return
    if (!mkdirProc.running) mkdirProc.running = true
    modeFile.setText(RainModel.stateFileBody(root.mode, root.weatherCode))
  }

  function applyWeather(raw) {
    var code = RainModel.weatherCodeFromPayload(raw)
    if (code === root.weatherCode) return
    root.weatherCode = code
    root.bumpConfig()
    persistMode()
  }

  function refreshWeather() {
    if (forecastProc.running) {
      root.pendingWeatherRefresh = true
      return
    }
    forecastProc.command = ["curl", "-fsS", "--max-time", "8", RainModel.forecastUrl(root.location)]
    forecastProc.running = true
  }

  Process {
    id: mkdirProc
    command: ["mkdir", "-p", root.stateDir]
  }

  FileView {
    id: modeFile
    path: root.modePath
    watchChanges: true
    atomicWrites: true
    printErrors: false
    onLoaded: {
      var next = RainModel.parseStateFile(text())
      root.mode = next.mode
      if (next.weatherCode != null) root.weatherCode = next.weatherCode
      root.modeLoaded = true
      if (root.weatherCode != null && next.weatherCode == null) root.persistMode()
      root.bumpConfig()
    }
    onLoadFailed: root.modeLoaded = true
  }

  FileView {
    id: weatherFile
    path: root.weatherPath
    watchChanges: true
    printErrors: false
    onLoaded: {
      root.location = RainModel.parseLocationFile(text())
      root.refreshWeather()
    }
    onLoadFailed: {
      root.location = RainModel.parseLocationFile("")
      root.refreshWeather()
    }
  }

  Process {
    id: forecastProc
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.applyWeather(String(text || "").trim())
    }

    onExited: function() {
      if (!root.pendingWeatherRefresh) return
      root.pendingWeatherRefresh = false
      root.refreshWeather()
    }
  }

  Timer {
    interval: 15 * 60 * 1000
    running: true
    repeat: true
    onTriggered: root.refreshWeather()
  }

  Timer {
    interval: 4000
    running: true
    repeat: false
    onTriggered: if (root.weatherCode == null) root.refreshWeather()
  }

  Timer {
    interval: 1500
    running: true
    repeat: false
    onTriggered: {
      modeFile.reload()
      weatherFile.reload()
    }
  }

  Component.onCompleted: {
    mkdirProc.running = true
    Qt.callLater(root.refreshWeather)
  }

  Variants {
    model: Quickshell.screens

    PanelWindow {
      id: panel
      required property var modelData

      property var sim: null
      property int tick: 0

      screen: modelData
      visible: !remapGuard.remapping
      color: "transparent"
      updatesEnabled: true
      anchors { top: true; bottom: true; left: true; right: true }

      WlrLayershell.namespace: "vincentritter-omarain"
      WlrLayershell.layer: WlrLayer.Bottom
      WlrLayershell.keyboardFocus: WlrKeyboardFocus.None
      exclusionMode: ExclusionMode.Ignore
      mask: Region {}

      ScreenMoveRemap {
        id: remapGuard
        window: panel
      }

      function applyConfig() {
        if (!sim) return
        RainModel.configure(sim, { mode: root.mode, weatherCode: root.weatherCode })
      }

      function syncSim() {
        if (width < 8 || height < 8) return
        if (!sim) {
          sim = RainModel.createState(width, height, {
            pixel: 4,
            seed: root.seedFor(modelData),
            mode: root.mode,
            weatherCode: root.weatherCode
          })
          return
        }
        if (sim.width !== width || sim.height !== height)
          RainModel.resize(sim, width, height)
        applyConfig()
      }

      onWidthChanged: syncSim()
      onHeightChanged: syncSim()
      Component.onCompleted: syncSim()

      Connections {
        target: root
        function onConfigTickChanged() { panel.applyConfig() }
      }

      Timer {
        interval: 50
        running: panel.sim !== null && panel.visible
        repeat: true
        onTriggered: {
          RainModel.step(panel.sim, interval / 1000)
          panel.tick++
        }
      }

      Repeater {
        model: panel.sim && panel.tick >= 0 ? panel.sim.cells.length : 0

        Rectangle {
          required property int index
          readonly property var cell: panel.sim ? panel.sim.cells[index] : null
          visible: panel.tick >= 0 && !!(cell && cell.alive && cell.alpha > 0.02)
          x: panel.tick >= 0 && cell ? Math.round(cell.x) : 0
          y: panel.tick >= 0 && cell ? Math.round(cell.y) : 0
          width: panel.tick >= 0 && cell ? cell.w : 0
          height: panel.tick >= 0 && cell ? cell.h : 0
          color: panel.tick >= 0 ? root.fillFor(cell ? cell.role : "muted", cell ? cell.alpha : 0) : "transparent"
          antialiasing: false
        }
      }
    }
  }
}
