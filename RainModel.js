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

function normalizeMode(value) {
  var mode = String(value || "").replace(/^\s+|\s+$/g, "").toLowerCase()
  if (mode === "off" || mode === "light" || mode === "steady" || mode === "heavy" || mode === "auto")
    return mode
  return "auto"
}

function weatherTint(code) {
  var c = parseInt(String(code), 10)
  if (!isFinite(c)) return 1
  if (c >= 95) return 1.7
  if (c >= 80) return 1.5
  if (c >= 71) return 1.1
  if (c >= 61) return 1.35
  if (c >= 51) return 1.15
  if (c >= 45) return 0.95
  if (c >= 3) return 0.85
  if (c >= 2) return 0.85
  if (c >= 0) return 0.7
  return 1
}

function wanderAt(elapsed) {
  return 1 + 0.1 * Math.sin((Number(elapsed) || 0) * 2 * Math.PI / 72)
}

function resolveIntensity(mode, weatherCode, elapsed) {
  mode = normalizeMode(mode)
  if (mode === "off") return 0
  if (mode === "light") return 0.45
  if (mode === "heavy") return 1.55
  if (mode === "steady") return 1
  return clamp(1.35 * weatherTint(weatherCode) * wanderAt(elapsed), 0.75, 2.6)
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
  var out = { mode: "auto", weatherCode: null }
  try {
    var data = JSON.parse(String(raw || ""))
    if (!data || typeof data !== "object") return out
    out.mode = normalizeMode(data.mode)
    if (data.weatherCode != null && data.weatherCode !== "") {
      var code = Number(data.weatherCode)
      if (isFinite(code)) out.weatherCode = code
    }
    return out
  } catch (e) {
    return out
  }
}

function parseModeFile(raw) {
  return parseStateFile(raw).mode
}

function stateFileBody(mode, weatherCode) {
  var body = "{\n  \"mode\": \"" + normalizeMode(mode) + "\""
  if (weatherCode != null && isFinite(Number(weatherCode)))
    body += ",\n  \"weatherCode\": " + Number(weatherCode)
  return body + "\n}\n"
}

function modeFileBody(mode) {
  return stateFileBody(mode, null)
}

function mergeState(raw, mode, weatherCode) {
  var current = parseStateFile(raw)
  var nextMode = mode === undefined || mode === null || mode === "" ? current.mode : normalizeMode(mode)
  var nextCode = weatherCode != null && weatherCode !== "" && isFinite(Number(weatherCode))
    ? Number(weatherCode)
    : current.weatherCode
  return { mode: nextMode, weatherCode: nextCode }
}

function cycleMode(mode) {
  var modes = ["off", "light", "steady", "heavy", "auto"]
  var index = modes.indexOf(normalizeMode(mode))
  if (index < 0) return "auto"
  return modes[(index + 1) % modes.length]
}

function modeLabel(mode) {
  mode = normalizeMode(mode)
  if (mode === "off") return "Off"
  if (mode === "light") return "Light"
  if (mode === "heavy") return "Heavy"
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
    { value: "auto", label: "Auto" }
  ]
}

function forecastUrl(location) {
  var lat = location && location.latitude
  var lon = location && location.longitude
  if (lat != null && lon != null && isFinite(Number(lat)) && isFinite(Number(lon))) {
    return "https://api.open-meteo.com/v1/forecast"
      + "?latitude=" + encodeURIComponent(String(lat))
      + "&longitude=" + encodeURIComponent(String(lon))
      + "&current=weather_code"
      + "&forecast_days=1"
      + "&timezone=auto"
  }
  var name = location && location.name ? String(location.name) : ""
  if (name) return "https://wttr.in/" + encodeURIComponent(name) + "?format=j1"
  return "https://wttr.in/?format=j1"
}

function blankCell() {
  return {
    alive: false,
    kind: "drop",
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    vx: 0,
    vy: 0,
    trail: 1,
    role: "muted",
    alpha: 0,
    startAlpha: 0,
    life: 0,
    maxLife: 0
  }
}

function ensurePool(state) {
  var needed = state.dropTarget + state.dropTarget * 6
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
  if (role === "accent") return 0.88
  if (role === "foreground") return 0.62
  return 0.48
}

function trailFor(role) {
  if (role === "accent") return 4
  if (role === "foreground") return 3
  return 2
}

function clampDropX(state, x) {
  var snapped = snapToGrid(x, state.pixel)
  var maxX = Math.max(0, state.width - state.pixel)
  if (snapped < 0) return 0
  if (snapped > maxX) return snapToGrid(maxX, state.pixel)
  return snapped
}

function paintDrop(cell, state, spec) {
  var role = spec.role || "muted"
  cell.alive = true
  cell.kind = "drop"
  cell.role = role
  cell.x = clampDropX(state, spec.x)
  cell.y = spec.y
  cell.vx = 0
  cell.vy = spec.vy
  cell.trail = spec.trail != null ? spec.trail : trailFor(role)
  cell.w = state.pixel
  cell.h = state.pixel * cell.trail
  cell.alpha = spec.alpha != null ? spec.alpha : alphaFor(role)
  cell.startAlpha = cell.alpha
  cell.life = 1
  cell.maxLife = 1
}

