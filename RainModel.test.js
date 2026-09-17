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
    assert.equal(drop.x % state.pixel, 0)
    assert.ok(drop.x >= 0)
    assert.ok(drop.x < state.width)
    assert.ok(["muted", "foreground", "accent"].indexOf(drop.role) !== -1)
    assert.ok(drop.vy > 0)
  })
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
  RainModel.spawnDrop(state, { x: 40, y: 196, vy: 80, role: "muted" })
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
  RainModel.spawnDrop(state, { x: 80, y: 196, vy: 80, role: "accent" })
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
  RainModel.spawnDrop(state, { x: 20, y: 196, vy: 80, role: "foreground" })
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
  RainModel.spawnDrop(state, { x: 40, y: 196, vy: 80, role: "muted" })
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
  assert.equal(RainModel.stateFileBody("heavy", 80), '{\n  "mode": "heavy",\n  "weatherCode": 80\n}\n')
})

test("mergeState keeps an existing weather code when a mode write omits it", () => {
  const merged = RainModel.mergeState('{\n  "mode": "auto",\n  "weatherCode": 80\n}\n', "heavy", null)
  assert.equal(merged.mode, "heavy")
  assert.equal(merged.weatherCode, 80)
  const first = RainModel.mergeState("", "auto", 61)
  assert.equal(first.weatherCode, 61)
})

test("forecast URL prefers Open-Meteo when coordinates exist", () => {
  const coords = RainModel.forecastUrl({ latitude: 50.06, longitude: 19.94 })
  assert.ok(coords.indexOf("api.open-meteo.com") !== -1)
  assert.ok(coords.indexOf("50.06") !== -1)
  assert.equal(RainModel.forecastUrl({ name: "Krakow" }), "https://wttr.in/Krakow?format=j1")
  assert.equal(RainModel.forecastUrl({}), "https://wttr.in/?format=j1")
})
