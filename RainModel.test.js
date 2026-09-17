const test = require("node:test")
const assert = require("node:assert/strict")
const RainModel = require("./RainModel.js")

function ofKind(state, kind) {
  return state.cells.filter(function (cell) { return cell.alive && cell.kind === kind })
}

test("snapToGrid lands on the pixel grid", () => {
  assert.equal(RainModel.snapToGrid(10, 3), 9)
  assert.equal(RainModel.snapToGrid(0, 3), 0)
  assert.equal(RainModel.snapToGrid(11, 4), 8)
})

test("createState sizes a sparse drop field from the screen width", () => {
  const small = RainModel.createState(800, 600, { seed: 1 })
  const wide = RainModel.createState(1920, 1080, { seed: 1 })
  assert.ok(small.dropTarget >= 6)
  assert.ok(wide.dropTarget > small.dropTarget)
  assert.ok(wide.dropTarget < 80)
  assert.equal(small.pixel, 3)
})

test("createState fills the field with drops already in flight", () => {
  const state = RainModel.createState(1280, 720, { seed: 7 })
  const drops = ofKind(state, "drop")
  assert.equal(drops.length, state.dropTarget)
  drops.forEach(function (drop) {
    assert.ok(drop.w >= 1)
    assert.equal(drop.x % drop.w, 0)
    assert.ok(drop.x >= 0)
    assert.ok(drop.x < state.width)
    assert.ok(["muted", "foreground", "accent"].indexOf(drop.role) !== -1)
    assert.ok(drop.vy > 0)
  })
})

test("a field mixes droplet sizes including specks smaller than the base pixel", () => {
  const state = RainModel.createState(1920, 1080, { seed: 12, pixel: 4 })
  const drops = ofKind(state, "drop")
  const widths = {}
  drops.forEach(function (drop) { widths[drop.w] = true })
  assert.ok(Object.keys(widths).length >= 2)
  assert.ok(drops.some(function (drop) { return drop.w < state.pixel }))
})

test("drops sit on far, mid, and near layers", () => {
  const state = RainModel.createState(1920, 1080, { seed: 15, pixel: 4 })
  const layers = {}
  ofKind(state, "drop").forEach(function (drop) { layers[drop.layer] = true })
  assert.equal(layers[0], true)
  assert.equal(layers[1], true)
  assert.equal(layers[2], true)
})

test("near drops fall faster than far drops", () => {
  const state = RainModel.createState(1920, 1080, { seed: 21, pixel: 4 })
  const drops = ofKind(state, "drop")
  const far = drops.filter(function (drop) { return drop.layer === 0 })
  const near = drops.filter(function (drop) { return drop.layer === 2 })
  assert.ok(far.length > 0)
  assert.ok(near.length > 0)
  const farMax = Math.max.apply(null, far.map(function (drop) { return drop.vy }))
  const nearMin = Math.min.apply(null, near.map(function (drop) { return drop.vy }))
  assert.ok(nearMin > farMax)
})

test("a slice of drops use the accent role", () => {
  const state = RainModel.createState(1920, 1080, { seed: 3 })
  const drops = ofKind(state, "drop")
  const accents = drops.filter(function (drop) { return drop.role === "accent" })
  assert.ok(accents.length >= 1)
  assert.ok(accents.length < drops.length * 0.4)
})

test("step moves drops downward", () => {
  const state = RainModel.createState(640, 480, { seed: 11 })
  const drop = ofKind(state, "drop")[0]
  drop.y = 12
  drop.vy = 120
  RainModel.step(state, 0.2)
  assert.equal(drop.kind, "drop")
  assert.ok(drop.y > 12)
})

test("a drop that hits the floor becomes a splash", () => {
  const state = RainModel.createState(400, 200, { seed: 2, pixel: 4, mode: "steady" })
  state.cells.forEach(function (cell) { cell.alive = false })
  state.dropTarget = 0
  state.dropTargetGoal = 0
  RainModel.spawnDrop(state, { x: 40, y: 196, vy: 80, role: "muted", layer: 1 })
  RainModel.step(state, 0.1)
  assert.equal(ofKind(state, "drop").length, 0)
  const splashes = ofKind(state, "splash")
  assert.ok(splashes.length >= 2)
  assert.ok(splashes.length <= 4)
  splashes.forEach(function (splash) {
    assert.equal(splash.role, "muted")
    assert.ok(splash.life > 0)
  })
})