function spawnDrop(state, spec) {
  spec = spec || {}
  var cell = freeCell(state)
  var role = spec.role || roleFor(dropCount(state), state.rng)
  paintDrop(cell, state, {
    role: role,
    x: spec.x != null ? spec.x : state.rng() * state.width,
    y: spec.y != null ? spec.y : state.rng() * (state.height + 80) - 80,
    vy: spec.vy != null ? spec.vy : 90 + state.rng() * 110,
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
  return cell
}

function splashFrom(state, drop) {
  var originX = drop.x
  var originY = Math.max(0, state.height - state.pixel)
  var role = drop.role
  drop.alive = false

  var splashCount = role === "accent" ? 4 : 2 + Math.floor(state.rng() * 3)
  for (var i = 0; i < splashCount; i++) {
    spawnBurst(state, {
      kind: "splash",
      role: role,
      x: originX + (state.rng() - 0.5) * state.pixel * 3,
      y: originY,
      vx: (state.rng() - 0.5) * 140,
      vy: -40 - state.rng() * 70,
      alpha: drop.startAlpha,
      life: 0.22 + state.rng() * 0.16
    })
  }

  if (role === "accent") {
    var sparkCount = 1 + Math.floor(state.rng() * 2)
    for (var s = 0; s < sparkCount; s++) {
      spawnBurst(state, {
        kind: "spark",
        role: "accent",
        x: originX + (state.rng() - 0.5) * state.pixel * 2,
        y: originY,
        vx: (state.rng() - 0.5) * 180,
        vy: -60 - state.rng() * 50,
        size: Math.max(2, state.pixel - 1),
        alpha: 0.9,
        life: 0.12 + state.rng() * 0.1
      })
    }
  }
}

function maintainDrops(state) {
  var missing = state.dropTarget - dropCount(state)
  for (var i = 0; i < missing; i++) {
    spawnDrop(state, {
      y: -state.rng() * 80 - state.pixel
    })
  }
}

function cullExtraDrops(state) {
  var extra = dropCount(state) - state.dropTarget
  for (var c = 0; extra > 0 && c < state.cells.length; c++) {
    if (state.cells[c].alive && state.cells[c].kind === "drop") {
      state.cells[c].alive = false
      extra--
    }
  }
}

function applyIntensity(state, intensity) {
  state.intensity = intensity
  state.dropTarget = dropTargetFor(state.width, intensity)
  ensurePool(state)
  cullExtraDrops(state)
  maintainDrops(state)
}

function syncIntensity(state) {
  applyIntensity(state, resolveIntensity(state.mode, state.weatherCode, state.elapsed))
}

function setMode(state, mode) {
  state.mode = normalizeMode(mode)
  syncIntensity(state)
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
    elapsed: 0,
    intensity: 1,
    dropTarget: 0,
    cells: [],
    rng: options.rng || mulberry32(seed)
  }
  if (!isFinite(state.weatherCode)) state.weatherCode = null
  syncIntensity(state)
  return state
}

function resize(state, width, height) {
  state.width = width
  state.height = height
  for (var i = 0; i < state.cells.length; i++) {
    var cell = state.cells[i]
    if (!cell.alive || cell.kind !== "drop") continue
    cell.x = clampDropX(state, cell.x)
    cell.w = state.pixel
    cell.h = state.pixel * cell.trail
  }
  syncIntensity(state)
}

function step(state, dt) {
  state.elapsed += dt
  if (state.mode === "auto") {
    var next = resolveIntensity("auto", state.weatherCode, state.elapsed)
    if (dropTargetFor(state.width, next) !== state.dropTarget)
      applyIntensity(state, next)
    else
      state.intensity = next
  }
  var gravity = 520
  for (var i = 0; i < state.cells.length; i++) {
    var cell = state.cells[i]
    if (!cell.alive) continue
    if (cell.kind === "drop") {
      cell.y += cell.vy * dt
      if (cell.y + cell.h >= state.height) splashFrom(state, cell)
      continue
    }
    cell.vy += gravity * dt
    cell.x += cell.vx * dt
    cell.y += cell.vy * dt
    cell.life -= dt
    if (cell.life <= 0 || cell.y > state.height + state.pixel) {
      cell.alive = false
      continue
    }
    cell.alpha = cell.startAlpha * (cell.life / cell.maxLife)
  }
  maintainDrops(state)
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
    setMode: setMode,
    setWeatherCode: setWeatherCode,
    configure: configure,
    weatherCodeFromPayload: weatherCodeFromPayload,
    parseLocationFile: parseLocationFile,
    parseStateFile: parseStateFile,
    parseModeFile: parseModeFile,
    mergeState: mergeState,
    stateFileBody: stateFileBody,
    modeFileBody: modeFileBody,
    forecastUrl: forecastUrl,
    cycleMode: cycleMode,
    modeLabel: modeLabel,
    weatherHint: weatherHint,
    modeOptions: modeOptions
  }
}
