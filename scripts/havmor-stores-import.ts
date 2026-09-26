/**
 * Pull every Havmor outlet from havmor.com/store-locator into
 * src/lib/stores/stores.json, for the garba map.
 *
 *   npm run stores:import                 # fetch the live page
 *   npm run stores:import -- saved.html   # or parse a saved copy
 *
 * The page lists every store inline (twice: once for the list, once for the
 * map), with its pin in `data-lat` / `data-long`. The import keeps each store
 * once, tidies whitespace and city spellings, and never drops a store: a pin
 * Havmor left empty or garbled is taken from PIN_FIXES, one that points at the
 * wrong town is replaced from PIN_CORRECTIONS, and the import fails if a store
 * has no pin at all, so a new store can't go missing silently.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HavmorStoreFileSchema, type HavmorStore } from "../src/lib/stores/schema";

const SOURCE = "https://www.havmor.com/store-locator";
const OUT = join(__dirname, "../src/lib/stores/stores.json");
/** Farther than this from the rest of its city and a pin is worth a look. */
const WARN_KM_FROM_CITY = 60;

/**
 * Pins for stores Havmor lists without usable coordinates, keyed by node id.
 * Placed with OpenStreetMap Nominatim on the address (the query is in the
 * note), so most mark the street or locality rather than the shop itself.
 */
const PIN_FIXES: Record<string, { lat: number; lng: number; note: string }> = {
  // Havmor's pin reads "26483794": the same number with its decimal point lost.
  "799": { lat: 26.483794, lng: 80.320086, note: "Havmor's pin, with its missing decimal point restored" },
  "449": { lat: 23.036, lng: 72.564343, note: "Nominatim: 'Navrangpura, Ahmedabad' (Vijay Cross Road)" },
  "298": { lat: 23.055955, lng: 72.584138, note: "Nominatim: 'Dudheshwar, Ahmedabad' (riverfront east)" },
  "352": { lat: 27.556318, lng: 76.614991, note: "Nominatim: 'Nehru Park, Alwar'" },
  "348": { lat: 28.015929, lng: 73.317137, note: "Nominatim: 'Bikaner' (city centre)" },
  "349": { lat: 29.611705, lng: 74.293602, note: "Nominatim: 'Hanumangarh Junction'" },
  "453": { lat: 17.403982, lng: 78.488194, note: "Nominatim: 'Himayatnagar, Hyderabad'" },
  "445": { lat: 26.862754, lng: 75.761163, note: "Nominatim: 'Madhyam Marg, Mansarovar, Jaipur'" },
  "345": { lat: 26.885074, lng: 75.800958, note: "Nominatim: 'Bapu Nagar, Jaipur'" },
  "350": { lat: 26.296772, lng: 73.035143, note: "Nominatim: 'Jodhpur' (city centre)" },
  "347": { lat: 25.146737, lng: 75.840709, note: "Nominatim: 'Talwandi, Kota'" },
  "313": { lat: 23.593289, lng: 72.380336, note: "Nominatim: 'Nagalpur, Mehsana' (bus port)" },
  "336": { lat: 19.227438, lng: 72.971853, note: "Nominatim: 'Hiranandani Meadows, Thane'" },
  "338": { lat: 19.105623, lng: 72.998865, note: "Nominatim: 'Kopar Khairane, Navi Mumbai'" },
  "339": { lat: 19.186483, lng: 72.975766, note: "Nominatim: 'Thane West' (no address listed)" },
  "346": { lat: 24.659305, lng: 72.930445, note: "Nominatim: 'Swaroopganj, Sirohi'" },
  "351": { lat: 29.320331, lng: 73.902673, note: "Nominatim: 'Suratgarh' (town centre)" },
};

/**
 * Stores whose pin on havmor.com is in the wrong place, often another store's
 * pin: a Patiala shop sitting in Mumbai, a Thane one in Punjab. Found by
 * geocoding every store's PIN code and city and comparing them with its pin;
 * each is re-placed with Nominatim on the locality in its address. `was` is
 * Havmor's pin at the time: if Havmor changes it, the import uses Havmor's
 * new pin and says so, so this list can be pruned.
 */
