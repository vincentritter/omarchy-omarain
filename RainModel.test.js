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
  const small = RainModel.createState(800, 600, { seed: 1, mode: "steady" })
  const wide = RainModel.createState(1920, 1080, { seed: 1, mode: "steady" })
  assert.ok(small.dropTarget >= 2)
  assert.ok(wide.dropTarget > small.dropTarget)
  assert.ok(wide.dropTarget < 80)
  assert.equal(small.pixel, 3)
})

test("createState fills the field with drops already in flight", () => {
  const state = RainModel.createState(1280, 720, { seed: 7, mode: "steady" })
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
  const state = RainModel.createState(1920, 1080, { seed: 12, pixel: 4, mode: "steady" })
  const drops = ofKind(state, "drop")
  const widths = {}
  drops.forEach(function (drop) { widths[drop.w] = true })
  assert.ok(Object.keys(widths).length >= 2)
  assert.ok(drops.some(function (drop) { return drop.w < state.pixel }))
})

test("drops sit on far, mid, and near layers", () => {
  const state = RainModel.createState(1920, 1080, { seed: 15, pixel: 4, mode: "steady" })
  const layers = {}
  ofKind(state, "drop").forEach(function (drop) { layers[drop.layer] = true })
  assert.equal(layers[0], true)
  assert.equal(layers[1], true)
  assert.equal(layers[2], true)
})

test("near drops fall faster than far drops", () => {
  const state = RainModel.createState(1920, 1080, { seed: 21, pixel: 4, mode: "steady" })
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
  const state = RainModel.createState(1920, 1080, { seed: 3, mode: "steady" })
  const drops = ofKind(state, "drop")
  const accents = drops.filter(function (drop) { return drop.role === "accent" })
  assert.ok(accents.length >= 1)
  assert.ok(accents.length < drops.length * 0.55)
})