test("an accent drop splashes with extra spark specks", () => {
  const state = RainModel.createState(400, 200, { seed: 4, pixel: 4, mode: "steady" })
  state.cells.forEach(function (cell) { cell.alive = false })
  state.dropTarget = 0
  state.dropTargetGoal = 0
  RainModel.spawnDrop(state, { x: 80, y: 196, vy: 80, role: "accent", layer: 2 })
  RainModel.step(state, 0.1)
  const splashes = ofKind(state, "splash")
  const sparks = ofKind(state, "spark")
  assert.ok(splashes.length >= 3)
  assert.ok(sparks.length >= 1)
  sparks.forEach(function (spark) {
    assert.equal(spark.role, "accent")
  })
})

test("splash particles fade and then vanish", () => {
  const state = RainModel.createState(400, 200, { seed: 5, pixel: 4, mode: "steady" })
  state.cells.forEach(function (cell) { cell.alive = false })
  state.dropTarget = 0
  state.dropTargetGoal = 0
  RainModel.spawnDrop(state, { x: 20, y: 196, vy: 80, role: "foreground", layer: 1 })
  RainModel.step(state, 0.05)
  const splashes = ofKind(state, "splash")
  assert.ok(splashes.length > 0)
  const startAlpha = splashes[0].alpha
  for (var i = 0; i < 40; i++) RainModel.step(state, 0.05)
  assert.equal(ofKind(state, "splash").length, 0)
  assert.equal(ofKind(state, "spark").length, 0)
  assert.ok(startAlpha > 0)
})

test("a fallen drop is replaced so rain keeps falling", () => {
  const state = RainModel.createState(400, 200, { seed: 8, pixel: 4, mode: "steady" })
  state.cells.forEach(function (cell) { cell.alive = false })
  state.dropTarget = 1
  state.dropTargetGoal = 1
  RainModel.spawnDrop(state, { x: 40, y: 196, vy: 80, role: "muted", layer: 1 })
  RainModel.step(state, 0.1)
  const drops = ofKind(state, "drop")
  assert.equal(drops.length, 1)
  assert.ok(drops[0].y < 0)
})

test("resize keeps the drop field matched to the new width", () => {
  const state = RainModel.createState(800, 600, { seed: 9 })
  RainModel.resize(state, 1920, 1080)
  assert.equal(state.width, 1920)
  assert.equal(state.height, 1080)
  assert.equal(ofKind(state, "drop").length, state.dropTarget)
})

test("unknown modes fall back to auto", () => {
  assert.equal(RainModel.normalizeMode("auto"), "auto")
  assert.equal(RainModel.normalizeMode("heavy"), "heavy")
  assert.equal(RainModel.normalizeMode(""), "auto")
  assert.equal(RainModel.normalizeMode("nope"), "auto")
})

test("fixed modes keep a constant intensity", () => {
  assert.equal(RainModel.resolveIntensity("off"), 0)
  assert.equal(RainModel.resolveIntensity("light"), 0.45)
  assert.equal(RainModel.resolveIntensity("steady"), 1)
  assert.equal(RainModel.resolveIntensity("heavy"), 1.55)
})

test("clear weather tints auto quieter than a storm, never off", () => {
  const clear = RainModel.resolveIntensity("auto", 0, 0)
  const storm = RainModel.resolveIntensity("auto", 95, 0)
  assert.ok(clear >= 0.7)
  assert.ok(storm > clear)
  assert.ok(storm <= 2.6)
})

test("auto with no weather is denser than steady", () => {
  assert.ok(RainModel.resolveIntensity("auto", null, 0) > RainModel.resolveIntensity("steady"))
})

