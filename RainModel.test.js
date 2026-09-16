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
  assert.ok(wide.dropTarget < 40)
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
  const state = RainModel.createState(400, 200, { seed: 2, pixel: 4 })
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
  const state = RainModel.createState(400, 200, { seed: 4, pixel: 4 })
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
  const state = RainModel.createState(400, 200, { seed: 5, pixel: 4 })
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
  const state = RainModel.createState(400, 200, { seed: 8, pixel: 4 })
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
