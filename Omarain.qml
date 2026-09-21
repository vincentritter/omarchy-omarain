import QtQuick
import QtQuick.Controls
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
  readonly property string helper: String(Qt.resolvedUrl("state-io.py")).replace(/^file:\/\//, "")

  function helperCmd(args) {
    return ["/usr/bin/python3", "-I", "-S", root.helper].concat(args)
  }
  readonly property var speeds: RainModel.speedOptions()
  readonly property var looks: RainModel.lookOptions()
  readonly property color foreground: bar ? bar.foreground : Color.foreground
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family
  readonly property bool followWeather: RainModel.followWeatherActive(mode, resumeMode)
  readonly property var sections: RainModel.panelSections(look, followWeather)
  readonly property bool headerHasCursor: cursorActive && focusSection === "power"
  readonly property string toggleHint: mode === "off" ? "Turn rain on" : "Turn rain off"
  readonly property color dim: Qt.darker(foreground, 1.4)
  readonly property string repoUrl: "https://github.com/vincentritter/omarchy-omarain"
  readonly property string siteUrl: "https://vincentritter.com?ts=omarain"
  property bool helpOpen: false
  property bool pendingHelpOpen: false
  property string mode: "auto"
  property string speed: "calm"
  property string look: "theme"
  property string script: "pixels"
  property string resumeMode: "auto"
  property string intensity: "steady"
  property var weatherCode: null
  property int speedIndex: 0
  property int lookIndex: 0
  property string focusSection: "power"
  property bool cursorActive: false

  readonly property var sharedService: bar && bar.shell && typeof bar.shell.serviceFor === "function"
    ? bar.shell.serviceFor(moduleName) : null
  readonly property string displayedSpeed: sharedService
    ? RainModel.normalizeSpeed(sharedService.speed)
    : RainModel.normalizeSpeed(speed)
  readonly property string displayedLook: sharedService
    ? RainModel.normalizeLook(sharedService.look)
    : RainModel.normalizeLook(look)
  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  readonly property string heroStatusText: {
    if (mode === "auto") return RainModel.weatherHint(weatherCode)
    if (mode === "off") return "Paused"
    return RainModel.modeLabel(mode) + " rain"
  }

  function showHelp(open) {
    var next = open === true
    if (helpOpen === next || pageFlip.running) return
    pendingHelpOpen = next
    pageFlip.restart()
  }

  function liveSnapshot() {
    if (sharedService) {
      return {
        mode: RainModel.normalizeMode(sharedService.mode),
        weatherCode: sharedService.weatherCode,
        speed: RainModel.normalizeSpeed(sharedService.speed),
        look: RainModel.normalizeLook(sharedService.look),
        script: RainModel.normalizeScript(sharedService.script),
        resumeMode: RainModel.normalizeMode(sharedService.resumeMode),
        intensity: RainModel.normalizeIntensity(sharedService.intensity)
      }
    }
    return {
      mode: root.mode,
      weatherCode: root.weatherCode,
      speed: root.speed,
      look: root.look,
      script: root.script,
      resumeMode: root.resumeMode,
      intensity: root.intensity
    }
  }

  function persistMerged(merged) {
    root.mode = merged.mode
    root.speed = merged.speed
    root.look = merged.look
    root.script = merged.script
    root.resumeMode = merged.resumeMode
    root.intensity = merged.intensity
    root.weatherCode = merged.weatherCode
    speedIndex = RainModel.speedChipIndex(merged.speed)
    lookIndex = selectedLookIndex()
    if (root.look !== "matrix" && root.focusSection === "glyphs")
      root.focusSection = "look"
    if (RainModel.followWeatherActive(merged.mode, merged.resumeMode) && root.focusSection === "intensity")
      root.focusSection = "weather"
    if (sharedService && typeof sharedService.syncFromPanel === "function")
      sharedService.syncFromPanel(merged)
    else {
      stateWrite.pending = RainModel.stateFileBody(merged.mode, merged.weatherCode, merged.speed, merged.look, merged.script, merged.resumeMode, merged.intensity)
      stateWrite.running = false
      stateWrite.running = true
    }
  }

  function selectedSpeedIndex() {
    return RainModel.speedChipIndex(displayedSpeed)
  }

  function selectedLookIndex() {
    for (var i = 0; i < looks.length; i++) {
      if (looks[i].value === look) return i
    }
    return 0
  }

  function currentStateText() {
    var s = liveSnapshot()
    return RainModel.stateFileBody(s.mode, s.weatherCode, s.speed, s.look, s.script, s.resumeMode, s.intensity)
  }

  function setMode(next) {
    var s = liveSnapshot()
    var merged = RainModel.mergeState(currentStateText(), next, s.weatherCode, s.speed, s.look, s.script, s.resumeMode, s.intensity)
    persistMerged(merged)
  }

  function setFollowWeather(follow) {
    var s = liveSnapshot()
    var applied = RainModel.applyFollowWeather({
      mode: s.mode,
      intensity: s.intensity,
      resumeMode: s.resumeMode
    }, follow)
    var merged = RainModel.mergeState(currentStateText(), applied.mode, s.weatherCode, s.speed, s.look, s.script, applied.resumeMode, applied.intensity)
    persistMerged(merged)
  }

  function setIntensity(next) {
    var s = liveSnapshot()
    var applied = RainModel.applyIntensityChoice({
      mode: s.mode,
      intensity: s.intensity,
      resumeMode: s.resumeMode
    }, next)
    var merged = RainModel.mergeState(currentStateText(), applied.mode, s.weatherCode, s.speed, s.look, s.script, applied.resumeMode, applied.intensity)
    persistMerged(merged)
  }

  function setSpeed(next) {
    var s = liveSnapshot()
    var merged = RainModel.mergeState(currentStateText(), s.mode, s.weatherCode, next, s.look, s.script, s.resumeMode, s.intensity)
    persistMerged(merged)
  }

  function setLook(next) {
    var s = liveSnapshot()
    var look = RainModel.normalizeLook(next)
    var script = s.script
    if (look === "matrix" && s.look !== "matrix") script = "glyphs"
    var merged = RainModel.mergeState(currentStateText(), s.mode, s.weatherCode, s.speed, look, script, s.resumeMode, s.intensity)
    persistMerged(merged)
  }

  function setGlyphs(on) {
    var s = liveSnapshot()
    if (s.look !== "matrix") return
    var merged = RainModel.mergeState(currentStateText(), s.mode, s.weatherCode, s.speed, "matrix", on ? "glyphs" : "pixels", s.resumeMode, s.intensity)
    persistMerged(merged)
  }

  function cycleMode() {
    setMode(RainModel.cycleMode(liveSnapshot().mode))
  }

  function toggleRain() {
    var s = liveSnapshot()
    var next = RainModel.toggleOnOff(s.mode, s.resumeMode)
    var merged = RainModel.mergeState(currentStateText(), next.mode, s.weatherCode, s.speed, s.look, s.script, next.resumeMode, s.intensity)
    persistMerged(merged)
  }

  function clampSection() {
    if (sections.indexOf(focusSection) >= 0) return
    if (focusSection === "intensity") {
      focusSection = "speed"
      return
    }
    if (focusSection === "glyphs") {
      focusSection = "look"
      return
    }
    focusSection = sections[0]
  }

  function moveCursor(dx, dy) {
    if (!cursorActive) {
      cursorActive = true
      speedIndex = selectedSpeedIndex()
      lookIndex = selectedLookIndex()
      return
    }
    clampSection()
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
    if (focusSection === "intensity" && !root.followWeather) {
      setIntensity(RainModel.intensityFromIndex(RainModel.intensityIndex(root.intensity) + dx))
    }
  }

  function activateCursor() {
    if (!cursorActive) return
    clampSection()
    if (focusSection === "power") {
      toggleRain()
      return
    }
    if (focusSection === "weather") {
      setFollowWeather(!root.followWeather)
      return
    }
    if (focusSection === "glyphs") {
      setGlyphs(RainModel.normalizeScript(root.script) !== "glyphs")
      return
    }
    if (focusSection === "speed") {
      if (speedIndex < 0 || speedIndex >= speeds.length) return
      setSpeed(speeds[speedIndex].value)
      return
    }
    if (focusSection === "look") {
      if (lookIndex < 0 || lookIndex >= looks.length) return
      setLook(looks[lookIndex].value)
    }
  }

  IpcHandler {
    target: "vincentritter.omarain"
    function open(): void { root.open() }
    function close(): void { root.close() }
    function toggle(): void { root.toggle() }
    function toggleRain(): void { root.toggleRain() }
  }

  Process {
    id: stateWrite
    property string pending: ""
    stdinEnabled: true
    command: root.helperCmd(["write", "omarain.json"])
    onStarted: {
      write(pending)
      stdinEnabled = false
    }
  }

  Process {
    id: stateRead
    command: root.helperCmd(["read", "omarain.json"])
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.applyStateText(String(text || ""))
    }
  }

  FileView {
    id: modeFile
    path: root.modePath
    preload: false
    blockAllReads: true
    watchChanges: true
    printErrors: false
    onFileChanged: {
      stateRead.running = false
      stateRead.running = true
    }
  }

  function applyStateText(raw) {
    var next = RainModel.parseStateFile(raw)
    root.mode = next.mode
    root.speed = next.speed
    root.look = next.look
    root.script = next.script
    root.resumeMode = next.resumeMode
    root.intensity = next.intensity
    if (next.weatherCode != null) root.weatherCode = next.weatherCode
    if (!(root.cursorActive && root.focusSection === "speed"))
      root.speedIndex = RainModel.speedChipIndex(next.speed)
    if (!(root.cursorActive && root.focusSection === "look"))
      root.lookIndex = root.selectedLookIndex()
  }

  function applyServiceState() {
    if (!sharedService) return
    root.mode = RainModel.normalizeMode(sharedService.mode)
    root.weatherCode = sharedService.weatherCode
    root.speed = RainModel.normalizeSpeed(sharedService.speed)
    root.look = RainModel.normalizeLook(sharedService.look)
    root.script = RainModel.normalizeScript(sharedService.script)
    root.resumeMode = RainModel.normalizeMode(sharedService.resumeMode)
    root.intensity = RainModel.normalizeIntensity(sharedService.intensity)
    if (!root.opened) {
      root.speedIndex = root.selectedSpeedIndex()
      root.lookIndex = root.selectedLookIndex()
    }
  }

  Connections {
    target: sharedService
    function onModeChanged() { root.applyServiceState() }
    function onWeatherCodeChanged() { root.applyServiceState() }
    function onSpeedChanged() { root.applyServiceState() }
    function onLookChanged() { root.applyServiceState() }
    function onScriptChanged() { root.applyServiceState() }
    function onResumeModeChanged() { root.applyServiceState() }
    function onIntensityChanged() { root.applyServiceState() }
  }

  Timer {
    interval: 2000
    running: sharedService !== null
    repeat: true
    onTriggered: root.applyServiceState()
  }

  onOpenedChanged: {
    if (opened) {
      applyServiceState()
      stateRead.running = false
      stateRead.running = true
      speedIndex = selectedSpeedIndex()
      lookIndex = selectedLookIndex()
      return
    }
    pageFlip.stop()
    helpOpen = false
    pendingHelpOpen = false
    if (cardRotation) cardRotation.angle = 0
  }

  SequentialAnimation {
    id: pageFlip
    NumberAnimation {
      target: cardRotation
      property: "angle"
      from: 0
      to: 90
      duration: 130
      easing.type: Easing.InQuad
    }
    ScriptAction {
      script: {
        root.helpOpen = root.pendingHelpOpen
        cardRotation.angle = -90
        if (panelFlick) panelFlick.contentY = 0
      }
    }
    NumberAnimation {
      target: cardRotation
      property: "angle"
      from: -90
      to: 0
      duration: 170
      easing.type: Easing.OutQuad
    }
    ScriptAction {
      script: Qt.callLater(function() { keyCatcher.forceActiveFocus() })
    }
  }

  onSharedServiceChanged: applyServiceState()

  Component.onCompleted: {
    applyServiceState()
    stateRead.running = true
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
    contentWidth: panel.fittedContentWidth(Style.space(380))
    contentHeight: panel.fittedContentHeight(
      root.helpOpen ? helpPage.implicitHeight : column.implicitHeight,
      Style.space(560)
    )

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onMoveRequested: function(dx, dy) {
        if (!root.helpOpen) root.moveCursor(dx, dy)
      }
      onActivateRequested: if (!root.helpOpen) root.activateCursor()
      onCloseRequested: {
        if (root.helpOpen) root.showHelp(false)
        else root.close()
      }
      onTabRequested: function(direction) { root.switchPanel(direction) }

      Item {
        id: pageCard
        anchors.fill: parent
        transform: Rotation {
          id: cardRotation
          origin.x: pageCard.width / 2
          origin.y: pageCard.height / 2
          axis.x: 0
          axis.y: 1
          axis.z: 0
        }

      Flickable {
        id: panelFlick
        visible: !root.helpOpen
        anchors.fill: parent
        contentWidth: width
        contentHeight: column.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        flickableDirection: Flickable.VerticalFlick
        interactive: contentHeight > height
        ScrollBar.vertical: ScrollBar { policy: ScrollBar.AsNeeded }

        Column {
          id: column
          width: panelFlick.width
          spacing: Style.space(12)

          Item {
            id: header
            width: parent.width
            implicitHeight: hero.implicitHeight
            readonly property bool ringVisible: root.headerHasCursor
            function focusHero() {
              root.cursorActive = true
              root.focusSection = "power"
            }

            PanelHero {
              id: hero
              width: parent.width
              title: "Omarain"
              meta: root.heroStatusText
              foreground: root.foreground
              fontFamily: root.fontFamily
              iconOpacity: root.mode === "off" ? 0.45 : 1
              iconComponent: Component {
                OmarainIcon {
                  iconSize: Style.font.display
                  color: root.foreground
                }
              }
              trailingControl: Component {
                Row {
                  spacing: Style.space(6)
                  height: Math.max(helpButton.implicitHeight, powerSwitch.implicitHeight)

                  PanelActionButton {
                    id: helpButton
                    anchors.verticalCenter: parent.verticalCenter
                    iconText: "󰋗"
                    tooltipText: "About Omarain"
                    foreground: hero.foreground
                    fontFamily: hero.fontFamily
                    onClicked: root.showHelp(true)
                  }

                  ToggleSwitch {
                    id: powerSwitch
                    anchors.verticalCenter: parent.verticalCenter
                    checked: root.mode !== "off"
                    hasCursor: header.ringVisible
                    foreground: hero.foreground
                    onHovered: function(on) { if (on) header.focusHero() }
                    onToggled: root.toggleRain()

                    PanelToolTip {
                      visible: powerSwitch.containsMouse
                      text: root.toggleHint
                      fontFamily: hero.fontFamily
                    }
                  }
                }
              }
            }
          }

          PanelSeparator {
            foreground: root.foreground
          }

          Toggle {
            width: parent.width
            label: "Follow weather"
            description: "Rain at the weather widget's location while it is raining outside."
            checked: root.followWeather
            hasCursor: root.cursorActive && root.focusSection === "weather"
            foreground: root.foreground
            fontFamily: root.fontFamily
            onClicked: root.setFollowWeather(!root.followWeather)
            onHovered: function(h) {
              if (h) {
                root.cursorActive = true
                root.focusSection = "weather"
              }
            }
          }

          Column {
            visible: !root.followWeather
            width: parent.width
            spacing: Style.space(6)

            Item {
              width: parent.width
              implicitHeight: Math.max(intensityHeader.implicitHeight, intensityValue.implicitHeight)

              PanelSectionHeader {
                id: intensityHeader
                text: "INTENSITY"
                foreground: root.foreground
                fontFamily: root.fontFamily
                anchors.left: parent.left
                anchors.verticalCenter: parent.verticalCenter
              }

              Text {
                id: intensityValue
                textFormat: Text.PlainText
                text: RainModel.modeLabel(root.intensity)
                color: Qt.darker(root.foreground, 1.4)
                font.family: root.fontFamily
                font.pixelSize: Style.font.caption
                font.bold: true
                anchors.right: parent.right
                anchors.rightMargin: Style.space(6)
                anchors.verticalCenter: parent.verticalCenter
              }
            }

            CursorSurface {
              id: intensitySliderRow
              width: parent.width
              height: intensitySlider.implicitHeight + Style.spacing.controlGap
              hasCursor: root.cursorActive && root.focusSection === "intensity"
              foreground: root.foreground
              outline: true

              PanelSlider {
                id: intensitySlider
                bar: root.bar
                anchors.fill: parent
                anchors.leftMargin: Style.space(6)
                anchors.rightMargin: Style.space(6)
                minimum: 0
                maximum: 3
                step: 1
                integer: true
                tickCount: 4
                value: RainModel.intensityIndex(root.intensity)
                onMoved: function(v) {
                  root.setIntensity(RainModel.intensityFromIndex(v))
                }
              }

              HoverHandler {
                onHoveredChanged: if (hovered) {
                  root.cursorActive = true
                  root.focusSection = "intensity"
                }
              }
            }
          }

          Column {
            width: parent.width
            spacing: Style.space(10)

            PanelSectionHeader {
              text: "SPEED"
              foreground: root.foreground
              fontFamily: root.fontFamily
            }

            Row {
              id: speedRow
              width: parent.width
              spacing: Style.space(6)

              readonly property real cellWidth: (width - spacing * (root.speeds.length - 1)) / root.speeds.length

              Repeater {
                model: root.speeds
                Item {
                  required property var modelData
                  required property int index
                  width: speedRow.cellWidth
                  implicitHeight: speedChip.implicitHeight
                  height: speedChip.implicitHeight

                  Button {
                    id: speedChip
                    width: parent.width
                    text: modelData.label
                    tooltipText: modelData.tooltip || ""
                    fontSize: Style.font.bodySmall
                    foreground: root.foreground
                    fontFamily: root.fontFamily
                    horizontalPadding: Style.spacing.controlPaddingX
                    verticalPadding: Style.spacing.controlPaddingY + Style.space(2)
                    bordered: true
                    selected: root.displayedSpeed === modelData.value
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

                  LookRain {
                    anchors.fill: speedChip
                    anchors.margins: 2
                    look: root.look
                    speed: modelData.value
                    running: speedChip.hasCursor
                    foreground: root.foreground
                    accent: Color.accent
                    z: 1
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
              foreground: root.foreground
              fontFamily: root.fontFamily
            }

            Row {
              id: lookRow
              width: parent.width
              spacing: Style.space(6)

              readonly property real cellWidth: (width - spacing * (root.looks.length - 1)) / root.looks.length

              Repeater {
                model: root.looks
                Item {
                  required property var modelData
                  required property int index
                  width: lookRow.cellWidth
                  implicitHeight: lookChip.implicitHeight
                  height: lookChip.implicitHeight

                  Button {
                    id: lookChip
                    width: parent.width
                    text: modelData.label
                    tooltipText: modelData.tooltip || ""
                    fontSize: Style.font.caption
                    foreground: root.foreground
                    fontFamily: root.fontFamily
                    horizontalPadding: Style.space(6)
                    verticalPadding: Style.spacing.controlPaddingY + Style.space(4)
                    bordered: true
                    selected: root.displayedLook === modelData.value
                    hasCursor: root.cursorActive && root.focusSection === "look" && root.lookIndex === index
                    onClicked: root.setLook(modelData.value)
                    onHovered: function(h) {
                      if (h) {
                        root.cursorActive = true
                        root.focusSection = "look"
                        root.lookIndex = index
                      }
                    }
                  }

                  LookRain {
                    anchors.fill: lookChip
                    anchors.margins: 2
                    look: modelData.value
                    speed: root.displayedSpeed
                    running: lookChip.hasCursor
                    foreground: root.foreground
                    accent: Color.accent
                    z: 1
                  }

                  Row {
                    id: lookStripe
                    anchors.left: lookChip.left
                    anchors.right: lookChip.right
                    anchors.bottom: lookChip.bottom
                    anchors.leftMargin: Style.space(8)
                    anchors.rightMargin: Style.space(8)
                    anchors.bottomMargin: Style.space(5)
                    height: 2
                    enabled: false
                    spacing: 0
                    z: 2
                    opacity: root.look === modelData.value ? 1 : 0.55

                    readonly property var colors: {
                      var stripe = RainModel.lookSwatches(modelData.value)
                      return stripe.length ? stripe : [root.foreground]
                    }

                    Repeater {
                      model: lookStripe.colors.length
                      Rectangle {
                        required property int index
                        width: Math.max(1, Math.floor(lookStripe.width / lookStripe.colors.length))
                        height: lookStripe.height
                        enabled: false
                        color: lookStripe.colors[index]
                      }
                    }
                  }
                }
              }
            }
          }

          Toggle {
            visible: root.look === "matrix"
            width: parent.width
            label: "Glyphs"
            description: "Fall as Matrix characters instead of pixels."
            checked: RainModel.usesGlyphs(root.look, root.script)
            hasCursor: root.cursorActive && root.focusSection === "glyphs"
            foreground: root.foreground
            fontFamily: root.fontFamily
            onClicked: root.setGlyphs(!RainModel.usesGlyphs(root.look, root.script))
            onHovered: function(h) {
              if (h) {
                root.cursorActive = true
                root.focusSection = "glyphs"
              }
            }
          }
        }
      }

      Column {
        id: helpPage
        visible: root.helpOpen
        width: parent.width
        spacing: Style.space(12)

        Item {
          width: parent.width
          implicitHeight: Math.max(helpBackButton.implicitHeight, helpLabels.implicitHeight)

          PanelActionButton {
            id: helpBackButton
            anchors.left: parent.left
            anchors.verticalCenter: parent.verticalCenter
            iconText: "󰁍"
            tooltipText: "Back"
            foreground: root.foreground
            fontFamily: root.fontFamily
            onClicked: root.showHelp(false)
          }

          Column {
            id: helpLabels
            anchors.left: helpBackButton.right
            anchors.leftMargin: Style.space(10)
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            spacing: Style.space(3)

            Text {
              textFormat: Text.PlainText
              text: "ABOUT"
              color: root.foreground
              font.family: root.fontFamily
              font.pixelSize: Style.font.title
              font.bold: true
            }
          }
        }

        PanelSeparator {
          foreground: root.foreground
        }

        Text {
          width: parent.width
          textFormat: Text.PlainText
          text: "A quiet rain overlay for Omarchy, by Vincent Ritter."
          color: root.dim
          font.family: root.fontFamily
          font.pixelSize: Style.font.body
          wrapMode: Text.WordWrap
        }

        Column {
          width: parent.width
          spacing: Style.space(8)

          HelpCreditLine {
            prefix: "BUILT BY "
            linkText: "VINCENT RITTER"
            url: root.siteUrl
            tracking: 1.2
          }

          HelpCreditLine {
            prefix: "View this plugin on "
            linkText: "GitHub"
            url: root.repoUrl
          }
        }
      }
      }
    }
  }

  component HelpCreditLine: Row {
    id: creditLine

    property string prefix: ""
    property string linkText: ""
    property string url: ""
    property real tracking: 0

    spacing: 0

    Text {
      textFormat: Text.PlainText
      text: creditLine.prefix
      color: root.dim
      font.family: root.fontFamily
      font.pixelSize: Style.font.caption
      font.bold: true
      font.letterSpacing: creditLine.tracking
    }

    HelpLink {
      text: creditLine.linkText
      url: creditLine.url
      tracking: creditLine.tracking
    }
  }

  component HelpLink: Text {
    id: helpLink

    property string url: ""
    property real tracking: 0

    color: helpLinkMouse.containsMouse ? root.foreground : root.dim
    font.family: root.fontFamily
    font.pixelSize: Style.font.caption
    font.bold: true
    font.underline: true
    font.letterSpacing: tracking
    textFormat: Text.PlainText

    MouseArea {
      id: helpLinkMouse
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      onClicked: {
        if (!RainModel.openUrlAllowed(helpLink.url)) return
        Quickshell.execDetached(["/usr/bin/xdg-open", "--", helpLink.url])
      }
    }
  }
}