test("auto wander breathes intensity over time", () => {
  const a = RainModel.resolveIntensity("auto", null, 0)
  const b = RainModel.resolveIntensity("auto", null, 18)
  assert.notEqual(Math.round(a * 100), Math.round(b * 100))
})

test("heavier intensity packs more drops onto the same width", () => {
  const light = RainModel.dropTargetFor(1800, 0.45)
  const steady = RainModel.dropTargetFor(1800, 1)
  const heavy = RainModel.dropTargetFor(1800, 1.55)
  assert.equal(RainModel.dropTargetFor(1800, 0), 0)
  assert.ok(light > 0)
  assert.ok(light < steady)
  assert.ok(steady < heavy)
})

test("off culls falling drops", () => {
  const state = RainModel.createState(800, 600, { seed: 1 })
  assert.ok(ofKind(state, "drop").length > 0)
  RainModel.setMode(state, "off")
  assert.equal(state.dropTarget, 0)
  assert.equal(ofKind(state, "drop").length, 0)
})

test("auto step retargets the field as the wander moves", () => {
  const state = RainModel.createState(1800, 900, { seed: 2, mode: "auto" })
  const start = state.dropTarget
  for (var i = 0; i < 800; i++) RainModel.step(state, 0.05)
  assert.notEqual(state.dropTarget, start)
})

test("new drops fade in over the first stretch of fall", () => {
  const state = RainModel.createState(400, 200, { seed: 1, pixel: 4, mode: "steady" })
  state.cells.forEach(function (cell) { cell.alive = false })
  state.dropTarget = 0
  state.dropTargetGoal = 0
  const drop = RainModel.spawnDrop(state, { x: 40, y: -20, vy: 80, role: "muted", layer: 1 })
  assert.ok(drop.targetAlpha > 0)
  assert.ok(drop.alpha < drop.targetAlpha * 0.5)
  for (var i = 0; i < 15; i++) RainModel.step(state, 0.05)
  assert.ok(drop.alpha >= drop.targetAlpha * 0.99)
})

test("west wind leans far drops more than near drops", () => {
  const windX = RainModel.windXFromPayload(JSON.stringify({
    current: { weather_code: 3, wind_speed_10m: 24, wind_direction_10m: 270 }
  }))
  assert.ok(windX > 0)
  const wttr = RainModel.windXFromPayload(JSON.stringify({
    current_condition: [{ weatherCode: "119", windspeedKmph: "24", winddirDegree: "270" }]
  }))
  assert.ok(wttr > 0)

  const state = RainModel.createState(800, 400, { seed: 3, pixel: 4, mode: "steady" })
  state.cells.forEach(function (cell) { cell.alive = false })
  state.dropTarget = 0
  state.dropTargetGoal = 0
  state.windX = 30
  const far = RainModel.spawnDrop(state, { x: 200, y: 20, vy: 50, layer: 0, role: "muted" })
  const near = RainModel.spawnDrop(state, { x: 200, y: 20, vy: 50, layer: 2, role: "muted" })
  const farX = far.x
  const nearX = near.x
  RainModel.step(state, 0.2)
  assert.ok(Math.abs(far.x - farX) > Math.abs(near.x - nearX))
})

test("raising intensity eases the drop count instead of snapping", () => {
  const state = RainModel.createState(800, 600, { seed: 1, mode: "off" })
  assert.equal(Math.round(state.dropTarget), 0)
  RainModel.setMode(state, "steady")
  const goal = state.dropTargetGoal
  assert.ok(goal > 0)
  assert.ok(state.dropTarget < goal)
  RainModel.step(state, 0.05)
  assert.ok(state.dropTarget > 0)
  assert.ok(state.dropTarget < goal)
  for (var i = 0; i < 50; i++) RainModel.step(state, 0.05)
  assert.equal(Math.round(state.dropTarget), goal)
})

test("Open-Meteo and wttr payloads yield a weather code", () => {
  assert.equal(RainModel.weatherCodeFromPayload(JSON.stringify({
    current: { weather_code: 61 }
  })), 61)
  assert.equal(RainModel.weatherCodeFromPayload(JSON.stringify({
    current_condition: [{ weatherCode: "266" }]
  })), 51)
  assert.equal(RainModel.weatherCodeFromPayload(""), null)
})

