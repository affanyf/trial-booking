"use server";

import { redirect } from "next/navigation";
import { callCreateBooking, callPayBooking } from "@/lib/internal-api";
import { parseId } from "@/lib/parse-id";

export async function createBookingAction(formData: FormData) {
  const parentId = String(formData.get("parent_id") ?? "");
  const studentId = parseId(formData.get("student_id"));
  const trialClassId = parseId(formData.get("trial_class_id"));

  if (studentId === null || trialClassId === null) {
    redirect(
      `/?parent_id=${parentId}&error=${encodeURIComponent("Please select a student and a trial class first")}`,
    );
  }

  const result = await callCreateBooking(studentId, trialClassId);

  if (result.status !== 201) {
    redirect(
      `/?parent_id=${parentId}&error=${encodeURIComponent(result.body.error ?? "Booking failed")}`,
    );
  }

  redirect(`/bookings/${result.body.booking_id}`);
}

export async function payBookingAction(formData: FormData) {
  const bookingId = String(formData.get("booking_id") ?? "");
  const paymentMethod = String(formData.get("payment_method") ?? "mock_card");

  await callPayBooking(bookingId, paymentMethod);

  // Redirecting back to the same page re-runs the Server Component, so it
  // re-fetches the booking's latest status - this is the "revalidation"
  // step called for in REQUIREMENTS.md instead of client-side state.
  redirect(`/bookings/${bookingId}`);
}
