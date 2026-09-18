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
  readonly property var looks: RainModel.lookOptions()
  readonly property var sections: ["intensity", "speed", "look"]
  property string mode: "auto"
  property string speed: "calm"
  property string look: "theme"
  property string script: "pixels"
  property string resumeMode: "auto"
  property double matrixClickAt: 0
  property var weatherCode: null
  property int cursorIndex: 0
  property int speedIndex: 0
  property int lookIndex: 0
  property string focusSection: "intensity"
  property bool cursorActive: false

  readonly property var sharedService: bar && bar.shell && typeof bar.shell.serviceFor === "function"
    ? bar.shell.serviceFor(moduleName) : null
  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

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
    root.look = merged.look
    root.script = merged.script
    root.resumeMode = merged.resumeMode
    root.weatherCode = merged.weatherCode
    cursorIndex = selectedIndex()
    speedIndex = selectedSpeedIndex()
    lookIndex = selectedLookIndex()
    if (!mkdirProc.running) mkdirProc.running = true
    modeFile.setText(RainModel.stateFileBody(merged.mode, merged.weatherCode, merged.speed, merged.look, merged.script, merged.resumeMode))
  }

  function selectedLookIndex() {
    for (var i = 0; i < looks.length; i++) {
      if (looks[i].value === look) return i
    }
    return 0
  }

  function setMode(next) {
    var merged = RainModel.mergeState(modeFile.text(), next, root.weatherCode, root.speed, root.look, root.script)
    persistMerged(merged)
    if (sharedService && typeof sharedService.setMode === "function")
      sharedService.setMode(merged.mode)
  }

  function setSpeed(next) {
    var merged = RainModel.mergeState(modeFile.text(), root.mode, root.weatherCode, next, root.look, root.script)
    persistMerged(merged)
    if (sharedService && typeof sharedService.setSpeed === "function")
      sharedService.setSpeed(merged.speed)
  }

  function setLook(next) {
    var look = RainModel.normalizeLook(next)
    var script = look === "matrix" ? "glyphs" : root.script
    var merged = RainModel.mergeState(modeFile.text(), root.mode, root.weatherCode, root.speed, look, script)
    persistMerged(merged)
    if (sharedService && typeof sharedService.setLook === "function")
      sharedService.setLook(merged.look)
    if (sharedService && typeof sharedService.setScript === "function")
      sharedService.setScript(merged.script)
  }

  function toggleMatrixScript() {
    var merged = RainModel.mergeState(
      modeFile.text(),
      "matrix",
      root.weatherCode,
      root.speed,
      "matrix",
      RainModel.cycleScript(root.script)
    )
    persistMerged(merged)
    if (sharedService && typeof sharedService.setLook === "function")
      sharedService.setLook("matrix")
    if (sharedService && typeof sharedService.setScript === "function")
      sharedService.setScript(merged.script)
  }

  function cycleMode() {
    setMode(RainModel.cycleMode(mode))
  }

  function toggleRain() {
    var next = RainModel.toggleOnOff(root.mode, root.resumeMode)
    var merged = RainModel.mergeState(modeFile.text(), next.mode, root.weatherCode, root.speed, root.look, root.script, next.resumeMode)
    persistMerged(merged)
    if (sharedService && typeof sharedService.setMode === "function")
      sharedService.setMode(merged.mode)
  }

  function moveCursor(dx, dy) {
    if (!cursorActive) {
      cursorActive = true
      cursorIndex = selectedIndex()
      speedIndex = selectedSpeedIndex()
      lookIndex = selectedLookIndex()
      return
    }
    if (dy !== 0) {
      var section = sections.indexOf(focusSection)
      if (section < 0) section = 0
      section += dy > 0 ? 1 : -1
      if (section < 0) section = 0
      if (section > sections.length - 1) section = sections.length - 1
      focusSection = sections[section]
      return
    }
    if (focusSection === "speed") {
      var s = speedIndex + dx
      if (s < 0) s = 0
      if (s > speeds.length - 1) s = speeds.length - 1
      speedIndex = s
      return
    }
    if (focusSection === "look") {
      var l = lookIndex + dx
      if (l < 0) l = 0
      if (l > looks.length - 1) l = looks.length - 1
      lookIndex = l
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
    if (focusSection === "look") {
      if (lookIndex < 0 || lookIndex >= looks.length) return
      setLook(looks[lookIndex].value)
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
    function setLook(look: string): void { root.setLook(look) }
    function cycle(): void { root.cycleMode() }
    function toggleRain(): void { root.toggleRain() }
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
      root.look = next.look
      if (!root.opened) root.lookIndex = root.selectedLookIndex()
      root.script = next.script
      root.resumeMode = next.resumeMode
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
    function onLookChanged() {
      if (!sharedService) return
      root.look = RainModel.normalizeLook(sharedService.look)
      if (!root.opened) root.lookIndex = root.selectedLookIndex()
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
      root.look = RainModel.normalizeLook(sharedService.look)
    }
  }

  Component.onCompleted: {
    cursorIndex = selectedIndex()
    if (sharedService) {
      mode = RainModel.normalizeMode(sharedService.mode)
      weatherCode = sharedService.weatherCode
      speed = RainModel.normalizeSpeed(sharedService.speed)
      look = RainModel.normalizeLook(sharedService.look)
      cursorIndex = selectedIndex()
      speedIndex = selectedSpeedIndex()
      lookIndex = selectedLookIndex()
    } else {
      modeFile.reload()
    }
  }

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    slotSize: Style.bar.iconSlot
    tooltipText: "Omarain"
    dimmed: root.mode === "off"
    iconComponent: Component {
      Item {
        OmarainIcon {
          anchors.centerIn: parent
          iconSize: Style.bar.iconCanvas
          color: root.bar.foreground
        }
      }
    }
    onPressed: function(b) {
      if (b === Qt.RightButton) root.toggleRain()
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
    contentWidth: panel.fittedContentWidth(Style.space(520))
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

          OmarainIcon {
            id: heroIcon
            anchors.left: parent.left
            anchors.verticalCenter: parent.verticalCenter
            iconSize: Style.space(32)
            color: root.bar.foreground
            opacity: root.mode === "off" ? 0.45 : 1
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

        Column {
          width: parent.width
          spacing: Style.space(10)

          PanelSectionHeader {
            text: "LOOK"
            foreground: root.bar.foreground
            fontFamily: root.bar.fontFamily
          }

          Row {
            id: lookRow
            width: parent.width
            spacing: Style.space(6)

            readonly property real cellWidth: (width - spacing * (root.looks.length - 1)) / root.looks.length

            Repeater {
              model: root.looks
              Button {
                required property var modelData
                required property int index
                width: lookRow.cellWidth
                text: modelData.label
                fontSize: Style.font.bodySmall
                foreground: root.bar.foreground
                fontFamily: root.bar.fontFamily
                horizontalPadding: Style.spacing.controlPaddingX
                verticalPadding: Style.spacing.controlPaddingY + Style.space(2)
                bordered: true
                active: root.look === modelData.value
                hasCursor: root.cursorActive && root.focusSection === "look" && root.lookIndex === index
                onClicked: {
                  if (modelData.value !== "matrix") {
                    root.setLook(modelData.value)
                    return
                  }
                  var now = Date.now()
                  if (root.look === "matrix" && now - root.matrixClickAt < 400) {
                    root.toggleMatrixScript()
                    root.matrixClickAt = 0
                    return
                  }
                  root.matrixClickAt = now
                  if (root.look !== "matrix") root.setLook("matrix")
                }
                onHovered: function(h) {
                  if (h) {
                    root.cursorActive = true
                    root.focusSection = "look"
                    root.lookIndex = index
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
