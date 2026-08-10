import { supabase } from '@/lib/supabase';

/**
 * Driver applications, and the review workflow around them.
 *
 * Everything here is subject to Row Level Security: an applicant's queries can
 * only ever return their own row, and the review calls only succeed for an
 * account whose profile has `is_admin`. The client code below is therefore a
 * convenience, not the security boundary — see `supabase/02_driver_applications.sql`.
 */
export type ApplicationStatus = 'pending' | 'under_review' | 'approved' | 'rejected';

/** How long the copy promises a review takes. Used to flag overdue queues. */
export const REVIEW_WORKING_DAYS = 7;

export type DriverApplication = {
  id: string;
  userId: string;
  reference: string;

  fullName: string;
  phone: string;
  email: string;
  nin: string;
  address: string;
  state: string;
  baseCity: string | null;

  vehicleType: string;
  plateNumber: string;
  licenseId: string;

  guarantorName: string;
  guarantorPhone: string;
  guarantorRelationship: string;
  guarantorAddress: string;
  guarantorNin: string;

  bankName: string;
  accountNumber: string;
  accountName: string;

  kinName: string;
  kinPhone: string;
  kinRelationship: string;

  /** Filenames of what was attached. The files themselves aren't uploaded yet. */
  documents: Record<string, string | null>;

  status: ApplicationStatus;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  submittedAt: string;
};

type Row = Record<string, unknown>;

const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const nullableStr = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

export function rowToApplication(row: Row): DriverApplication {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    reference: str(row.reference),
    fullName: str(row.full_name),
    phone: str(row.phone),
    email: str(row.email),
    nin: str(row.nin),
    address: str(row.address),
    state: str(row.state),
    baseCity: nullableStr(row.base_city),
    vehicleType: str(row.vehicle_type),
    plateNumber: str(row.plate_number),
    licenseId: str(row.license_id),
    guarantorName: str(row.guarantor_name),
    guarantorPhone: str(row.guarantor_phone),
    guarantorRelationship: str(row.guarantor_relationship),
    guarantorAddress: str(row.guarantor_address),
    guarantorNin: str(row.guarantor_nin),
    bankName: str(row.bank_name),
    accountNumber: str(row.account_number),
    accountName: str(row.account_name),
    kinName: str(row.kin_name),
    kinPhone: str(row.kin_phone),
    kinRelationship: str(row.kin_relationship),
    documents: (row.documents as Record<string, string | null>) ?? {},
    status: str(row.status) as ApplicationStatus,
    reviewNote: nullableStr(row.review_note),
    reviewedBy: nullableStr(row.reviewed_by),
    reviewedAt: nullableStr(row.reviewed_at),
    submittedAt: str(row.submitted_at),
  };
}

export type NewApplication = Omit<
  DriverApplication,
  'id' | 'status' | 'reviewNote' | 'reviewedBy' | 'reviewedAt' | 'submittedAt'
>;

export async function submitApplication(application: NewApplication): Promise<DriverApplication> {
  const { data, error } = await supabase
    .from('driver_applications')
    .insert({
      user_id: application.userId,
      reference: application.reference,
      full_name: application.fullName,
      phone: application.phone,
      email: application.email,
      nin: application.nin,
      address: application.address,
      state: application.state,
      base_city: application.baseCity,
      vehicle_type: application.vehicleType,
      plate_number: application.plateNumber,
      license_id: application.licenseId,
      guarantor_name: application.guarantorName,
      guarantor_phone: application.guarantorPhone,
      guarantor_relationship: application.guarantorRelationship,
      guarantor_address: application.guarantorAddress,
      guarantor_nin: application.guarantorNin,
      bank_name: application.bankName,
      account_number: application.accountNumber,
      account_name: application.accountName,
      kin_name: application.kinName,
      kin_phone: application.kinPhone,
      kin_relationship: application.kinRelationship,
      documents: application.documents,
      // Not sent: status, reviewed_by, reviewed_at. The insert policy refuses
      // anything but 'pending' anyway — this just makes the intent explicit.
    })
    .select()
    .single();

  if (error) throw error;
  return rowToApplication(data);
}

