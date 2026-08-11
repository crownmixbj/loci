import { supabase } from '@/lib/supabase';

/**
 * The Admin area's data access.
 *
 * Everything here goes through Row Level Security or a `security definer`
 * function that checks `is_admin()` server-side. Nothing in this file is the
 * security boundary — hiding the Admin nav entry is a courtesy, and these calls
 * simply fail for a non-admin. See `supabase/07_admin.sql`.
 */

// ------------------------------------------------------------- overview -----

export type AdminOverview = {
  users: number;
  admins: number;
  applicationsPending: number;
  applicationsUnderReview: number;
  driversApproved: number;
  applicationsRejected: number;
  parcelsTotal: number;
  parcelsUnclaimed: number;
  parcelsInTransit: number;
  parcelsDelivered: number;
  parcelsLast7Days: number;
  errorsLast24h: number;
};

const num = (value: unknown): number => (typeof value === 'number' ? value : Number(value ?? 0));

/**
 * Platform counts.
 *
 * Deliberately aggregates rather than rows: "how many parcels moved this week"
 * is an operational question, and answering it does not require an admin to see
 * anyone's recipient address. The function returns numbers only.
 */
export async function fetchOverview(): Promise<AdminOverview> {
  const { data, error } = await supabase.rpc('admin_overview');
  if (error) throw error;

  const raw = (data ?? {}) as Record<string, unknown>;

  return {
    users: num(raw.users),
    admins: num(raw.admins),
    applicationsPending: num(raw.applications_pending),
    applicationsUnderReview: num(raw.applications_under_review),
    driversApproved: num(raw.drivers_approved),
    applicationsRejected: num(raw.applications_rejected),
    parcelsTotal: num(raw.parcels_total),
    parcelsUnclaimed: num(raw.parcels_unclaimed),
    parcelsInTransit: num(raw.parcels_in_transit),
    parcelsDelivered: num(raw.parcels_delivered),
    parcelsLast7Days: num(raw.parcels_last_7_days),
    errorsLast24h: num(raw.errors_last_24h),
  };
}

export type CityVolume = { city: string; total: number; active: number };

export async function fetchCityVolumes(): Promise<CityVolume[]> {
  const { data, error } = await supabase.rpc('admin_city_volumes');
  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    city: String(row.city ?? ''),
    total: num(row.total),
    active: num(row.active),
  }));
}

// ---------------------------------------------------------------- users -----

export type AdminUser = {
  id: string;
  fullName: string;
  phone: string;
  isAdmin: boolean;
  createdAt: string;
  /** Set while the person is barred from accepting jobs. Reversible. */
  drivingBannedAt: string | null;
  banReason: string | null;
  /** Set once erased. The account keeps its login but every policy refuses it. */
  deletedAt: string | null;
};

/**
 * Every account.
 *
 * Readable only because `07_admin.sql` adds an admin-only select policy on
 * `profiles`. Without it this returns exactly one row — the caller's own — which
 * is what it did before, and why this screen could not exist.
 */
export async function fetchUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, full_name, phone, is_admin, created_at, driving_banned_at, driving_ban_reason, deleted_at',
    )
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    fullName: String(row.full_name ?? ''),
    phone: String(row.phone ?? ''),
    isAdmin: Boolean(row.is_admin),
    createdAt: String(row.created_at ?? ''),
    drivingBannedAt: (row.driving_banned_at as string | null) ?? null,
    banReason: (row.driving_ban_reason as string | null) ?? null,
    deletedAt: (row.deleted_at as string | null) ?? null,
  }));
}

/**
 * Bar a driver from accepting jobs, or lift it.
 *
 * The account keeps working as a customer — banning revokes driving, not the
 * login. Enforced by `is_approved_driver()`, which the claim policy on
 * `bookings` already calls, so the ban applies to the feed and the claim at
 * once rather than being a UI condition someone can route around.
 *
 * A reason is required by the server when banning. A ban nobody can explain six
 * months later is a ban that cannot be defended or lifted with confidence.
 */
export async function setDrivingBan(
  targetId: string,
  banned: boolean,
  reason?: string,
): Promise<void> {
  const { error } = await supabase.rpc('set_driving_ban', {
    target_id: targetId,
    banned,
    note: reason ?? null,
  });

  if (error) throw error;
}

