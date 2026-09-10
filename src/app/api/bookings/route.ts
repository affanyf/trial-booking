import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { parseId } from "@/lib/parse-id";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const studentId = parseId(body?.student_id);
  const trialClassId = parseId(body?.trial_class_id);

  if (studentId === null || trialClassId === null) {
    return NextResponse.json(
      { error: "student_id and trial_class_id must be provided as positive integers" },
      { status: 400 },
    );
  }

  try {
    const booking = await prisma.booking.create({
      data: { studentId, trialClassId },
    });

    return NextResponse.json(
      { booking_id: Number(booking.id), status: booking.status },
      { status: 201 },
    );
  } catch (error) {
    // The partial unique index `unique_active_booking` (student_id,
    // trial_class_id) WHERE status IN ('pending_payment','confirmed') is
    // raw SQL, not something Prisma's schema knows about — but Postgres
    // still raises a real unique_violation, which Prisma still surfaces
    // as P2002 regardless of where the index came from.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Student already has an active booking for this class" },
        { status: 409 },
      );
    }

    // student_id / trial_class_id pointing at a row that doesn't exist.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        { error: "student_id or trial_class_id does not exist" },
        { status: 404 },
      );
    }

    throw error;
  }
}
