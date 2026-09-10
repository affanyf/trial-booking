import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseId } from "@/lib/parse-id";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parentId = parseId(searchParams.get("parent_id"));

  if (parentId === null) {
    return NextResponse.json(
      { error: "parent_id query param must be a positive integer" },
      { status: 400 },
    );
  }

  const students = await prisma.student.findMany({
    where: { parentId },
    orderBy: { id: "asc" },
  });

  return NextResponse.json(
    students.map((student) => ({
      id: Number(student.id),
      name: student.name,
      parent_id: Number(student.parentId),
    })),
  );
}
