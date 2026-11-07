// how often each vehicle turns up. Main's mix is close to Pune's own (about six in ten on the road are two-wheelers,
// one in eight an auto, one in five a car); only the rare ones come up half as often again, as Onkar asked (1.5×, not 2×)
import { TYPES } from '@orig/traffic/traffic.js';
import { SPECS } from '@orig/vehicles/vehicle.js';
import { addVariantSpecs } from '../vehicles/models.js';

// every vehicle goes by its real model: real is what prompts and the HUD call it ("Take the Scorpio from its driver"),
// model the full line, name the body type (luxury is a class, not a body, so the E-Class is a sedan). The variants carry
// theirs in beta/vehicles/models.js VARIANTS
const REAL = {
  scooter: ['Activa', 'Honda Activa 110 cc', 'Scooter'], bike: ['Splendor', 'Hero Splendor 125 cc', 'Motorcycle'], cycle: ['Hero Jet', 'Hero Jet roadster', 'Bicycle'],
  hatch: ['Swift', 'Maruti Swift 1.2 petrol', 'Hatchback'], sedan: ['Dzire', 'Maruti Dzire 1.2 petrol', 'Sedan'], taxi: ['Dzire taxi', 'Maruti Dzire Tour, CNG', 'Sedan'],
  suv: ['Creta', 'Hyundai Creta 1.5 diesel', 'SUV'], auto: ['Bajaj RE', 'Bajaj RE 4-stroke', 'Auto rickshaw'], tempo: ['Tata Ace', 'Tata Ace mini truck', 'Tempo'],
  lux: ['E-Class', 'Mercedes-Benz E-Class 2.0 turbo petrol', 'Sedan'], jeep: ['Thar', 'Mahindra Thar 2.2 diesel 4x4', 'SUV'], sports: ['911', 'Porsche 911 3.0 flat-six', 'Coupé'],
  super: ['Huracán', 'Lamborghini Huracán 5.2 V10', 'Supercar'], superbike: ['ZX-10R', 'Kawasaki ZX-10R 1000 cc', 'Motorcycle'], bullet: ['Bullet', 'Royal Enfield Bullet 350', 'Motorcycle'],
  bus: ['PMPML bus', '12 m CNG city bus', 'Bus'],
};
for (const [k, [real, model, name]] of Object.entries(REAL)) if (SPECS[k]) Object.assign(SPECS[k], { real, model, name });
addVariantSpecs(SPECS);

for (const k of ['lux', 'jeep', 'sports', 'super', 'superbike', 'fortuner']) if (TYPES[k]) TYPES[k].w *= 1.5;