const PIN_CORRECTIONS: Record<string, { was: [number, number]; lat: number; lng: number; note: string }> = {
  "257": { was: [19.30206, 73.05707], lat: 23.056713, lng: 72.550858, note: "Nominatim: 'Naranpura, Ahmedabad' (Havmor's pin was 421 km away)" },
  "259": { was: [19.162919, 72.842201], lat: 23.03858, lng: 72.458775, note: "Nominatim: 'Bopal, Ahmedabad' (Havmor's pin was 433 km away)" },
  "263": { was: [22.16518, 73.18315], lat: 23.048539, lng: 72.511742, note: "Nominatim: 'Thaltej, Ahmedabad' (Havmor's pin was 120 km away)" },
  "269": { was: [23.0383, 72.64363], lat: 21.771884, lng: 72.141645, note: "Nominatim: 'Bhavnagar, Gujarat' (Havmor's pin was 150 km away)" },
  "278": { was: [19.076, 72.8777], lat: 22.702801, lng: 71.672393, note: "Nominatim: 'Wadhwan, Surendranagar' (Havmor's pin was 422 km away)" },
  "283": { was: [22.30177, 70.78683], lat: 23.058933, lng: 72.671874, note: "Nominatim: 'Nikol, Ahmedabad' (Havmor's pin was 211 km away)" },
  "285": { was: [23.031459, 72.564108], lat: 23.463424, lng: 73.299063, note: "Nominatim: 'Modasa, Gujarat' (Havmor's pin was 89 km away)" },
  "286": { was: [19.14946, 72.83126], lat: 21.145022, lng: 72.757319, note: "Nominatim: 'VR Mall, Surat' (Havmor's pin was 222 km away)" },
  "288": { was: [31.30272, 75.57854], lat: 23.027602, lng: 72.52117, note: "Nominatim: 'Satellite, Ahmedabad' (Havmor's pin was 968 km away)" },
  "289": { was: [23.0911, 72.56014], lat: 23.065091, lng: 70.130031, note: "Nominatim: 'Oslo Circle, Gandhidham' (Havmor's pin was 249 km away)" },
  "342": { was: [22.719319, 71.655611], lat: 30.584286, lng: 74.808913, note: "Nominatim: 'Kotkapura, Punjab' (Havmor's pin was 929 km away)" },
  "354": { was: [31.643257, 74.876348], lat: 28.680675, lng: 77.20395, note: "Nominatim: 'Kamla Nagar, Delhi' (Havmor's pin was 398 km away)" },
  "358": { was: [18.5631, 73.78327], lat: 19.130252, lng: 72.821377, note: "Nominatim: 'Versova, Mumbai' (Havmor's pin was 119 km away)" },
  "360": { was: [23.03435, 72.56077], lat: 19.014881, lng: 72.827956, note: "Nominatim: 'Prabhadevi, Mumbai' (Havmor's pin was 448 km away)" },
  "361": { was: [15.53552, 73.82076], lat: 18.963753, lng: 72.806862, note: "Nominatim: 'Kemps Corner, Mumbai' (Havmor's pin was 396 km away)" },
  "362": { was: [22.32104, 73.15939], lat: 19.055591, lng: 72.827141, note: "Nominatim: 'Khar West, Mumbai' (Havmor's pin was 365 km away)" },
  "368": { was: [23.050739, 72.667296], lat: 21.156001, lng: 79.031506, note: "Nominatim: 'Wardhman Nagar, Nagpur' (Havmor's pin was 689 km away)" },
  "369": { was: [30.90809, 75.8353], lat: 19.033594, lng: 73.018164, note: "Nominatim: 'Nerul, Navi Mumbai' (Havmor's pin was 1350 km away)" },
  "370": { was: [23.053, 72.53364], lat: 18.991424, lng: 72.836459, note: "Nominatim: 'Lalbaug, Mumbai' (Havmor's pin was 453 km away)" },
  "371": { was: [21.144824, 72.757799], lat: 19.136394, lng: 72.837382, note: "Nominatim: 'Jogeshwari West, Mumbai' (Havmor's pin was 223 km away)" },
  "372": { was: [30.40377, 74.02667], lat: 19.115883, lng: 72.854202, note: "Nominatim: 'Andheri East, Mumbai' (Havmor's pin was 1261 km away)" },
  "374": { was: [18.551347, 73.918789], lat: 19.302556, lng: 73.058807, note: "Nominatim: 'Bhiwandi, Thane' (Havmor's pin was 123 km away)" },
  "375": { was: [18.50047, 73.80206], lat: 19.019227, lng: 72.842848, note: "Nominatim: 'Dadar, Mumbai' (Havmor's pin was 116 km away)" },
  "377": { was: [23.060296, 72.553593], lat: 19.163328, lng: 72.8412, note: "Nominatim: 'Goregaon West, Mumbai' (Havmor's pin was 434 km away)" },
  "393": { was: [30.33452, 76.38421], lat: 28.6536, lng: 77.295788, note: "Nominatim: 'Karkardooma, Delhi' (Havmor's pin was 207 km away)" },
  "398": { was: [19.076, 72.8777], lat: 30.335059, lng: 76.382664, note: "Nominatim: 'Leela Bhawan, Patiala' (Havmor's pin was 1301 km away)" },
  "399": { was: [19.12915, 72.81569], lat: 30.319841, lng: 74.121794, note: "Nominatim: 'Fazilka, Punjab' (Havmor's pin was 1251 km away)" },
  "401": { was: [23.01333, 72.52235], lat: 31.292231, lng: 75.567888, note: "Nominatim: 'Jalandhar, Punjab' (Havmor's pin was 968 km away)" },
  "403": { was: [31.3255, 75.57844], lat: 30.286716, lng: 74.526223, note: "Nominatim: 'Sri Muktsar Sahib' (Havmor's pin was 153 km away)" },
  "404": { was: [23.046843, 72.516334], lat: 31.293881, lng: 75.577756, note: "Nominatim: 'Model Town, Jalandhar 144003' (Havmor's pin was 966 km away)" },
  "405": { was: [30.33452, 76.38421], lat: 30.639635, lng: 76.821444, note: "Nominatim: 'VIP Road, Zirakpur' (Havmor's pin was 54 km away)" },
  "406": { was: [30.63207, 76.80901], lat: 30.906637, lng: 75.833962, note: "Nominatim: 'Rani Jhansi Road, Ludhiana' (Havmor's pin was 98 km away)" },
  "407": { was: [30.75602, 76.66982], lat: 30.606598, lng: 74.258109, note: "Nominatim: 'Jalalabad, Fazilka' (Havmor's pin was 231 km away)" },
  "410": { was: [30.37114, 75.54317], lat: 30.247159, lng: 75.84314, note: "Nominatim: 'Nabha Gate, Sangrur' (Havmor's pin was 32 km away)" },
  "411": { was: [23.065312, 70.132349], lat: 30.750308, lng: 76.668897, note: "Nominatim: 'Sunny Enclave, Kharar' (Havmor's pin was 1072 km away)" },
  "413": { was: [23.21501, 72.64714], lat: 18.488368, lng: 73.898667, note: "Nominatim: 'Wanowrie, Pune' (Havmor's pin was 541 km away)" },
  "784": { was: [30.335277, 76.396036], lat: 30.843519, lng: 75.672281, note: "Nominatim: 'Mullanpur Dakha' (Havmor's pin was 89 km away)" },
  "881": { was: [23.19552, 72.423457], lat: 23.164033, lng: 72.881832, note: "Nominatim: 'Dehgam, Gandhinagar' (Havmor's pin was 47 km away)" },
  "909": { was: [22.994939, 72.245185], lat: 22.995525, lng: 72.533458, note: "Nominatim: 'Vishala Circle, Ahmedabad' (Havmor's pin was 30 km away)" },
  "926": { was: [22.315271, 72.572648], lat: 22.26756, lng: 73.164486, note: "Nominatim: 'Kalali, Vadodara' (Havmor's pin was 61 km away)" },
};

