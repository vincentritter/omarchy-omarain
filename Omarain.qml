import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "RainModel.js" as RainModel

Panel {
  id: root
  moduleName: "vincentritter.omarain"
  ipcTarget: "vincentritter.omarain"
  manageIpc: false

  readonly property string home: Quickshell.env("HOME")
  readonly property string modePath: home + "/.local/state/omarchy/omarain.json"
  readonly property var modes: RainModel.modeOptions()
  readonly property var speeds: RainModel.speedOptions()
  property string mode: "auto"
  property string speed: "calm"
  property var weatherCode: null
  property int cursorIndex: 0
  property int speedIndex: 0
  property string focusSection: "intensity"
  property bool cursorActive: false

  readonly property var sharedService: bar && bar.shell && typeof bar.shell.serviceFor === "function"
    ? bar.shell.serviceFor(moduleName) : null
  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  readonly property string rainGlyph: ""
  readonly property string heroStatusText: {
    if (mode === "auto") return RainModel.weatherHint(weatherCode)
    if (mode === "off") return "Paused"
    return RainModel.modeLabel(mode) + " rain"
  }

  function selectedIndex() {
    for (var i = 0; i < modes.length; i++) {
      if (modes[i].value === mode) return i
    }
    return 0
  }

  function selectedSpeedIndex() {
    for (var i = 0; i < speeds.length; i++) {
      if (speeds[i].value === speed) return i
    }
    return 0
  }

  function persistMerged(merged) {
    root.mode = merged.mode
    root.speed = merged.speed
    root.weatherCode = merged.weatherCode
    cursorIndex = selectedIndex()
    speedIndex = selectedSpeedIndex()
    if (!mkdirProc.running) mkdirProc.running = true
    modeFile.setText(RainModel.stateFileBody(merged.mode, merged.weatherCode, merged.speed))
  }

  function setMode(next) {
    var merged = RainModel.mergeState(modeFile.text(), next, root.weatherCode, root.speed)
    persistMerged(merged)
    if (sharedService && typeof sharedService.setMode === "function")
      sharedService.setMode(merged.mode)
  }

  function setSpeed(next) {
    var merged = RainModel.mergeState(modeFile.text(), root.mode, root.weatherCode, next)
    persistMerged(merged)
    if (sharedService && typeof sharedService.setSpeed === "function")
      sharedService.setSpeed(merged.speed)
  }

  function cycleMode() {
    setMode(RainModel.cycleMode(mode))
  }

  function moveCursor(dx, dy) {
    if (!cursorActive) {
      cursorActive = true
      cursorIndex = selectedIndex()
      speedIndex = selectedSpeedIndex()
      return
    }
    if (dy !== 0) {
      focusSection = dy > 0 ? "speed" : "intensity"
      return
    }
    if (focusSection === "speed") {
      var s = speedIndex + dx
      if (s < 0) s = 0
      if (s > speeds.length - 1) s = speeds.length - 1
      speedIndex = s
      return
    }
    var next = cursorIndex + dx
    if (next < 0) next = 0
    if (next > modes.length - 1) next = modes.length - 1
    cursorIndex = next
  }

  function activateCursor() {
    if (!cursorActive) return
    if (focusSection === "speed") {
      if (speedIndex < 0 || speedIndex >= speeds.length) return
      setSpeed(speeds[speedIndex].value)
      return
    }
    if (cursorIndex < 0 || cursorIndex >= modes.length) return
    setMode(modes[cursorIndex].value)
  }

  IpcHandler {
    target: "vincentritter.omarain"
    function open(): void { root.open() }
    function close(): void { root.close() }
    function toggle(): void { root.toggle() }
    function setMode(mode: string): void { root.setMode(mode) }
    function setSpeed(speed: string): void { root.setSpeed(speed) }
    function cycle(): void { root.cycleMode() }
  }

  Process {
    id: mkdirProc
    command: ["mkdir", "-p", root.home + "/.local/state/omarchy"]
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
      if (next.mode !== root.mode) {
        root.mode = next.mode
        if (!root.opened) root.cursorIndex = root.selectedIndex()
      }
      if (next.weatherCode != null) root.weatherCode = next.weatherCode
      root.speed = next.speed
      if (!root.opened) root.speedIndex = root.selectedSpeedIndex()
    }
    onLoadFailed: root.mode = "auto"
  }

  Connections {
    target: sharedService
    function onModeChanged() {
      if (!sharedService) return
      root.mode = RainModel.normalizeMode(sharedService.mode)
      if (!root.opened) root.cursorIndex = root.selectedIndex()
    }
    function onWeatherCodeChanged() {
      if (sharedService) root.weatherCode = sharedService.weatherCode
    }
    function onSpeedChanged() {
      if (!sharedService) return
      root.speed = RainModel.normalizeSpeed(sharedService.speed)
      if (!root.opened) root.speedIndex = root.selectedSpeedIndex()
    }
  }

  Timer {
    interval: 2000
    running: sharedService !== null
    repeat: true
    onTriggered: {
      var next = RainModel.normalizeMode(sharedService.mode)
      if (next !== root.mode) {
        root.mode = next
        if (!root.opened) root.cursorIndex = root.selectedIndex()
      }
      root.weatherCode = sharedService.weatherCode
      root.speed = RainModel.normalizeSpeed(sharedService.speed)
    }
  }

  Component.onCompleted: {
    cursorIndex = selectedIndex()
    if (sharedService) {
      mode = RainModel.normalizeMode(sharedService.mode)
      weatherCode = sharedService.weatherCode
      speed = RainModel.normalizeSpeed(sharedService.speed)
      cursorIndex = selectedIndex()
      speedIndex = selectedSpeedIndex()
    } else {
      modeFile.reload()
    }
  }

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: root.rainGlyph
    slotSize: Style.bar.iconSlot
    tooltipText: "Omarain"
    dimmed: root.mode === "off"
    onPressed: function(b) {
      if (b === Qt.RightButton || b === Qt.MiddleButton) root.cycleMode()
      else root.toggle()
    }
  }

  KeyboardPanel {
    id: panel
    anchorItem: button
    owner: root
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(420))
    contentHeight: panel.fittedContentHeight(column.implicitHeight)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onMoveRequested: function(dx, dy) {
        root.moveCursor(dx, dy)
      }
      onActivateRequested: root.activateCursor()
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }

      Column {
        id: column
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        spacing: Style.space(14)

        Item {
          width: parent.width
          implicitHeight: Math.max(heroIcon.implicitHeight, heroLabels.implicitHeight)

          Text {
            id: heroIcon
            textFormat: Text.PlainText
            text: root.rainGlyph
            color: root.bar.foreground
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.display
            anchors.left: parent.left
            anchors.verticalCenter: parent.verticalCenter
          }

          Column {
            id: heroLabels
            anchors.left: heroIcon.right
            anchors.leftMargin: Style.space(14)
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            spacing: Style.space(2)

            Text {
              text: "Omarain"
              color: root.bar.foreground
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.title
              font.bold: true
              elide: Text.ElideRight
              width: parent.width
            }

            Text {
              textFormat: Text.PlainText
              text: root.heroStatusText.toUpperCase()
              color: Qt.darker(root.bar.foreground, 1.4)
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.caption
              font.bold: true
              font.letterSpacing: 1.2
              elide: Text.ElideRight
              width: parent.width
            }
          }
        }

        PanelSeparator {
          foreground: root.bar.foreground
        }

        Column {
          width: parent.width
          spacing: Style.space(10)

          PanelSectionHeader {
            text: "INTENSITY"
            foreground: root.bar.foreground
            fontFamily: root.bar.fontFamily
          }

          Row {
            id: modeRow
            width: parent.width
            spacing: Style.space(6)

            readonly property real cellWidth: (width - spacing * (root.modes.length - 1)) / root.modes.length

            Repeater {
              model: root.modes
              Button {
                required property var modelData
                required property int index
                width: modeRow.cellWidth
                text: modelData.label
                fontSize: Style.font.bodySmall
                foreground: root.bar.foreground
                fontFamily: root.bar.fontFamily
                horizontalPadding: Style.spacing.controlPaddingX
                verticalPadding: Style.spacing.controlPaddingY + Style.space(2)
                bordered: true
                active: root.mode === modelData.value
                hasCursor: root.cursorActive && root.focusSection === "intensity" && root.cursorIndex === index
                onClicked: root.setMode(modelData.value)
                onHovered: function(h) {
                  if (h) {
                    root.cursorActive = true
                    root.focusSection = "intensity"
                    root.cursorIndex = index
                  }
                }
              }
            }
          }
        }

        Column {
          width: parent.width
          spacing: Style.space(10)

          PanelSectionHeader {
            text: "SPEED"
            foreground: root.bar.foreground
            fontFamily: root.bar.fontFamily
          }

          Row {
            id: speedRow
            width: parent.width
            spacing: Style.space(6)

            readonly property real cellWidth: (width - spacing * (root.speeds.length - 1)) / root.speeds.length

            Repeater {
              model: root.speeds
              Button {
                required property var modelData
                required property int index
                width: speedRow.cellWidth
                text: modelData.label
                fontSize: Style.font.bodySmall
                foreground: root.bar.foreground
                fontFamily: root.bar.fontFamily
                horizontalPadding: Style.spacing.controlPaddingX
                verticalPadding: Style.spacing.controlPaddingY + Style.space(2)
                bordered: true
                active: root.speed === modelData.value
                hasCursor: root.cursorActive && root.focusSection === "speed" && root.speedIndex === index
                onClicked: root.setSpeed(modelData.value)
                onHovered: function(h) {
                  if (h) {
                    root.cursorActive = true
                    root.focusSection = "speed"
                    root.speedIndex = index
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
