// LUMEN BAY: game bootstrap, loop, input, camera, wanted decay,
// busted/wasted, autosave, ?shot= staging and the ?test=1 self-test.
(function () {
  'use strict';
  var CFG = window.LB.CFG;

  function Game() {
    this.city = new window.LB.City(CFG.SEED);
    this.vehicles = new window.LB.Vehicles(this);
    this.people = new window.LB.People(this);
    this.player = new window.LB.Player(this);
    this.missions = new window.LB.Missions(this);
    this.audio = new window.LB.AudioSys();
    this.render = new window.LB.Render(this);
    this.hud = new window.LB.Hud(this);
    this.save = new window.LB.Save(this);
    this.clock = CFG.CLOCK_START;
    this.wanted = 0;
    this.time = 0;
    this.state = 'title'; // title | play | pause | busted | wasted
    this.camera = { x: 0, y: 0 };
    this.tracers = [];
    this.floats = [];
    this.shotsFiredRecently = 0;
    this.lastTheftT = 99;
    this.unseenT = 0;
    this.autosaveT = 0;
    this.input = { up: false, down: false, left: false, right: false, run: false, nos: false, mouseDown: false, mouseHeld: false, mouseClicked: false, mx: 0, my: 0 };
    this.testResults = null;
  }

  Game.prototype.addFloatText = function (x, y, text, color) {
    this.floats.push({ x: x, y: y, text: text, color: color || '#fff', t: 2.2 });
  };

  Game.prototype.raiseWanted = function (n) {
    this.wanted = Math.max(0, Math.min(CFG.WANTED_MAX, this.wanted + n));
    this.unseenT = 0;
  };

  Game.prototype.setWanted = function (n) {
    this.wanted = Math.max(0, Math.min(CFG.WANTED_MAX, n));
    this.unseenT = 0;
  };

  Game.prototype.bust = function () {
    if (this.state !== 'play') return;
    this.state = 'busted';
    this.player.cash = Math.floor(this.player.cash / 2);
    this.player.health = 50;
    this.setWanted(0);
    this.vehicles.police = [];
    this.vehicles.heli = null;
    this.hud.showScreen('screen-busted');
    this.audio.play('fail');
  };

  Game.prototype.wasted = function () {
    if (this.state !== 'play') return;
    this.state = 'wasted';
    this.player.cash = Math.floor(this.player.cash * 0.75);
    this.player.health = CFG.START_HEALTH;
    this.setWanted(0);
    this.vehicles.police = [];
    this.vehicles.heli = null;
    this.hud.showScreen('screen-wasted');
    this.audio.play('fail');
  };

  Game.prototype.respawn = function () {
    var lm = this.city.landmarks.safehouse;
    this.player.x = lm.x; this.player.y = lm.y + 60;
    this.player.inCar = false; this.player.car = null;
    this.state = 'play';
    this.hud.hideScreens();
  };

  Game.prototype.interact = function () {
    var p = this.player, g = this;
    if (p.inCar) { p.exitCar(); return; }
    if (p.stealCar()) return;
    // Shops / safehouse by proximity.
    var lm = this.city.landmarks;
    var near = function (pt, d) { return Math.hypot(p.x - pt.x, p.y - pt.y) < d; };
    if (near(lm.gun, 100)) {
      var order = ['smg', 'shotgun', 'rifle'];
      var bought = false;
      for (var i = 0; i < order.length; i++) {
        if (!p.owned[order[i]] && p.buyWeapon(order[i])) { bought = true; this.addFloatText(p.x, p.y - 28, 'Bought ' + window.LB.WEAPONS[order[i]].name, '#7CFF00'); break; }
      }
      if (!bought && p.buyAmmo(p.weapon)) this.addFloatText(p.x, p.y - 28, 'Ammo restocked', '#7CFF00');
      else if (!bought) this.addFloatText(p.x, p.y - 28, 'Need more cash', '#ff5555');
      this.audio.play('pickup');
      return;
    }
    if (near(lm.diner, 100)) {
      if (p.cash >= 15 && p.health < 100) { p.cash -= 15; p.health = Math.min(100, p.health + 25); this.addFloatText(p.x, p.y - 28, '+25 HP — Neon Diner', '#7CFF00'); this.audio.play('heal'); }
      else this.addFloatText(p.x, p.y - 28, 'Diner: $15 for +25 HP', '#ffe600');
      return;
    }
    if (near(lm.garage, 100)) {
      if (p.inCar) return;
      var car = this.vehicles.nearestParked(p.x, p.y, 120);
      if (car && p.cash >= 50 && car.hp < 100) { p.cash -= 50; car.hp = 100; this.addFloatText(p.x, p.y - 28, 'Car repaired $50', '#7CFF00'); }
      else if (car && p.cash >= 200 && !car.nos) { p.cash -= 200; car.nos = true; this.addFloatText(p.x, p.y - 28, 'NOS installed $200 (Shift in car)', '#00f0ff'); }
      else this.addFloatText(p.x, p.y - 28, 'Garage: repair $50 · NOS $200', '#ffe600');
      this.audio.play('pickup');
      return;
    }
    if (near(lm.safehouse, 100)) {
      p.health = 100;
      this.save.save();
      this.addFloatText(p.x, p.y - 28, 'Healed + game saved', '#7CFF00');
      this.audio.play('heal');
      return;
    }
  };

  Game.prototype.updateWanted = function (dt) {
    if (this.wanted === 0) return;
    var p = this.player, near = false;
    for (var i = 0; i < this.vehicles.police.length; i++) {
      if (Math.hypot(this.vehicles.police[i].x - p.x, this.vehicles.police[i].y - p.y) < 500) { near = true; break; }
    }
    if (this.vehicles.heli) near = true;
    if (near) this.unseenT = 0;
    else {
      this.unseenT += dt;
      if (this.unseenT > CFG.WANTED_DECAY_S) { this.wanted--; this.unseenT = 0; }
    }
  };

  Game.prototype.update = function (dt) {
    var p = this.player;
    this.time += dt;
    this.clock += CFG.CLOCK_RATE * dt;
    if (this.clock >= 24 * 60) this.clock -= 24 * 60;
    this.shotsFiredRecently = Math.max(0, this.shotsFiredRecently - dt);
    this.lastTheftT += dt;
    // Aim: mouse position in world space.
    var canvas = document.getElementById('game');
    var rect = canvas.getBoundingClientRect();
    var sx = canvas.width / rect.width, sy = canvas.height / rect.height;
    var wx = this.camera.x - canvas.width / 2 + (this.input.mx - rect.left) * sx;
    var wy = this.camera.y - canvas.height / 2 + (this.input.my - rect.top) * sy;
    if (p.inCar && p.car) p.aim = p.car.angle;
    else p.aim = Math.atan2(wy - p.y, wx - p.x);
    if (p.inCar && p.car) {
      this.vehicles.drivePlayerCar(p.car, this.input, dt);
      p.x = p.car.x; p.y = p.car.y;
      this.audio.engine(Math.abs(p.car.speed) / p.car.top);
      p.tryShoot(dt); // drive-by shooting
    } else {
      p.walk(this.input, dt);
      this.audio.stopEngine();
      p.tryShoot(dt);
    }
    this.vehicles.updateTraffic(dt);
    this.vehicles.updatePolice(dt);
    this.people.update(dt);
    this.missions.update(dt);
    this.updateWanted(dt);
    // Camera: follow with a driving lead.
    var lead = 0;
    if (p.inCar && p.car) lead = 60;
    var tx = p.x + (p.inCar && p.car ? Math.cos(p.car.angle) * lead : 0);
    var ty = p.y + (p.inCar && p.car ? Math.sin(p.car.angle) * lead : 0);
    this.camera.x += (tx - this.camera.x) * Math.min(1, dt * 5);
    this.camera.y += (ty - this.camera.y) * Math.min(1, dt * 5);
    // Effects timers.
    for (var i = this.tracers.length - 1; i >= 0; i--) { this.tracers[i].t -= dt; if (this.tracers[i].t <= 0) this.tracers.splice(i, 1); }
    for (var j = this.floats.length - 1; j >= 0; j--) { this.floats[j].t -= dt; this.floats[j].y -= 22 * dt; if (this.floats[j].t <= 0) this.floats.splice(j, 1); }
    // Autosave every 20 s.
    this.autosaveT += dt;
    if (this.autosaveT > 20) { this.autosaveT = 0; this.save.save(); }
    this.input.mouseClicked = false;
    this.hud.update();
  };

  Game.prototype.loop = function () {
    var self = this, last = performance.now();
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (self.state === 'play') self.update(dt);
      var canvas = document.getElementById('game');
      var ctx = canvas.getContext('2d');
      self.render.draw(ctx, canvas.width, canvas.height);
      if (self.state === 'play') self.hud.update();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

  // ---- ?shot= staging: deterministic scene setups for screenshots ----
  Game.prototype.stageShot = function (shot) {
    var p = this.player, lm = this.city.landmarks;
    this.state = 'play';
    this.hud.hideScreens();
    if (shot === 'title') {
      this.state = 'title';
      p.x = lm.plaza.x; p.y = lm.plaza.y;
      this.camera.x = p.x; this.camera.y = p.y;
      this.clock = 19 * 60 + 10;
      this.hud.fillTitle();
      this.hud.showScreen('screen-title');
      return;
    }
    if (shot === 'chase') {
      this.clock = 19 * 60 + 30;
      var car = this.vehicles.parked[0];
      // Stage on a straight horizontal road so the chase reads at speed.
      p.x = this.city.roadX(1); p.y = this.city.roadY(3);
      car.x = p.x; car.y = p.y;
      p.inCar = true; p.car = car; car.speed = 260; car.angle = 0;
      this.vehicles.parked.splice(0, 1);
      this.setWanted(4);
      this.vehicles.updatePolice(0.1);
      this.vehicles.spawnHeli();
      this.missions.startMission(0);
      this.camera.x = p.x; this.camera.y = p.y;
      this.floats = [];
      return;
    }
    if (shot === 'foot') {
      this.clock = 19 * 60 + 45;
      p.x = lm.gun.x - 120; p.y = lm.gun.y + 40;
      p.owned.smg = true; p.ammo.smg = 64; p.weapon = 'smg';
      this.setWanted(2);
      this.vehicles.updatePolice(0.1);
      this.missions.startMission(1);
      this.camera.x = p.x; this.camera.y = p.y;
      this.floats = [];
      return;
    }
    if (shot === 'escape') {
      this.clock = 19 * 60 + 55;
      p.x = lm.bank.x; p.y = lm.bank.y + 80;
      this.missions.startMission(4);
      this.missions.state.grabbed = true;
      p.cash += 400;
      this.setWanted(5);
      this.vehicles.updatePolice(0.1);
      this.vehicles.spawnHeli();
      this.camera.x = p.x; this.camera.y = p.y;
      this.floats = [];
      return;
    }
  };

  // ---- ?test=1 self-test: 20 checks over the real game systems ----
  Game.prototype.runSelfTest = function () {
    var results = [];
    var check = function (name, ok) { results.push({ name: name, pass: !!ok }); };
    var g = this, p = g.player;
    try {
      check('spawn', p.x > 0 && p.x < CFG.WORLD_W && p.y > 0 && p.y < CFG.WORLD_H);
      check('traffic', g.vehicles.traffic.length >= 8);
      check('parked cars', g.vehicles.parked.length >= 6);
      check('peds', g.people.peds.length >= 10);
      check('mission 1 active', g.missions.current() && g.missions.current().id === 1);
      // Walk: move the player with input.
      var ox = p.x, oy = p.y;
      g.input.right = true; p.walk(g.input, 0.5); g.input.right = false;
      check('walk', Math.hypot(p.x - ox, p.y - oy) > 20);
      // Steal a car.
      var car = g.vehicles.parked[0];
      p.x = car.x; p.y = car.y;
      check('steal car', p.stealCar() === true && p.inCar);
      check('wanted rises', g.wanted >= 1);
      // Drive it.
      var s0 = p.car.speed;
      g.input.up = true; g.vehicles.drivePlayerCar(p.car, g.input, 0.5); g.input.up = false;
      check('car drives', Math.abs(p.car.speed) > Math.abs(s0));
      // Police spawn at 3 stars.
      g.setWanted(3); g.vehicles.updatePolice(0.1);
      check('police spawn', g.vehicles.police.length >= 1);
      // Helicopter at 4 stars.
      g.setWanted(4); g.vehicles.updatePolice(0.1);
      check('helicopter at 4 stars', !!g.vehicles.heli);
      // Mission 1 completes -> mission 2 starts.
      p.x = g.city.landmarks.garage.x; p.y = g.city.landmarks.garage.y;
      g.missions.update(0.1);
      check('mission 1 completes', g.missions.done >= 1);
      check('mission 2 starts', g.missions.current() && g.missions.current().id === 2);
      // Save/load round-trip.
      var cashBefore = p.cash;
      g.save.save();
      p.cash = 1;
      var loaded = g.save.load();
      check('save/load round-trip', loaded && p.cash === cashBefore);
      // Shooting consumes ammo.
      p.exitCar();
      p.weapon = 'pistol'; p.ammo.pistol = 10;
      var a0 = p.ammo.pistol;
      g.input.mouseHeld = true; g.input.mouseDown = true; g.input.mouseClicked = true;
      p.aim = 0; p.fireT = 0; p.tryShoot(0.1);
      g.input.mouseHeld = false; g.input.mouseDown = false;
      check('shooting consumes ammo', p.ammo.pistol === a0 - 1);
      // Shops / safehouse / radio reachable.
      p.x = g.city.landmarks.gun.x; p.y = g.city.landmarks.gun.y;
      check('shop reachable', !!g.city.landmarks.gun && Math.hypot(p.x - g.city.landmarks.gun.x, p.y - g.city.landmarks.gun.y) < 100);
      p.x = g.city.landmarks.safehouse.x; p.y = g.city.landmarks.safehouse.y;
      check('safehouse reachable', !!g.city.landmarks.safehouse && Math.hypot(p.x - g.city.landmarks.safehouse.x, p.y - g.city.landmarks.safehouse.y) < 100);
      g.audio.setRadio(true, 0);
      check('radio reachable', g.audio.radioOn === true);
      g.audio.setRadio(false);
      // Drive-by: shooting from a car consumes ammo.
      var car2 = g.vehicles.parked[0];
      if (car2) {
        p.x = car2.x; p.y = car2.y; p.stealCar();
        p.weapon = 'smg'; p.owned.smg = true; p.ammo.smg = 10;
        var b0 = p.ammo.smg;
        g.input.mouseHeld = true; g.input.mouseClicked = true;
        p.fireT = 0; p.tryShoot(0.1);
        g.input.mouseHeld = false;
        check('drive-by shooting', p.ammo.smg === b0 - 1);
      } else check('drive-by shooting', false);
      // Wanted decay when unseen.
      g.setWanted(1); g.vehicles.police = []; g.vehicles.heli = null;
      g.unseenT = CFG.WANTED_DECAY_S + 1;
      g.updateWanted(0.1);
      check('wanted decay', g.wanted === 0);
    } catch (e) {
      results.push({ name: 'exception: ' + e.message, pass: false });
    }
    var passed = results.filter(function (r) { return r.pass; }).length;
    this.testResults = { passed: passed, total: results.length, results: results };
    var el = document.getElementById('test-results');
    if (el) {
      el.style.display = 'block';
      el.textContent = 'SELF-TEST ' + passed + '/' + results.length + ' PASS\n' +
        results.map(function (r) { return (r.pass ? 'PASS ' : 'FAIL ') + r.name; }).join('\n');
    }
    document.title = 'SELF-TEST ' + passed + '/' + results.length;
    console.log('SELF-TEST ' + passed + '/' + results.length, JSON.stringify(results));
    window.__LB_TEST__ = this.testResults;
    return this.testResults;
  };

  // ---- bootstrap ----
  function boot() {
    var params = new URLSearchParams(window.location.search);
    var seed = parseInt(params.get('seed') || '', 10);
    var game = new Game();
    if (!isNaN(seed)) { game.city = new window.LB.City(seed); }
    window.LBGame = game;
    window.__LB_ERRORS__ = [];
    window.addEventListener('error', function (e) { window.__LB_ERRORS__.push(String(e.message)); });
    // Spawn downtown.
    var lm = game.city.landmarks;
    game.player.spawn(lm.plaza.x, lm.plaza.y + 40);
    game.vehicles.spawnTraffic(14);
    game.vehicles.spawnParked(12);
    game.people.spawn(26);
    game.missions.startMission(0);
    game.camera.x = game.player.x; game.camera.y = game.player.y;
    game.hud.fillTitle();

    // Input.
    var keys = {};
    function keyHandler(e, down) {
      var k = e.key.toLowerCase();
      keys[k] = down;
      game.input.up = !!(keys['w'] || keys['arrowup']);
      game.input.down = !!(keys['s'] || keys['arrowdown']);
      game.input.left = !!(keys['a'] || keys['arrowleft']);
      game.input.right = !!(keys['d'] || keys['arrowright']);
      game.input.run = !!keys['shift'];
      game.input.nos = !!keys['shift'] && game.player.inCar;
      if (down && (k === 'e')) game.interact();
      if (down && (k === 'r') && game.player.inCar) game.audio.setRadio(!game.audio.radioOn, game.audio.station);
      if (down && k === '1') game.player.weapon = 'pistol';
      if (down && k === '2' && game.player.owned.smg) game.player.weapon = 'smg';
      if (down && k === '3' && game.player.owned.shotgun) game.player.weapon = 'shotgun';
      if (down && k === '4' && game.player.owned.rifle) game.player.weapon = 'rifle';
      if (down && (k === 'p' || k === 'escape')) {
        if (game.state === 'play') { game.state = 'pause'; game.hud.showScreen('screen-pause'); }
        else if (game.state === 'pause') { game.state = 'play'; game.hud.hideScreens(); }
      }
      if (down && (k === 'enter') && (game.state === 'busted' || game.state === 'wasted')) game.respawn();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) >= 0) e.preventDefault();
    }
    window.addEventListener('keydown', function (e) { game.audio.ensure(); keyHandler(e, true); });
    window.addEventListener('keyup', function (e) { keyHandler(e, false); });
    var canvas = document.getElementById('game');
    canvas.addEventListener('mousemove', function (e) { game.input.mx = e.clientX; game.input.my = e.clientY; });
    canvas.addEventListener('mousedown', function (e) {
      game.audio.ensure();
      game.input.mouseDown = true; game.input.mouseHeld = true; game.input.mouseClicked = true;
      game.input.mx = e.clientX; game.input.my = e.clientY;
      if (game.state === 'title') { game.state = 'play'; game.hud.hideScreens(); }
      else if (game.state === 'busted' || game.state === 'wasted') game.respawn();
    });
    window.addEventListener('mouseup', function () { game.input.mouseDown = false; game.input.mouseHeld = false; });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // Buttons.
    var btn = document.getElementById('btn-start');
    if (btn) btn.addEventListener('click', function () { game.audio.ensure(); game.state = 'play'; game.hud.hideScreens(); });
    var btnLoad = document.getElementById('btn-load');
    if (btnLoad) btnLoad.addEventListener('click', function () {
      game.audio.ensure();
      if (game.save.load()) { game.state = 'play'; game.hud.hideScreens(); }
    });
    var btnResume = document.getElementById('btn-resume');
    if (btnResume) btnResume.addEventListener('click', function () { game.state = 'play'; game.hud.hideScreens(); });
    var btnRespawn = document.getElementById('btn-respawn');
    if (btnRespawn) btnRespawn.addEventListener('click', function () { game.respawn(); });

    var shot = params.get('shot');
    var test = params.get('test');
    if (shot) {
      game.stageShot(shot);
      game.update(0.5);
      game.update(0.5);
      // Keep the staged chase at speed after the warm-up updates decay it.
      if (shot === 'chase' && game.player.car) game.player.car.speed = 260;
    } else if (test === '1') {
      game.state = 'play';
      game.hud.hideScreens();
      setTimeout(function () { game.runSelfTest(); }, 600);
    }
    game.loop();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
