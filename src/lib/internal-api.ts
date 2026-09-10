import { POST as createBookingHandler } from "@/app/api/bookings/route";
import { GET as getBookingHandler } from "@/app/api/bookings/[id]/route";
import { POST as payBookingHandler } from "@/app/api/bookings/[id]/payment/route";
import { GET as getRosterHandler } from "@/app/api/trial-classes/[id]/roster/route";
import { GET as listParentsHandler } from "@/app/api/parents/route";
import { GET as listStudentsHandler } from "@/app/api/students/route";
import { GET as listAvailableTrialClassesHandler } from "@/app/api/trial-classes/available/route";
import { GET as listTrialClassesHandler } from "@/app/api/trial-classes/route";

/**
 * Calls Route Handlers directly (no HTTP round-trip) by invoking the
 * exported functions with a real `Request`/`params` shape - the same
 * objects Next.js constructs for a live request. Used by both the minimal
 * UI (Server Components/Actions) and the test suite, so there is exactly
 * one place that knows how to talk to our own API from inside the process.
 */

export interface BookingResponseBody {
  booking_id?: number;
  status?: string;
  error?: string;
  reason?: string;
  student_id?: number;
  trial_class_id?: number;
  created_at?: string;
  payment_attempt?: { attempt_number: number; status: string };
}

export interface RosterResponseBody {
  trial_class_id: number;
  class_name: string;
  capacity: number;
  confirmed_count: number;
  roster: {
    student_id: number;
    student_name: string;
    booking_id: number;
    confirmed_at: string;
  }[];
}

export interface ParentSummary {
  id: number;
  name: string;
}

export interface StudentSummary {
  id: number;
  name: string;
  parent_id: number;
}

export interface TrialClassSummary {
  id: number;
  name: string;
  capacity: number;
}

interface ApiResult<T> {
  status: number;
  body: T;
}

// Accepts whatever shape an id happens to be at the call site - a route
// param string, a Prisma bigint, or a plain number - so callers never need
// to convert before calling in.
type Id = bigint | number | string;

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function callCreateBooking(
  studentId: Id,
  trialClassId: Id,
): Promise<ApiResult<BookingResponseBody>> {
  const res = await createBookingHandler(
    jsonRequest("http://localhost/api/bookings", {
      student_id: Number(studentId),
      trial_class_id: Number(trialClassId),
    }),
  );
  return { status: res.status, body: await res.json() };
}

export async function callGetBooking(
  bookingId: Id,
): Promise<ApiResult<BookingResponseBody>> {
  const res = await getBookingHandler(
    new Request(`http://localhost/api/bookings/${bookingId}`),
    { params: Promise.resolve({ id: String(bookingId) }) },
  );
  return { status: res.status, body: await res.json() };
}

export async function callPayBooking(
  bookingId: Id,
  paymentMethod: string,
): Promise<ApiResult<BookingResponseBody>> {
  const res = await payBookingHandler(
    jsonRequest(`http://localhost/api/bookings/${bookingId}/payment`, {
      payment_method: paymentMethod,
    }),
    { params: Promise.resolve({ id: String(bookingId) }) },
  );
  return { status: res.status, body: await res.json() };
}

export async function callGetRoster(
  trialClassId: Id,
): Promise<ApiResult<RosterResponseBody>> {
  const res = await getRosterHandler(
    new Request(`http://localhost/api/trial-classes/${trialClassId}/roster`),
    { params: Promise.resolve({ id: String(trialClassId) }) },
  );
  return { status: res.status, body: await res.json() };
}

export async function callListParents(): Promise<ApiResult<ParentSummary[]>> {
  const res = await listParentsHandler();
  return { status: res.status, body: await res.json() };
}

export async function callListStudentsByParent(
  parentId: Id,
): Promise<ApiResult<StudentSummary[]>> {
  const res = await listStudentsHandler(
    new Request(`http://localhost/api/students?parent_id=${parentId}`),
  );
  return { status: res.status, body: await res.json() };
}

export async function callListAvailableTrialClasses(): Promise<
  ApiResult<TrialClassSummary[]>
> {
  const res = await listAvailableTrialClassesHandler();
  return { status: res.status, body: await res.json() };
}

export async function callListTrialClasses(): Promise<
  ApiResult<TrialClassSummary[]>
> {
  const res = await listTrialClassesHandler();
  return { status: res.status, body: await res.json() };
}
