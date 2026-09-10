import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseId } from "@/lib/parse-id";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bookingId = parseId(id);

  if (bookingId === null) {
    return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  return NextResponse.json({
    booking_id: Number(booking.id),
    student_id: Number(booking.studentId),
    trial_class_id: Number(booking.trialClassId),
    status: booking.status,
    created_at: booking.createdAt.toISOString(),
  });
}
