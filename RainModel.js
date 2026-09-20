function mulberry32(seed) {
  var t = seed >>> 0
  return function () {
    t += 0x6D2B79F5
    var r = t
    r = Math.imul(r ^ (r >>> 15), r | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function snapToGrid(value, pixel) {
  var size = Number(pixel)
  if (!isFinite(size) || size <= 0) return 0
  var n = Number(value)
  if (!isFinite(n)) return 0
  return Math.floor(n / size) * size
}

function clamp(value, min, max) {
  var n = Number(value)
  if (!isFinite(n)) return min
  return Math.max(min, Math.min(max, n))
}

function normalizeSpeed(value) {
  var speed = String(value || "").replace(/^\s+|\s+$/g, "").toLowerCase()
  if (speed === "natural") return "natural"
  if (speed === "hyper" || speed === "hyper-gravity" || speed === "hypergravity") return "hyper"
  if (speed === "calm") return "calm"
  return "calm"
}

function speedScale(speed) {
  speed = normalizeSpeed(speed)
  if (speed === "natural") return 3.5
  if (speed === "hyper") return 16
  return 1
}

function speedLabel(speed) {
  speed = normalizeSpeed(speed)
  if (speed === "natural") return "Natural"
  if (speed === "hyper") return "Hyper-gravity"
  return "Calm"
}

function speedOptions() {
  return [
    { value: "calm", label: "Calm" },
    { value: "natural", label: "Natural" },
    { value: "hyper", label: "Hyper", tooltip: "Hyper-gravity" }
  ]
}

function normalizeLook(value) {
  var look = String(value || "").replace(/^\s+|\s+$/g, "").toLowerCase()
  if (look === "candy") return "candy"
  if (look === "matrix") return "matrix"
  if (look === "amber" || look === "crt") return "amber"
  if (look === "theme") return "theme"
  return "theme"
}

function lookLabel(look) {
  look = normalizeLook(look)
  if (look === "candy") return "Candy"
  if (look === "matrix") return "Matrix"
  if (look === "amber") return "Amber"
  return "Theme"
}

function lookOptions() {
  return [
    { value: "theme", label: "Theme" },
    { value: "candy", label: "Candy" },
    { value: "matrix", label: "Matrix" },
    { value: "amber", label: "Amber" }
  ]
}

function normalizeScript(value) {
  var script = String(value || "").replace(/^\s+|\s+$/g, "").toLowerCase()
  if (script === "glyphs" || script === "glyph" || script === "text" || script === "matrix")
    return "glyphs"
  return "pixels"
}

function cycleScript(script) {
  return normalizeScript(script) === "glyphs" ? "pixels" : "glyphs"
}

function usesGlyphs(look, script) {
  return normalizeLook(look) === "matrix" && normalizeScript(script) === "glyphs"
}

function defaultScriptForLook(look) {
  return normalizeLook(look) === "matrix" ? "glyphs" : "pixels"
}

function pickGlyph(rng) {
  var glyphs = "█▓▒░<>/ $*!?#|"
  var roll = rng ? rng() : Math.random()
  return glyphs.charAt(Math.floor(roll * glyphs.length)) || "░"
}

function glyphTrailCap(layer) {
  if (layer === 0) return 4
  if (layer === 1) return 6
  return 9
}

function pushGlyph(cell, rng) {
  var next = pickGlyph(rng)
  cell.glyph = next
  cell.trailGlyphs = (cell.trailGlyphs || "") + next
  var cap = glyphTrailCap(cell.layer)
  if (cell.trailGlyphs.length > cap)
    cell.trailGlyphs = cell.trailGlyphs.substring(cell.trailGlyphs.length - cap)
}

function candySwatches() {
  return [
    "#FF2BD6", "#00F0FF", "#FFE600", "#7CFF00", "#FF6B00",
    "#B14FFF", "#FF3B7C", "#00FFC2", "#4D7CFF", "#FF004D",
    "#FF8AD8", "#C8FF00"
  ]
}

function pickCandy(rng) {
  var swatches = candySwatches()
  var roll = rng ? rng() : Math.random()
  return swatches[Math.floor(roll * swatches.length)] || swatches[0]
}

function paletteHex(look, role) {
  look = normalizeLook(look)
  if (look === "theme") return ""
  var palettes = {
    candy: { muted: "#FF2BD6", foreground: "#00F0FF", accent: "#FFE600" },
    matrix: { muted: "#185318", foreground: "#92be92", accent: "#dbffdb" },
    amber: { muted: "#E08A00", foreground: "#FFC94A", accent: "#FFE7A0" }
  }
  var palette = palettes[look]
  if (!palette) return ""
  if (role === "accent") return palette.accent
  if (role === "muted") return palette.muted
  return palette.foreground
}

function lookSwatch(look) {
  look = normalizeLook(look)
  if (look === "theme") return ""
  return paletteHex(look, "accent")
}

function normalizeMode(value) {
  var mode = String(value || "").replace(/^\s+|\s+$/g, "").toLowerCase()
  if (mode === "off" || mode === "light" || mode === "steady" || mode === "heavy" || mode === "torrential" || mode === "auto")
    return mode
  return "auto"
}

function weatherTint(code) {
  var c = parseInt(String(code), 10)
  if (!isFinite(c)) return 0
  if (c >= 95) return 2.4
  if (c >= 82) return 1.9
  if (c >= 80) return 1.15
  if (c >= 71) return 0.7
  if (c >= 65) return 1.8
  if (c >= 61) return 1.1
  if (c >= 51) return 0.28
  return 0
}

function wanderAt(elapsed) {
  return 1 + 0.1 * Math.sin((Number(elapsed) || 0) * 2 * Math.PI / 72)
}

function resolveIntensity(mode, weatherCode, elapsed, precipitation) {
  mode = normalizeMode(mode)
  if (mode === "off") return 0
  if (mode === "light") return 0.45
  if (mode === "heavy") return 3.4
  if (mode === "torrential") return 8
  if (mode === "steady") return 1
  var tint = weatherTint(weatherCode)
  if (precipitation != null && precipitation !== "" && isFinite(Number(precipitation)) && Number(precipitation) <= 0)
    tint = 0
  return clamp(tint * wanderAt(elapsed), 0, 3.2)
}

function dropTargetFor(width, intensity) {
  var w = Number(width)
  if (!isFinite(w) || w <= 0) return 0
  if (intensity === undefined || intensity === null) intensity = 1
  var level = Number(intensity)
  if (!isFinite(level) || level <= 0) return 0
  return Math.max(0, Math.round(w / (62 / level)))
}

function wttrToWmo(code) {
  var c = parseInt(String(code), 10)
  if (!isFinite(c)) return null
  if (c === 113) return 0
  if (c === 116) return 2
  if (c === 119 || c === 122) return 3
  if (c === 143 || c === 248 || c === 260) return 45
  if (c === 200 || c === 386 || c === 389 || c === 392 || c === 395) return 95
  if (c === 329 || c === 332 || c === 335 || c === 338 || c === 371) return 73
  if (c === 308 || c === 356 || c === 359) return 65
  if (c === 266 || c === 293 || c === 296 || c === 299 || c === 302 || c === 305) return 51
  if (c === 176 || c === 263 || c === 353) return 80
  return 3
}

function windXFromPayload(raw) {
  var text = String(raw || "").replace(/^\s+|\s+$/g, "")
  if (!text) return 0
  try {
    var data = JSON.parse(text)
    var speed = 0
    var fromDeg = 0
    if (data && data.current) {
      if (data.current.wind_speed_10m != null) speed = Number(data.current.wind_speed_10m)
      if (data.current.wind_direction_10m != null) fromDeg = Number(data.current.wind_direction_10m)
    } else {
      var current = data && data.current_condition && data.current_condition[0]
      if (current) {
        if (current.windspeedKmph != null) speed = Number(current.windspeedKmph)
        if (current.winddirDegree != null) fromDeg = Number(current.winddirDegree)
      }
    }
    if (!isFinite(speed) || speed === 0) return 0
    if (!isFinite(fromDeg)) fromDeg = 0
    return -speed * Math.sin(fromDeg * Math.PI / 180) * 3.6
  } catch (e) {
    return 0
  }
}

function parseAccelLine(raw) {
  var parts = String(raw || "").replace(/^\s+|\s+$/g, "").split(/[\s,]+/)
  if (parts.length < 3) return null
  var x = Number(parts[0])
  var y = Number(parts[1])
  var z = Number(parts[2])
  if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return null
  return { x: x, y: y, z: z }
}

function tiltXFromAccel(x, y, z) {
  var ax = Number(x)
  var ay = Number(y)
  if (!isFinite(ax)) ax = 0
  if (!isFinite(ay)) ay = 0
  var lateral = Math.abs(ax) >= Math.abs(ay) ? ax : ay
  var dead = 0.55
  if (Math.abs(lateral) < dead) return 0
  var mag = lateral > 0 ? lateral - dead : lateral + dead
  if (mag > 8) mag = 8
  if (mag < -8) mag = -8
  return mag * 28
}

function smoothTilt(prev, next) {
  var a = Number(prev)
  var b = Number(next)
  if (!isFinite(b)) return isFinite(a) ? a : 0
  if (!isFinite(a)) return b
  return a * 0.8 + b * 0.2
}

function layerWind(layer) {
  if (layer === 0) return 1
  if (layer === 1) return 0.58
  return 0.28
}

function weatherCodeFromPayload(raw) {
  var text = String(raw || "").replace(/^\s+|\s+$/g, "")
  if (!text) return null
  try {
    var data = JSON.parse(text)
    if (data && data.current && data.current.weather_code != null) {
      var wmo = Number(data.current.weather_code)
      return isFinite(wmo) ? wmo : null
    }
    var current = data && data.current_condition && data.current_condition[0]
    if (current && current.weatherCode != null) return wttrToWmo(current.weatherCode)
    return null
  } catch (e) {
    return null
  }
}

function precipitationFromPayload(raw) {
  var text = String(raw || "").replace(/^\s+|\s+$/g, "")
  if (!text) return null
  try {
    var data = JSON.parse(text)
    if (data && data.current && data.current.precipitation != null) {
      var mm = Number(data.current.precipitation)
      return isFinite(mm) ? mm : null
    }
    var current = data && data.current_condition && data.current_condition[0]
    if (current && current.precipMM != null) {
      var wttr = Number(current.precipMM)
      return isFinite(wttr) ? wttr : null
    }
    return null
  } catch (e) {
    return null
  }
}

function coordsFrom(latitude, longitude, name) {
  var lat = parseFloat(latitude)
  var lon = parseFloat(longitude)
  if (isNaN(lat) || isNaN(lon)) return null
  return {
    name: typeof name === "string" ? name.replace(/^\s+|\s+$/g, "") : "",
    latitude: lat,
    longitude: lon
  }
}

function locationFromWttrPayload(raw) {
  var text = String(raw || "").replace(/^\s+|\s+$/g, "")
  if (!text) return null
  try {
    var data = JSON.parse(text)
    var area = data && data.nearest_area && data.nearest_area[0]
    if (!area) return null
    var name = ""
    if (area.areaName && area.areaName[0] && area.areaName[0].value)
      name = String(area.areaName[0].value)
    return coordsFrom(area.latitude, area.longitude, name)
  } catch (e) {
    return null
  }
}

function locationFromLocatePayload(raw) {
  var text = String(raw || "").replace(/^\s+|\s+$/g, "")
  if (!text) return null
  try {
    var data = JSON.parse(text)
    if (!data || typeof data !== "object") return null
    if (data.current && data.current.weather_code != null) return null
    var result = data.results && data.results[0]
    if (result) return coordsFrom(result.latitude, result.longitude, result.name)
    var wttr = locationFromWttrPayload(text)
    if (wttr) return wttr
    return coordsFrom(data.latitude, data.longitude, data.city || data.name)
  } catch (e) {
    return null
  }
}

function parseLocationFile(raw) {
  var unset = { name: "", latitude: null, longitude: null }
  try {
    var data = JSON.parse(String(raw || ""))
    if (!data || typeof data !== "object") return unset
    var latitude = parseFloat(data.latitude)
    var longitude = parseFloat(data.longitude)
    var hasCoordinates = !isNaN(latitude) && !isNaN(longitude)
    return {
      name: typeof data.name === "string" ? data.name.replace(/^\s+|\s+$/g, "") : "",
      latitude: hasCoordinates ? latitude : null,
      longitude: hasCoordinates ? longitude : null
    }
  } catch (e) {
    return unset
  }
}

function parseStateFile(raw) {
  var out = {
    mode: "auto",
    weatherCode: null,
    speed: "calm",
    look: "theme",
    script: "pixels",
    resumeMode: "auto",
    intensity: "steady"
  }
  try {
    var data = JSON.parse(String(raw || ""))
    if (!data || typeof data !== "object") return out
    out.mode = normalizeMode(data.mode)
    out.speed = normalizeSpeed(data.speed)
    out.look = normalizeLook(data.look)
    if (data.script == null || data.script === "")
      out.script = defaultScriptForLook(out.look)
    else
      out.script = normalizeScript(data.script)
    if (data.weatherCode != null && data.weatherCode !== "") {
      var code = Number(data.weatherCode)
      if (isFinite(code)) out.weatherCode = code
    }
    var resume = normalizeMode(data.resumeMode)
    out.resumeMode = resume === "off" ? "auto" : resume
    if (out.mode !== "off") out.resumeMode = out.mode
    out.intensity = normalizeIntensity(data.intensity)
    if (isManualIntensity(out.mode)) out.intensity = out.mode
    else if ((data.intensity == null || data.intensity === "") && out.mode === "off" && isManualIntensity(out.resumeMode))
      out.intensity = out.resumeMode
    return out
  } catch (e) {
    return out
  }
}

function parseModeFile(raw) {
  return parseStateFile(raw).mode
}

function stateFileBody(mode, weatherCode, speed, look, script, resumeMode, intensity) {
  var nextMode = normalizeMode(mode)
  var resume = normalizeMode(resumeMode)
  if (resume === "off") resume = "auto"
  if (nextMode !== "off") resume = nextMode
  var nextIntensity = normalizeIntensity(intensity)
  if (isManualIntensity(nextMode)) nextIntensity = nextMode
  var body = "{\n  \"mode\": \"" + nextMode + "\""
  if (weatherCode != null && isFinite(Number(weatherCode)))
    body += ",\n  \"weatherCode\": " + Number(weatherCode)
  body += ",\n  \"speed\": \"" + normalizeSpeed(speed) + "\""
  body += ",\n  \"look\": \"" + normalizeLook(look) + "\""
  body += ",\n  \"script\": \"" + normalizeScript(script) + "\""
  body += ",\n  \"resumeMode\": \"" + resume + "\""
  body += ",\n  \"intensity\": \"" + nextIntensity + "\""
  return body + "\n}\n"
}

function modeFileBody(mode) {
  return stateFileBody(mode, null, "calm", "theme", "pixels", mode)
}

function mergeState(raw, mode, weatherCode, speed, look, script, resumeMode, intensity) {
  var current = parseStateFile(raw)
  var nextMode = mode === undefined || mode === null || mode === "" ? current.mode : normalizeMode(mode)
  var nextCode = weatherCode != null && weatherCode !== "" && isFinite(Number(weatherCode))
    ? Number(weatherCode)
    : current.weatherCode
  var nextSpeed = speed === undefined || speed === null || speed === "" ? current.speed : normalizeSpeed(speed)
  var nextLook = look === undefined || look === null || look === "" ? current.look : normalizeLook(look)
  var nextScript = script === undefined || script === null || script === "" ? current.script : normalizeScript(script)
  var nextResume = resumeMode === undefined || resumeMode === null || resumeMode === ""
    ? current.resumeMode
    : normalizeMode(resumeMode)
  var nextIntensity = intensity === undefined || intensity === null || intensity === ""
    ? current.intensity
    : normalizeIntensity(intensity)
  if (nextResume === "off") nextResume = "auto"
  if (nextMode !== "off") nextResume = nextMode
  if (isManualIntensity(nextMode)) nextIntensity = nextMode
  return {
    mode: nextMode,
    weatherCode: nextCode,
    speed: nextSpeed,
    look: nextLook,
    script: nextScript,
    resumeMode: nextResume,
    intensity: nextIntensity
  }
}

function toggleOnOff(mode, resumeMode) {
  mode = normalizeMode(mode)
  var resume = normalizeMode(resumeMode)
  if (resume === "off") resume = "auto"
  if (mode === "off") return { mode: resume, resumeMode: resume }
  return { mode: "off", resumeMode: mode }
}

function cycleMode(mode) {
  var modes = ["off", "light", "steady", "heavy", "torrential", "auto"]
  var index = modes.indexOf(normalizeMode(mode))
  if (index < 0) return "auto"
  return modes[(index + 1) % modes.length]
}

function modeLabel(mode) {
  mode = normalizeMode(mode)
  if (mode === "off") return "Off"
  if (mode === "light") return "Light"
  if (mode === "heavy") return "Heavy"
  if (mode === "torrential") return "Torrential"
  if (mode === "auto") return "Auto"
  return "Steady"
}

function weatherHint(code) {
  var c = parseInt(String(code), 10)
  if (!isFinite(c)) return "Living"
  if (c >= 95) return "Thunder"
  if (c >= 85) return "Snow showers"
  if (c >= 80) return "Showers"
  if (c >= 71) return "Snow"
  if (c >= 61) return "Rain"
  if (c >= 51) return "Drizzle"
  if (c >= 45) return "Fog"
  if (c >= 3) return "Overcast"
  if (c >= 1) return "Cloudy"
  return "Clear"
}

function modeOptions() {
  return [
    { value: "off", label: "Off" },
    { value: "light", label: "Light" },
    { value: "steady", label: "Steady" },
    { value: "heavy", label: "Heavy" },
    { value: "torrential", label: "Torrential" },
    { value: "auto", label: "Auto" }
  ]
}

function intensityOptions() {
  return [
    { value: "light", label: "Light" },
    { value: "steady", label: "Steady" },
    { value: "heavy", label: "Heavy" },
    { value: "torrential", label: "Torrential" }
  ]
}

function isManualIntensity(mode) {
  mode = normalizeMode(mode)
  return mode === "light" || mode === "steady" || mode === "heavy" || mode === "torrential"
}

function normalizeIntensity(value) {
  var intensity = String(value || "").replace(/^\s+|\s+$/g, "").toLowerCase()
  if (intensity === "light" || intensity === "steady" || intensity === "heavy" || intensity === "torrential")
    return intensity
  return "steady"
}

function intensityIndex(value) {
  var intensity = normalizeIntensity(value)
  var options = intensityOptions()
  for (var i = 0; i < options.length; i++) {
    if (options[i].value === intensity) return i
  }
  return 1
}

function intensityFromIndex(index) {
  var options = intensityOptions()
  var i = Math.round(Number(index))
  if (!isFinite(i)) i = 1
  if (i < 0) i = 0
  if (i > options.length - 1) i = options.length - 1
  return options[i].value
}

function followWeatherActive(mode, resumeMode) {
  mode = normalizeMode(mode)
  if (mode === "auto") return true
  if (mode === "off") return normalizeMode(resumeMode) === "auto"
  return false
}

function applyFollowWeather(state, follow) {
  var mode = normalizeMode(state && state.mode)
  var intensity = normalizeIntensity(state && state.intensity)
  if (isManualIntensity(mode)) intensity = mode
  if (mode === "off") {
    return {
      mode: "off",
      intensity: intensity,
      resumeMode: follow ? "auto" : intensity
    }
  }
  if (follow) return { mode: "auto", intensity: intensity, resumeMode: "auto" }
  return { mode: intensity, intensity: intensity, resumeMode: intensity }
}

function applyIntensityChoice(state, next) {
  var intensity = normalizeIntensity(next)
  var mode = normalizeMode(state && state.mode)
  if (mode === "off") return { mode: "off", intensity: intensity, resumeMode: intensity }
  return { mode: intensity, intensity: intensity, resumeMode: intensity }
}

function panelSections(look) {
  var sections = ["power", "weather", "intensity", "speed", "look"]
  if (normalizeLook(look) === "matrix") sections.push("glyphs")
  return sections
}

function forecastUrl(location) {
  var lat = location && location.latitude
  var lon = location && location.longitude
  if (lat == null || lon == null || !isFinite(Number(lat)) || !isFinite(Number(lon))) return ""
  return "https://api.open-meteo.com/v1/forecast"
    + "?latitude=" + encodeURIComponent(String(lat))
    + "&longitude=" + encodeURIComponent(String(lon))
    + "&current=weather_code,wind_speed_10m,wind_direction_10m,precipitation"
    + "&forecast_days=1"
    + "&timezone=auto"
}

function locateUrl(location) {
  var name = location && location.name ? String(location.name).replace(/^\s+|\s+$/g, "") : ""
  if (name)
    return "https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(name) + "&count=1&language=en&format=json"
  return "https://get.geojs.io/v1/ip/geo.json"
}

function blankCell() {
  return {
    alive: false,
    kind: "drop",
    layer: 0,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    vx: 0,
    vy: 0,
    baseVy: 0,
    trail: 1,
    glyph: "",
    trailGlyphs: "",
    glyphStage: -1,
    look: "theme",
    script: "pixels",
    speedScale: 1,
    tint: "",
    role: "muted",
    alpha: 0,
    startAlpha: 0,
    targetAlpha: 0,
    bornY: 0,
    collapseAcc: 0,
    life: 0,
    maxLife: 0
  }
}

function ensurePool(state) {
  var n = Math.max(Math.round(state.dropTarget || 0), Math.round(state.dropTargetGoal || 0))
  var needed = n + Math.max(48, Math.round(n * 1.25))
  while (state.cells.length < needed) state.cells.push(blankCell())
}

function freeCell(state) {
  for (var i = 0; i < state.cells.length; i++) {
    if (!state.cells[i].alive) return state.cells[i]
  }
  var cell = blankCell()
  state.cells.push(cell)
  return cell
}

function dropCount(state) {
  var n = 0
  for (var i = 0; i < state.cells.length; i++) {
    if (state.cells[i].alive && state.cells[i].kind === "drop") n++
  }
  return n
}

function roleFor(index, rng) {
  var roll = rng()
  if (index % 7 === 0 || roll < 0.12) return "accent"
  if (roll < 0.4) return "foreground"
  return "muted"
}

function alphaFor(role) {
  if (role === "accent") return 1
  if (role === "foreground") return 0.9
  return 0.78
}

function trailFor(role) {
  if (role === "accent") return 4
  if (role === "foreground") return 3
  return 2
}

function pickLayer(rng) {
  var roll = rng()
  if (roll < 0.5) return 0
  if (roll < 0.82) return 1
  return 2
}

function layerSize(layer, pixel, rng) {
  var base = Math.max(1, pixel || 3)
  if (layer === 0) return rng() < 0.62 ? 1 : 2
  if (layer === 1) return Math.max(2, base - 1)
  return rng() < 0.22 ? base + 1 : base
}

function layerSpeed(layer, rng) {
  if (layer === 0) return 42 + rng() * 38
  if (layer === 1) return 98 + rng() * 52
  return 178 + rng() * 90
}

function layerTrail(layer, role) {
  var extra = role === "accent" ? 1 : 0
  if (layer === 0) return 1 + extra
  if (layer === 1) return 2 + extra
  return 3 + extra
}

function layerAlpha(layer) {
  if (layer === 0) return 0.7
  if (layer === 1) return 0.9
  return 1
}

function clampDropX(state, x, size) {
  var step = Math.max(1, size || state.pixel)
  var snapped = snapToGrid(x, step)
  var maxX = Math.max(0, state.width - step)
  if (snapped < 0) return 0
  if (snapped > maxX) return snapToGrid(maxX, step)
  return snapped
}

function paintDrop(cell, state, spec) {
  var role = spec.role || "muted"
  var layer = spec.layer != null ? spec.layer : 1
  var size = spec.size != null ? spec.size : layerSize(layer, state.pixel, state.rng)
  cell.alive = true
  cell.kind = "drop"
  cell.layer = layer
  cell.role = role
  cell.w = size
  cell.x = clampDropX(state, spec.x, size)
  cell.y = spec.y
  cell.vx = 0
  cell.look = spec.look || state.look || "theme"
  cell.script = spec.script || state.script || "pixels"
  cell.speedScale = spec.speedScale != null ? spec.speedScale : speedScale(state.speed)
  cell.baseVy = spec.vy
  cell.vy = spec.vy * cell.speedScale
  cell.trail = spec.trail != null ? spec.trail : layerTrail(layer, role)
  cell.h = size * cell.trail
  var baseAlpha = spec.alpha != null ? spec.alpha : alphaFor(role)
  cell.targetAlpha = spec.alpha != null ? spec.alpha : baseAlpha * layerAlpha(layer)
  cell.startAlpha = cell.targetAlpha
  cell.bornY = spec.y
  cell.alpha = spec.y < 0 ? 0 : cell.targetAlpha
  cell.glyph = spec.glyph || pickGlyph(state.rng)
  cell.trailGlyphs = cell.glyph
  cell.glyphStage = 0
  cell.collapseAcc = 0
  cell.tint = spec.tint || pickCandy(state.rng)
  cell.life = 1
  cell.maxLife = 1
}

function spawnDrop(state, spec) {
  spec = spec || {}
  var cell = freeCell(state)
  var role = spec.role || roleFor(dropCount(state), state.rng)
  var layer = spec.layer != null ? spec.layer : pickLayer(state.rng)
  paintDrop(cell, state, {
    role: role,
    layer: layer,
    size: spec.size,
    x: spec.x != null ? spec.x : state.rng() * state.width,
    y: spec.y != null ? spec.y : state.rng() * (state.height + 80) - 80,
    vy: spec.vy != null ? spec.vy : layerSpeed(layer, state.rng),
    trail: spec.trail,
    alpha: spec.alpha
  })
  return cell
}

function spawnBurst(state, spec) {
  var cell = freeCell(state)
  cell.alive = true
  cell.kind = spec.kind
  cell.role = spec.role
  cell.x = spec.x
  cell.y = spec.y
  cell.vx = spec.vx
  cell.vy = spec.vy
  cell.trail = 1
  cell.w = spec.size || state.pixel
  cell.h = spec.size || state.pixel
  cell.alpha = spec.alpha
  cell.startAlpha = spec.alpha
  cell.life = spec.life
  cell.maxLife = spec.life
  cell.tint = spec.tint || ""
  cell.look = spec.look || ""
  cell.script = spec.script || ""
  cell.speedScale = spec.speedScale != null ? spec.speedScale : 1
  return cell
}

function findPuddle(state, x, reach) {
  for (var i = 0; i < state.cells.length; i++) {
    var cell = state.cells[i]
    if (!cell.alive || cell.kind !== "puddle") continue
    if (Math.abs(cell.x - x) <= reach) return cell
  }
  return null
}

function collectPuddle(state, drop, originX, originY, size) {
  var existing = findPuddle(state, originX, size * 5)
  if (existing) {
    existing.life = Math.min(3.2, existing.life + 0.55)
    existing.maxLife = Math.max(existing.maxLife, existing.life)
    existing.w = Math.min(size * 8, existing.w + Math.max(1, size))
    existing.x = (existing.x + originX) / 2
    existing.y = originY
    existing.startAlpha = Math.min(1, existing.startAlpha + 0.12)
    existing.alpha = existing.startAlpha
    if (drop.tint) existing.tint = drop.tint
    return
  }
  var count = 1 + Math.floor(state.rng() * 2)
  for (var i = 0; i < count; i++) {
    spawnBurst(state, {
      kind: "puddle",
      role: drop.role,
      tint: drop.tint,
      look: drop.look,
      script: drop.script,
      speedScale: drop.speedScale,
      x: originX + (state.rng() - 0.5) * size * 2,
      y: originY,
      vx: 0,
      vy: 0,
      size: i === 0 ? size : Math.max(1, size - 1),
      alpha: 0.82,
      life: 1.5 + state.rng() * 1.2
    })
  }
}

function splashFrom(state, drop) {
  var originX = drop.x
  var size = Math.max(1, drop.w || state.pixel)
  var originY = Math.max(0, state.height - size)
  var role = drop.role
  var layer = drop.layer == null ? 1 : drop.layer
  drop.alive = false

  var splashCount = layer === 0
    ? 2 + Math.floor(state.rng() * 2)
    : (role === "accent" ? 5 + Math.floor(state.rng() * 3) : 3 + Math.floor(state.rng() * 4))
  for (var i = 0; i < splashCount; i++) {
    var speck = layer === 0 ? 1 : (state.rng() < 0.35 ? Math.max(1, size - 1) : size)
    spawnBurst(state, {
      kind: "splash",
      role: role,
      tint: drop.tint,
      look: drop.look,
      script: drop.script,
      speedScale: drop.speedScale,
      x: originX + (state.rng() - 0.5) * size * 5,
      y: originY,
      vx: (state.rng() - 0.5) * (layer === 0 ? 110 : 220),
      vy: -50 - state.rng() * (layer === 0 ? 70 : 130),
      size: speck,
      alpha: Math.min(1, drop.startAlpha + 0.15),
      life: 0.22 + state.rng() * 0.28
    })
  }

  var sparkChance = role === "accent" || (layer >= 1 && state.rng() < 0.35)
  if (sparkChance && layer >= 1) {
    var sparkCount = 1 + Math.floor(state.rng() * 3)
    for (var s = 0; s < sparkCount; s++) {
      spawnBurst(state, {
        kind: "spark",
        role: "accent",
        tint: drop.tint,
        look: drop.look,
        script: drop.script,
        speedScale: drop.speedScale,
        x: originX + (state.rng() - 0.5) * size * 3,
        y: originY,
        vx: (state.rng() - 0.5) * 260,
        vy: -80 - state.rng() * 90,
        size: Math.max(1, size - 1),
        alpha: 1,
        life: 0.16 + state.rng() * 0.18
      })
    }
  }

  collectPuddle(state, drop, originX, originY, size)
}

function gatherLive(state) {
  var live = state.live
  if (!live) {
    live = []
    state.live = live
  }
  var cells = state.cells
  var w = 0
  for (var i = 0; i < cells.length; i++) {
    if (cells[i].alive) live[w++] = cells[i]
  }
  live.length = w
}

function hasLive(state) {
  if (!state) return false
  if (state.live) return state.live.length > 0
  if (!state.cells) return false
  for (var i = 0; i < state.cells.length; i++) {
    if (state.cells[i].alive) return true
  }
  return false
}

function liveDropTarget(state) {
  return Math.round(state.dropTarget || 0)
}

function maintainDrops(state) {
  var missing = liveDropTarget(state) - dropCount(state)
  for (var i = 0; i < missing; i++) {
    spawnDrop(state, {
      y: -state.rng() * 80 - state.pixel
    })
  }
}

function cullExtraDrops(state) {
  var extra = dropCount(state) - liveDropTarget(state)
  for (var c = 0; extra > 0 && c < state.cells.length; c++) {
    if (state.cells[c].alive && state.cells[c].kind === "drop") {
      state.cells[c].alive = false
      extra--
    }
  }
}

function applyIntensity(state, intensity, immediate) {
  state.intensity = intensity
  state.dropTargetGoal = dropTargetFor(state.width, intensity)
  ensurePool(state)
  if (immediate) {
    state.dropTarget = state.dropTargetGoal
    cullExtraDrops(state)
    maintainDrops(state)
    return
  }
  if (state.dropTargetGoal === 0) state.dropTarget = 0
}

function easeDropTarget(state, dt) {
  var goal = state.dropTargetGoal
  if (goal === 0) {
    state.dropTarget = 0
    return
  }
  if (state.dropTarget === goal) return
  var t = 1 - Math.exp(-dt / 0.45)
  state.dropTarget += (goal - state.dropTarget) * t
  if (Math.abs(goal - state.dropTarget) < 0.5) state.dropTarget = goal
  ensurePool(state)
}

function syncIntensity(state, immediate) {
  applyIntensity(state, resolveIntensity(state.mode, state.weatherCode, state.elapsed, state.precipitation), immediate)
}

function setMode(state, mode) {
  state.mode = normalizeMode(mode)
  syncIntensity(state)
}

function setSpeed(state, speed) {
  state.speed = normalizeSpeed(speed)
}

function setWeatherCode(state, code) {
  var next = code == null || code === "" ? null : Number(code)
  state.weatherCode = isFinite(next) ? next : null
  if (state.mode === "auto") syncIntensity(state)
}

function configure(state, options) {
  options = options || {}
  if (options.mode !== undefined) state.mode = normalizeMode(options.mode)
  if (options.weatherCode !== undefined) {
    var next = options.weatherCode == null || options.weatherCode === "" ? null : Number(options.weatherCode)
    state.weatherCode = isFinite(next) ? next : null
  }
  if (options.windX !== undefined) {
    var wind = Number(options.windX)
    state.windX = isFinite(wind) ? wind : 0
  }
  if (options.tiltX !== undefined) {
    var tilt = Number(options.tiltX)
    state.tiltX = isFinite(tilt) ? tilt : 0
  }
  if (options.speed !== undefined) setSpeed(state, options.speed)
  if (options.look !== undefined) state.look = normalizeLook(options.look)
  if (options.script !== undefined) state.script = normalizeScript(options.script)
  if (options.precipitation !== undefined) {
    var precip = options.precipitation == null || options.precipitation === "" ? null : Number(options.precipitation)
    state.precipitation = isFinite(precip) ? precip : null
  }
  syncIntensity(state)
}

function createState(width, height, options) {
  options = options || {}
  var pixel = options.pixel || 3
  var seed = options.seed == null ? 1 : options.seed
  var mode = normalizeMode(options.mode || "auto")
  var state = {
    width: width,
    height: height,
    pixel: pixel,
    mode: mode,
    weatherCode: options.weatherCode == null ? null : Number(options.weatherCode),
    precipitation: options.precipitation == null || options.precipitation === "" ? null : Number(options.precipitation),
    windX: options.windX == null ? 0 : Number(options.windX),
    tiltX: options.tiltX == null ? 0 : Number(options.tiltX),
    speed: normalizeSpeed(options.speed || "calm"),
    look: normalizeLook(options.look || "theme"),
    script: normalizeScript(options.script || defaultScriptForLook(options.look || "theme")),
    elapsed: 0,
    intensity: 1,
    dropTarget: 0,
    dropTargetGoal: 0,
    cells: [],
    live: [],
    rng: options.rng || mulberry32(seed)
  }
  if (!isFinite(state.weatherCode)) state.weatherCode = null
  if (!isFinite(state.precipitation)) state.precipitation = null
  if (!isFinite(state.windX)) state.windX = 0
  if (!isFinite(state.tiltX)) state.tiltX = 0
  syncIntensity(state, true)
  gatherLive(state)
  return state
}

function resize(state, width, height) {
  state.width = width
  state.height = height
  for (var i = 0; i < state.cells.length; i++) {
    var cell = state.cells[i]
    if (!cell.alive || cell.kind !== "drop") continue
    cell.x = clampDropX(state, cell.x, cell.w)
  }
  syncIntensity(state, true)
}

function fadeDrop(cell) {
  var span = 40
  var fallen = cell.y - cell.bornY
  var fade = fallen <= 0 ? 0 : (fallen >= span ? 1 : fallen / span)
  cell.alpha = cell.targetAlpha * fade
}

function wrapDropX(state, cell) {
  var width = state.width
  if (width <= 0) return
  if (cell.x > width) cell.x -= width + cell.w
  if (cell.x + cell.w < 0) cell.x += width + cell.w
}

function step(state, dt) {
  state.elapsed += dt
  if (state.mode === "auto") {
    var next = resolveIntensity("auto", state.weatherCode, state.elapsed, state.precipitation)
    var goal = dropTargetFor(state.width, next)
    if (goal !== state.dropTargetGoal || Math.abs(next - state.intensity) > 0.03)
      applyIntensity(state, next)
  }
  easeDropTarget(state, dt)
  var fieldScale = speedScale(state.speed)
  var wind = (state.windX || 0) + (state.tiltX || 0)
  for (var i = 0; i < state.cells.length; i++) {
    var cell = state.cells[i]
    if (!cell.alive) continue
    var scale = cell.speedScale || fieldScale
    if (cell.kind === "drop") {
      var fall = (cell.baseVy || cell.vy) * scale
      cell.vy = fall
      cell.y += fall * dt
      if (wind !== 0) {
        cell.x += wind * layerWind(cell.layer) * dt
        wrapDropX(state, cell)
      }
      if (cell.alpha !== cell.targetAlpha) fadeDrop(cell)
      if (usesGlyphs(cell.look, cell.script)) {
        if (cell.y + cell.h >= state.height) {
          cell.y = state.height - cell.h
          if (cell.trailGlyphs && cell.trailGlyphs.length > 1) {
            cell.collapseAcc = (cell.collapseAcc || 0) + dt
            while (cell.collapseAcc >= 0.05 && cell.trailGlyphs.length > 1) {
              cell.collapseAcc -= 0.05
              cell.trailGlyphs = cell.trailGlyphs.substring(1)
              cell.glyph = cell.trailGlyphs.charAt(cell.trailGlyphs.length - 1)
            }
            if (cell.trailGlyphs.length > 1) continue
          }
          splashFrom(state, cell)
          continue
        }
        var stage = Math.floor(Math.max(0, cell.y - cell.bornY) / 10)
        if (stage !== cell.glyphStage) {
          cell.glyphStage = stage
          pushGlyph(cell, state.rng)
        }
        continue
      }
      if (cell.y + cell.h >= state.height) splashFrom(state, cell)
      continue
    }
    if (cell.kind === "puddle") {
      cell.life -= dt
      cell.y = state.height - cell.h
      cell.vx = 0
      cell.vy = 0
      if (cell.life <= 0) {
        cell.alive = false
        continue
      }
      cell.alpha = cell.startAlpha * (cell.life / cell.maxLife)
      continue
    }
    cell.vy += 520 * scale * dt
    cell.x += cell.vx * dt
    cell.y += cell.vy * dt
    if (cell.kind === "splash" && cell.vy > 0 && cell.y + cell.h >= state.height) {
      cell.y = state.height - cell.h
      cell.vy *= -0.32
      cell.vx *= 0.7
    }
    cell.life -= dt
    if (cell.life <= 0 || cell.y > state.height + state.pixel) {
      cell.alive = false
      continue
    }
    cell.alpha = cell.startAlpha * (cell.life / cell.maxLife)
  }
  maintainDrops(state)
  gatherLive(state)
}

if (typeof module !== "undefined") {
  module.exports = {
    snapToGrid: snapToGrid,
    dropTargetFor: dropTargetFor,
    normalizeMode: normalizeMode,
    resolveIntensity: resolveIntensity,
    weatherTint: weatherTint,
    createState: createState,
    spawnDrop: spawnDrop,
    step: step,
    resize: resize,
    hasLive: hasLive,
    setMode: setMode,
    setSpeed: setSpeed,
    setWeatherCode: setWeatherCode,
    normalizeSpeed: normalizeSpeed,
    speedScale: speedScale,
    speedLabel: speedLabel,
    speedOptions: speedOptions,
    normalizeLook: normalizeLook,
    lookLabel: lookLabel,
    lookOptions: lookOptions,
    lookSwatch: lookSwatch,
    paletteHex: paletteHex,
    pickCandy: pickCandy,
    normalizeScript: normalizeScript,
    cycleScript: cycleScript,
    usesGlyphs: usesGlyphs,
    pickGlyph: pickGlyph,
    configure: configure,
    weatherCodeFromPayload: weatherCodeFromPayload,
    precipitationFromPayload: precipitationFromPayload,
    locationFromWttrPayload: locationFromWttrPayload,
    locationFromLocatePayload: locationFromLocatePayload,
    windXFromPayload: windXFromPayload,
    parseAccelLine: parseAccelLine,
    tiltXFromAccel: tiltXFromAccel,
    smoothTilt: smoothTilt,
    parseLocationFile: parseLocationFile,
    parseStateFile: parseStateFile,
    parseModeFile: parseModeFile,
    mergeState: mergeState,
    toggleOnOff: toggleOnOff,
    stateFileBody: stateFileBody,
    modeFileBody: modeFileBody,
    forecastUrl: forecastUrl,
    locateUrl: locateUrl,
    cycleMode: cycleMode,
    modeLabel: modeLabel,
    weatherHint: weatherHint,
    modeOptions: modeOptions,
    intensityOptions: intensityOptions,
    isManualIntensity: isManualIntensity,
    normalizeIntensity: normalizeIntensity,
    intensityIndex: intensityIndex,
    intensityFromIndex: intensityFromIndex,
    followWeatherActive: followWeatherActive,
    applyFollowWeather: applyFollowWeather,
    applyIntensityChoice: applyIntensityChoice,
    panelSections: panelSections
  }
}
