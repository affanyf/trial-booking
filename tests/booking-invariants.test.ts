import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createParentWithStudents,
  createTrialClass,
  createConfirmedBooking,
  cleanupTestData,
} from "./helpers";
import { callCreateBooking, callPayBooking, callGetRoster } from "./api-client";

afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});

describe("duplicate booking", () => {
  it("rejects a second active booking for the same student + class", async () => {
    const parent = await createParentWithStudents(1);
    const student = parent.students[0];
    const trialClass = await createTrialClass(4);

    const first = await callCreateBooking(student.id, trialClass.id);
    expect(first.status).toBe(201);
    expect(first.body.status).toBe("pending_payment");

    const second = await callCreateBooking(student.id, trialClass.id);
    expect(second.status).toBe(409);
    expect(second.body.error).toMatch(/already has an active booking/i);

    // Only one active booking should actually exist for this pair.
    const activeCount = await prisma.booking.count({
      where: {
        studentId: student.id,
        trialClassId: trialClass.id,
        status: { in: ["pending_payment", "confirmed"] },
      },
    });
    expect(activeCount).toBe(1);
  });
});

describe("overbooking", () => {
  it("rejects payment on the 5th booking once the class is at capacity", async () => {
    const trialClass = await createTrialClass(4);
    const filler = await createParentWithStudents(4);
    const fifthParent = await createParentWithStudents(1);

    // Fill all 4 seats directly - the payment endpoint's confirm path is
    // already covered elsewhere, this test is only about the 5th booking.
    for (const student of filler.students) {
      await createConfirmedBooking(student.id, trialClass.id);
    }

    const fifthStudent = fifthParent.students[0];
    const created = await callCreateBooking(fifthStudent.id, trialClass.id);
    // Creating the booking itself is always allowed - seats are only
    // checked at payment time, per the spec.
    expect(created.status).toBe(201);

    const payment = await callPayBooking(created.body.booking_id!, "mock_card");
    expect(payment.status).toBe(200);
    expect(payment.body.status).toBe("payment_failed");
    expect(payment.body.reason).toBe("seat_unavailable");
    // The simulator must never have been reached: a rejected-for-seat
    // attempt is still recorded as a failed payment_attempt, but the
    // student was never actually charged.
    expect(payment.body.payment_attempt?.status).toBe("failed");

    const confirmedCount = await prisma.booking.count({
      where: { trialClassId: trialClass.id, status: "confirmed" },
    });
    expect(confirmedCount).toBe(4);
  });
});

describe("payment failure keeps the roster clean", () => {
  it("does not add the student to the confirmed roster when payment is declined", async () => {
    const parent = await createParentWithStudents(1);
    const student = parent.students[0];
    const trialClass = await createTrialClass(4);

    const booking = await callCreateBooking(student.id, trialClass.id);
    const payment = await callPayBooking(booking.body.booking_id!, "mock_card_declined");

    expect(payment.body.status).toBe("payment_failed");
    expect(payment.body.reason).toBe("payment_declined");

    const roster = await callGetRoster(trialClass.id);
    expect(roster.body.confirmed_count).toBe(0);
    expect(
      roster.body.roster.some((entry) => entry.student_id === Number(student.id)),
    ).toBe(false);

    // The booking itself is retryable: a second attempt with a normal
    // payment method should succeed and bump attempt_number to 2.
    const retry = await callPayBooking(booking.body.booking_id!, "mock_card");
    expect(retry.body.status).toBe("confirmed");
    expect(retry.body.payment_attempt?.attempt_number).toBe(2);

    const rosterAfterRetry = await callGetRoster(trialClass.id);
    expect(rosterAfterRetry.body.confirmed_count).toBe(1);
  });
});
