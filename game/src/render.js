// LUMEN BAY: canvas world rendering — golden dusk fading to neon night,
// neon signs, street lamps, headlights, a light pool around the player,
// beach + sea, mission markers, police livery, helicopter spotlight, minimap.
(function () {
  'use strict';
  var CFG = window.LB.CFG;

  function Render(game) { this.game = game; }

  Render.prototype.nightT = function () {
    var c = this.game.clock;
    var t = (c - CFG.CLOCK_START) / (CFG.CLOCK_END - CFG.CLOCK_START);
    return Math.max(0, Math.min(1, t));
  };

  Render.prototype.draw = function (ctx, W, H) {
    var g = this.game, cam = g.camera, nt = this.nightT();
    ctx.save();
    // Sky base: dusk purple -> deep night blue.
    var sky = nt < 0.5
      ? 'rgb(' + Math.round(43 - nt * 40) + ',' + Math.round(29 - nt * 20) + ',' + Math.round(78 - nt * 40) + ')'
      : 'rgb(10,10,36)';
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.translate(-cam.x + W / 2, -cam.y + H / 2);
    this.drawGround(ctx);
    this.drawCity(ctx, nt);
    this.drawVehicles(ctx, nt);
    this.drawPeople(ctx);
    this.drawPlayer(ctx, nt);
    this.drawMarkers(ctx, nt);
    this.drawEffects(ctx);
    this.drawLighting(ctx, W, H, cam, nt);
    ctx.restore();
    this.drawMinimap(ctx, W, H);
  };

  Render.prototype.drawGround = function (ctx) {
    var g = this.game, city = g.city;
    // Sidewalk base under the whole city grid.
    ctx.fillStyle = '#33333f'; ctx.fillRect(0, 0, CFG.WORLD_W, CFG.CITY_H);
    // Roads.
    ctx.fillStyle = '#23232e';
    var i, j;
    for (i = 0; i <= CFG.COLS; i++) ctx.fillRect(city.roadX(i) - CFG.ROAD / 2, 0, CFG.ROAD, CFG.CITY_H);
    for (j = 0; j <= CFG.ROWS; j++) ctx.fillRect(0, city.roadY(j) - CFG.ROAD / 2, CFG.WORLD_W, CFG.ROAD);
    // Road centre dashes.
    ctx.fillStyle = '#d8c25a';
    for (i = 0; i <= CFG.COLS; i++) for (var y = 0; y < CFG.CITY_H; y += 46) ctx.fillRect(city.roadX(i) - 2, y + 8, 4, 22);
    for (j = 0; j <= CFG.ROWS; j++) for (var x = 0; x < CFG.WORLD_W; x += 46) ctx.fillRect(x + 8, city.roadY(j) - 2, 22, 4);
    // Parks.
    for (i = 0; i < city.parks.length; i++) {
      var pk = city.parks[i];
      ctx.fillStyle = '#1d4d2b'; ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
      ctx.fillStyle = '#256b35'; ctx.fillRect(pk.x + 12, pk.y + 12, pk.w - 24, pk.h - 24);
    }
    // Beach + sea to the south.
    ctx.fillStyle = '#c9a86a'; ctx.fillRect(0, CFG.CITY_H, CFG.WORLD_W, CFG.BEACH);
    ctx.fillStyle = '#0e3a5c'; ctx.fillRect(0, CFG.CITY_H + CFG.BEACH, CFG.WORLD_W, CFG.SEA);
    ctx.fillStyle = '#082a46';
    for (var w = 0; w < 10; w++) ctx.fillRect(0, CFG.CITY_H + CFG.BEACH + 30 + w * 30, CFG.WORLD_W, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (w = 0; w < 24; w++) {
      var wx = ((w * 197 + g.time * 12) % CFG.WORLD_W);
      ctx.fillRect(wx, CFG.CITY_H + CFG.BEACH + 4 + (w % 3) * 10, 60, 3);
    }
    // Palms.
    for (i = 0; i < city.palms.length; i++) {
      var pl = city.palms[i];
      ctx.fillStyle = '#5a3a22'; ctx.fillRect(pl.x - 2, pl.y - 2, 4, 10);
      ctx.fillStyle = '#2f8f4e';
      ctx.beginPath(); ctx.arc(pl.x, pl.y - 6, 9, 0, Math.PI * 2); ctx.fill();
    }
  };

  Render.prototype.drawCity = function (ctx, nt) {
    var city = this.game.city, i;
    for (i = 0; i < city.buildings.length; i++) {
      var b = city.buildings[i];
      ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 8);
      // Lit windows at night.
      ctx.fillStyle = nt > 0.3 ? '#ffd76a' : '#3a3450';
      for (var wy = b.y + 16; wy < b.y + b.h - 10; wy += 18)
        for (var wx = b.x + 10; wx < b.x + b.w - 10; wx += 20)
          ctx.fillRect(wx, wy, 10, 12);
      if (b.neon) {
        ctx.save();
        ctx.shadowColor = b.neon; ctx.shadowBlur = 14 + nt * 12;
        ctx.fillStyle = b.neon;
        ctx.fillRect(b.x, b.y - 4, b.w, 4);
        ctx.restore();
      }
    }
    // Neon signs with glow.
    ctx.textAlign = 'center'; ctx.font = 'bold 13px sans-serif';
    for (i = 0; i < city.signs.length; i++) {
      var s = city.signs[i];
      ctx.save();
      ctx.shadowColor = s.color; ctx.shadowBlur = 12 + nt * 10;
      ctx.fillStyle = s.color;
      ctx.fillText(s.text, s.x, s.y);
      ctx.restore();
    }
    // Street lamps.
    for (i = 0; i < city.lamps.length; i++) {
      var l = city.lamps[i];
      ctx.fillStyle = '#888'; ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
      if (nt > 0.25) {
        ctx.save();
        ctx.globalAlpha = 0.5 + nt * 0.4;
        ctx.fillStyle = '#ffe9a8';
        ctx.beginPath(); ctx.arc(l.x, l.y, 7, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    // Landmark labels.
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    var lm = city.landmarks;
    for (var k in lm) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(lm[k].label, lm[k].x, lm[k].y - 52);
    }
  };

  Render.prototype.drawCarShape = function (ctx, c, nt) {
    ctx.save();
    ctx.translate(c.x, c.y); ctx.rotate(c.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-20, -10, 42, 24);
    ctx.fillStyle = c.color; ctx.fillRect(-20, -11, 40, 22);
    ctx.fillStyle = '#1c2733'; ctx.fillRect(-6, -9, 12, 18);
    ctx.fillStyle = '#ffe9a8';
    if (nt > 0.2 || true) { ctx.fillRect(19, -9, 3, 5); ctx.fillRect(19, 4, 3, 5); }
    ctx.fillStyle = '#ff2222'; ctx.fillRect(-21, -9, 3, 5); ctx.fillRect(-21, 4, 3, 5);
    if (c.police) {
      ctx.fillStyle = '#fff'; ctx.fillRect(-14, -11, 10, 22);
      ctx.fillStyle = '#2255ff'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('PD', -9, 3);
      var fl = Math.floor(this.game.time * 4) % 2 === 0;
      ctx.fillStyle = fl ? '#ff2222' : '#2255ff';
      ctx.beginPath(); ctx.arc(-2, 0, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (c.taxi) {
      ctx.fillStyle = '#111'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('TAXI', 4, 3);
    }
    if (c.smoke > 0) {
      ctx.fillStyle = 'rgba(120,120,120,' + (0.4 * c.smoke) + ')';
      ctx.beginPath(); ctx.arc(-24, 0, 8 + Math.random() * 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // Headlight beams at night.
    if (nt > 0.3) {
      ctx.save();
      ctx.translate(c.x, c.y); ctx.rotate(c.angle);
      var grad = ctx.createLinearGradient(20, 0, 130, 0);
      grad.addColorStop(0, 'rgba(255,240,180,0.25)'); grad.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(20, -8); ctx.lineTo(130, -26); ctx.lineTo(130, 26); ctx.lineTo(20, 8); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  };

  Render.prototype.drawVehicles = function (ctx, nt) {
    var v = this.game.vehicles, i;
    for (i = 0; i < v.parked.length; i++) this.drawCarShape(ctx, v.parked[i], nt);
    for (i = 0; i < v.traffic.length; i++) this.drawCarShape(ctx, v.traffic[i], nt);
    for (i = 0; i < v.police.length; i++) this.drawCarShape(ctx, v.police[i], nt);
    var p = this.game.player;
    if (p.inCar && p.car) this.drawCarShape(ctx, p.car, nt);
    // Helicopter with spotlight cone.
    var h = v.heli;
    if (h) {
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.fillStyle = 'rgba(255,250,200,0.14)';
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(h.angle + 0.35) * 260, Math.sin(h.angle + 0.35) * 260);
      ctx.lineTo(Math.cos(h.angle - 0.35) * 260, Math.sin(h.angle - 0.35) * 260);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,250,200,0.35)';
      ctx.beginPath(); ctx.arc(Math.cos(h.angle) * 260, Math.sin(h.angle) * 260, 34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#20242e';
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#666'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.stroke();
      ctx.fillStyle = '#ff2222';
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  };

  Render.prototype.drawPeople = function (ctx) {
    var g = this.game, i;
    for (i = 0; i < g.people.peds.length; i++) {
      var ped = g.people.peds[i];
      ctx.save(); ctx.translate(ped.x, ped.y); ctx.rotate(ped.angle);
      ctx.fillStyle = ped.shirt; ctx.fillRect(-6, -6, 12, 12);
      ctx.fillStyle = ped.color; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (ped.taxi) {
        ctx.fillStyle = '#ffe600'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('TAXI!', ped.x, ped.y - 18);
      }
    }
    for (i = 0; i < g.people.officers.length; i++) {
      var o = g.people.officers[i];
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.angle);
      ctx.fillStyle = '#1c2f6b'; ctx.fillRect(-6, -6, 12, 12);
      ctx.fillStyle = '#e8c39e'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2255ff'; ctx.fillRect(-6, -9, 12, 3);
      ctx.restore();
    }
  };

  Render.prototype.drawPlayer = function (ctx, nt) {
    var g = this.game, p = g.player;
    if (p.inCar) return;
    ctx.save(); ctx.translate(p.x, p.y);
    // Light pool around the player at night.
    if (nt > 0.2) {
      var lg = ctx.createRadialGradient(0, 0, 10, 0, 0, 130);
      lg.addColorStop(0, 'rgba(255,220,150,0.20)'); lg.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(0, 0, 130, 0, Math.PI * 2); ctx.fill();
    }
    ctx.rotate(p.aim);
    ctx.fillStyle = '#ffcf5c'; ctx.fillRect(-7, -7, 14, 14);
    ctx.fillStyle = '#222'; ctx.fillRect(6, -2, 12, 4); // gun barrel
    ctx.fillStyle = '#e8c39e'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Aim line.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.aim) * 46, p.y + Math.sin(p.aim) * 46); ctx.stroke();
  };

  Render.prototype.drawMarkers = function (ctx, nt) {
    var g = this.game, m = g.missions.marker();
    if (m) {
      var bob = Math.sin(g.time * 3) * 6;
      ctx.save();
      ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 16;
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath(); ctx.moveTo(m.x, m.y - 44 + bob);
      ctx.lineTo(m.x - 12, m.y - 66 + bob); ctx.lineTo(m.x + 12, m.y - 66 + bob);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(0,240,255,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(m.x, m.y, 34 + Math.sin(g.time * 2) * 5, 0, Math.PI * 2); ctx.stroke();
    }
    // Compass arrow toward the marker (drawn in world space near the player).
    if (m) {
      var p = g.player;
      var a = Math.atan2(m.y - p.y, m.x - p.x);
      ctx.save(); ctx.translate(p.x + Math.cos(a) * 60, p.y + Math.sin(a) * 60); ctx.rotate(a);
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  };

  Render.prototype.drawEffects = function (ctx) {
    var g = this.game;
    for (var i = g.tracers.length - 1; i >= 0; i--) {
      var t = g.tracers[i];
      ctx.strokeStyle = 'rgba(255,240,150,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
    }
    ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
    for (var j = 0; j < g.floats.length; j++) {
      var f = g.floats[j];
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    // Wanted heat vignette.
    if (g.wanted >= 3) {
      var vg = ctx.createRadialGradient(g.camera.x, g.camera.y, 200, g.camera.x, g.camera.y, 520);
      vg.addColorStop(0, 'rgba(255,0,0,0)'); vg.addColorStop(1, 'rgba(255,0,0,0.22)');
      ctx.fillStyle = vg;
      ctx.fillRect(g.camera.x - 700, g.camera.y - 450, 1400, 900);
    }
  };

  Render.prototype.drawLighting = function (ctx, W, H, cam, nt) {
    // Dusk sun glow in the west, fading as night falls.
    if (nt < 0.8) {
      var sx = cam.x - W / 2 + 120, sy = cam.y - H / 2 + 90;
      var sg = ctx.createRadialGradient(sx, sy, 10, sx, sy, 260);
      sg.addColorStop(0, 'rgba(255,170,60,' + (0.35 * (1 - nt)) + ')');
      sg.addColorStop(1, 'rgba(255,170,60,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(sx - 260, sy - 260, 520, 520);
    }
    // Night darkness overlay with a hole of light around the player.
    if (nt > 0.15) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(6,6,26,' + (0.28 * nt) + ')';
      ctx.fillRect(cam.x - W / 2, cam.y - H / 2, W, H);
      ctx.restore();
    }
  };

  Render.prototype.drawMinimap = function (ctx, W, H) {
    var g = this.game;
    var mw = 168, mh = Math.round(168 * CFG.WORLD_H / CFG.WORLD_W);
    var mx = W - mw - 14, my = 14;
    var sx = mw / CFG.WORLD_W, sy = mh / CFG.WORLD_H;
    ctx.save();
    ctx.fillStyle = 'rgba(8,8,20,0.78)'; ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
    ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 1; ctx.strokeRect(mx - 4, my - 4, mw + 8, mh + 8);
    ctx.fillStyle = '#0e3a5c'; ctx.fillRect(mx, my + mh - 12, mw, 12);
    ctx.fillStyle = '#c9a86a'; ctx.fillRect(mx, my + mh - 18, mw, 6);
    ctx.fillStyle = '#33333f'; ctx.fillRect(mx, my, mw, mh - 18);
    ctx.fillStyle = '#23232e';
    var city = g.city;
    for (var i = 0; i <= CFG.COLS; i++) ctx.fillRect(mx + city.roadX(i) * sx - 2, my, 4, (mh - 18));
    for (var j = 0; j <= CFG.ROWS; j++) ctx.fillRect(mx, my + city.roadY(j) * sy - 2, mw, 4);
    var dot = function (x, y, color, r) {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(mx + x * sx, my + y * sy, r, 0, Math.PI * 2); ctx.fill();
    };
    var m = g.missions.marker();
    if (m) dot(m.x, m.y, '#00f0ff', 4);
    for (i = 0; i < g.vehicles.police.length; i++) dot(g.vehicles.police[i].x, g.vehicles.police[i].y, '#ff2222', 3);
    if (g.vehicles.heli) dot(g.vehicles.heli.x, g.vehicles.heli.y, '#ff8800', 4);
    dot(g.player.x, g.player.y, '#fff', 4);
    // Viewport box.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(mx + (g.camera.x - 640) * sx, my + (g.camera.y - 360) * sy, 1280 * sx, 720 * sy);
    ctx.restore();
  };

  window.LB.Render = Render;
})();
