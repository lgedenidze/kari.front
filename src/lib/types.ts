// Shapes returned by the .NET API (api/src/Kari.Api/Features). Keep in step with the C# records.

export type UserRole = "member" | "staff" | "admin";
export type UserStatus = "guest" | "pending" | "approved" | "rejected" | "banned";
export type InviteMode = "auto" | "on" | "off";
export type PassKind = "member" | "guest" | "door";
export type PassStatus = "active" | "revoked";
export type InviteState = "pending" | "accepted" | "declined" | "revoked" | "expired";
export type Decision = "admitted" | "denied";
/** What a row of the door's log records: a decision, or an admission that was taken back. */
export type EntryDecision = Decision | "undone";
export type EntryMethod = "scan" | "manual";

export type Verdict =
  | "ok"
  | "reentry"
  | "stale"
  | "wrong_night"
  | "revoked"
  | "banned"
  | "unknown"
  | "no_pass"
  | "not_on_list";

export interface Me {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  profileUrl: string | null;
  role: UserRole;
  status: UserStatus;
  reviewNote: string | null;
  hasPhoto: boolean;
  lang: string;
  canInvite: boolean;
  inviteQuota: number;
  visits: number;
  pendingInvites: number;
  /** Requests to join that nobody has answered. Always 0 unless this is an admin. */
  pendingRequests: number;
}

export interface NightInfo {
  /** yyyy-MM-dd. The night a date belongs to is decided by the API, never here. */
  night: string;
  open: boolean;
  title: string | null;
  note: string | null;
  capacity: number;
  doorsOpen: string;
  doorsClose: string;
  endsAt: string;
  overridden: boolean;
}

export interface Ticket {
  publicId: string;
  shortCode: string;
  kind: PassKind;
  night: string;
  nightTitle: string | null;
  firstName: string;
  lastName: string;
  inviterName: string | null;
  /** base64url HMAC key the phone uses to draw the rotating code. */
  key: string;
  status: PassStatus;
  admittedAt: string | null;
  endsAt: string;
  accessToken: string | null;
}

export interface UpcomingPass {
  night: string;
  nightTitle: string | null;
  kind: PassKind;
  inviterName: string | null;
}

export interface TonightResponse {
  serverTime: number;
  tonight: NightInfo;
  ticket: Ticket | null;
  canClaim: boolean;
  blocker: "closed" | "not_approved" | "banned" | null;
  upcoming: UpcomingPass[];
}

export interface TicketResponse {
  serverTime: number;
  tonight: string;
  ticket: Ticket;
}

export interface Invite {
  id: string;
  code: string;
  night: string;
  nightTitle: string | null;
  guestFirstName: string;
  guestLastName: string;
  guestPersonalNumber: string | null;
  inviteePhone: string | null;
  status: InviteState;
  inviterName: string;
  createdAt: string;
  respondedAt: string | null;
  admitted: boolean;
}

/** One night in the invite calendar. Closed nights are included, with nothing remaining. */
export interface InviteNight {
  night: string;
  open: boolean;
  title: string | null;
  note: string | null;
  used: number;
  remaining: number;
}

export interface InvitesOverview {
  canInvite: boolean;
  quota: number;
  nights: InviteNight[];
  sent: Invite[];
  received: Invite[];
}

export interface InviteLinkResponse {
  serverTime: number;
  tonight: string;
  invite: Invite;
  ticket: Ticket | null;
  viewerIsInviter: boolean;
  night: NightInfo;
}

export interface PersonCard {
  userId: string | null;
  firstName: string;
  lastName: string;
  personalNumber: string | null;
  phone: string | null;
  profileUrl: string | null;
  status: UserStatus;
  hasPhoto: boolean;
  visits: number;
  lastVisit: string | null;
  denials: number;
  staffNotes: string | null;
}

export interface PassCard {
  id: string;
  shortCode: string;
  kind: PassKind;
  night: string;
  status: PassStatus;
  admittedAt: string | null;
  /** Whose tap let this pass in, and whether its code was scanned or the person was found by hand. */
  admittedBy: string | null;
  admittedMethod: EntryMethod | null;
}

export interface ScanResult {
  verdict: Verdict;
  method: EntryMethod;
  person: PersonCard | null;
  pass: PassCard | null;
  inviter: { id: string; name: string; status: UserStatus } | null;
  warnings: ("matches_banned" | "at_capacity" | "closed_tonight")[];
}

export interface Entry {
  id: string;
  night: string;
  personName: string;
  staffName: string;
  decision: EntryDecision;
  reason: string | null;
  verdict: Verdict;
  method: EntryMethod;
  createdAt: string;
  passId: string | null;
  userId: string | null;
}

export interface DoorTonight {
  night: NightInfo;
  inside: number;
  denied: number;
  passes: number;
  recent: Entry[];
}

export interface DecideResponse {
  entry: Entry;
  tonight: DoorTonight;
}

/** entry is null when there was no admission left to take back; result is the pass as the door now sees it. */
export interface UndoResponse {
  entry: Entry | null;
  result: ScanResult;
  tonight: DoorTonight;
}

/** A member's own card: token is what its QR says, code the same thing as printed under it. */
export interface MemberCard {
  code: string;
  token: string;
  firstName: string;
  lastName: string;
  since: string;
}

export interface WalkInResponse {
  ticketToken: string;
  pass: PassCard;
  entry: Entry;
  tonight: DoorTonight;
}

export interface SearchHit {
  passId: string | null;
  userId: string | null;
  name: string;
  /** A phone number, a pass kind, or "guest_of:<name>". */
  detail: string | null;
  status: UserStatus | "revoked";
  hasPass: boolean;
  admitted: boolean;
}

export interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  profileUrl: string | null;
  role: UserRole;
  status: UserStatus;
  hasPhoto: boolean;
  appliedAt: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  inviteMode: InviteMode;
  inviteQuota: number | null;
  staffNotes: string | null;
  createdAt: string;
  visits: number;
}

export interface AdminUserDetail {
  user: AdminUser;
  lastVisit: string | null;
  denials: number;
  invitesSent: number;
  canInvite: boolean;
  effectiveQuota: number;
  entries: Entry[];
}

export interface UserPage {
  items: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Overview {
  pending: number;
  members: number;
  guests: number;
  banned: number;
  tonight: NightInfo;
  passesTonight: number;
  insideTonight: number;
  deniedTonight: number;
  series: { night: string; admitted: number; denied: number }[];
}

export interface Settings {
  openDays: number[];
  doorsOpen: string;
  doorsClose: string;
  cutoffHour: number;
  capacity: number;
  defaultInviteQuota: number;
}

export interface EntriesResponse {
  night: string;
  info: NightInfo;
  inside: number;
  denied: number;
  entries: Entry[];
}

export interface PublicVenue {
  tonight: NightInfo;
  week: NightInfo[];
}
