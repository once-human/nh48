// how often each vehicle turns up. Main's mix is close to Pune's own (about six in ten on the road are two-wheelers,
// one in eight an auto, one in five a car); only the rare ones come up half as often again, as Onkar asked (1.5×, not 2×)
import { TYPES } from '@orig/traffic/traffic.js';
import { SPECS } from '@orig/vehicles/vehicle.js';
import { addVariantSpecs } from '../vehicles/models.js';

// the family cars get their model names, the models their own specs (beta/vehicles/models.js VARIANTS)
SPECS.sedan.model = 'Dzire-style 1.2 petrol';
SPECS.taxi.model = 'Dzire-style cab, CNG';
addVariantSpecs(SPECS);

for (const k of ['lux', 'jeep', 'sports', 'super', 'superbike', 'fortuner']) if (TYPES[k]) TYPES[k].w *= 1.5;
