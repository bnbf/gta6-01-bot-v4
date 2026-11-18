// LUMEN BAY — Neon Heat: shared constants, palette, economy, weapons, missions.
// A 2D top-down open-world crime game in an original neon coastal city.
(function () {
  'use strict';
  var CFG = {
    // World geometry: 7 x 6 blocks, roads between them, beach + sea to the south.
    BLOCK: 240, ROAD: 80, COLS: 7, ROWS: 6,
    BEACH: 170, SEA: 320,
    SEED: 1337,
    // Clock: golden dusk 18:40 -> neon night 20:00 (minutes of day).
    CLOCK_START: 18 * 60 + 40, CLOCK_END: 20 * 60,
    CLOCK_RATE: 0.55, // game-minutes per real second
    PLAYER_SPEED: 150, PLAYER_RUN: 235,
    CAR_ACCEL: 420, CAR_MAX: 330, CAR_BRAKE: 620, CAR_TURN: 2.9,
    WANTED_MAX: 5, WANTED_DECAY_S: 14,
    START_CASH: 250, START_HEALTH: 100,
    HELI_MIN_STARS: 4, HELI_BOUNTY: 500,
    SAVE_KEY: 'lumenbay-save-v4',
    RANKS: [
      { min: 0, name: 'Street Punk' }, { min: 500, name: 'Wheelman' },
      { min: 1500, name: 'Hustler' }, { min: 3500, name: 'Neon Runner' },
      { min: 7000, name: 'Bay Boss' }, { min: 12000, name: 'King of the Bay' }
    ]
  };
  CFG.WORLD_W = CFG.COLS * CFG.BLOCK + (CFG.COLS + 1) * CFG.ROAD;
  CFG.WORLD_H = CFG.ROWS * CFG.BLOCK + (CFG.ROWS + 1) * CFG.ROAD + CFG.BEACH + CFG.SEA;
  CFG.CITY_H = CFG.ROWS * CFG.BLOCK + (CFG.ROWS + 1) * CFG.ROAD; // roads+blocks only

  var PALETTE = {
    duskSky: '#2b1d4e', nightSky: '#0a0a24',
    road: '#23232e', roadLine: '#d8c25a', sidewalk: '#3a3a48',
    building: ['#4a3f6b', '#5b4a7a', '#3d3358', '#6b4a5e', '#46587a'],
    neon: ['#ff2ea6', '#00f0ff', '#ffe600', '#7CFF00', '#ff6a00', '#b967ff'],
    sea: '#0e3a5c', seaDeep: '#082a46', sand: '#c9a86a',
    park: '#1d4d2b', park2: '#256b35', palm: '#2f8f4e'
  };

  var WEAPONS = {
    pistol: { name: 'Pistol', damage: 22, rate: 0.28, range: 320, spread: 0.05, auto: false, mag: 12, price: 0, ammoPrice: 25 },
    smg: { name: 'SMG', damage: 12, rate: 0.09, range: 300, spread: 0.11, auto: true, mag: 32, price: 400, ammoPrice: 60 },
    shotgun: { name: 'Shotgun', damage: 14, pellets: 6, rate: 0.75, range: 220, spread: 0.22, auto: false, mag: 6, price: 700, ammoPrice: 80 },
    rifle: { name: 'Rifle', damage: 38, rate: 0.16, range: 480, spread: 0.02, auto: true, mag: 30, price: 1200, ammoPrice: 110 }
  };

  var CAR_TYPES = [
    { name: 'Comet', color: '#e33f5f', top: 300, accel: 430 },
    { name: 'Sedan', color: '#3f7de3', top: 260, accel: 380 },
    { name: 'Taxi', color: '#ffd23f', top: 270, accel: 400 },
    { name: 'Coupe', color: '#9b3fe3', top: 330, accel: 460 },
    { name: 'Truck', color: '#e38a3f', top: 230, accel: 330 },
    { name: 'Interceptor', color: '#1a1a22', top: 360, accel: 520 }
  ];

  var MISSIONS = [
    { id: 1, name: 'First Wheels', brief: 'Steal a car and deliver it to Volt Garage.', pay: 300 },
    { id: 2, name: 'Neon Courier', brief: 'Deliver the package to the Neon Diner before the timer runs out.', pay: 450 },
    { id: 3, name: 'Protection Money', brief: 'Collect protection money from 3 shops around the bay.', pay: 600 },
    { id: 4, name: 'Heat Wave', brief: 'Lose a 3-star wanted level, then reach the Harbor Loft safehouse.', pay: 800 },
    { id: 5, name: 'The Big Score', brief: 'Rob the Lumen Trust Bank vault and escape with the cash.', pay: 1500 },
    { id: 6, name: 'Midnight Race', brief: 'Win the street race: hit all 4 checkpoints before the rival.', pay: 1000 },
    { id: 7, name: 'King of the Bay', brief: 'Take the crown: survive 5 stars for 60 seconds at the marina.', pay: 2500 }
  ];

  var SHOPS = {
    gun: { name: 'LUMEN ARMS', kind: 'gun', desc: 'Buy weapons & ammo' },
    diner: { name: 'Neon Diner', kind: 'diner', desc: 'Eat: +25 health, $15' },
    garage: { name: 'Volt Garage', kind: 'garage', desc: 'Repair $50 · NOS $200' },
    safehouse: { name: 'Harbor Loft', kind: 'safehouse', desc: 'Heal + save game' },
    bank: { name: 'Lumen Trust Bank', kind: 'bank', desc: 'The Big Score target' }
  };

  window.LB = window.LB || {};
  window.LB.CFG = CFG; window.LB.PALETTE = PALETTE;
  window.LB.WEAPONS = WEAPONS; window.LB.CAR_TYPES = CAR_TYPES;
  window.LB.MISSIONS = MISSIONS; window.LB.SHOPS = SHOPS;
})();
