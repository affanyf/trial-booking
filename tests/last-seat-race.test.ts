import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createParentWithStudents,
  createTrialClass,
  createConfirmedBooking,
  // cleanupTestData,
} from "./helpers";
import { callCreateBooking, callPayBooking } from "./api-client";

afterAll(async () => {
  // Cleanup disabled on purpose: leaves this test's rows in place so they
  // can be inspected directly (Prisma Studio / psql) after a run, as proof
  // beyond the console output above. Re-enable by importing cleanupTestData
  // from "./helpers" again and calling it here - or just run
  // `npx prisma db seed` to wipe everything and reset to the documented
  // demo state when done inspecting.
  // await cleanupTestData();
  await prisma.$disconnect();
});

/**
 * Sets up a class with exactly 1 seat left (3 of 4 confirmed) and two
 * students each holding a pending booking for that same class - the exact
 * "User A / User B" situation.
 */
async function setUpLastSeatScenario() {
  const trialClass = await createTrialClass(4);

  const filler = await createParentWithStudents(3);
  for (const student of filler.students) {
    await createConfirmedBooking(student.id, trialClass.id);
  }

  const racers = await createParentWithStudents(2);
  const bookingA = await callCreateBooking(racers.students[0].id, trialClass.id);
  const bookingB = await callCreateBooking(racers.students[1].id, trialClass.id);

  return { trialClass, bookingIdA: bookingA.body.booking_id!, bookingIdB: bookingB.body.booking_id! };
}

/**
 * Fires both payment requests at once and times each one individually.
 * The loser's elapsed time is the actual, visible evidence that it was
 * blocked on `SELECT ... FOR UPDATE` and not just "unlucky" - it's not
 * inferred from the pass/fail outcome alone.
 */
async function payBothConcurrently(bookingIdA: number, bookingIdB: number) {
  const start = Date.now();
  const [resultA, resultB] = await Promise.all([
    callPayBooking(bookingIdA, "mock_card").then((r) => ({
      ...r,
      elapsedMs: Date.now() - start,
    })),
    callPayBooking(bookingIdB, "mock_card").then((r) => ({
      ...r,
      elapsedMs: Date.now() - start,
    })),
  ]);
  return { resultA, resultB };
}

describe("last-seat race condition", () => {
  it("confirms exactly one of two concurrent payments for the final seat", async () => {
    const { trialClass, bookingIdA, bookingIdB } = await setUpLastSeatScenario();

    // Promise.all fires both handler calls in the same tick; both reach
    // their first `await prisma...` call before either one's DB round trip
    // resolves, so the two payment transactions genuinely overlap at the
    // database level - see the explanation given alongside this test.
    const { resultA, resultB } = await payBothConcurrently(bookingIdA, bookingIdB);

    const outcomes = [resultA.body, resultB.body];
    const confirmed = outcomes.filter((o) => o.status === "confirmed");
    const failed = outcomes.filter((o) => o.status === "payment_failed");

    expect(confirmed).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toBe("seat_unavailable");
    // The loser must never have reached the payment simulator - it only
    // ever gets a "failed" payment_attempt from the seat-check branch.
    expect(failed[0].payment_attempt?.status).toBe("failed");

    // The invariant that actually matters: capacity is never exceeded in
    // the database, regardless of what the HTTP responses claim.
    const confirmedCount = await prisma.booking.count({
      where: { trialClassId: trialClass.id, status: "confirmed" },
    });
    expect(confirmedCount).toBe(trialClass.capacity);

    // --- printed evidence, not just the pass/fail above ---
    console.log(
      `\n[last-seat race] trial_class=${trialClass.id} capacity=${trialClass.capacity}`,
    );
    console.log(
      `  booking A (#${bookingIdA}) -> ${resultA.body.status}` +
        (resultA.body.reason ? ` (${resultA.body.reason})` : "") +
        ` in ${resultA.elapsedMs}ms`,
    );
    console.log(
      `  booking B (#${bookingIdB}) -> ${resultB.body.status}` +
        (resultB.body.reason ? ` (${resultB.body.reason})` : "") +
        ` in ${resultB.elapsedMs}ms`,
    );
    console.log(
      `  DB-verified confirmed count (queried directly via prisma.booking.count, ` +
        `independent of the HTTP responses above): ${confirmedCount}/${trialClass.capacity}`,
    );
  });

  it("holds across repeated trials, to rule out a lucky single run", async () => {
    // A broken implementation (e.g. count-then-write without FOR UPDATE)
    // can still pass a single race test by accident if the two calls
    // happen not to overlap that one time. Running several independent
    // trials makes that kind of false-positive very unlikely to slip by.
    const trials = 5;
    const trialLog: {
      trial: number;
      winnerBookingId: number;
      loserBookingId: number;
      loserReason: string;
      winnerMs: number;
      loserMs: number;
      confirmedCount: number;
      capacity: number;
    }[] = [];

    for (let i = 0; i < trials; i += 1) {
      const { trialClass, bookingIdA, bookingIdB } = await setUpLastSeatScenario();

      const { resultA, resultB } = await payBothConcurrently(bookingIdA, bookingIdB);

      const confirmedCount = await prisma.booking.count({
        where: { trialClassId: trialClass.id, status: "confirmed" },
      });

      expect(confirmedCount).toBe(trialClass.capacity);
      const confirmedInResponses = [resultA.body, resultB.body].filter(
        (o) => o.status === "confirmed",
      ).length;
      expect(confirmedInResponses).toBe(1);

      const winnerIsA = resultA.body.status === "confirmed";
      const winner = winnerIsA ? resultA : resultB;
      const loser = winnerIsA ? resultB : resultA;

      trialLog.push({
        trial: i + 1,
        winnerBookingId: winnerIsA ? bookingIdA : bookingIdB,
        loserBookingId: winnerIsA ? bookingIdB : bookingIdA,
        loserReason: loser.body.reason ?? "",
        winnerMs: winner.elapsedMs,
        loserMs: loser.elapsedMs,
        confirmedCount,
        capacity: trialClass.capacity,
      });
    }

    console.log(
      "\n[last-seat race] repeated trials - one row per race, each on a fresh trial class:",
    );
    console.table(trialLog);
  });
});
