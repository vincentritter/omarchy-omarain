import QtQuick
import qs.Commons

Item {
  id: root

  property real iconSize: Style.font.icon
  property color color: Color.foreground

  readonly property real u: iconSize / 32

  implicitWidth: iconSize
  implicitHeight: iconSize
  width: iconSize
  height: iconSize

  component Drop: Rectangle {
    property real px
    property real py
    property real pw
    property real ph
    property real pr
    property real po: 1

    x: px * root.u
    y: py * root.u
    width: Math.max(1, pw * root.u)
    height: Math.max(1, ph * root.u)
    radius: Math.max(0.5, pr * root.u)
    color: root.color
    opacity: po
  }

  Drop { px: 8; py: 6; pw: 3; ph: 6; pr: 0.6; po: 0.38 }
  Drop { px: 14.5; py: 4; pw: 4; ph: 9; pr: 0.7 }
  Drop { px: 22; py: 8; pw: 2.5; ph: 5; pr: 0.5; po: 0.62 }
  Drop { px: 10.5; py: 16; pw: 3; ph: 7; pr: 0.6; po: 0.72 }
  Drop { px: 18; py: 15; pw: 2; ph: 4; pr: 0.4; po: 0.45 }
  Drop { px: 7; py: 25; pw: 2; ph: 2; pr: 0.4; po: 0.5 }
  Drop { px: 16; py: 26; pw: 3; ph: 2; pr: 0.4; po: 0.85 }
  Drop { px: 23; py: 24; pw: 1.5; ph: 1.5; pr: 0.3; po: 0.4 }
}
