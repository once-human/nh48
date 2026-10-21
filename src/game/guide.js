// The in-game guide (Jhola → Guide, or Guide in the pause menu): every kind of place and what you
// can do there, every way to make money (legal and not), where to buy what, how your body works,
// the people you meet, and the controls. Written as a Punekar would explain it to a friend.

const SHOPS = [
  ['Eat and drink', [
    ['Tapri', 'Cutting chai, bun maska, poha. Cheapest energy in the city.'],
    ['Misal and vada pav', 'Spicy, filling, cheap. Choose how tikhat; extra kat is free.'],
    ['Thali house', 'Unlimited Maharashtrian or Gujarati thali. Fills you right up.'],
    ['Biryani', 'Full or half plate. Heavy on food, a little mood.'],
    ['South Indian (Udupi)', 'Dosa, idli, filter coffee. Sambar refills are free.'],
    ['Indo-Chinese', 'Manchurian, hakka noodles, triple rice. Dry or gravy.'],
    ['Pizza and burgers', 'The chains. More expensive, quick, dine in or takeaway.'],
    ['Restaurant', 'A bit of everything; the menu follows the area.'],
    ['Café', 'Coffee, sandwiches, cake. The usual place for dates.'],
    ['Bakery', 'Shrewsbury biscuits, khari, puffs. Good gifts too.'],
    ['Sweet mart', 'Bakarwadi, barfi, modak. A box of sweets makes any date go better.'],
    ['Juice and mastani', 'Mastani, sugarcane, lassi. Best for water when it’s hot.'],
    ['Ice cream', 'Mood up, a little water.'],
  ], 'Every food place lets you walk in. Order at the counter, then either eat at a table (sit with F and it comes to you) or take a parcel that goes into your jhola for later. Chains and posh areas cost more; each cuisine has its own room.'],
  ['Nights out', [
    ['Bar and club', 'Pay the cover after 9 pm, then the bar, the dance floor and the sofas. A drink or two makes you more confident (charm up); too many and the screen swims, you walk badly and people stop taking you seriously. Clubs come in three kinds: warehouse, lounge and Bollywood night.'],
  ], 'People with a small heart over them are up for a chat. See People and dating below.'],
  ['Looking good', [
    ['Salon', 'Haircuts, beard, colour, champi. The local barber is cheap; a premium salon costs more and has keratin.'],
    ['Clothes', 'Trial room with a live preview. Men’s, Women’s and Unisex are labelled; anyone can wear anything, and people react.'],
    ['Footwear', 'Chappals to sneakers, tried on in the shop.'],
    ['Optician', 'Eye test, glasses (you see more of the minimap), sunglasses (style in polished areas), contacts. Chains test your eyes free; premium stores cost the most.'],
  ], 'Clothes that suit the area raise your style there: a kurta in Sadashiv Peth, something sharp in Koregaon Park.'],
  ['Health', [
    ['Medical store', 'Painkillers, ORS, bandages, for your jhola.'],
    ['Doctor’s clinic', 'Health back for a few hundred rupees.'],
    ['Dental clinic', 'Cleaning and whitening raise your charm for days.'],
    ['Skin and hair clinic', 'Facials and peels: charm and style.'],
    ['Diagnostic lab', 'A full checkup tells you your real numbers; if you’re fit, +5 max health.'],
    ['Physiotherapy', 'Energy back, fitness sticks.'],
    ['Eye hospital', 'Check-ups and LASIK.'],
    ['Hospital', 'Full patch-up at private rates. Pass out and you wake up in one: a government hospital charges ₹600, a private one ₹3,500 (more if you were beaten up).'],
    ['Gym', 'Workouts raise fitness, which raises your max health. Chain gyms cost more than the local one.'],
  ]],
  ['Money', [
    ['Bank and ATM', 'Deposit and withdraw. Money in the bank earns a little interest every day and can’t be taken if you’re robbed.'],
    ['Jeweller', 'Buy and sell gold by the gram. The rate moves every day: buy low, sell high.'],
  ]],
  ['Things', [
    ['Kirana', 'Water, biscuits, bananas, lottery tickets.'],
    ['Mobile shop', 'A smartphone (needed for Zwiggy deliveries), recharges.'],
    ['Electronics', 'Gadgets that change things, on EMI.'],
    ['Bookshop', 'A book: mood, and a good gift.'],
    ['Florist', 'Gajra (a gift), a marigold garland for your auto (karma).'],
    ['Paan', 'Meetha paan for mood. No tobacco.'],
  ]],
  ['Vehicles', [
    ['Vehicle showroom', 'Walk in and see them on the floor. Cycles, scooters, bikes, hatchbacks, SUVs, at real on-road prices.'],
    ['Garage', 'Repair dents and engine damage, service, upgrades. Vehicles never explode; they just get slow and sad.'],
    ['Petrol and CNG pump', 'Drive up and fill. Everything runs out of fuel eventually.'],
    ['Travels', 'Rent a scooter by the day.'],
  ]],
  ['Places', [
    ['Police chowki', 'Pay your pending challans, collect a towed auto, or turn yourself in.'],
    ['Lodge', 'A room for the night: sleep, energy back.'],
    ['Estate agent', 'Buy a home or rent it out.'],
    ['Homes for sale', 'Six of them: 1 RK in Sadashiv Peth (₹28 lakh), 1 BHK in Erandwane, 2 BHK in Model Colony, 3 BHK in Koregaon Park, a row house on Prabhat Road and a Boat Club Road bungalow (₹12 crore). Live in one (sleep, change, keep vehicles) or rent it out for daily income.'],
  ]],
];

