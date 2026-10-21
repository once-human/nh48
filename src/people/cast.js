// The people you can talk to: a fixed cast, each with one name and one look for good. Whoever you met
// on the dance floor last night looks the same at the café today, and nobody else in the city has their name.
import { RNG } from '../core/util.js';

const F = ['Riya', 'Ananya', 'Sanika', 'Tanvi', 'Ishita', 'Mrunmayi', 'Aditi', 'Shreya', 'Kavya', 'Pooja', 'Zoya', 'Neha',
  'Sakshi', 'Gauri', 'Rutuja', 'Ketaki', 'Prachi', 'Mitali', 'Siya', 'Tara', 'Naina', 'Aarohi', 'Myra', 'Kiara', 'Anushka',
  'Radhika', 'Devika', 'Isha', 'Meera', 'Nidhi', 'Sneha', 'Shruti', 'Ira', 'Alisha', 'Tanya', 'Rhea', 'Sara', 'Mahira',
  'Vaidehi', 'Janhavi', 'Pallavi', 'Esha', 'Trisha', 'Anaya', 'Kriti', 'Avni', 'Diya', 'Saanvi', 'Natasha', 'Leah'];
const M = ['Arjun', 'Kabir', 'Rohan', 'Omkar', 'Siddhant', 'Aditya', 'Varun', 'Nikhil', 'Yash', 'Aman', 'Rahul', 'Dev',
  'Tejas', 'Atharva', 'Sahil', 'Pranav', 'Aniket', 'Saurabh', 'Ishaan', 'Vihaan', 'Reyansh', 'Aryan', 'Kunal', 'Neel',
  'Shantanu', 'Akshay', 'Harsh', 'Parth', 'Ronak', 'Kartik', 'Mihir', 'Ved', 'Aarav', 'Rishi', 'Abhay', 'Chinmay',
  'Soham', 'Jay', 'Zaid', 'Advait', 'Rehan', 'Sameer', 'Tanmay', 'Gaurav', 'Vikram', 'Ayaan', 'Kian', 'Nakul', 'Om', 'Shlok'];
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
// each one dresses their own way, always: western (KP, Viman Nagar), modern, or traditional
const member = (name, female) => {
  const seed = hash(name + (female ? 'f' : 'm')), r = new RNG(seed);
  const x = r.next();
  const dress = female ? (x < 0.45 ? 'western' : x < 0.8 ? 'modern' : 'traditional') : (x < 0.75 ? 'modern' : 'traditional');
  return { name, female, seed, dress };
};
export const CAST = { f: F.map(n => member(n, true)), m: M.map(n => member(n, false)) };
export const castByName = (name, female) => (female == null ? [...CAST.f, ...CAST.m] : CAST[female ? 'f' : 'm']).find(c => c.name === name) || null;

// hand one of the cast to a pooled body: their name, their face, their clothes
export function castAs(p, c, kit) {
  p.name = c.name; p.cast = c.name; p.female = c.female;
  if (kit) {
    p.look = kit.randomLook(new RNG(c.seed), { female: c.female, dress: c.dress });
    p.shirt = [p.look.top.r, p.look.top.g, p.look.top.b]; p.lower = [p.look.bottom.r, p.look.bottom.g, p.look.bottom.b]; p.skin = [p.look.skin.r, p.look.skin.g, p.look.skin.b];
  }
  return p;
}
// someone from the cast who isn't already in the room (a club leans to the ones who dress for it)
export function pickCast(rng, female, taken, venue) {
  let pool = CAST[female ? 'f' : 'm'].filter(c => !taken.has(c.name));
  if (venue === 'club') { const w = pool.filter(c => c.dress !== 'traditional'); if (w.length) pool = w; }
  return pool.length ? pool[Math.floor(rng.next() * pool.length)] : null;
}