/**
 * Erase a person: irreversible.
 *
 * Overwrites every identifying field across the profile, the booking rows and
 * the driver application, deletes the uploaded documents, and blocks the
 * account. Parcels survive — the sender's own delivery history is theirs, and
 * destroying it to satisfy someone else's erasure would be the wrong trade.
 *
 * ⚠ Does NOT remove the row from `auth.users`. See the header of
 *   `supabase/09_bans.sql`: two foreign keys make a hard delete destructive
 *   today, and removing the login needs an Edge Function holding the
 *   service_role key.
 */
export async function erasePerson(targetId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('erase_person', {
    target_id: targetId,
    note: reason ?? null,
  });

  if (error) throw error;
}

/**
 * Just enough of each driver application to segment the user list.
 *
 * Deliberately not `fetchAllApplications`. That returns whole rows — NIN, bank
 * account, guarantor — and the user list needs none of it. Pulling the full
 * record into a screen that only wants to print "Approved" would put those
 * fields in the client's memory for no reason, and eventually into a log or a
 * crash report.
 */
export type ApplicationSummary = {
  userId: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  reference: string;
  submittedAt: string;
};

export async function fetchApplicationSummaries(): Promise<ApplicationSummary[]> {
  const { data, error } = await supabase
    .from('driver_applications')
    .select('user_id, status, reference, submitted_at');

  if (error) throw error;

  return (data ?? []).map((row) => ({
    userId: String(row.user_id),
    status: row.status as ApplicationSummary['status'],
    reference: String(row.reference ?? ''),
    submittedAt: String(row.submitted_at ?? ''),
  }));
}

/**
 * Promote or demote.
 *
 * A function call, not an update: `profiles.is_admin` is un-writable by any
 * client, and this is the single audited path around that. The server refuses
 * to let you change your own row, and refuses to remove the last admin — both
 * surface here as thrown errors with messages worth showing verbatim.
 */
export async function setAdminRole(
  targetId: string,
  makeAdmin: boolean,
  reason?: string,
): Promise<void> {
  const { error } = await supabase.rpc('set_admin_role', {
    target_id: targetId,
    make_admin: makeAdmin,
    note: reason ?? null,
  });

  if (error) throw error;
}

export type RoleGrant = {
  id: string;
  subjectId: string;
  actorId: string;
  granted: boolean;
  reason: string | null;
  createdAt: string;
};

/** The audit trail. Every row was written by `set_admin_role`, never a client. */
export async function fetchRoleGrants(limit = 25): Promise<RoleGrant[]> {
  const { data, error } = await supabase
    .from('role_grants')
    .select('id, subject_id, actor_id, granted, reason, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    subjectId: String(row.subject_id),
    actorId: String(row.actor_id),
    granted: Boolean(row.granted),
    reason: (row.reason as string | null) ?? null,
    createdAt: String(row.created_at ?? ''),
  }));
}

// --------------------------------------------------------------- events -----

export type EventLevel = 'info' | 'warning' | 'error';

export type AppEvent = {
  id: string;
  level: EventLevel;
  area: string;
  message: string;
  context: Record<string, unknown>;
  actorId: string | null;
  createdAt: string;
};

export async function fetchEvents(options?: {
  level?: EventLevel | 'all';
  limit?: number;
}): Promise<AppEvent[]> {
  let query = supabase
    .from('app_events')
    .select('id, level, area, message, context, actor_id, created_at')
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 100);

  if (options?.level && options.level !== 'all') {
    query = query.eq('level', options.level);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    level: (row.level as EventLevel) ?? 'info',
    area: String(row.area ?? ''),
    message: String(row.message ?? ''),
    context: (row.context as Record<string, unknown>) ?? {},
    actorId: (row.actor_id as string | null) ?? null,
    createdAt: String(row.created_at ?? ''),
  }));
}

/**
 * Records something that went wrong.
 *
 * Fire-and-forget, and it swallows its own failure on purpose: a logger that
 * throws turns a handled error into an unhandled one, and the thing being
 * logged is more important than the log.
 *
 * ⚠ `context` reaches a table an admin can read. Do not put a NIN, a bank
 *   account, an address or a phone number in it — put an id and let the reader
 *   look it up under the policies that govern that data.
 */
export async function logEvent(
  level: EventLevel,
  area: string,
  message: string,
  context: Record<string, unknown> = {},
): Promise<void> {
  try {
    await supabase.from('app_events').insert({
      level,
      area,
      // Truncated: an error message can be a whole HTML page from a proxy, and
      // a log row that big is unreadable in the viewer and expensive to store.
      message: message.slice(0, 500),
      context,
    });
  } catch {
    // Nothing to do. Failing to log must never mask the original failure.
  }
}
