import { buildAuto, buildScooter, buildBike, buildCar, buildBus, buildTempo, buildCycle } from '../../src/vehicles/models.js';
const tri = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
const m = { auto: buildAuto({ driver: true, inst: true, withWheels: true }), scooter: buildScooter({ helmet: true }), scooterP: buildScooter({ pillion: true, sideSaddle: true }),
  bike: buildBike({ helmet: true }), cycle: buildCycle(), hatch: buildCar('hatch'), sedan: buildCar('sedan'), suv: buildCar('suv'), bus: buildBus(), tempo: buildTempo() };
for (const [k, v] of Object.entries(m)) console.log(k.padEnd(10), 'body', tri(v.body), 'glass', tri(v.glass));
