import { z } from "zod";
import { eq } from "drizzle-orm";
import { fail, guard, json } from "@/lib/api";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";

/**
 * The browser compresses and crops the photo to a small square WebP before it
 * gets here, so the payload is tens of kilobytes.
 *
 * With Vercel Blob configured we store the file and keep a URL. Without it we
 * keep the data URL in Postgres — which costs nothing extra and means the app
 * works on a bare free-tier database with no object storage at all.
 */

const MAX_BYTES = 220 * 1024;

const Body = z.object({
  dataUrl: z
    .string()
    .regex(/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/, "Unsupported image"),
});

export async function POST(req: Request) {
  return guard(async () => {
    const user = await requireUser();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Please choose a photo again.");

    const [header, base64] = parsed.data.dataUrl.split(",");
    const buffer = Buffer.from(base64, "base64");
    if (buffer.byteLength > MAX_BYTES) {
      return fail("That photo is too large. Try a smaller one.");
    }

    const contentType = header.slice(5, header.indexOf(";"));
    let avatarUrl = parsed.data.dataUrl;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import("@vercel/blob");
      const ext = contentType.split("/")[1];
      const blob = await put(`avatars/${user.id}-${Date.now()}.${ext}`, buffer, {
        access: "public",
        contentType,
      });
      avatarUrl = blob.url;
    }

    await db
      .update(users)
      .set({ avatarUrl, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    return json({ ok: true, avatarUrl });
  });
}
