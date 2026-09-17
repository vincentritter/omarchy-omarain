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
  property string speed: "calm"
  property string look: "theme"
  property string script: "pixels"
  readonly property bool useGlyphs: RainModel.usesGlyphs(look, script)
  property var weatherCode: null
  property real windX: 0
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

  function fillFor(role, alpha, tint) {
    if (root.look === "psychedelic" && tint)
      return Util.alpha(tint, alpha)
    var hex = RainModel.paletteHex(root.look, role)
    if (hex) return Util.alpha(hex, alpha)
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

  function setSpeed(next) {
    var speed = RainModel.normalizeSpeed(next)
    if (speed === root.speed) {
      persistMode()
      return
    }
    root.speed = speed
    root.bumpConfig()
    persistMode()
  }

  function setLook(next) {
    var look = RainModel.normalizeLook(next)
    var script = look === "matrix" ? "glyphs" : root.script
    var same = look === root.look && script === root.script
    root.look = look
    root.script = script
    if (same) {
      persistMode()
      return
    }
    root.bumpConfig()
    persistMode()
  }

  function setScript(next) {
    var script = RainModel.normalizeScript(next)
    if (script === root.script) {
      persistMode()
      return
    }
    root.script = script
    root.bumpConfig()
    persistMode()
  }

  function persistMode() {
    if (!root.modeLoaded) return
    if (!mkdirProc.running) mkdirProc.running = true
    modeFile.setText(RainModel.stateFileBody(root.mode, root.weatherCode, root.speed, root.look, root.script))
  }

  function applyWeather(raw) {
    var code = RainModel.weatherCodeFromPayload(raw)
    var windX = RainModel.windXFromPayload(raw)
    var dirty = false
    if (code !== root.weatherCode) {
      root.weatherCode = code
      dirty = true
    }
    if (windX !== root.windX) {
      root.windX = windX
      dirty = true
    }
    if (!dirty) return
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
    onFileChanged: reload()
    onLoaded: {
      var next = RainModel.parseStateFile(text())
      var dirty = next.mode !== root.mode || next.speed !== root.speed || next.look !== root.look || next.script !== root.script
      if (next.weatherCode != null && next.weatherCode !== root.weatherCode) {
        root.weatherCode = next.weatherCode
        dirty = true
      }
      root.mode = next.mode
      root.speed = next.speed
      root.look = next.look
      root.script = next.script
      root.modeLoaded = true
      if (dirty) root.bumpConfig()
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
    interval: 500
    running: true
    repeat: true
    onTriggered: modeFile.reload()
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
      property bool draining: false

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
        RainModel.configure(sim, {
          mode: root.mode,
          weatherCode: root.weatherCode,
          windX: root.windX,
          speed: root.speed,
          look: root.look,
          script: root.script
        })
      }

      function syncSim() {
        if (width < 8 || height < 8) return
        if (!sim) {
          sim = RainModel.createState(width, height, {
            pixel: 4,
            seed: root.seedFor(modelData),
            mode: root.mode,
            weatherCode: root.weatherCode,
            windX: root.windX,
            speed: root.speed,
            look: root.look,
            script: root.script
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
        function onModeChanged() { panel.applyConfig() }
        function onSpeedChanged() { panel.applyConfig() }
        function onLookChanged() { panel.applyConfig() }
        function onScriptChanged() { panel.applyConfig() }
      }

      function cssColor(role, alpha, tint) {
        var c = root.fillFor(role, alpha, tint)
        if (!c) return "transparent"
        if (typeof c === "string") return c
        return "rgba(" + Math.round(c.r * 255) + "," + Math.round(c.g * 255) + "," + Math.round(c.b * 255) + "," + c.a + ")"
      }

      function paintCells(ctx) {
        if (!sim) return
        var cells = sim.cells
        var glyphs = root.useGlyphs
        var fontFamily = Style.font.family
        var gs = 11
        ctx.imageSmoothingEnabled = false
        ctx.textBaseline = "top"
        ctx.font = gs + "px \"" + fontFamily + "\""
        for (var pass = 0; pass <= 3; pass++) {
          for (var i = 0; i < cells.length; i++) {
            var cell = cells[i]
            if (!cell.alive || cell.alpha <= 0.02) continue
            var isDrop = cell.kind === "drop"
            if (isDrop && (cell.layer || 0) !== pass) continue
            if (!isDrop && pass !== 3) continue
            if (glyphs && isDrop) {
              var trail = cell.trailGlyphs || cell.glyph || ""
              var n = Math.max(1, trail.length)
              var x = cell.x
              var y = cell.y + cell.h - n * gs
              for (var g = 0; g < n; g++) {
                var role = g === n - 1 ? "accent" : (g > n - 3 ? "foreground" : "muted")
                ctx.fillStyle = cssColor(role, cell.alpha * ((g + 1) / n), cell.tint)
                ctx.fillText(trail.charAt(g), x, y + g * gs)
              }
              continue
            }
            ctx.fillStyle = cssColor(cell.role, cell.alpha, cell.tint)
            ctx.fillRect(cell.x, cell.y, cell.w, cell.h)
          }
        }
      }

      FrameAnimation {
        running: panel.sim !== null && panel.visible && (root.mode !== "off" || panel.draining)
        onTriggered: {
          var dt = frameTime
          if (!(dt > 0) || dt > 0.05) dt = 1 / 60
          RainModel.step(panel.sim, dt)
          panel.draining = RainModel.hasLive(panel.sim)
          canvas.requestPaint()
        }
      }

      Canvas {
        id: canvas
        anchors.fill: parent
        renderTarget: Canvas.FramebufferObject
        renderStrategy: Canvas.Cooperative
        contextType: "2d"
        onPaint: {
          var ctx = getContext("2d")
          if (!ctx) return
          ctx.clearRect(0, 0, width, height)
          panel.paintCells(ctx)
        }
      }
    }
  }
}
