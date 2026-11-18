// LUMEN BAY: HUD — wanted stars, cash, health, ammo, speed, clock, rank,
// objective, compass, radio display; start/pause/busted/wasted screens.
(function () {
  'use strict';
  var CFG = window.LB.CFG;

  function Hud(game) { this.game = game; }

  Hud.prototype.el = function (id) { return document.getElementById(id); };

  Hud.prototype.stars = function (n) {
    var s = '';
    for (var i = 0; i < CFG.WANTED_MAX; i++) s += i < n ? '★' : '☆';
    return s;
  };

  Hud.prototype.clockText = function () {
    var m = Math.floor(this.game.clock) % (24 * 60);
    var hh = Math.floor(m / 60), mm = m % 60;
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  };

  Hud.prototype.update = function () {
    var g = this.game, p = g.player;
    var set = function (id, txt) { var e = document.getElementById(id); if (e) e.textContent = txt; };
    set('hud-stars', this.stars(g.wanted));
    set('hud-cash', '$' + Math.floor(p.cash));
    set('hud-health', 'HP ' + Math.max(0, Math.ceil(p.health)));
    var w = window.LB.WEAPONS[p.weapon];
    set('hud-ammo', w.name + ' ' + (p.ammo[p.weapon] || 0) + ' / ∞');
    set('hud-speed', p.inCar && p.car ? Math.round(Math.abs(p.car.speed) * 0.28) + ' mph' : '—');
    set('hud-clock', this.clockText());
    set('hud-rank', p.rankName() + ' · ' + p.score + ' pts');
    set('hud-objective', g.missions.objectiveText());
    var m = g.missions.marker();
    if (m) {
      var a = Math.atan2(m.y - p.y, m.x - p.x);
      var arrows = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
      var idx = Math.round(a / (Math.PI / 4)) % 8;
      if (idx < 0) idx += 8;
      set('hud-compass', '◆ ' + arrows[idx] + ' ' + Math.round(Math.hypot(m.x - p.x, m.y - p.y)) + 'm');
    } else set('hud-compass', '');
    set('hud-radio', g.audio.radioOn ? ('♪ ' + (g.audio.station === 0 ? 'NEON FM' : 'SUNSET DRIVE') + ' (R: off, 1/2: station)') : 'Radio off — press R in a car');
    set('hud-weapons', Object.keys(window.LB.WEAPONS).map(function (k) {
      return (p.owned[k] ? '● ' : '○ ') + window.LB.WEAPONS[k].name + (k === p.weapon ? ' ◄' : '');
    }).join('  '));
    var bar = this.el('hud-healthbar');
    if (bar) { bar.style.width = Math.max(0, p.health) + '%'; bar.style.background = p.health > 50 ? '#7CFF00' : (p.health > 25 ? '#ffe600' : '#ff2222'); }
  };

  Hud.prototype.showScreen = function (id) {
    var ids = ['screen-title', 'screen-pause', 'screen-busted', 'screen-wasted'];
    for (var i = 0; i < ids.length; i++) {
      var e = this.el(ids[i]);
      if (e) e.style.display = ids[i] === id ? 'block' : 'none';
    }
  };

  Hud.prototype.hideScreens = function () { this.showScreen(null); };

  Hud.prototype.fillTitle = function () {
    var e = this.el('title-features');
    if (!e) return;
    e.innerHTML = [
      '7 story missions — First Wheels to King of the Bay',
      'Police helicopter from 4★ — shoot it down for +$500',
      '4 weapons: pistol, SMG, shotgun, rifle',
      'Car radio: 2 procedural synthwave stations',
      'Shops: LUMEN ARMS, Neon Diner, Volt Garage (repair + NOS)',
      'Safehouse: heal + save · Drive-by shooting · Car damage + smoke',
      'Street races & taxi fares · Wanted 1–5★ · Saves + autosave'
    ].map(function (f) { return '<li>' + f + '</li>'; }).join('');
  };

  window.LB.Hud = Hud;
})();
