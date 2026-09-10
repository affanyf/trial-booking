import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createParentWithStudents,
  createTrialClass,
  createConfirmedBooking,
  cleanupTestData,
} from "./helpers";
import { callCreateBooking, callPayBooking } from "./api-client";

afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});

/**
 * Sets up a class with exactly 1 seat left (3 of 4 confirmed) and two
 * students each holding a pending booking for that same class - the exact
 * "User A / User B" situation from REQUIREMENTS.md.
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

describe("last-seat race condition", () => {
  it("confirms exactly one of two concurrent payments for the final seat", async () => {
    const { trialClass, bookingIdA, bookingIdB } = await setUpLastSeatScenario();

    // Promise.all fires both handler calls in the same tick; both reach
    // their first `await prisma...` call before either one's DB round trip
    // resolves, so the two payment transactions genuinely overlap at the
    // database level - see the explanation given alongside this test.
    const [resultA, resultB] = await Promise.all([
      callPayBooking(bookingIdA, "mock_card"),
      callPayBooking(bookingIdB, "mock_card"),
    ]);

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
  });

  it("holds across repeated trials, to rule out a lucky single run", async () => {
    // A broken implementation (e.g. count-then-write without FOR UPDATE)
    // can still pass a single race test by accident if the two calls
    // happen not to overlap that one time. Running several independent
    // trials makes that kind of false-positive very unlikely to slip by.
    const trials = 5;

    for (let i = 0; i < trials; i += 1) {
      const { trialClass, bookingIdA, bookingIdB } = await setUpLastSeatScenario();

      const [resultA, resultB] = await Promise.all([
        callPayBooking(bookingIdA, "mock_card"),
        callPayBooking(bookingIdB, "mock_card"),
      ]);

      const confirmedCount = await prisma.booking.count({
        where: { trialClassId: trialClass.id, status: "confirmed" },
      });

      expect(confirmedCount).toBe(trialClass.capacity);
      const confirmedInResponses = [resultA.body, resultB.body].filter(
        (o) => o.status === "confirmed",
      ).length;
      expect(confirmedInResponses).toBe(1);
    }
  });
});
