// how often each vehicle turns up. Main's mix is close to Pune's own (about six in ten on the road are two-wheelers,
// one in eight an auto, one in five a car); only the rare ones come up half as often again, as Onkar asked (1.5×, not 2×)
import { TYPES } from '@orig/traffic/traffic.js';

for (const k of ['lux', 'jeep', 'sports', 'super', 'superbike']) if (TYPES[k]) TYPES[k].w *= 1.5;
