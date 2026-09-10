import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const trialClasses = await prisma.trialClass.findMany({
    orderBy: { id: "asc" },
  });

  return NextResponse.json(
    trialClasses.map((trialClass) => ({
      id: Number(trialClass.id),
      name: trialClass.name,
      capacity: trialClass.capacity,
    })),
  );
}
