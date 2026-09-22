/**
 * Fills the circle with sample dancers so the reel has something to land on.
 * Safe to re-run: it skips numbers that already exist.
 *
 *   npm run db:seed
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { inArray } from "drizzle-orm";
import { db } from "../src/lib/db";
import { users } from "../src/lib/db/schema";

const FIRST_F = ["Priya", "Khushi", "Aarohi", "Meera", "Sneha", "Riya", "Kavya", "Isha", "Tanvi", "Nidhi", "Shreya", "Dhara"];
const FIRST_M = ["Aarav", "Rohan", "Jay", "Dev", "Karan", "Harsh", "Yash", "Mihir", "Parth", "Raj", "Neel", "Kunal"];
const LAST = ["Patel", "Shah", "Desai", "Joshi", "Trivedi", "Mehta", "Kulkarni", "Deshmukh", "Sharma", "Vora"];
const CITIES: [string, string][] = [
  ["Ahmedabad", "Gujarat"], ["Surat", "Gujarat"], ["Vadodara", "Gujarat"],
  ["Rajkot", "Gujarat"], ["Mumbai", "Maharashtra"], ["Pune", "Maharashtra"],
  ["Thane", "Maharashtra"], ["Nashik", "Maharashtra"], ["Indore", "Madhya Pradesh"],
  ["Jaipur", "Rajasthan"], ["Delhi", "Delhi"], ["Bengaluru", "Karnataka"],
];
const STYLES = ["Garba", "Dandiya Raas", "Sanedo", "Hinch", "Dodhiyu", "Titodo", "Bollywood"];
const LEVELS = ["beginner", "intermediate", "pro"];
const BIOS = [
  "Raas till 2am, chai after. Looking for someone who knows the 12-step.",
  "Been doing garba since school. Teach me Sanedo and I'm yours.",
  "Chaniya choli ready, partner missing.",
  "I know exactly three steps but I do them with full confidence.",
  "Dhol lover. If the beat drops I am gone.",
  "Navratri is my whole personality for nine nights.",
  "Looking for someone who won't leave after two rounds.",
  "Timli specialist. Bring stamina.",
  "First Navratri in this city, show me the good grounds.",
  "Garba in the evening, garba in my dreams.",
];

function pick<T>(list: T[], i: number): T {
  return list[i % list.length];
}

async function main() {
  const count = 36;
  const rows = Array.from({ length: count }, (_, i) => {
    const female = i % 2 === 0;
    const [city, state] = pick(CITIES, i * 5 + 1);
    const styleCount = 1 + (i % 3);
    return {
      // Stored canonically as 91 + a 10-digit mobile, same as a real sign-in.
      // 70000 1xxxx is a reserved test range, never a live subscriber.
      phone: `9170000${String(10000 + i).slice(-5)}`,
      name: `${female ? pick(FIRST_F, i) : pick(FIRST_M, i)} ${pick(LAST, i * 3)}`,
      gender: female ? "female" : i % 7 === 3 ? "other" : "male",
      age: 19 + (i % 14),
      city,
      state,
      bio: pick(BIOS, i * 2),
      danceStyles: Array.from({ length: styleCount }, (_, j) => pick(STYLES, i + j * 2)),
      skillLevel: pick(LEVELS, i),
      profileComplete: true,
    };
  });

  const phones = rows.map((r) => r.phone);
  const existing = await db
    .select({ phone: users.phone })
    .from(users)
    .where(inArray(users.phone, phones));
  const known = new Set(existing.map((e) => e.phone));

  const fresh = rows.filter((r) => !known.has(r.phone));
  if (fresh.length === 0) {
    console.log(`All ${count} sample dancers already exist. Nothing to do.`);
    return;
  }

  await db.insert(users).values(fresh);
  console.log(`Added ${fresh.length} sample dancers to the circle.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