test("step moves drops downward", () => {
  const state = RainModel.createState(640, 480, { seed: 11, mode: "steady" })
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
  assert.ok(splashes.length <= 8)
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

test("a drop leaves a puddle that sits on the floor and fades", () => {
  const state = RainModel.createState(400, 200, { seed: 6, pixel: 4, mode: "steady" })
  state.cells.forEach(function (cell) { cell.alive = false })
  state.dropTarget = 0
  state.dropTargetGoal = 0
  RainModel.spawnDrop(state, { x: 40, y: 196, vy: 80, role: "muted", layer: 1 })
  RainModel.step(state, 0.1)
  const puddles = ofKind(state, "puddle")
  assert.ok(puddles.length >= 1)
  puddles.forEach(function (puddle) {
    assert.ok(puddle.y + puddle.h >= state.height - 1)
    assert.ok(puddle.life > 0.8)
  })
  const start = puddles[0].alpha
  const startLife = puddles[0].life
  for (var i = 0; i < 8; i++) RainModel.step(state, 0.05)
  assert.ok(puddles[0].alive)
  assert.ok(puddles[0].alpha < start)
  assert.ok(puddles[0].life < startLife)
})

test("a second drop nearby feeds the same puddle", () => {
  const state = RainModel.createState(400, 200, { seed: 7, pixel: 4, mode: "steady" })
  state.cells.forEach(function (cell) { cell.alive = false })
  state.dropTarget = 0
  state.dropTargetGoal = 0
  RainModel.spawnDrop(state, { x: 40, y: 196, vy: 80, role: "muted", layer: 1 })
  RainModel.step(state, 0.1)
  const first = ofKind(state, "puddle")
  assert.ok(first.length >= 1)
  const count = first.length
  const life = first[0].life
  const width = first[0].w
  RainModel.spawnDrop(state, { x: 44, y: 196, vy: 80, role: "muted", layer: 1 })
  RainModel.step(state, 0.1)
  const after = ofKind(state, "puddle")
  assert.ok(after.length <= count + 1)
  assert.ok(after[0].life > life || after[0].w > width)
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
  const state = RainModel.createState(800, 600, { seed: 9, mode: "steady" })
  RainModel.resize(state, 1920, 1080)
  assert.equal(state.width, 1920)
  assert.equal(state.height, 1080)
  assert.equal(ofKind(state, "drop").length, state.dropTarget)
})

test("unknown modes fall back to auto", () => {
  assert.equal(RainModel.normalizeMode("auto"), "auto")
  assert.equal(RainModel.normalizeMode("heavy"), "heavy")
  assert.equal(RainModel.normalizeMode("torrential"), "torrential")
  assert.equal(RainModel.normalizeMode(""), "auto")
  assert.equal(RainModel.normalizeMode("nope"), "auto")
})

test("fixed modes keep a constant intensity", () => {
  assert.equal(RainModel.resolveIntensity("off"), 0)
  assert.equal(RainModel.resolveIntensity("light"), 0.45)
  assert.equal(RainModel.resolveIntensity("steady"), 1)
  assert.ok(RainModel.resolveIntensity("heavy") > 2)
  assert.ok(RainModel.resolveIntensity("torrential") > RainModel.resolveIntensity("heavy") * 2)
})

test("clear and overcast auto stay dry", () => {
  assert.equal(RainModel.resolveIntensity("auto", 0, 0), 0)
  assert.equal(RainModel.resolveIntensity("auto", 1, 0), 0)
  assert.equal(RainModel.resolveIntensity("auto", 2, 0), 0)
  assert.equal(RainModel.resolveIntensity("auto", 3, 0), 0)
  assert.equal(RainModel.resolveIntensity("auto", 45, 0), 0)
})

test("auto rains for drizzle and storms, with drizzle quieter than Light", () => {
  const drizzle = RainModel.resolveIntensity("auto", 51, 0)
  const storm = RainModel.resolveIntensity("auto", 95, 0)
  const showers = RainModel.resolveIntensity("auto", 80, 0)
  assert.ok(drizzle > 0)
  assert.ok(drizzle < RainModel.resolveIntensity("light"))
  assert.ok(showers > drizzle)
  assert.ok(storm > showers)
  assert.ok(storm > 1)
})

test("auto with unknown weather stays dry", () => {
  assert.equal(RainModel.resolveIntensity("auto", null, 0), 0)
})

test("zero precipitation keeps auto dry even if the weather code says drizzle", () => {
  assert.equal(RainModel.resolveIntensity("auto", 51, 0, 0), 0)
  assert.ok(RainModel.resolveIntensity("auto", 51, 0, 0.3) > 0)
})

test("auto wander breathes intensity over time", () => {
  const a = RainModel.resolveIntensity("auto", 61, 0)
  const b = RainModel.resolveIntensity("auto", 61, 18)
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

test("auto overcast drains the field instead of keeping specks", () => {
  const state = RainModel.createState(800, 600, { seed: 1, mode: "auto", weatherCode: 80 })
  assert.ok(ofKind(state, "drop").length > 0)
  RainModel.configure(state, { weatherCode: 3, precipitation: 0 })
  assert.equal(state.dropTarget, 0)
  assert.equal(state.dropTargetGoal, 0)
  for (var i = 0; i < 400; i++) RainModel.step(state, 0.05)
  assert.equal(ofKind(state, "drop").length, 0)
})

test("off stops spawning but lets falling drops finish", () => {
  const state = RainModel.createState(800, 600, { seed: 1, mode: "steady" })
  const before = ofKind(state, "drop").length
  assert.ok(before > 0)
  RainModel.setMode(state, "off")
  assert.equal(state.dropTarget, 0)
  assert.equal(state.dropTargetGoal, 0)
  assert.equal(ofKind(state, "drop").length, before)
  RainModel.step(state, 0.05)
  assert.ok(ofKind(state, "drop").length <= before)
  for (var i = 0; i < 400; i++) RainModel.step(state, 0.05)
  assert.equal(ofKind(state, "drop").length, 0)
  assert.equal(RainModel.hasLive(state), false)
})

test("auto step retargets the field as the wander moves", () => {
  const state = RainModel.createState(1800, 900, { seed: 2, mode: "auto", weatherCode: 95 })
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

test("tilt from accelerometer ignores rest and leans when the machine tips", () => {
  assert.equal(RainModel.tiltXFromAccel(0, 0, 9.81), 0)
  assert.equal(RainModel.tiltXFromAccel(0.2, 0, 9.8), 0)
  assert.ok(RainModel.tiltXFromAccel(3, 0, 9) > 0)
  assert.ok(RainModel.tiltXFromAccel(-3, 0, 9) < 0)
  const parsed = RainModel.parseAccelLine("1.25 -0.40 9.60")
  assert.equal(parsed.x, 1.25)
  assert.ok(Math.abs(RainModel.smoothTilt(0, 100) - 20) < 0.01)
})

test("west wind leans far drops more than near drops", () => {
  const windX = RainModel.windXFromPayload(JSON.stringify({
    current: { weather_code: 3, wind_speed_10m: 24, wind_direction_10m: 270 }
  }))
  assert.ok(windX > 50)
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

test("Open-Meteo and wttr payloads yield precipitation", () => {
  assert.equal(RainModel.precipitationFromPayload(JSON.stringify({
    current: { weather_code: 3, precipitation: 0 }
  })), 0)
  assert.equal(RainModel.precipitationFromPayload(JSON.stringify({
    current: { weather_code: 61, precipitation: 1.2 }
  })), 1.2)
  assert.equal(RainModel.precipitationFromPayload(JSON.stringify({
    current_condition: [{ weatherCode: "266", precipMM: "0.3" }]
  })), 0.3)
  assert.equal(RainModel.precipitationFromPayload(""), null)
})

test("auto uses this hour when the current snapshot is dry", () => {
  const picked = RainModel.autoWeatherFromPayload(JSON.stringify({
    current: { time: "2026-09-21T12:30", weather_code: 3, precipitation: 0 },
    hourly: {
      time: ["2026-09-21T11:00", "2026-09-21T12:00", "2026-09-21T13:00", "2026-09-21T16:00"],
      weather_code: [51, 51, 3, 63],
      precipitation: [0.2, 0.3, 0, 4.0]
    }
  }))
  assert.equal(picked.weatherCode, 51)
  assert.equal(picked.precipitation, 0.3)
  assert.ok(RainModel.resolveIntensity("auto", picked.weatherCode, 0, picked.precipitation) > 0)
})

test("auto prefers current precipitation over this hour", () => {
  const picked = RainModel.autoWeatherFromPayload(JSON.stringify({
    current: { time: "2026-09-21T12:30", weather_code: 61, precipitation: 1.2 },
    hourly: {
      time: ["2026-09-21T12:00"],
      weather_code: [51],
      precipitation: [0.3]
    }
  }))
  assert.equal(picked.weatherCode, 61)
  assert.equal(picked.precipitation, 1.2)
})

test("auto stays dry when this hour is dry even if later hours are wet", () => {
  const picked = RainModel.autoWeatherFromPayload(JSON.stringify({
    current: { time: "2026-09-21T13:15", weather_code: 3, precipitation: 0 },
    hourly: {
      time: ["2026-09-21T12:00", "2026-09-21T13:00", "2026-09-21T16:00"],
      weather_code: [51, 3, 63],
      precipitation: [0.3, 0, 4.0]
    }
  }))
  assert.equal(picked.weatherCode, 3)
  assert.equal(picked.precipitation, 0)
  assert.equal(RainModel.resolveIntensity("auto", picked.weatherCode, 0, picked.precipitation), 0)
})

test("auto ignores this hour when precipitation is wet but the code is dry", () => {
  const picked = RainModel.autoWeatherFromPayload(JSON.stringify({
    current: { time: "2026-09-21T12:30", weather_code: 3, precipitation: 0 },
    hourly: {
      time: ["2026-09-21T12:00"],
      weather_code: [3],
      precipitation: [0.3]
    }
  }))
  assert.equal(picked.weatherCode, 3)
  assert.equal(picked.precipitation, 0)
})

test("auto falls back to current when hourly is missing", () => {
  const picked = RainModel.autoWeatherFromPayload(JSON.stringify({
    current: { time: "2026-09-21T12:30", weather_code: 3, precipitation: 0 }
  }))
  assert.equal(picked.weatherCode, 3)
  assert.equal(picked.precipitation, 0)
  assert.equal(RainModel.autoWeatherFromPayload("").weatherCode, null)
})

test("a wttr payload yields coordinates so auto can follow up with Open-Meteo", () => {
  const loc = RainModel.locationFromWttrPayload(JSON.stringify({
    nearest_area: [{ areaName: [{ value: "Polesie" }], latitude: "52.017", longitude: "20.017" }],
    current_condition: [{ weatherCode: "266" }]
  }))
  assert.equal(loc.name, "Polesie")
  assert.equal(loc.latitude, 52.017)
  assert.equal(loc.longitude, 20.017)
  const url = RainModel.forecastUrl(loc)
  assert.ok(url.indexOf("api.open-meteo.com") !== -1)
  assert.ok(url.indexOf("52.017") !== -1)
  assert.equal(RainModel.locationFromWttrPayload(JSON.stringify({
    current: { weather_code: 3 }
  })), null)
})

test("locate payloads yield coordinates without treating a forecast as a place", () => {
  const geo = RainModel.locationFromLocatePayload(JSON.stringify({
    city: "Rzeszow",
    latitude: "50.0398",
    longitude: "22.0065"
  }))
  assert.equal(geo.name, "Rzeszow")
  assert.equal(geo.latitude, 50.0398)
  assert.equal(geo.longitude, 22.0065)
  const geocoded = RainModel.locationFromLocatePayload(JSON.stringify({
    results: [{ name: "Krakow", latitude: 50.06143, longitude: 19.93658 }]
  }))
  assert.equal(geocoded.name, "Krakow")
  assert.equal(geocoded.latitude, 50.06143)
  assert.equal(RainModel.locationFromLocatePayload(JSON.stringify({
    latitude: 50.06,
    longitude: 19.94,
    current: { weather_code: 3, precipitation: 0 }
  })), null)
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
  assert.equal(RainModel.parseStateFile('{"look":"matrix"}').script, "glyphs")
  assert.equal(RainModel.parseStateFile("").script, "pixels")
  assert.equal(RainModel.parseStateFile('{"script":"glyphs"}').script, "glyphs")
  assert.equal(RainModel.parseStateFile('{"mode":"off","resumeMode":"heavy"}').resumeMode, "heavy")
  assert.equal(RainModel.parseStateFile("").resumeMode, "auto")
  assert.equal(
    RainModel.stateFileBody("heavy", 80, "calm", "theme", "pixels", "heavy"),
    '{\n  "mode": "heavy",\n  "weatherCode": 80,\n  "speed": "calm",\n  "look": "theme",\n  "script": "pixels",\n  "resumeMode": "heavy",\n  "intensity": "heavy"\n}\n'
  )
})

test("right-click toggles off and restores the last intensity", () => {
  const off = RainModel.toggleOnOff("steady", "auto")
  assert.equal(off.mode, "off")
  assert.equal(off.resumeMode, "steady")
  const on = RainModel.toggleOnOff("off", "torrential")
  assert.equal(on.mode, "torrential")
  assert.equal(on.resumeMode, "torrential")
  const fromOffDefault = RainModel.toggleOnOff("off", "off")
  assert.equal(fromOffDefault.mode, "auto")
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

test("intensity options are the four manual levels", () => {
  assert.deepEqual(RainModel.intensityOptions().map(function (option) {
    return option.value
  }), ["light", "steady", "heavy", "torrential"])
})

test("normalizeIntensity keeps a manual level and defaults the rest to steady", () => {
  assert.equal(RainModel.normalizeIntensity("heavy"), "heavy")
  assert.equal(RainModel.normalizeIntensity("LIGHT"), "light")
  assert.equal(RainModel.normalizeIntensity("auto"), "steady")
  assert.equal(RainModel.normalizeIntensity("off"), "steady")
  assert.equal(RainModel.normalizeIntensity(""), "steady")
})

test("intensity index maps slider ticks onto manual levels", () => {
  assert.equal(RainModel.intensityIndex("light"), 0)
  assert.equal(RainModel.intensityIndex("steady"), 1)
  assert.equal(RainModel.intensityIndex("torrential"), 3)
  assert.equal(RainModel.intensityFromIndex(2), "heavy")
  assert.equal(RainModel.intensityFromIndex(-1), "light")
  assert.equal(RainModel.intensityFromIndex(99), "torrential")
})

test("state file remembers last manual intensity beside auto", () => {
  const parsed = RainModel.parseStateFile('{"mode":"auto","intensity":"heavy"}')
  assert.equal(parsed.mode, "auto")
  assert.equal(parsed.intensity, "heavy")
  const fromMode = RainModel.parseStateFile('{"mode":"light"}')
  assert.equal(fromMode.intensity, "light")
  const empty = RainModel.parseStateFile("")
  assert.equal(empty.intensity, "steady")
  const paused = RainModel.parseStateFile('{"mode":"off","resumeMode":"auto","intensity":"torrential"}')
  assert.equal(paused.intensity, "torrential")
  const pausedUpgrade = RainModel.parseStateFile('{"mode":"off","resumeMode":"heavy"}')
  assert.equal(pausedUpgrade.intensity, "heavy")
})

test("follow weather is auto while raining and armed resume while paused", () => {
  assert.equal(RainModel.followWeatherActive("auto", "auto"), true)
  assert.equal(RainModel.followWeatherActive("off", "auto"), true)
  assert.equal(RainModel.followWeatherActive("off", "heavy"), false)
  assert.equal(RainModel.followWeatherActive("heavy", "heavy"), false)
})

test("applying follow weather keeps last intensity and arms auto", () => {
  const on = RainModel.applyFollowWeather({ mode: "heavy", intensity: "heavy", resumeMode: "heavy" }, true)
  assert.equal(on.mode, "auto")
  assert.equal(on.intensity, "heavy")
  assert.equal(on.resumeMode, "auto")
  const off = RainModel.applyFollowWeather({ mode: "auto", intensity: "heavy", resumeMode: "auto" }, false)
  assert.equal(off.mode, "heavy")
  assert.equal(off.intensity, "heavy")
  const paused = RainModel.applyFollowWeather({ mode: "off", intensity: "light", resumeMode: "light" }, true)
  assert.equal(paused.mode, "off")
  assert.equal(paused.resumeMode, "auto")
  assert.equal(paused.intensity, "light")
})

test("choosing an intensity leaves auto and stores the level", () => {
  const fromAuto = RainModel.applyIntensityChoice({
    mode: "auto",
    intensity: "steady",
    resumeMode: "auto"
  }, "torrential")
  assert.equal(fromAuto.mode, "torrential")
  assert.equal(fromAuto.intensity, "torrential")
  assert.equal(fromAuto.resumeMode, "torrential")
  const paused = RainModel.applyIntensityChoice({
    mode: "off",
    intensity: "steady",
    resumeMode: "auto"
  }, "light")
  assert.equal(paused.mode, "off")
  assert.equal(paused.intensity, "light")
  assert.equal(paused.resumeMode, "light")
})

test("speed chips use Hyper as the short label", () => {
  assert.equal(RainModel.speedOptions()[2].label, "Hyper")
  assert.equal(RainModel.speedOptions()[2].tooltip, "Hyper-gravity")
  assert.equal(RainModel.speedLabel("hyper"), "Hyper-gravity")
})

test("look swatch uses the palette accent", () => {
  assert.equal(RainModel.lookSwatch("theme"), "")
  assert.equal(RainModel.lookSwatch("amber"), RainModel.paletteHex("amber", "accent"))
  assert.equal(RainModel.lookSwatch("matrix"), RainModel.paletteHex("matrix", "accent"))
})

test("look preview colors feed chip hover rain", () => {
  assert.deepEqual(RainModel.lookPreviewColors("theme"), [])
  const candy = RainModel.lookPreviewColors("candy")
  assert.ok(candy.length >= 4)
  assert.equal(candy[0].charAt(0), "#")
  const amber = RainModel.lookPreviewColors("amber")
  assert.equal(amber.length, 3)
  assert.equal(amber[2], RainModel.paletteHex("amber", "accent"))
  assert.equal(RainModel.lookPreviewColors("matrix")[0], RainModel.paletteHex("matrix", "muted"))
})

test("candy look swatch is a stripe of palette colors", () => {
  const stripe = RainModel.lookSwatches("candy")
  assert.ok(stripe.length >= 4)
  stripe.forEach(function (hex) {
    assert.equal(hex.charAt(0), "#")
    assert.equal(hex.length, 7)
  })
  assert.notEqual(stripe[0], stripe[1])
  assert.deepEqual(RainModel.lookSwatches("amber"), [RainModel.lookSwatch("amber")])
  assert.deepEqual(RainModel.lookSwatches("theme"), [])
})

test("fetch URLs only allow Open-Meteo and geojs over https", () => {
  assert.equal(RainModel.fetchUrlAllowed(RainModel.forecastUrl({ latitude: 50, longitude: 20 })), true)
  assert.equal(RainModel.fetchUrlAllowed(RainModel.locateUrl({ name: "Krakow" })), true)
  assert.equal(RainModel.fetchUrlAllowed(RainModel.locateUrl({})), true)
  assert.equal(RainModel.fetchUrlAllowed("http://api.open-meteo.com/v1/forecast"), false)
  assert.equal(RainModel.fetchUrlAllowed("https://evil.example/v1/forecast"), false)
  assert.equal(RainModel.fetchUrlAllowed("https://api.open-meteo.com.evil/"), false)
})

test("about links only open Vincent's site and this repo", () => {
  assert.equal(RainModel.openUrlAllowed("https://vincentritter.com?ts=omarain"), true)
  assert.equal(RainModel.openUrlAllowed("https://github.com/vincentritter/omarchy-omarain"), true)
  assert.equal(RainModel.openUrlAllowed("https://github.com/vincentritter/omarchy-omarain/issues"), true)
  assert.equal(RainModel.openUrlAllowed("https://github.com/evil/repo"), false)
  assert.equal(RainModel.openUrlAllowed("javascript:alert(1)"), false)
  assert.equal(RainModel.openUrlAllowed("https://evil.example/@vincentritter.com/"), false)
})

test("state files larger than the cap are ignored", () => {
  const parsed = RainModel.parseStateFile('{"mode":"heavy","pad":"' + "x".repeat(70000) + '"}')
  assert.equal(parsed.mode, "auto")
})

test("matrix look keeps glyphs on the extra panel section", () => {
  assert.deepEqual(RainModel.panelSections("theme"), ["power", "weather", "intensity", "speed", "look"])
  assert.deepEqual(RainModel.panelSections("matrix"), ["power", "weather", "intensity", "speed", "look", "glyphs"])
})

test("follow weather hides the intensity slider section", () => {
  assert.deepEqual(RainModel.panelSections("theme", true), ["power", "weather", "speed", "look"])
  assert.deepEqual(RainModel.panelSections("matrix", true), ["power", "weather", "speed", "look", "glyphs"])
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

test("spawned drops carry a single artifact glyph", () => {
  const state = RainModel.createState(800, 400, { seed: 2, pixel: 4, mode: "steady" })
  const drop = ofKind(state, "drop")[0]
  assert.equal(typeof drop.glyph, "string")
  assert.equal(drop.glyph.length, 1)
  assert.ok("█▓▒░<>/ $*!?#|".indexOf(drop.glyph) !== -1)
})

test("a drop cycles its glyph as it falls", () => {
  const state = RainModel.createState(400, 300, { seed: 8, pixel: 4, mode: "steady", look: "matrix", script: "glyphs" })
  state.cells.forEach(function (cell) { cell.alive = false })
  state.dropTarget = 0
  state.dropTargetGoal = 0
  const drop = RainModel.spawnDrop(state, { x: 40, y: 10, vy: 120, role: "muted", layer: 1 })
  const seen = {}
  seen[drop.glyph] = true
  for (var i = 0; i < 20; i++) {
    RainModel.step(state, 0.05)
    if (drop.glyph) seen[drop.glyph] = true
  }
  assert.ok(Object.keys(seen).length >= 2)
})

test("a falling drop grows a fading glyph trail behind the head", () => {
  const state = RainModel.createState(400, 400, { seed: 3, pixel: 4, mode: "steady", look: "matrix", script: "glyphs" })
  state.cells.forEach(function (cell) { cell.alive = false })
  state.dropTarget = 0
  state.dropTargetGoal = 0
  const drop = RainModel.spawnDrop(state, { x: 40, y: 10, vy: 120, role: "muted", layer: 2 })
  assert.equal(drop.trailGlyphs, drop.glyph)
  for (var i = 0; i < 20; i++) RainModel.step(state, 0.05)
  assert.ok(drop.trailGlyphs.length > 1)
  assert.ok(drop.trailGlyphs.length <= 9)
  assert.equal(drop.trailGlyphs.charAt(drop.trailGlyphs.length - 1), drop.glyph)
})

test("a glyph trail collapses into the floor before splashing", () => {
  const state = RainModel.createState(400, 200, { seed: 4, pixel: 4, mode: "steady", look: "matrix", script: "glyphs" })
  state.cells.forEach(function (cell) { cell.alive = false })
  state.dropTarget = 0
  state.dropTargetGoal = 0
  const drop = RainModel.spawnDrop(state, { x: 40, y: 10, vy: 80, role: "muted", layer: 2 })
  drop.trailGlyphs = "█▓▒░<>/$*"
  drop.glyph = "*"
  drop.y = 196
  drop.h = 4
  RainModel.step(state, 0.05)
  assert.equal(drop.alive, true)
  assert.ok(drop.trailGlyphs.length < 9)
  const len = drop.trailGlyphs.length
  RainModel.step(state, 0.05)
  assert.equal(drop.alive, true)
  assert.equal(drop.trailGlyphs.length, len - 1)
})

test("unknown looks fall back to theme", () => {
  assert.equal(RainModel.normalizeLook("theme"), "theme")
  assert.equal(RainModel.normalizeLook("candy"), "candy")
  assert.equal(RainModel.normalizeLook("matrix"), "matrix")
  assert.equal(RainModel.normalizeLook("amber"), "amber")
  assert.equal(RainModel.normalizeLook("psychedelic"), "theme")
  assert.equal(RainModel.normalizeLook("nope"), "theme")
})

test("candy look is labeled Candy", () => {
  assert.equal(RainModel.lookLabel("candy"), "Candy")
  assert.equal(RainModel.lookOptions()[1].value, "candy")
  assert.equal(RainModel.lookOptions()[1].label, "Candy")
})

test("candy and matrix palettes use their own hex, theme does not", () => {
  assert.equal(RainModel.paletteHex("theme", "accent"), "")
  const rain = RainModel.paletteHex("candy", "foreground")
  assert.equal(rain.charAt(0), "#")
  assert.equal(rain.length, 7)
  assert.notEqual(RainModel.paletteHex("matrix", "accent"), rain)
  assert.notEqual(RainModel.paletteHex("amber", "foreground"), RainModel.paletteHex("matrix", "foreground"))
})

test("candy drops pick different tints", () => {
  const state = RainModel.createState(1920, 1080, { seed: 9, pixel: 4, mode: "steady" })
  const tints = {}
  ofKind(state, "drop").forEach(function (drop) {
    assert.equal(drop.tint.charAt(0), "#")
    tints[drop.tint] = true
  })
  assert.ok(Object.keys(tints).length >= 3)
})

test("speed chip index highlights the saved speed", () => {
  assert.equal(RainModel.speedChipIndex("calm"), 0)
  assert.equal(RainModel.speedChipIndex("natural"), 1)
  assert.equal(RainModel.speedChipIndex("hyper"), 2)
  assert.equal(RainModel.speedChipIndex(""), 0)
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

test("chip hover rain uses a readable speed scale", () => {
  assert.equal(RainModel.previewFallScale("calm"), 1)
  assert.ok(RainModel.previewFallScale("natural") > RainModel.previewFallScale("calm"))
  assert.ok(RainModel.previewFallScale("hyper") > RainModel.previewFallScale("natural"))
  assert.ok(RainModel.previewFallScale("hyper") < RainModel.speedScale("hyper"))
})

test("changing speed does not affect drops already falling", () => {
  const state = RainModel.createState(800, 400, { seed: 4, pixel: 4, mode: "steady", speed: "calm" })
  state.cells.forEach(function (cell) { cell.alive = false })
  state.dropTarget = 0
  state.dropTargetGoal = 0
  const drop = RainModel.spawnDrop(state, { x: 40, y: 20, vy: 80, layer: 2, role: "muted" })
  const scale = drop.speedScale
  RainModel.setSpeed(state, "hyper")
  assert.equal(state.speed, "hyper")
  assert.equal(drop.speedScale, scale)
  const y = drop.y
  RainModel.step(state, 0.1)
  assert.ok(drop.y - y < 20)
})

test("a field created from a saved state file already falls at the saved speed", () => {
  const saved = RainModel.parseStateFile('{"mode":"steady","speed":"natural"}')
  const calm = RainModel.createState(800, 400, { seed: 6, pixel: 4, mode: "steady", speed: "calm" })
  const restored = RainModel.createState(800, 400, {
    seed: 6,
    pixel: 4,
    mode: saved.mode,
    speed: saved.speed,
    look: saved.look,
    script: saved.script
  })
  assert.equal(saved.speed, "natural")
  assert.equal(restored.speed, "natural")
  const calmNear = ofKind(calm, "drop").filter(function (drop) { return drop.layer === 2 })
  const naturalNear = ofKind(restored, "drop").filter(function (drop) { return drop.layer === 2 })
  assert.ok(calmNear.length > 0)
  assert.ok(naturalNear.length > 0)
  assert.equal(naturalNear[0].speedScale, RainModel.speedScale("natural"))
  assert.ok(naturalNear[0].vy > calmNear[0].vy)
})

test("spawned hyper drops are faster than calm drops on the same layer", () => {
  const calm = RainModel.createState(800, 400, { seed: 6, pixel: 4, mode: "steady", speed: "calm" })
  const hyper = RainModel.createState(800, 400, { seed: 6, pixel: 4, mode: "steady", speed: "hyper" })
  const calmNear = ofKind(calm, "drop").filter(function (drop) { return drop.layer === 2 })
  const hyperNear = ofKind(hyper, "drop").filter(function (drop) { return drop.layer === 2 })
  if (calmNear.length && hyperNear.length)
    assert.ok(hyperNear[0].vy > calmNear[0].vy * 2)
})

test("a drop keeps its look after the field look changes", () => {
  const state = RainModel.createState(800, 400, { seed: 1, pixel: 4, mode: "steady", look: "amber" })
  const drop = ofKind(state, "drop")[0]
  assert.equal(drop.look, "amber")
  state.look = "matrix"
  state.script = "glyphs"
  assert.equal(drop.look, "amber")
  assert.equal(drop.script, "pixels")
})

test("forecast URL prefers Open-Meteo when coordinates exist", () => {
  const coords = RainModel.forecastUrl({ latitude: 50.06, longitude: 19.94 })
  assert.ok(coords.indexOf("api.open-meteo.com") !== -1)
  assert.ok(coords.indexOf("50.06") !== -1)
  assert.ok(coords.indexOf("wind_speed_10m") !== -1)
  assert.ok(coords.indexOf("precipitation") !== -1)
  assert.ok(coords.indexOf("hourly=weather_code,precipitation") !== -1)
  assert.equal(RainModel.forecastUrl({ name: "Krakow" }), "")
  assert.equal(RainModel.forecastUrl({}), "")
})

test("locate URL geocodes a name and otherwise uses IP geo", () => {
  const named = RainModel.locateUrl({ name: "Krakow" })
  assert.ok(named.indexOf("geocoding-api.open-meteo.com") !== -1)
  assert.ok(named.indexOf("Krakow") !== -1)
  assert.equal(RainModel.locateUrl({}), "https://get.geojs.io/v1/ip/geo.json")
})
