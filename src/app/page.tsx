import Link from "next/link";
import { createBookingAction } from "@/app/actions";
import {
  callListParents,
  callListStudentsByParent,
  callListAvailableTrialClasses,
  callListTrialClasses,
} from "@/lib/internal-api";
import { parseId } from "@/lib/parse-id";
import { button, select, label, link, card, heading, muted } from "@/app/ui";

// Reads straight from Postgres via Prisma on every request (not through
// fetch(), so Next.js won't auto-detect it as dynamic) - force it so the
// available-seats list is never stale from a cached build.
export const dynamic = "force-dynamic";

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ parent_id?: string; error?: string }>;
}) {
  const { parent_id, error } = await searchParams;
  const parentId = parseId(parent_id);

  const { body: parents } = await callListParents();
  const { body: trialClasses } = await callListAvailableTrialClasses();
  const { body: allTrialClasses } = await callListTrialClasses();
  const students = parentId !== null
    ? (await callListStudentsByParent(parentId)).body
    : [];

  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-10">
      <h1 className="text-2xl font-bold">Trial Class Booking</h1>

      {error && (
        <p className="rounded-md border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <section className={card}>
        <h2 className={`mb-3 ${heading}`}>1. Pilih Parent</h2>
        <form method="GET" action="/" className="flex items-center gap-2">
          <select name="parent_id" defaultValue={parent_id ?? ""} className={select}>
            <option value="" disabled>
              -- pilih parent --
            </option>
            {parents.map((parent) => (
              <option key={parent.id} value={parent.id}>
                {parent.name}
              </option>
            ))}
          </select>
          <button type="submit" className={button}>
            Lanjut →
          </button>
        </form>
      </section>

      {parentId !== null && (
        <section className={card}>
          <h2 className={`mb-3 ${heading}`}>
            2. Pilih Student &amp; Trial Class
          </h2>
          {students.length === 0 ? (
            <p className={muted}>Parent ini belum punya student.</p>
          ) : trialClasses.length === 0 ? (
            <p className={muted}>Tidak ada trial class yang masih available.</p>
          ) : (
            <form action={createBookingAction} className="space-y-4">
              <input type="hidden" name="parent_id" value={String(parentId)} />

              <div>
                <label className={label}>Student</label>
                <select name="student_id" required className={`${select} w-full`}>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={label}>Trial Class</label>
                <select
                  name="trial_class_id"
                  required
                  className={`${select} w-full`}
                >
                  {trialClasses.map((trialClass) => (
                    <option key={trialClass.id} value={trialClass.id}>
                      {trialClass.name} (capacity {trialClass.capacity})
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className={button}>
                Book Trial Class
              </button>
            </form>
          )}
        </section>
      )}

      <section className={card}>
        <h2 className={`mb-3 ${heading}`}>Roster (admin)</h2>
        <ul className="space-y-1">
          {allTrialClasses.map((trialClass) => (
            <li key={trialClass.id}>
              <Link
                href={`/admin/trial-classes/${trialClass.id}`}
                className={link}
              >
                {trialClass.name} (capacity {trialClass.capacity})
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
