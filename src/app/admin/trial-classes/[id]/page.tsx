import Link from "next/link";
import { notFound } from "next/navigation";
import { callGetRoster } from "@/lib/internal-api";
import { link, card, muted, bodyText } from "@/app/ui";

export const dynamic = "force-dynamic";

export default async function RosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { status, body: roster } = await callGetRoster(id);

  if (status === 404) {
    notFound();
  }

  const isFull = roster.confirmed_count >= roster.capacity;

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <h1 className="text-2xl font-bold">{roster.class_name}</h1>

      <section className={card}>
        <span
          className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${
            isFull
              ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
              : "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
          }`}
        >
          Confirmed: {roster.confirmed_count} / {roster.capacity}
          {isFull ? " (penuh)" : ""}
        </span>
      </section>

      <section className={card}>
        {roster.roster.length === 0 ? (
          <p className={muted}>Belum ada student confirmed di kelas ini.</p>
        ) : (
          <table className={`w-full text-left text-sm ${bodyText}`}>
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400">
                <th className="py-2 pr-4 font-medium">Booking ID</th>
                <th className="py-2 pr-4 font-medium">Student</th>
                <th className="py-2 font-medium">Confirmed At</th>
              </tr>
            </thead>
            <tbody>
              {roster.roster.map((entry) => (
                <tr
                  key={entry.booking_id}
                  className="border-b border-gray-100 dark:border-gray-700"
                >
                  <td className="py-2 pr-4">{entry.booking_id}</td>
                  <td className="py-2 pr-4">{entry.student_name}</td>
                  <td className="py-2 text-gray-500 dark:text-gray-400">
                    {entry.confirmed_at}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p>
        <Link href="/" className={link}>
          ← Booking baru
        </Link>
      </p>
    </main>
  );
}
