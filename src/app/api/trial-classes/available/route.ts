import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const trialClasses = await prisma.trialClass.findMany({
    orderBy: { id: "asc" },
    include: {
      _count: { select: { bookings: { where: { status: "confirmed" } } } },
    },
  });

  const available = trialClasses.filter(
    (trialClass) => trialClass._count.bookings < trialClass.capacity,
  );

  return NextResponse.json(
    available.map((trialClass) => ({
      id: Number(trialClass.id),
      name: trialClass.name,
      capacity: trialClass.capacity,
    })),
  );
}
