// LUMEN BAY: localStorage save/load + autosave (cash, health, ammo, weapons,
// missions, score, position, clock, wanted).
(function () {
  'use strict';
  var CFG = window.LB.CFG;

  function Save(game) { this.game = game; }

  Save.prototype.serialize = function () {
    var g = this.game, p = g.player;
    return {
      v: 4, cash: p.cash, health: p.health, score: p.score,
      x: Math.round(p.x), y: Math.round(p.y),
      weapon: p.weapon, ammo: p.ammo, owned: p.owned,
      mission: g.missions.index, done: g.missions.done,
      clock: g.clock, wanted: g.wanted, savedAt: Date.now()
    };
  };

  Save.prototype.save = function () {
    try {
      localStorage.setItem(CFG.SAVE_KEY, JSON.stringify(this.serialize()));
      return true;
    } catch (e) { return false; }
  };

  Save.prototype.load = function () {
    var raw;
    try { raw = localStorage.getItem(CFG.SAVE_KEY); } catch (e) { return false; }
    if (!raw) return false;
    var d;
    try { d = JSON.parse(raw); } catch (e) { return false; }
    if (!d || d.v !== 4) return false;
    var g = this.game, p = g.player;
    p.cash = d.cash; p.health = d.health; p.score = d.score;
    p.x = d.x; p.y = d.y;
    p.weapon = d.weapon || 'pistol'; p.ammo = d.ammo || p.ammo; p.owned = d.owned || p.owned;
    g.missions.index = d.mission || 0; g.missions.done = d.done || 0;
    g.clock = d.clock || CFG.CLOCK_START;
    g.wanted = d.wanted || 0;
    g.missions.startMission(g.missions.index);
    return true;
  };

  Save.prototype.hasSave = function () {
    try { return !!localStorage.getItem(CFG.SAVE_KEY); } catch (e) { return false; }
  };

  window.LB.Save = Save;
})();
