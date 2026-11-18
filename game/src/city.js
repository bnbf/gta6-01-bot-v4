// LUMEN BAY: deterministic seeded city — blocks, roads, buildings, parks,
// beach + sea, landmarks and collision queries. Nothing here reads the clock.
(function () {
  'use strict';
  var CFG = window.LB.CFG;

  // Mulberry32 — small deterministic PRNG, seeded per world.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function City(seed) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.buildings = [];   // {x,y,w,h,color,neon,label,shop}
    this.parks = [];       // {x,y,w,h}
    this.palms = [];       // {x,y}
    this.lamps = [];       // {x,y}
    this.signs = [];       // {x,y,text,color}
    this.landmarks = {};   // key -> {x,y,label,kind}
    this.generate();
  }

  City.prototype.blockRect = function (c, r) {
    return {
      x: CFG.ROAD + c * (CFG.BLOCK + CFG.ROAD),
      y: CFG.ROAD + r * (CFG.BLOCK + CFG.ROAD),
      w: CFG.BLOCK, h: CFG.BLOCK
    };
  };

  City.prototype.roadX = function (i) { return i * (CFG.BLOCK + CFG.ROAD) + CFG.ROAD / 2; };
  City.prototype.roadY = function (j) { return j * (CFG.BLOCK + CFG.ROAD) + CFG.ROAD / 2; };
  City.prototype.onRoadX = function (x) {
    for (var i = 0; i <= CFG.COLS; i++) if (Math.abs(x - this.roadX(i)) < CFG.ROAD / 2 - 6) return true;
    return false;
  };
  City.prototype.onRoadY = function (y) {
    for (var j = 0; j <= CFG.ROWS; j++) if (Math.abs(y - this.roadY(j)) < CFG.ROAD / 2 - 6) return true;
    return false;
  };
  City.prototype.onRoad = function (x, y) { return this.onRoadX(x) || this.onRoadY(y); };

  City.prototype.generate = function () {
    var rng = this.rng, i, c, r;
    // Landmark anchor points on the road grid.
    var lm = this.landmarks;
    lm.garage = { x: this.roadX(1), y: this.roadY(5), label: 'Volt Garage', kind: 'garage' };
    lm.gun = { x: this.roadX(3), y: this.roadY(2), label: 'LUMEN ARMS', kind: 'gun' };
    lm.diner = { x: this.roadX(5), y: this.roadY(3), label: 'Neon Diner', kind: 'diner' };
    lm.safehouse = { x: this.roadX(6), y: this.roadY(5), label: 'Harbor Loft', kind: 'safehouse' };
    lm.bank = { x: this.roadX(3), y: this.roadY(1), label: 'Lumen Trust Bank', kind: 'bank' };
    lm.marina = { x: this.roadX(4), y: CFG.CITY_H + CFG.BEACH / 2, label: 'Marina', kind: 'marina' };
    lm.race = { x: this.roadX(0), y: this.roadY(0), label: 'Race Start', kind: 'race' };
    lm.plaza = { x: this.roadX(3), y: this.roadY(3), label: 'Neon Plaza', kind: 'plaza' };

    var neonNames = ['NEON', 'LUMEN', 'BAY 24H', 'HOTEL NOVA', 'CLUB VOLT', 'PIER 9', 'RAMEN', 'ARCADE', 'TACOS', 'SUSHI', 'CASINO', 'MOTEL'];
    var ni = 0;
    for (c = 0; c < CFG.COLS; c++) {
      for (r = 0; r < CFG.ROWS; r++) {
        var b = this.blockRect(c, r);
        if (rng() < 0.16) { // park block
          this.parks.push({ x: b.x, y: b.y, w: b.w, h: b.h });
          for (i = 0; i < 7; i++) this.palms.push({ x: b.x + 25 + rng() * (b.w - 50), y: b.y + 25 + rng() * (b.h - 50) });
          continue;
        }
        // 2-4 buildings per block, inset from the road.
        var n = 2 + Math.floor(rng() * 3);
        for (i = 0; i < n; i++) {
          var bw = 60 + rng() * 70, bh = 55 + rng() * 65;
          var bx = b.x + 14 + rng() * Math.max(1, b.w - bw - 28);
          var by = b.y + 14 + rng() * Math.max(1, b.h - bh - 28);
          var color = window.LB.PALETTE.building[Math.floor(rng() * window.LB.PALETTE.building.length)];
          var neon = rng() < 0.55 ? window.LB.PALETTE.neon[Math.floor(rng() * window.LB.PALETTE.neon.length)] : null;
          var label = null, shop = null;
          if (neon && ni < neonNames.length) { label = neonNames[ni++]; }
          this.buildings.push({ x: bx, y: by, w: bw, h: bh, color: color, neon: neon, label: label, shop: shop });
          if (neon && label) this.signs.push({ x: bx + bw / 2, y: by - 6, text: label, color: neon });
        }
      }
    }
    // Shop fronts: place shop buildings beside their landmark road points.
    var shopDefs = [
      ['gun', 'gun', '#ff2ea6'], ['diner', 'diner', '#ffe600'],
      ['garage', 'garage', '#00f0ff'], ['safehouse', 'safehouse', '#7CFF00'],
      ['bank', 'bank', '#b967ff']
    ];
    for (var s = 0; s < shopDefs.length; s++) {
      var key = shopDefs[s][0], kind = shopDefs[s][1], col = shopDefs[s][2];
      var p = lm[key];
      var sx = p.x + 62, sy = p.y - 34;
      this.buildings.push({ x: sx, y: sy, w: 96, h: 68, color: '#2e2a44', neon: col, label: window.LB.SHOPS[kind].name, shop: kind });
      this.signs.push({ x: sx + 48, y: sy - 6, text: window.LB.SHOPS[kind].name, color: col });
    }
    // Street lamps along every road intersection.
    for (i = 0; i <= CFG.COLS; i++) for (var j = 0; j <= CFG.ROWS; j++) {
      this.lamps.push({ x: this.roadX(i) + CFG.ROAD / 2 - 8, y: this.roadY(j) + CFG.ROAD / 2 - 8 });
    }
    // Palms along the beach.
    for (i = 0; i < 14; i++) this.palms.push({ x: 60 + rng() * (CFG.WORLD_W - 120), y: CFG.CITY_H + 24 + rng() * (CFG.BEACH - 60) });
  };

  // True when (x,y) with radius r hits a building (roads, parks, beach are open).
  City.prototype.blocked = function (x, y, r) {
    if (x < r || y < r || x > CFG.WORLD_W - r || y > CFG.WORLD_H - r) return true;
    for (var i = 0; i < this.buildings.length; i++) {
      var b = this.buildings[i];
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    }
    return false;
  };

  // Nearest point on the road grid to (x,y) — used to spawn traffic/peds.
  City.prototype.nearestRoadPoint = function (x, y) {
    var best = null, bd = 1e18;
    for (var i = 0; i <= CFG.COLS; i++) {
      var px = this.roadX(i);
      var d = Math.abs(x - px);
      if (d < bd) { bd = d; best = { x: px, y: Math.max(60, Math.min(CFG.CITY_H - 60, y)) }; }
    }
    for (var j = 0; j <= CFG.ROWS; j++) {
      var py = this.roadY(j);
      var d2 = Math.abs(y - py);
      if (d2 < bd) { bd = d2; best = { x: Math.max(60, Math.min(CFG.WORLD_W - 60, x)), y: py }; }
    }
    return best;
  };

  City.prototype.randomRoadPoint = function () {
    var horiz = this.rng() < 0.5;
    if (horiz) return { x: 60 + this.rng() * (CFG.WORLD_W - 120), y: this.roadY(Math.floor(this.rng() * (CFG.ROWS + 1))) };
    return { x: this.roadX(Math.floor(this.rng() * (CFG.COLS + 1))), y: 60 + this.rng() * (CFG.CITY_H - 120) };
  };

  window.LB.City = City;
  window.LB.mulberry32 = mulberry32;
})();
