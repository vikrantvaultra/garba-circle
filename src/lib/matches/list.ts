import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { PublicProfile } from "@/lib/api";

export type Conversation = {
  matchId: string;
  partner: PublicProfile;
  lastMessage: { body: string; mine: boolean; createdAt: string } | null;
  unread: number;
  /** True when this user sent the dandiya that opened the conversation. */
  initiatedByMe: boolean;
  createdAt: string;
};

export type MatchesPayload = {
  conversations: Conversation[];
  unreadTotal: number;
};

type Row = Record<string, unknown>;

function rows(result: unknown): Row[] {
  return (Array.isArray(result) ? result : (result as { rows?: Row[] }).rows) ?? [];
}

/**
 * Every conversation this dancer is in, newest activity first, with unread
 * counts. Sending a dandiya opens the chat immediately, so there is no
 * pending-invite state to model any more — a conversation either has replies
 * or it does not.
 */
export async function listMatches(userId: string): Promise<MatchesPayload> {
  const result = await db.execute(sql`
    select
      m.id            as match_id,
      m.created_at    as created_at,
      u.id            as p_id,
      u.name          as p_name,
      u.gender        as p_gender,
      u.age           as p_age,
      u.city          as p_city,
      u.state         as p_state,
      u.bio           as p_bio,
      u.dance_styles  as p_styles,
      u.skill_level   as p_skill,
      u.avatar_url    as p_avatar,
      coalesce(cnt.unread, 0)::int as unread,
      exists (
        select 1 from interests i
        where i.from_user_id = ${userId}::uuid and i.to_user_id = u.id
      ) as initiated_by_me
    from matches m
    join users u
      on u.id = case when m.user_a_id = ${userId}::uuid then m.user_b_id else m.user_a_id end
    left join chat_sessions cs
      on cs.match_id = m.id and cs.user_id = ${userId}::uuid
    left join lateral (
      select count(*) as unread
      from messages msg
      where msg.match_id = m.id
        and msg.sender_id <> ${userId}::uuid
        and msg.created_at > coalesce(cs.last_read_at, to_timestamp(0))
    ) cnt on true
    where (m.user_a_id = ${userId}::uuid or m.user_b_id = ${userId}::uuid)
      and not exists (
        select 1 from blocks b
        where (b.blocker_id = ${userId}::uuid and b.blocked_id = u.id)
           or (b.blocker_id = u.id and b.blocked_id = ${userId}::uuid)
      )
    order by coalesce(m.last_message_at, m.created_at) desc
    limit 100
  `);

  const matchRows = rows(result);
  if (matchRows.length === 0) return { conversations: [], unreadTotal: 0 };

  const ids = matchRows.map((row) => row.match_id as string);
  const previewResult = await db.execute(sql`
    select distinct on (match_id)
      match_id, body, sender_id, created_at
    from messages
    where match_id in (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
    order by match_id, created_at desc
  `);

  const previews = new Map<string, Row>();
  for (const row of rows(previewResult)) {
    previews.set(row.match_id as string, row);
  }

  const conversations = matchRows.map((row): Conversation => {
    const preview = previews.get(row.match_id as string);
    return {
      matchId: row.match_id as string,
      partner: {
        id: row.p_id as string,
        name: row.p_name as string | null,
        gender: row.p_gender as string | null,
        age: row.p_age as number | null,
        city: row.p_city as string | null,
        state: row.p_state as string | null,
        bio: row.p_bio as string | null,
        danceStyles: (row.p_styles as string[] | null) ?? [],
        skillLevel: row.p_skill as string | null,
        avatarUrl: row.p_avatar as string | null,
      },
      lastMessage: preview
        ? {
            body: preview.body as string,
            mine: (preview.sender_id as string) === userId,
            createdAt: new Date(preview.created_at as string).toISOString(),
          }
        : null,
      unread: Number(row.unread ?? 0),
      initiatedByMe: Boolean(row.initiated_by_me),
      createdAt: new Date(row.created_at as string).toISOString(),
    };
  });

  return {
    conversations,
    unreadTotal: conversations.reduce((sum, c) => sum + (c.unread > 0 ? 1 : 0), 0),
  };
}

/** Conversations with something waiting, for the bottom-nav badge. */
export async function countPendingInvites(userId: string): Promise<number> {
  const { unreadTotal } = await listMatches(userId);
  return unreadTotal;
}
