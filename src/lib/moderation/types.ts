export type ContactFindingKind =
  | "phone"
  | "phone_fragment"
  | "phone_request"
  | "email"
  | "upi"
  | "url"
  | "social"
  | "platform"
  | "handle"
  | "move_off_platform";

export type ContactFinding = {
  kind: ContactFindingKind;
  reason: string;
};
