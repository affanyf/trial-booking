import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const parents = await prisma.parent.findMany({ orderBy: { id: "asc" } });

  return NextResponse.json(
    parents.map((parent) => ({
      id: Number(parent.id),
      name: parent.name,
    })),
  );
}
