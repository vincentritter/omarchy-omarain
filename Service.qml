import Quickshell
import Quickshell.Wayland
import QtQuick
import qs.Commons
import qs.Ui
import "RainModel.js" as RainModel

Item {
  id: root

  property var shell: null
  property var manifest: null

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

      function syncSim() {
        if (width < 8 || height < 8) return
        if (!sim) {
          sim = RainModel.createState(width, height, {
            pixel: 4,
            seed: root.seedFor(modelData)
          })
          return
        }
        if (sim.width !== width || sim.height !== height)
          RainModel.resize(sim, width, height)
      }

      onWidthChanged: syncSim()
      onHeightChanged: syncSim()
      Component.onCompleted: syncSim()

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
