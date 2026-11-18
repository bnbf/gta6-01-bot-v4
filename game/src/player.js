// LUMEN BAY: the player — walk/run, steal and exit cars, mouse-aim hitscan
// shooting with 4 weapons, drive-by shooting, pickups, health and cash.
(function () {
  'use strict';
  var CFG = window.LB.CFG;

  function Player(game) {
    this.game = game;
    this.x = 0; this.y = 0; this.angle = 0; this.aim = 0;
    this.health = CFG.START_HEALTH; this.cash = CFG.START_CASH;
    this.inCar = false; this.car = null;
    this.weapon = 'pistol';
    this.ammo = { pistol: 48, smg: 0, shotgun: 0, rifle: 0 };
    this.owned = { pistol: true, smg: false, shotgun: false, rifle: false };
    this.fireT = 0; this.score = 0;
  }

  Player.prototype.spawn = function (x, y) { this.x = x; this.y = y; this.angle = -Math.PI / 2; };

  Player.prototype.walk = function (input, dt) {
    var sp = input.run ? CFG.PLAYER_RUN : CFG.PLAYER_SPEED;
    var mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    var my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (mx || my) {
      var len = Math.hypot(mx, my);
      var nx = this.x + (mx / len) * sp * dt;
      var ny = this.y + (my / len) * sp * dt;
      if (!this.game.city.blocked(nx, this.y, 12)) this.x = nx;
      if (!this.game.city.blocked(this.x, ny, 12)) this.y = ny;
      this.angle = Math.atan2(my, mx);
    }
    this.x = Math.max(16, Math.min(CFG.WORLD_W - 16, this.x));
    this.y = Math.max(16, Math.min(CFG.WORLD_H - 16, this.y));
  };

  Player.prototype.stealCar = function () {
    var car = this.game.vehicles.nearestParked(this.x, this.y, 64);
    if (!car) return false;
    var idx = this.game.vehicles.parked.indexOf(car);
    if (idx >= 0) this.game.vehicles.parked.splice(idx, 1);
    this.inCar = true; this.car = car;
    this.car.x = this.x; this.car.y = this.y;
    if (!car.stolen) {
      car.stolen = true;
      this.game.raiseWanted(1);
      this.game.lastTheftT = 0;
      this.game.addFloatText(this.x, this.y - 28, 'CAR STOLEN +1★', '#ff5555');
    }
    this.game.audio.play('steal');
    return true;
  };

  Player.prototype.exitCar = function () {
    if (!this.inCar || !this.car) return;
    var car = this.car;
    this.inCar = false; this.car = null;
    this.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    this.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    if (this.game.city.blocked(this.x, this.y, 12)) { this.x = car.x; this.y = car.y - 30; }
    // The car becomes parked again where it was left.
    this.game.vehicles.parked.push(car);
    car.speed = 0;
  };

  Player.prototype.tryShoot = function (dt) {
    this.fireT -= dt;
    var w = window.LB.WEAPONS[this.weapon];
    if (!w) return;
    if (!this.game.input.mouseDown && !this.game.input.mouseHeld) return;
    if (this.fireT > 0) return;
    if (!w.auto && this.game.input.mouseClicked === false) return;
    if (this.ammo[this.weapon] <= 0) { this.game.audio.play('dry'); this.fireT = 0.25; return; }
    this.fireT = w.rate;
    this.ammo[this.weapon]--;
    this.game.shotsFiredRecently = 2;
    this.game.audio.play('shot');
    var pellets = w.pellets || 1;
    var hitSomething = false;
    for (var k = 0; k < pellets; k++) {
      var a = this.aim + (Math.random() - 0.5) * 2 * w.spread;
      var hx = this.x + Math.cos(a) * w.range, hy = this.y + Math.sin(a) * w.range;
      // Hit police cars / helicopter along the ray (approx: nearest within a cone).
      var targets = this.game.vehicles.police.slice();
      if (this.game.vehicles.heli) targets.push(this.game.vehicles.heli);
      for (var i = 0; i < targets.length; i++) {
        var t = targets[i];
        var dx = t.x - this.x, dy = t.y - this.y;
        var d = Math.hypot(dx, dy);
        if (d > w.range + 40) continue;
        var ang = Math.atan2(dy, dx), diff = Math.abs(((ang - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (diff < 0.09 + 30 / Math.max(60, d)) {
          hitSomething = true;
          if (t.heli) {
            t.hp -= w.damage;
            this.game.addFloatText(t.x, t.y - 20, '-' + w.damage, '#ffe600');
            if (t.hp <= 0) this.game.vehicles.destroyHeli();
          } else {
            t.hp = (t.hp || 100) - w.damage;
            if (t.hp <= 0) {
              var pi = this.game.vehicles.police.indexOf(t);
              if (pi >= 0) this.game.vehicles.police.splice(pi, 1);
              this.game.player.cash += 50;
              this.game.addFloatText(t.x, t.y, '+$50', '#7CFF00');
            }
          }
          hx = t.x; hy = t.y;
          break;
        }
      }
      this.game.tracers.push({ x1: this.x, y1: this.y, x2: hx, y2: hy, t: 0.08 });
    }
    if (hitSomething) this.game.raiseWanted(0); // shooting near police keeps heat; no extra star here
    else if (Math.random() < 0.25) this.game.raiseWanted(0);
    // Firing a gun in public draws attention.
    if (this.game.wanted === 0 && Math.random() < 0.4) this.game.raiseWanted(1);
  };

  Player.prototype.buyWeapon = function (key) {
    var w = window.LB.WEAPONS[key];
    if (!w || this.owned[key]) return false;
    if (this.cash < w.price) return false;
    this.cash -= w.price; this.owned[key] = true;
    this.ammo[key] = w.mag; this.weapon = key;
    return true;
  };

  Player.prototype.buyAmmo = function (key) {
    var w = window.LB.WEAPONS[key];
    if (!w || !this.owned[key]) return false;
    if (this.cash < w.ammoPrice) return false;
    this.cash -= w.ammoPrice; this.ammo[key] += w.mag;
    return true;
  };

  Player.prototype.rankName = function () {
    var name = 'Street Punk';
    var ranks = CFG.RANKS;
    for (var i = 0; i < ranks.length; i++) if (this.score >= ranks[i].min) name = ranks[i].name;
    return name;
  };

  window.LB.Player = Player;
})();