/** Stores Havmor files under the wrong city, though their pin is right. */
const CITY_FIXES: Record<string, string> = {
  "429": "Surat", // Adajan, L.P. Savani Road: Surat 395009
  "434": "Limbdi", // Food Mall, Limbdi highway: 363421
};

/** Names with letters lost off the front in Havmor's listing. */
const NAME_FIXES: Record<string, string> = {
  "River ont (Stall no.9 )": "Riverfront (Stall no. 9)",
  "ranandani Thane": "Hiranandani Thane",
};

/** One spelling per city, matching the garba data where both have it. */
const CITY_ALIASES: Record<string, string> = {
  baroda: "Vadodara",
  bangalore: "Bengaluru",
  gurgaon: "Gurugram",
  "new delhi": "Delhi",
  firozpur: "Firozepur",
  sriganganagar: "Sri Ganganagar",
  "shri ganganagar": "Sri Ganganagar",
  "bavla road": "Bavla",
  chhatisgarh: "Chhattisgarh",
  sidhdhpur: "Siddhpur",
  "fategarh sahib": "Fatehgarh Sahib",
  jalalabad: "Jalalabad",
  abohar: "Abohar",
  fazilka: "Fazilka",
  faridkot: "Faridkot",
};

const TYPES: Record<string, HavmorStore["type"]> = {
  "ICECREAM PARLOR": "parlour",
  RESTAURANTS: "restaurant",
  "HAVMOR EATERY": "eatery",
};