/** The signed-in user's own application, if they have one. */
export async function fetchMyApplication(userId: string): Promise<DriverApplication | null> {
  const { data, error } = await supabase
    .from('driver_applications')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data ? rowToApplication(data) : null;
}

/**
 * Every application, for the review queue.
 *
 * Returns nothing but the caller's own row for a non-admin — RLS decides, not
 * this function. Oldest first: a review queue worked newest-first leaves the
 * earliest applicants waiting longest, which is exactly backwards when you've
 * promised a 3–7 day turnaround.
 */
export async function fetchAllApplications(): Promise<DriverApplication[]> {
  const { data, error } = await supabase
    .from('driver_applications')
    .select('*')
    .order('submitted_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(rowToApplication);
}

/** Approve, reject, or move to under_review. Refused by RLS for non-admins. */
export async function reviewApplication(
  id: string,
  decision: { status: ApplicationStatus; note?: string; reviewerId: string },
): Promise<DriverApplication> {
  const { data, error } = await supabase
    .from('driver_applications')
    .update({
      status: decision.status,
      review_note: decision.note ?? null,
      reviewed_by: decision.reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return rowToApplication(data);
}

/** Whether the signed-in account can see the review dashboard. */
export async function fetchIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();

  // A missing profile is not an error worth surfacing — it just isn't an admin.
  if (error) return false;
  return Boolean(data?.is_admin);
}

/** Working days since submission, for flagging a queue that's slipping. */
export function workingDaysSince(iso: string, now: Date = new Date()): number {
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return 0;

  let days = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);

  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1);
    const day = cursor.getDay();
    // 0 Sunday, 6 Saturday.
    if (day !== 0 && day !== 6) days += 1;
  }

  return days;
}

export function isOverdue(application: DriverApplication, now: Date = new Date()): boolean {
  if (application.status === 'approved' || application.status === 'rejected') return false;
  return workingDaysSince(application.submittedAt, now) > REVIEW_WORKING_DAYS;
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: 'Pending review',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
};

/**
 * Live updates to one applicant's own row.
 *
 * The `filter` scopes the subscription to this user, but that is an efficiency
 * measure, not the security boundary — Row Level Security decides what the
 * websocket is allowed to deliver, so removing the filter would still not leak
 * anyone else's application.
 *
 * `onChange` receives the new row. Comparing against the previous status is the
 * caller's job: the same UPDATE fires for a review note as for an approval, and
 * announcing "approved!" twice is worse than announcing it late.
 *
 * Returns an unsubscribe function.
 */
export function subscribeToMyApplication(
  userId: string,
  onChange: (application: DriverApplication) => void,
): () => void {
  const channel = supabase
    .channel(`driver_application:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'driver_applications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new as Row | null;
        // DELETE payloads carry no `new`; nothing to report.
        if (row && Object.keys(row).length > 0) onChange(rowToApplication(row));
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/** What to say when a status changes. Null when the change isn't worth a toast. */
export function statusChangeMessage(
  previous: ApplicationStatus | null,
  next: ApplicationStatus,
): { title: string; message: string; tone: 'success' | 'info' } | null {
  // First load, or a change that isn't a change.
  if (previous === null || previous === next) return null;

  switch (next) {
    case 'approved':
      return {
        title: "You're approved to drive",
        message: 'You can now accept delivery jobs. Find Jobs is open to you.',
        tone: 'success',
      };
    case 'rejected':
      return {
        title: 'Application not approved',
        message: 'Your driver application was reviewed and not approved this time.',
        tone: 'info',
      };
    case 'under_review':
      return {
        title: 'Application under review',
        message: 'Someone is looking at your application now.',
        tone: 'info',
      };
    case 'pending':
      // Going back to pending is an admin correcting themselves; not news.
      return null;
  }
}
