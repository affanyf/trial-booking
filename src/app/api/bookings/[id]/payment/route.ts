import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseId } from "@/lib/parse-id";

// Deterministic mock: only this exact sentinel value declines. Kept
// deterministic (no randomness) so tests - especially the concurrent
// last-seat race test - control outcomes precisely instead of hoping a
// coin flip lands the right way.
function simulatePayment(paymentMethod: string): boolean {
  return paymentMethod !== "mock_card_declined";
}

type PaymentOutcome =
  | { kind: "not_payable"; status: string }
  | { kind: "seat_unavailable"; attemptNumber: number }
  | { kind: "payment_declined"; attemptNumber: number }
  | { kind: "confirmed"; attemptNumber: number };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bookingId = parseId(id);
  if (bookingId === null) {
    return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const paymentMethod = body?.payment_method;
  if (typeof paymentMethod !== "string" || paymentMethod.length === 0) {
    return NextResponse.json(
      { error: "payment_method is required" },
      { status: 400 },
    );
  }

  const bookingExists = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, trialClassId: true },
  });
  if (!bookingExists) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const outcome = await prisma.$transaction(async (tx) => {
    // 1. SELECT trial_class FOR UPDATE - row-level lock. Every payment
    // transaction for bookings in this class (including a second, racing
    // request for THIS SAME booking) blocks here until this transaction
    // commits or rolls back.
    const [trialClass] = await tx.$queryRaw<{ id: bigint; capacity: number }[]>`
      SELECT id, capacity FROM trial_classes WHERE id = ${bookingExists.trialClassId} FOR UPDATE
    `;

    // Re-read the booking now that we hold the lock - a concurrent request
    // for this exact booking could have resolved it while we were waiting.
    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId },
    });

    if (
      booking.status !== "pending_payment" &&
      booking.status !== "payment_failed"
    ) {
      return { kind: "not_payable", status: booking.status } satisfies PaymentOutcome;
    }

    const attemptNumber =
      (await tx.paymentAttempt.count({ where: { bookingId } })) + 1;

    // 2. COUNT(*) confirmed bookings for this class - computed fresh, never
    // a stored counter that could drift from the real row data.
    const confirmedCount = await tx.booking.count({
      where: { trialClassId: booking.trialClassId, status: "confirmed" },
    });

    // 3. Decide before ever touching the payment simulator.
    if (confirmedCount >= trialClass.capacity) {
      await tx.paymentAttempt.create({
        data: { bookingId, attemptNumber, paymentMethod, status: "failed" },
      });
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: "payment_failed" },
      });
      return { kind: "seat_unavailable", attemptNumber } satisfies PaymentOutcome;
    }

    const paymentSucceeded = simulatePayment(paymentMethod);

    if (paymentSucceeded) {
      await tx.paymentAttempt.create({
        data: { bookingId, attemptNumber, paymentMethod, status: "success" },
      });
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: "confirmed" },
      });
      return { kind: "confirmed", attemptNumber } satisfies PaymentOutcome;
    }

    await tx.paymentAttempt.create({
      data: { bookingId, attemptNumber, paymentMethod, status: "failed" },
    });
    await tx.booking.update({
      where: { id: bookingId },
      data: { status: "payment_failed" },
    });
    return { kind: "payment_declined", attemptNumber } satisfies PaymentOutcome;
  });

  if (outcome.kind === "not_payable") {
    return NextResponse.json(
      { error: `Booking is ${outcome.status} and cannot be paid` },
      { status: 409 },
    );
  }

  if (outcome.kind === "confirmed") {
    return NextResponse.json({
      booking_id: Number(bookingId),
      status: "confirmed",
      payment_attempt: { attempt_number: outcome.attemptNumber, status: "success" },
    });
  }

  return NextResponse.json({
    booking_id: Number(bookingId),
    status: "payment_failed",
    reason: outcome.kind,
    payment_attempt: { attempt_number: outcome.attemptNumber, status: "failed" },
  });
}