/** Some fields are escaped twice ("&amp;amp;"), so decode until nothing changes. */
const decode = (s: string): string => {
  const once = decodeOnce(s);
  return once === s ? s : decode(once);
};

const decodeOnce = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

const tidy = (s: string) =>
  decode(s)
    .replace(/\s+/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .replace(/,(?=\S)/g, ", ")
    .trim();

/** Kept in capitals when an all-caps address is set in title case. */
const ABBREVIATIONS = new Set(
  "SBI BRTS GF FF SCO NH SH SG VR PVR DLF MG LP DY CG TP GIDC HDFC ICICI BOB PNB GPO ST RTO UP HP MP IT BSNL APMC SRP ONGC IOC HPCL BPCL".split(" "),
);

/**
 * "LOWER GROUND, AMBITION MALL, NR:SBI" reads as shouting on a card; set an
 * all-caps string in title case, keeping abbreviations and codes as they are.
 */
function unshout(text: string): string {
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length < 6 || letters !== letters.toUpperCase()) return text;
  return text.replace(/[A-Za-z][A-Za-z']*/g, (word) =>
    ABBREVIATIONS.has(word) || (word.length > 2 && !/[AEIOUY]/.test(word))
      ? word
      : word[0] + word.slice(1).toLowerCase(),
  );
}

function cityOf(heading: string): string {
  const raw = heading.split(",").slice(1).join(",").replace(/,+$/, "").trim();
  const alias = CITY_ALIASES[raw.toLowerCase()];
  if (alias) return alias;
  // "SOUTH BOPAL" and "south bopal" both become "South Bopal".
  return raw === raw.toUpperCase() || raw === raw.toLowerCase()
    ? raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
    : raw;
}

/** "13.0361862`" and "28.425472 E" both hold a usable number; "NULL" doesn't. */
function coord(value: string | null): number | null {
  const m = value?.match(/^\s*(-?\d{1,3}\.\d+)/);
  return m ? Number(m[1]) : null;
}

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function main() {
  const file = process.argv[2];
  const html = file
    ? readFileSync(file, "utf8")
    : await fetch(SOURCE, { headers: { "User-Agent": "Mozilla/5.0 (garba-circle store import)" } }).then(
        (r) => {
          if (!r.ok) throw new Error(`${SOURCE}: HTTP ${r.status}`);
          return r.text();
        },
      );

  const blocks = html.split('<div class="havmorelocation">').slice(1);
  if (blocks.length === 0) throw new Error("No stores found: has the page's markup changed?");

  const problems: string[] = [];
  const stores = new Map<string, HavmorStore>();

  for (const block of blocks) {
    const attr = (key: string) => {
      const m = block.match(new RegExp(`data-${key}="([^"]*)"`));
      return m ? m[1] : null;
    };
    const node = attr("node");
    const heading = tidy(block.match(/<h2>([\s\S]*?)<\/h2>/)?.[1] ?? "");
    if (!node) {
      problems.push(`no node id: ${heading}`);
      continue;
    }
    if (stores.has(node)) continue; // the map's copy of a store already listed

    const listedName = unshout(tidy(attr("franchisee") ?? heading.split(",")[0]));
    const type = TYPES[attr("type") ?? ""];
    if (!type) problems.push(`${node} ${heading}: unknown type ${attr("type")}`);

    let lat = coord(attr("lat"));
    let lng = coord(attr("long"));
    const usable = lat !== null && lng !== null && lat > 6 && lat < 37 && lng > 68 && lng < 98;
    let note: string | null = null;
    const fix = PIN_FIXES[node];
    const correction = PIN_CORRECTIONS[node];
    if (fix) {
      if (usable) console.warn(`note: ${node} ${heading} now has a pin on havmor.com; PIN_FIXES entry unused`);
      else ({ lat, lng, note } = fix);
    } else if (correction && usable) {
      const [wasLat, wasLng] = correction.was;
      if (Math.abs(lat! - wasLat) < 1e-4 && Math.abs(lng! - wasLng) < 1e-4) ({ lat, lng, note } = correction);
      else console.warn(`note: ${node} ${heading} has a new pin on havmor.com; using it (PIN_CORRECTIONS entry unused)`);
    } else if (!usable) {
      problems.push(
        `${node} ${heading}: no usable pin (${attr("lat")}, ${attr("long")}); geocode "${tidy(attr("body") ?? "")}" and add it to PIN_FIXES`,
      );
      continue;
    }

    const phone = tidy(attr("phone") ?? "");
    let address = tidy(attr("body") ?? "");
    // Some addresses end by repeating the phone number; it has its own line.
    const digits = phone.replace(/\D/g, "");
    if (digits.length >= 10) address = address.replace(new RegExp(`[,\\s]*${digits}[\\s.,]*`), " ").trim();

    stores.set(node, {
      id: `havmor-${node}`,
      name: NAME_FIXES[listedName] ?? listedName,
      type: type ?? "parlour",
      city: CITY_FIXES[node] ?? cityOf(heading),
      address: unshout(address) || null,
      phone: phone || null,
      lat: Number(lat!.toFixed(6)),
      lng: Number(lng!.toFixed(6)),
      coordsNote: note,
    });
  }

  if (problems.length) {
    console.error(`${problems.length} problem(s); nothing written:\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }

  // A pin far from the rest of its city is usually a typo; flag it for a look.
  const list = [...stores.values()].sort(
    (a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
  const byCity = Map.groupBy(list, (s) => s.city);
  for (const [city, group] of byCity) {
    if (group.length < 3) continue;
    const centre = { lat: median(group.map((s) => s.lat)), lng: median(group.map((s) => s.lng)) };
    for (const s of group) {
      const d = km(s, centre);
      if (d > WARN_KM_FROM_CITY) console.warn(`check: ${s.id} ${s.name}, ${city} is ${Math.round(d)} km from the rest of ${city}`);
    }
  }

  const out = HavmorStoreFileSchema.parse({
    source: SOURCE,
    fetchedOn: new Date().toISOString().slice(0, 10),
    stores: list,
  });
  writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);
  const placed = list.filter((s) => s.coordsNote).length;
  console.log(`${list.length} stores in ${byCity.size} cities (${placed} pinned by us) → ${OUT}`);
}

void main();
