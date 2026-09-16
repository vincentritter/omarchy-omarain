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

function dropTargetFor(width) {
  var w = Number(width)
  if (!isFinite(w) || w <= 0) return 6
  return Math.max(6, Math.round(w / 90))
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

function createState(width, height, options) {
  options = options || {}
  var pixel = options.pixel || 3
  var seed = options.seed == null ? 1 : options.seed
  var state = {
    width: width,
    height: height,
    pixel: pixel,
    dropTarget: dropTargetFor(width),
    cells: [],
    rng: options.rng || mulberry32(seed)
  }
  ensurePool(state)
  for (var i = 0; i < state.dropTarget; i++) spawnDrop(state)
  return state
}

function resize(state, width, height) {
  state.width = width
  state.height = height
  state.dropTarget = dropTargetFor(width)
  ensurePool(state)
  for (var i = 0; i < state.cells.length; i++) {
    var cell = state.cells[i]
    if (!cell.alive || cell.kind !== "drop") continue
    cell.x = clampDropX(state, cell.x)
    cell.w = state.pixel
    cell.h = state.pixel * cell.trail
  }
  var extra = dropCount(state) - state.dropTarget
  for (var c = 0; extra > 0 && c < state.cells.length; c++) {
    if (state.cells[c].alive && state.cells[c].kind === "drop") {
      state.cells[c].alive = false
      extra--
    }
  }
  maintainDrops(state)
}

function step(state, dt) {
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
    createState: createState,
    spawnDrop: spawnDrop,
    step: step,
    resize: resize
  }
}
