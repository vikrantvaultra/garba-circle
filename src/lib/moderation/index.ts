/**
 * The one entry point every write path calls before text is persisted:
 * chat messages, display names and profile bios all go through here.
 */

import { scanForAbuse, worstSeverity, type AbuseFinding } from "./abuse";
import { scanForContactSharing } from "./phone";
import { scanForPlatformSharing } from "./platforms";
import type { ContactFinding } from "./types";
import { tidyWhitespace } from "./normalize";

export type ModerationAction = "allow" | "block";

export type ModerationVerdict = {
  action: ModerationAction;
  /** Shown to the sender. Friendly, never quotes the matched term back. */
  message?: string;
  /** Adds to the user's strike count when true. */
  strike: boolean;
  reasonCode:
    | "clean"
    | "abuse_severe"
    | "abuse_moderate"
    | "contact_phone"
    | "contact_fragment"
    | "contact_request"
    | "contact_platform"
    | "contact_other"
    | "empty"
    | "too_long";
  abuse: AbuseFinding[];
  contact: ContactFinding[];
  /** Digit fragments to remember for this sender's next message. */
  carry: string;
  /** Truncated original text, kept only when the message was blocked. */
  snippet: string | null;
};

export const MAX_MESSAGE_LENGTH = 800;

/** Findings that mean "they tried to move this somewhere else". */
const PLATFORM_KINDS = new Set(["platform", "handle", "move_off_platform"]);

const CONTACT_COPY: Record<string, string> = {
  phone:
    "Phone numbers stay inside Garba Circle — keep the chat here so we can keep you safe.",
  phone_fragment:
    "Looks like a number was being sent in pieces. Please keep the chat inside Garba Circle.",
  phone_request:
    "Asking for numbers or socials isn’t allowed. Chat here first — you can always meet at the ground.",
  email: "Email addresses can’t be shared here.",
  upi: "Never share UPI IDs in chat. Payments outside Garba Circle are not protected.",
  url: "Links can’t be shared in chat.",
  social: "Social handles can’t be shared here.",
  platform:
    "Other apps can’t be shared here. Everything stays inside Garba Circle — that’s what keeps it safe.",
  handle: "Usernames and account names can’t be shared. Keep the chat here.",
  move_off_platform:
    "The conversation stays in Garba Circle. Meet at the ground, not on another app.",
};

export type ModerateOptions = {
  /** Digits this sender emitted in their recent allowed messages. */
  carryDigits?: string;
  /** Profile text is stricter about contact info and never carries fragments. */
  context?: "chat" | "profile";
};

export function moderateText(
  input: string,
  options: ModerateOptions = {},
): ModerationVerdict {
  const text = tidyWhitespace(input);
  const context = options.context ?? "chat";

  /** Enough for a human to judge an appeal, never a full transcript. */
  const snippet = text.slice(0, 200);

  const empty: Omit<ModerationVerdict, "action" | "reasonCode" | "strike"> = {
    abuse: [],
    contact: [],
    carry: "",
    snippet: null,
  };

  if (!text) {
    return { action: "block", reasonCode: "empty", strike: false, ...empty };
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    return {
      action: "block",
      reasonCode: "too_long",
      strike: false,
      message: `Keep it under ${MAX_MESSAGE_LENGTH} characters.`,
      ...empty,
    };
  }

  const abuse = scanForAbuse(text);
  const severity = worstSeverity(abuse);

  const contactScan = scanForContactSharing(text, {
    carryDigits: context === "chat" ? options.carryDigits : undefined,
  });
  // Numbers and off-platform links are separate problems with separate
  // detectors; a message can trip both, and the copy should name the one the
  // sender most likely meant.
  const contact = [...contactScan.findings, ...scanForPlatformSharing(text)];

  // Abuse outranks contact sharing: it is the more serious safety issue and
  // the copy should reflect what the user actually did wrong.
  if (severity === "severe") {
    return {
      action: "block",
      reasonCode: "abuse_severe",
      strike: true,
      message:
        "That message breaks our community rules. Garba Circle is a family space — keep it respectful.",
      abuse,
      contact,
      carry: "",
      snippet,
    };
  }

  if (contact.length > 0) {
    const primary = contact[0];
    const isFragment = primary.kind === "phone_fragment";
    const isRequest = primary.kind === "phone_request";
    return {
      action: "block",
      reasonCode: isFragment
        ? "contact_fragment"
        : isRequest
          ? "contact_request"
          : primary.kind === "phone"
            ? "contact_phone"
            : PLATFORM_KINDS.has(primary.kind)
              ? "contact_platform"
              : "contact_other",
      // Persistent attempts earn a strike; a single slip just gets a nudge.
      strike: isFragment,
      message: CONTACT_COPY[primary.kind] ?? CONTACT_COPY.phone,
      abuse,
      contact,
      carry: "",
      snippet,
    };
  }

  if (severity === "moderate") {
    return {
      action: "block",
      reasonCode: "abuse_moderate",
      strike: false,
      message:
        "Let’s keep it friendly — that one won’t go through. Try again without the insult.",
      abuse,
      contact,
      carry: "",
      snippet,
    };
  }

  return {
    action: "allow",
    reasonCode: "clean",
    strike: false,
    abuse,
    contact,
    carry: contactScan.carry,
    snippet: null,
  };
}

export { scanForAbuse, scanForContactSharing, scanForPlatformSharing };
export type { AbuseFinding, ContactFinding };
