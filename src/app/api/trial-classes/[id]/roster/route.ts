import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseId } from "@/lib/parse-id";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const trialClassId = parseId(id);

  if (trialClassId === null) {
    return NextResponse.json(
      { error: "Invalid trial_class id" },
      { status: 400 },
    );
  }

  const trialClass = await prisma.trialClass.findUnique({
    where: { id: trialClassId },
  });
  if (!trialClass) {
    return NextResponse.json(
      { error: "Trial class not found" },
      { status: 404 },
    );
  }

  const confirmedBookings = await prisma.booking.findMany({
    where: { trialClassId, status: "confirmed" },
    include: { student: true },
    orderBy: { id: "asc" },
  });

  return NextResponse.json({
    trial_class_id: Number(trialClass.id),
    class_name: trialClass.name,
    capacity: trialClass.capacity,
    confirmed_count: confirmedBookings.length,
    roster: confirmedBookings.map((booking) => ({
      student_id: Number(booking.studentId),
      student_name: booking.student.name,
      booking_id: Number(booking.id),
      confirmed_at: booking.updatedAt.toISOString(),
    })),
  });
}
