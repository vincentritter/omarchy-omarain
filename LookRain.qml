import QtQuick
import qs.Commons
import "RainModel.js" as RainModel

Item {
  id: root

  property string look: "theme"
  property string speed: "calm"
  property bool running: false
  property color foreground: Color.foreground
  property color accent: Color.accent
  property int dropCount: 11
  readonly property real fallScale: RainModel.previewFallScale(speed)

  clip: true
  enabled: false
  opacity: running ? 1 : 0
  visible: opacity > 0.02

  Behavior on opacity { NumberAnimation { duration: 140 } }

  readonly property var colors: {
    var list = RainModel.lookPreviewColors(look)
    if (list.length) return list
    return [
      Qt.rgba(foreground.r, foreground.g, foreground.b, 0.42),
      foreground,
      accent
    ]
  }

  property real t: 0

  FrameAnimation {
    running: root.running || root.opacity > 0.02
    onTriggered: root.t += frameTime * root.fallScale
  }

  Repeater {
    model: root.dropCount

    Rectangle {
      required property int index
      antialiasing: false
      width: 1 + (index % 2)
      height: 3 + (index % 4) * 2
      x: 3 + (index * 17 + index * 3) % Math.max(1, root.width - 6)
      y: {
        var span = root.height + height + 6
        if (span <= 0) return -height
        var period = 0.62 + (index % 5) * 0.11
        var phase = index * 0.17
        var u = (root.t / period + phase) % 1
        if (u < 0) u += 1
        return -height + u * span
      }
      color: root.colors[index % root.colors.length]
      opacity: index % 3 === 0 ? 1 : 0.62
      radius: 0.5
    }
  }
}
