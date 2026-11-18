// LUMEN BAY: pedestrians — strolling citizens who flee crime, flag taxis,
// and can be chased/busted by foot officers when the player is wanted.
(function () {
  'use strict';
  var CFG = window.LB.CFG;

  function People(game) { this.game = game; this.peds = []; this.officers = []; }

  People.prototype.spawn = function (n) {
    for (var i = 0; i < n; i++) {
      var p = this.game.city.randomRoadPoint();
      this.peds.push({
        x: p.x + (Math.random() - 0.5) * 40, y: p.y + (Math.random() - 0.5) * 40,
        angle: Math.random() * Math.PI * 2, speed: 28 + Math.random() * 22,
        color: ['#e8c39e', '#c98d5f', '#8a5a3b', '#f0d0b0'][Math.floor(Math.random() * 4)],
        shirt: ['#e33f5f', '#3f7de3', '#7CFF00', '#ffe600', '#b967ff', '#fff'][Math.floor(Math.random() * 6)],
        flee: 0, taxi: false, target: null, wait: 0
      });
    }
  };

  People.prototype.nearestPed = function (x, y, maxD) {
    var best = null, bd = maxD;
    for (var i = 0; i < this.peds.length; i++) {
      var d = Math.hypot(this.peds[i].x - x, this.peds[i].y - y);
      if (d < bd) { bd = d; best = this.peds[i]; }
    }
    return best;
  };

  People.prototype.update = function (dt) {
    var g = this.game, p = g.player;
    var crime = g.wanted > 0 && (g.shotsFiredRecently > 0 || g.lastTheftT < 3);
    for (var i = 0; i < this.peds.length; i++) {
      var ped = this.peds[i];
      if (crime && Math.hypot(ped.x - p.x, ped.y - p.y) < 320) ped.flee = 2.5;
      if (ped.flee > 0) {
        ped.flee -= dt;
        var a = Math.atan2(ped.y - p.y, ped.x - p.x);
        ped.x += Math.cos(a) * 130 * dt; ped.y += Math.sin(a) * 130 * dt;
        ped.angle = a;
      } else {
        if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 24) {
          ped.target = g.city.randomRoadPoint();
        }
        var dx = ped.target.x - ped.x, dy = ped.target.y - ped.y;
        var d = Math.hypot(dx, dy) || 1;
        ped.angle = Math.atan2(dy, dx);
        var nx = ped.x + (dx / d) * ped.speed * dt, ny = ped.y + (dy / d) * ped.speed * dt;
        if (!g.city.blocked(nx, ped.y, 8)) ped.x = nx;
        if (!g.city.blocked(ped.x, ny, 8)) ped.y = ny;
      }
      // Taxi flag: a ped near a stopped taxi car waves for a fare.
      ped.taxi = p.inCar && p.car && p.car.taxi && Math.hypot(ped.x - p.x, ped.y - p.y) < 90 && Math.abs(p.car.speed) < 20;
    }
    // Foot officers appear at wanted 2+ and chase the player on foot.
    var wantOff = g.wanted >= 2 ? 1 : 0;
    if (g.wanted >= 4) wantOff = 2;
    while (this.officers.length < wantOff) {
      var ang = Math.random() * Math.PI * 2;
      this.officers.push({ x: p.x + Math.cos(ang) * 320, y: p.y + Math.sin(ang) * 320, speed: 165, angle: 0 });
    }
    while (this.officers.length > wantOff) this.officers.pop();
    for (var j = 0; j < this.officers.length; j++) {
      var o = this.officers[j];
      var odx = p.x - o.x, ody = p.y - o.y, od = Math.hypot(odx, ody) || 1;
      o.angle = Math.atan2(ody, odx);
      o.x += (odx / od) * o.speed * dt; o.y += (ody / od) * o.speed * dt;
      if (od < 26 && !p.inCar) g.bust();
    }
  };

  window.LB.People = People;
})();