test("weather location file yields coordinates when present", () => {
  const loc = RainModel.parseLocationFile(JSON.stringify({
    name: "Krakow",
    latitude: 50.06,
    longitude: 19.94
  }))
  assert.equal(loc.name, "Krakow")
  assert.equal(loc.latitude, 50.06)
  assert.equal(loc.longitude, 19.94)
  const empty = RainModel.parseLocationFile("")
  assert.equal(empty.latitude, null)
})

test("mode file stores a known mode", () => {
  assert.equal(RainModel.parseModeFile('{"mode":"light"}'), "light")
  assert.equal(RainModel.parseModeFile(""), "auto")
  assert.equal(RainModel.parseStateFile('{"mode":"auto","weatherCode":61}').weatherCode, 61)
  assert.equal(RainModel.parseStateFile("").weatherCode, null)
  assert.equal(RainModel.parseStateFile("").speed, "calm")
  assert.equal(RainModel.parseStateFile("").look, "theme")
  assert.equal(RainModel.parseStateFile('{"mode":"auto","speed":"hyper"}').speed, "hyper")
  assert.equal(RainModel.parseStateFile('{"look":"matrix"}').look, "matrix")
  assert.equal(RainModel.parseStateFile("").script, "pixels")
  assert.equal(RainModel.parseStateFile('{"script":"glyphs"}').script, "glyphs")
  assert.equal(
    RainModel.stateFileBody("heavy", 80, "calm", "theme", "pixels"),
    '{\n  "mode": "heavy",\n  "weatherCode": 80,\n  "speed": "calm",\n  "look": "theme",\n  "script": "pixels"\n}\n'
  )
})

test("mergeState keeps an existing weather code when a mode write omits it", () => {
  const merged = RainModel.mergeState('{\n  "mode": "auto",\n  "weatherCode": 80\n}\n', "heavy", null)
  assert.equal(merged.mode, "heavy")
  assert.equal(merged.weatherCode, 80)
  const first = RainModel.mergeState("", "auto", 61)
  assert.equal(first.weatherCode, 61)
  const speed = RainModel.mergeState('{\n  "mode": "auto",\n  "speed": "natural"\n}\n', "auto", null, null)
  assert.equal(speed.speed, "natural")
  const look = RainModel.mergeState('{\n  "mode": "auto",\n  "look": "amber"\n}\n', "auto", null, null, null)
  assert.equal(look.look, "amber")
  const script = RainModel.mergeState('{\n  "script": "glyphs"\n}\n', "auto", null, null, null, null)
  assert.equal(script.script, "glyphs")
})

test("matrix script cycles between pixels and glyphs", () => {
  assert.equal(RainModel.normalizeScript("glyphs"), "glyphs")
  assert.equal(RainModel.normalizeScript("text"), "glyphs")
  assert.equal(RainModel.normalizeScript("nope"), "pixels")
  assert.equal(RainModel.cycleScript("pixels"), "glyphs")
  assert.equal(RainModel.cycleScript("glyphs"), "pixels")
  assert.equal(RainModel.usesGlyphs("matrix", "glyphs"), true)
  assert.equal(RainModel.usesGlyphs("matrix", "pixels"), false)
  assert.equal(RainModel.usesGlyphs("theme", "glyphs"), false)
})

test("spawned drops carry a matrix glyph", () => {
  const state = RainModel.createState(800, 400, { seed: 2, pixel: 4, mode: "steady" })
  const drop = ofKind(state, "drop")[0]
  assert.equal(typeof drop.glyph, "string")
  assert.ok(drop.glyph.length >= 1)
})

test("unknown looks fall back to theme", () => {
  assert.equal(RainModel.normalizeLook("theme"), "theme")
  assert.equal(RainModel.normalizeLook("psychedelic"), "psychedelic")
  assert.equal(RainModel.normalizeLook("screensaver"), "psychedelic")
  assert.equal(RainModel.normalizeLook("matrix"), "matrix")
  assert.equal(RainModel.normalizeLook("amber"), "amber")
  assert.equal(RainModel.normalizeLook("nope"), "theme")
})

