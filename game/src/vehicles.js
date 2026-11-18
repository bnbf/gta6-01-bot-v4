// LUMEN BAY: vehicles — traffic AI on the road grid, parked cars, player
// arcade driving, police chase/ram/bust AI and the police helicopter.
(function () {
  'use strict';
  var CFG = window.LB.CFG;

  function makeCar(typeIdx, x, y, angle, opts) {
    opts = opts || {};
    var t = window.LB.CAR_TYPES[typeIdx % window.LB.CAR_TYPES.length];
    return {
      type: typeIdx, name: t.name, color: t.color, top: t.top, accel: t.accel,
      x: x, y: y, angle: angle || 0, speed: 0,
      hp: 100, smoke: 0, nos: opts.nos || false, nosLeft: 0,
      police: !!opts.police, heli: false, taxi: t.name === 'Taxi',
      stolen: false, target: null, wait: 0, siren: 0,
      vx: 0, vy: 0
    };
  }

  function Vehicles(game) { this.game = game; this.traffic = []; this.parked = []; this.police = []; this.heli = null; }

  Vehicles.prototype.spawnTraffic = function (n) {
    for (var i = 0; i < n; i++) {
      var p = this.game.city.randomRoadPoint();
      var horiz = this.game.city.onRoadX(p.x) && !this.game.city.onRoadY(p.y) ? false : (this.game.city.onRoadY(p.y) && !this.game.city.onRoadX(p.x));
      var c = makeCar(Math.floor(Math.random() * 5), p.x, p.y, horiz ? 0 : Math.PI / 2);
      c.speed = 90 + Math.random() * 60;
      c.target = this.game.city.randomRoadPoint();
      this.traffic.push(c);
    }
  };

  Vehicles.prototype.spawnParked = function (n) {
    var tries = 0;
    while (this.parked.length < n && tries++ < 400) {
      var p = this.game.city.randomRoadPoint();
      var horiz = Math.abs(p.y - this.game.city.roadY(Math.round((p.y - CFG.ROAD / 2) / (CFG.BLOCK + CFG.ROAD)))) < 30;
      var x = p.x + (horiz ? 0 : 26), y = p.y + (horiz ? 26 : 0);
      if (this.game.city.blocked(x, y, 20)) continue;
      var near = false;
      for (var i = 0; i < this.parked.length; i++) {
        var d = Math.hypot(this.parked[i].x - x, this.parked[i].y - y);
        if (d < 70) { near = true; break; }
      }
      if (near) continue;
      this.parked.push(makeCar(Math.floor(Math.random() * 5), x, y, horiz ? 0 : Math.PI / 2));
    }
  };

  Vehicles.prototype.nearestParked = function (x, y, maxD) {
    var best = null, bd = maxD;
    for (var i = 0; i < this.parked.length; i++) {
      var d = Math.hypot(this.parked[i].x - x, this.parked[i].y - y);
      if (d < bd) { bd = d; best = this.parked[i]; }
    }
    return best;
  };

  Vehicles.prototype.spawnPolice = function (x, y) {
    var c = makeCar(5, x, y, 0, { police: true });
    c.speed = 120; c.color = '#20242e';
    this.police.push(c);
    return c;
  };

  Vehicles.prototype.spawnHeli = function () {
    if (this.heli) return this.heli;
    this.heli = {
      heli: true, x: this.game.player.x + 300, y: this.game.player.y - 300,
      angle: 0, speed: 0, hp: 100, shootT: 0, spotlight: 0, police: true,
      color: '#20242e', name: 'Police Heli'
    };
    return this.heli;
  };

  Vehicles.prototype.destroyHeli = function () {
    this.heli = null;
    this.game.player.cash += CFG.HELI_BOUNTY;
    this.game.addFloatText(this.game.player.x, this.game.player.y - 30, '+$' + CFG.HELI_BOUNTY + ' HELI DOWN', '#ffe600');
  };

  // Drive the player's car: arcade physics, building collision, damage + smoke.
  Vehicles.prototype.drivePlayerCar = function (car, input, dt) {
    var max = car.top * (car.nosLeft > 0 ? 1.45 : 1);
    if (input.up) car.speed += car.accel * dt * (car.nosLeft > 0 ? 1.6 : 1);
    else if (input.down) car.speed -= CFG.CAR_BRAKE * dt * 0.7;
    else car.speed -= Math.sign(car.speed) * 140 * dt;
    if (car.speed > max) car.speed = max;
    if (car.speed < -90) car.speed = -90;
    if (Math.abs(car.speed) > 5) {
      var steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      car.angle += steer * CFG.CAR_TURN * dt * (car.speed > 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 120);
    }
    if (input.nos && car.nos && car.nosLeft <= 0 && car.speed > 40) { car.nosLeft = 3; this.game.audio.play('nos'); }
    if (car.nosLeft > 0) car.nosLeft -= dt;
    var nx = car.x + Math.cos(car.angle) * car.speed * dt;
    var ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!this.game.city.blocked(nx, car.y, 16)) car.x = nx; else { this.crash(car, Math.abs(car.speed)); car.speed *= -0.25; }
    if (!this.game.city.blocked(car.x, ny, 16)) car.y = ny; else { this.crash(car, Math.abs(car.speed)); car.speed *= -0.25; }
    car.x = Math.max(20, Math.min(CFG.WORLD_W - 20, car.x));
    car.y = Math.max(20, Math.min(CFG.WORLD_H - 20, car.y));
    car.hp = Math.max(0, car.hp);
    car.smoke = car.hp < 55 ? (55 - car.hp) / 55 : 0;
    // Ram traffic out of the way.
    for (var i = 0; i < this.traffic.length; i++) {
      var t = this.traffic[i];
      var d = Math.hypot(t.x - car.x, t.y - car.y);
      if (d < 34 && Math.abs(car.speed) > 60) { this.crash(car, 30); t.x += Math.cos(car.angle) * 26; t.y += Math.sin(car.angle) * 26; this.game.audio.play('crash'); }
    }
  };

  Vehicles.prototype.crash = function (car, force) {
    if (force < 40) return;
    car.hp -= force * 0.06;
    if (car.hp < 0) car.hp = 0;
  };

  Vehicles.prototype.updateTraffic = function (dt) {
    var px = this.game.player.x, py = this.game.player.y;
    for (var i = 0; i < this.traffic.length; i++) {
      var c = this.traffic[i];
      if (!c.target) c.target = this.game.city.randomRoadPoint();
      var dx = c.target.x - c.x, dy = c.target.y - c.y;
      var dist = Math.hypot(dx, dy);
      if (dist < 30) { c.target = this.game.city.randomRoadPoint(); continue; }
      var want = Math.atan2(dy, dx);
      var diff = want - c.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
      // Slow for the car ahead.
      var slow = false;
      for (var j = 0; j < this.traffic.length; j++) {
        if (i === j) continue;
        var o = this.traffic[j];
        var ox = o.x - c.x, oy = o.y - c.y;
        if (Math.hypot(ox, oy) < 46 && Math.cos(c.angle) * ox + Math.sin(c.angle) * oy > 0) { slow = true; break; }
      }
      var targetSpeed = slow ? 30 : 110;
      c.speed += (targetSpeed - c.speed) * dt * 0.8;
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      // Keep traffic near the player: respawn far cars closer.
      if (Math.hypot(c.x - px, c.y - py) > 1400) {
        var p = this.game.city.nearestRoadPoint(px + (Math.random() - 0.5) * 900, py + (Math.random() - 0.5) * 900);
        c.x = p.x; c.y = p.y; c.target = this.game.city.randomRoadPoint();
      }
    }
  };

  Vehicles.prototype.updatePolice = function (dt) {
    var p = this.game.player, wanted = this.game.wanted;
    var wantCount = wanted >= 1 ? 1 : 0;
    if (wanted >= 2) wantCount = 2;
    if (wanted >= 3) wantCount = 3;
    if (wanted >= 5) wantCount = 4;
    while (this.police.length < wantCount) {
      var a = Math.random() * Math.PI * 2;
      this.spawnPolice(p.x + Math.cos(a) * 500, p.y + Math.sin(a) * 500);
    }
    while (this.police.length > wantCount) this.police.pop();
    for (var i = 0; i < this.police.length; i++) {
      var c = this.police[i];
      c.siren += dt;
      var dx = p.x - c.x, dy = p.y - c.y;
      var dist = Math.hypot(dx, dy);
      var want = Math.atan2(dy, dx);
      var diff = want - c.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.angle += Math.max(-3.4 * dt, Math.min(3.4 * dt, diff));
      var spd = Math.min(340, 200 + wanted * 30);
      // Ram: full speed when far, ease off when adjacent to bust.
      c.speed += ((dist > 60 ? spd : 40) - c.speed) * dt * 1.2;
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      if (dist < 44 && Math.abs(c.speed) < 90) {
        // Bust attempt: player on foot or slow car gets busted.
        if (!p.inCar || Math.abs(p.car.speed) < 50) this.game.bust();
      }
      // Police cars also damage the player's car on impact.
      if (p.inCar && dist < 36) { this.crash(p.car, 60); this.game.audio.play('crash'); c.x -= Math.cos(c.angle) * 20; c.y -= Math.sin(c.angle) * 20; }
    }
    // Helicopter from 4 stars.
    if (wanted >= CFG.HELI_MIN_STARS) {
      var h = this.spawnHeli();
      var hx = p.x - h.x, hy = p.y - h.y;
      var hd = Math.hypot(hx, hy);
      h.angle = Math.atan2(hy, hx);
      var hs = hd > 260 ? 190 : 60;
      h.x += Math.cos(h.angle) * hs * dt;
      h.y += Math.sin(h.angle) * hs * dt;
      h.shootT -= dt;
      if (h.shootT <= 0 && hd < 420) {
        h.shootT = 1.1;
        p.health -= 4;
        this.game.audio.play('shot');
        this.game.addFloatText(p.x, p.y - 24, '-4 HP', '#ff5555');
        if (p.health <= 0) this.game.wasted();
      }
    } else if (this.heli) this.heli = null;
  };

  window.LB.Vehicles = Vehicles;
  window.LB.makeCar = makeCar;
})();
