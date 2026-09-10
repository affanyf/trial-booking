import Link from "next/link";
import { notFound } from "next/navigation";
import { payBookingAction } from "@/app/actions";
import { callGetBooking } from "@/lib/internal-api";
import { button, select, link, card, heading, bodyText } from "@/app/ui";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  confirmed: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
  pending_payment:
    "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200",
  payment_failed: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
  cancelled: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200",
};

export default async function BookingStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { status, body } = await callGetBooking(id);

  if (status === 404) {
    notFound();
  }

  const isPayable =
    body.status === "pending_payment" || body.status === "payment_failed";

  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-10">
      <h1 className="text-2xl font-bold">Booking #{body.booking_id}</h1>

      <section className={card}>
        <span
          className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${
            statusColor[body.status ?? ""] ??
            "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
          }`}
        >
          {body.status}
        </span>

        <dl className={`mt-4 space-y-1 text-sm ${bodyText}`}>
          <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 py-1">
            <dt className="text-gray-500 dark:text-gray-400">Student ID</dt>
            <dd>{body.student_id}</dd>
          </div>
          <div className="flex justify-between border-b border-gray-100 dark:border-gray-700 py-1">
            <dt className="text-gray-500 dark:text-gray-400">Trial Class</dt>
            <dd>
              <Link
                href={`/admin/trial-classes/${body.trial_class_id}`}
                className={link}
              >
                show class #{body.trial_class_id} →
              </Link>
            </dd>
          </div>
          <div className="flex justify-between py-1">
            <dt className="text-gray-500 dark:text-gray-400">Created At</dt>
            <dd>{body.created_at}</dd>
          </div>
        </dl>
      </section>

      {isPayable && (
        <section className={card}>
          <h2 className={`mb-3 ${heading}`}>Pay for This Trial Class</h2>
          <form action={payBookingAction} className="space-y-3">
            <input type="hidden" name="booking_id" value={body.booking_id} />
            <select
              name="payment_method"
              defaultValue="mock_card"
              className={`${select} w-full`}
            >
              <option value="mock_card">mock_card (success)</option>
              <option value="mock_card_declined">
                mock_card_declined (intentionally fails - demo payment_declined)
              </option>
            </select>
            <button type="submit" className={button}>
              Pay
            </button>
          </form>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            If the class is already full (4/4 confirmed) when you click Pay,
            the result automatically becomes <code>payment_failed</code> with reason{" "}
            <code>seat_unavailable</code> - regardless of which payment_method
            is used.
          </p>
        </section>
      )}

      {body.status === "confirmed" && (
        <p className="text-sm text-green-700 dark:text-green-400">
          ✅ Booking confirmed.
        </p>
      )}

      <p>
        <Link href="/" className={link}>
          ← New Booking
        </Link>
      </p>
    </main>
  );
}