const EARN_LEGAL = [
  ['Auto shifts', 'Get into any auto and you’re on shift. People waving for one show up green on the map. Pick them up, drive them on the meter, get rated. Tips go up with your rating and your charm.'],
  ['Zwiggy deliveries', 'Buy a smartphone at a mobile shop. Your phone pings with orders (Y accepts): pick up at a real restaurant, drop at the door.'],
  ['Rent out a home', 'Buy a home and rent it out from the estate agent or your Owned tab. Rent arrives every day.'],
  ['Bank interest', 'A small amount every day on what’s in the bank.'],
  ['Gold', 'Buy when the rate is low, sell when it’s high.'],
  ['Lottery', 'From any kirana. Scratch it in your jhola. Usually nothing.'],
];
const EARN_ILLEGAL = [
  ['Steal a vehicle', 'Walk up to a parked or stopped vehicle and take it (F). Beat marshals come looking (up to three stars); get caught and it’s bail, ₹5,000.'],
  ['Chai-pani', 'When a traffic cop stops you, a “chai-pani” sometimes makes the challan go away. Sometimes he’s honest, and then it costs more.'],
  ['Skip the challan', 'Drive off when waved over. It doubles, and the number is noted.'],
];

const BODY = [
  ['Health', 'Fights, crashes and falls take it. Food, the doctor and sleep bring it back. At zero you pass out and wake up in hospital with a bill.'],
  ['Food and water', 'Go down slowly through the day. Starve and you pass out. Water goes faster in the heat.'],
  ['Energy', 'Sleep at a home or a lodge. Chai and a champi help a little.'],
  ['Mood', 'Good food, dancing, a partner, a nice outfit. Low mood makes people less warm to you.'],
  ['Charm', 'How people take to you: outfit for the area, mood, teeth and skin, a drink or two. It changes tips, prices, dates.'],
  ['Respect and karma', 'Respect comes from being known; karma from how you treat people and animals. Feeding strays and doing namaskar to cows helps. Kicking dogs does not.'],
  ['Fitness', 'Gym sessions raise your max health.'],
];

const PEOPLE = [
  ['Who you meet', 'Each area has its own people: Koregaon Park polished, the station mixed, the old peths full of uncles and aajis. They react to what you wear and what you do.'],
  ['Talking', 'People with a small heart over them are open to a chat: the other gender from your character. Walk up and press F. Ask what they do first: then you learn what they’re into, and talking about that lands far better. Compliments straight away read as a line. Buying a drink helps; being drunk doesn’t.'],
  ['Getting a number', 'Get them interested (the hearts fill), dance if you’re in a club, then ask. They might say not tonight.'],
  ['Dates', 'Jhola → People → Ask to meet. They pick a real café nearby, and they’ll be at a table. Ask about their day, share something real, make plans, bring a gift (a gajra, sweets, a book). Be late and they leave.'],
  ['Partners', 'Met → Talking → Dating. Once you’re dating, ask them to be your partner. A partner lifts your mood every day, sends food when you’re starving, warns you about nakabandis. Ignore them for days and they’ll say so; keep ignoring them and it’s over. Getting someone else’s number may get back to them.'],
];

const CONTROLS = [
  ['W A S D', 'Walk or drive'], ['Mouse', 'Look around (click the game to capture the mouse)'], ['Click', 'Punch'], ['C', 'Roll'], ['Space', 'Handbrake; on foot, jump or climb'], ['Shift / Alt', 'Sprint / walk'], ['X', 'Punch (also)'],
  ['F', 'Interact, enter, get in or out'], ['E', 'Jhola'], ['Tab', 'Your stats'], ['M', 'Map (or tap the minimap)'], ['H', 'Horn'], ['V', 'Camera'], ['B', 'Look back'],
  ['R', 'Back on the road'], ['Y', 'Accept a delivery'], ['1 to 8', 'Choose what to say'], ['Esc', 'Pause'], ['F3', 'Performance info'],
];

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dl = (rows) => `<dl class="gd-dl">${rows.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>`;
const sec = (title, body, open) => `<details class="gd-sec"${open ? ' open' : ''}><summary>${esc(title)}</summary>${body}</details>`;

export function guideHTML() {
  let h = `<p class="gd-intro">Everything in NH48 Pune, in one place. Real shops from the map are all over the city; the Nearby tab and the map (M) show what’s around you.</p>`;
  h += sec('Places and what to do there', SHOPS.map(([g, rows, note]) => `<h4>${esc(g)}</h4>${dl(rows)}${note ? `<p class="gd-note">${esc(note)}</p>` : ''}`).join(''), true);
  h += sec('Making money', `<h4>Straight</h4>${dl(EARN_LEGAL)}<h4>Not so straight</h4>${dl(EARN_ILLEGAL)}<p class="gd-note">Crime raises your wanted level. Money in the bank is safe; cash on you can be taken when you’re knocked out.</p>`);
  h += sec('Your body', dl(BODY));
  h += sec('People and dating', dl(PEOPLE));
  h += sec('Controls', dl(CONTROLS));
  return h;
}
export { EARN_ILLEGAL, EARN_LEGAL };