test("psychedelic and matrix palettes use their own hex, theme does not", () => {
  assert.equal(RainModel.paletteHex("theme", "accent"), "")
  const rain = RainModel.paletteHex("psychedelic", "foreground")
  assert.equal(rain.charAt(0), "#")
  assert.equal(rain.length, 7)
  assert.notEqual(RainModel.paletteHex("matrix", "accent"), rain)
  assert.notEqual(RainModel.paletteHex("amber", "foreground"), RainModel.paletteHex("matrix", "foreground"))
})

test("psychedelic drops pick different tints", () => {
  const state = RainModel.createState(1920, 1080, { seed: 9, pixel: 4, mode: "steady" })
  const tints = {}
  ofKind(state, "drop").forEach(function (drop) {
    assert.equal(drop.tint.charAt(0), "#")
    tints[drop.tint] = true
  })
  assert.ok(Object.keys(tints).length >= 3)
})

test("unknown speeds fall back to calm", () => {
  assert.equal(RainModel.normalizeSpeed("calm"), "calm")
  assert.equal(RainModel.normalizeSpeed("natural"), "natural")
  assert.equal(RainModel.normalizeSpeed("hyper"), "hyper")
  assert.equal(RainModel.normalizeSpeed("hyper-gravity"), "hyper")
  assert.equal(RainModel.normalizeSpeed("nope"), "calm")
})

test("natural and hyper fall faster than calm", () => {
  assert.equal(RainModel.speedScale("calm"), 1)
  assert.ok(RainModel.speedScale("natural") > 1)
  assert.ok(RainModel.speedScale("hyper") > RainModel.speedScale("natural"))
})

test("hyper-gravity rescales live drops instead of waiting for respawn", () => {
  const state = RainModel.createState(800, 400, { seed: 4, pixel: 4, mode: "steady" })
  const drop = ofKind(state, "drop")[0]
  drop.layer = 2
  drop.vy = 100
  RainModel.setSpeed(state, "hyper")
  assert.equal(state.speed, "hyper")
  assert.ok(drop.vy > 100)
})

test("spawned hyper drops are faster than calm drops on the same layer", () => {
  const calm = RainModel.createState(800, 400, { seed: 6, pixel: 4, mode: "steady", speed: "calm" })
  const hyper = RainModel.createState(800, 400, { seed: 6, pixel: 4, mode: "steady", speed: "hyper" })
  const calmNear = ofKind(calm, "drop").filter(function (drop) { return drop.layer === 2 })
  const hyperNear = ofKind(hyper, "drop").filter(function (drop) { return drop.layer === 2 })
  if (calmNear.length && hyperNear.length)
    assert.ok(hyperNear[0].vy > calmNear[0].vy * 2)
})

test("step honors the current speed even if drop vy was not rescaled", () => {
  const state = RainModel.createState(800, 400, { seed: 1, pixel: 4, mode: "steady", speed: "calm" })
  state.cells.forEach(function (cell) { cell.alive = false })
  state.dropTarget = 0
  state.dropTargetGoal = 0
  const drop = RainModel.spawnDrop(state, { x: 40, y: 10, vy: 80, layer: 2, role: "muted" })
  drop.vy = 80
  state.speed = "hyper"
  const y = drop.y
  RainModel.step(state, 0.1)
  assert.ok(drop.y - y > 40)
})

test("forecast URL prefers Open-Meteo when coordinates exist", () => {
  const coords = RainModel.forecastUrl({ latitude: 50.06, longitude: 19.94 })
  assert.ok(coords.indexOf("api.open-meteo.com") !== -1)
  assert.ok(coords.indexOf("50.06") !== -1)
  assert.ok(coords.indexOf("wind_speed_10m") !== -1)
  assert.equal(RainModel.forecastUrl({ name: "Krakow" }), "https://wttr.in/Krakow?format=j1")
  assert.equal(RainModel.forecastUrl({}), "https://wttr.in/?format=j1")
})
