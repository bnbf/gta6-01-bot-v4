// LUMEN BAY: 7 story missions plus the street-race and taxi side jobs.
// Each mission has a marker, an objective, and a completion check the loop calls.
(function () {
  'use strict';
  var CFG = window.LB.CFG;

  function Missions(game) {
    this.game = game;
    this.index = 0;            // current mission (0-based) into LB.MISSIONS
    this.done = 0;
    this.state = {};           // per-mission scratch
    this.timer = 0;
    this.race = null;          // {points:[], next:0, rival:0}
    this.taxi = null;          // {fare, dest, timer}
    this.completedAll = false;
  }

  Missions.prototype.current = function () { return window.LB.MISSIONS[this.index] || null; };
  Missions.prototype.objectiveText = function () {
    var m = this.current();
    if (!m) return 'Free roam — explore Lumen Bay. Press M for missions.';
    var s = this.state;
    switch (m.id) {
      case 1: return s.stolen ? 'Deliver the car to Volt Garage.' : 'Steal a car (press E near one).';
      case 2: return 'Deliver the package to the Neon Diner. ' + Math.ceil(this.timer) + 's left.';
      case 3: return 'Collect protection money: ' + (s.collected || 0) + '/3 shops.';
      case 4: return this.game.wanted > 0 ? 'Lose the heat (' + this.game.wanted + '★), then reach Harbor Loft.' : 'Heat is off — reach the Harbor Loft safehouse.';
      case 5: return s.grabbed ? 'Escape! Get away from the bank with the cash.' : 'Reach the Lumen Trust Bank vault.';
      case 6: return 'Race: hit checkpoint ' + ((this.race ? this.race.next : 0) + 1) + '/4 before the rival.';
      case 7: return 'Survive 5★ at the Marina: ' + Math.ceil(this.timer) + 's left.';
      default: return m.brief;
    }
  };

  Missions.prototype.marker = function () {
    var lm = this.game.city.landmarks, m = this.current(), s = this.state;
    if (!m) return null;
    switch (m.id) {
      case 1: return s.stolen ? lm.garage : null; // marker appears once a car is stolen
      case 2: return lm.diner;
      case 3: {
        var shops = [lm.gun, lm.diner, lm.garage];
        return shops[s.collected || 0] || null;
      }
      case 4: return lm.safehouse;
      case 5: return s.grabbed ? lm.marina : lm.bank;
      case 6: return this.race ? this.race.points[this.race.next] : null;
      case 7: return lm.marina;
      default: return null;
    }
  };

  Missions.prototype.startMission = function (idx) {
    this.index = idx; this.state = {}; this.timer = 0;
    var g = this.game, lm = g.city.landmarks;
    var m = this.current();
    if (!m) return;
    if (m.id === 2) this.timer = 90;
    if (m.id === 6) {
      this.race = {
        points: [
          { x: lm.race.x, y: lm.race.y }, { x: g.city.roadX(6), y: g.city.roadY(0) },
          { x: g.city.roadX(6), y: g.city.roadY(5) }, { x: g.city.roadX(0), y: g.city.roadY(5) }
        ],
        next: 0, rival: 0, rivalT: 0
      };
    }
    if (m.id === 7) { this.timer = 60; g.setWanted(5); }
    g.addFloatText(g.player.x, g.player.y - 40, 'MISSION: ' + m.name, '#00f0ff');
    g.audio.play('mission');
  };

  Missions.prototype.complete = function () {
    var g = this.game, m = this.current();
    if (!m) return;
    g.player.cash += m.pay;
    g.player.score += m.pay;
    this.done++;
    g.addFloatText(g.player.x, g.player.y - 40, 'MISSION COMPLETE +$' + m.pay, '#7CFF00');
    g.audio.play('complete');
    this.index++;
    this.state = {};
    if (this.index >= window.LB.MISSIONS.length) { this.completedAll = true; this.index = window.LB.MISSIONS.length; return; }
    this.startMission(this.index);
  };

  Missions.prototype.fail = function (why) {
    var g = this.game;
    g.addFloatText(g.player.x, g.player.y - 40, 'MISSION FAILED: ' + why, '#ff5555');
    g.audio.play('fail');
    this.state = {};
    this.startMission(this.index); // retry the same mission
  };

  Missions.prototype.update = function (dt) {
    var g = this.game, p = g.player, m = this.current(), s = this.state;
    if (!m) { this.updateSideJobs(dt); return; }
    var lm = g.city.landmarks;
    var near = function (pt, d) { return pt && Math.hypot(p.x - pt.x, p.y - pt.y) < d; };
    switch (m.id) {
      case 1:
        if (p.inCar && !s.stolen) { s.stolen = true; }
        if (s.stolen && near(lm.garage, 90)) this.complete();
        break;
      case 2:
        this.timer -= dt;
        if (this.timer <= 0) { this.fail('too slow'); break; }
        if (near(lm.diner, 80)) this.complete();
        break;
      case 3: {
        var shops = [lm.gun, lm.diner, lm.garage];
        var tgt = shops[s.collected || 0];
        if (tgt && near(tgt, 80)) {
          s.collected = (s.collected || 0) + 1;
          p.cash += 150; p.score += 150;
          g.addFloatText(p.x, p.y - 30, '+$150 collected', '#7CFF00');
          g.audio.play('pickup');
          if (s.collected >= 3) this.complete();
        }
        break;
      }
      case 4:
        if (g.wanted === 0 && near(lm.safehouse, 90)) this.complete();
        break;
      case 5:
        if (!s.grabbed && near(lm.bank, 80)) {
          s.grabbed = true; p.cash += 400; p.score += 400;
          g.setWanted(5);
          g.addFloatText(p.x, p.y - 30, '+$400 VAULT CASH', '#ffe600');
          g.audio.play('alarm');
        } else if (s.grabbed) {
          s.escapeT = (s.escapeT || 0) + dt;
          if (near(lm.marina, 110) && s.escapeT > 5) this.complete();
        }
        break;
      case 6: {
        var r = this.race;
        if (!r) break;
        r.rivalT += dt;
        r.rival = Math.min(4, Math.floor(r.rivalT / 18)); // rival pace: 18s per checkpoint
        var pt = r.points[r.next];
        if (pt && near(pt, 90)) {
          r.next++;
          g.audio.play('pickup');
          if (r.next >= 4) {
            if (r.rival < 4) this.complete(); else this.fail('rival won the race');
          }
        }
        if (r.rival >= 4 && r.next < 4) this.fail('rival won the race');
        break;
      }
      case 7:
        this.timer -= dt;
        if (g.wanted < 5) g.setWanted(5);
        if (this.timer <= 0) this.complete();
        break;
    }
    this.updateSideJobs(dt);
  };

  // Taxi fares: pick up a waving ped in a taxi, drop them at a random landmark.
  Missions.prototype.updateSideJobs = function (dt) {
    var g = this.game, p = g.player;
    if (this.taxi) {
      this.taxi.timer -= dt;
      var dest = this.taxi.dest;
      if (Math.hypot(p.x - dest.x, p.y - dest.y) < 90) {
        p.cash += this.taxi.fare; p.score += this.taxi.fare;
        g.addFloatText(p.x, p.y - 30, 'FARE +$' + this.taxi.fare, '#7CFF00');
        g.audio.play('pickup');
        this.taxi = null;
      } else if (this.taxi.timer <= 0) { this.taxi = null; }
      return;
    }
    if (p.inCar && p.car && p.car.taxi && Math.abs(p.car.speed) < 20) {
      var ped = g.people.nearestPed(p.x, p.y, 90);
      if (ped && ped.taxi) {
        var keys = ['diner', 'bank', 'safehouse', 'garage', 'marina'];
        var dest2 = g.city.landmarks[keys[Math.floor(Math.random() * keys.length)]];
        this.taxi = { fare: 60 + Math.floor(Math.random() * 90), dest: dest2, timer: 75 };
        g.addFloatText(p.x, p.y - 30, 'TAXI FARE: take them to ' + dest2.label, '#ffe600');
      }
    }
  };

  window.LB.Missions = Missions;
})();
