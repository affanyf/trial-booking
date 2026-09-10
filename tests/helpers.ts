import { prisma } from "@/lib/prisma";

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix} ${Date.now()}-${counter}`;
}

// Tracks everything this test file has created, so cleanupTestData() can
// remove it afterwards without touching the demo seed data.
const createdParentIds: bigint[] = [];
const createdTrialClassIds: bigint[] = [];

/** Fresh parent + N students, isolated from seed data and from other tests. */
export async function createParentWithStudents(studentCount = 1) {
  const parent = await prisma.parent.create({
    data: {
      name: unique("Test Parent"),
      students: {
        create: Array.from({ length: studentCount }, () => ({
          name: unique("Test Student"),
        })),
      },
    },
    include: { students: true },
  });
  createdParentIds.push(parent.id);
  return parent;
}

/** Fresh trial class, isolated from seed data and from other tests - each
 * test gets its own class so seat counts never leak between tests. */
export async function createTrialClass(capacity = 4) {
  const trialClass = await prisma.trialClass.create({
    data: { name: unique("Test Class"), capacity },
  });
  createdTrialClassIds.push(trialClass.id);
  return trialClass;
}

/**
 * Deletes everything created via the helpers above (in FK-safe order), so
 * running the suite never leaves throwaway rows next to the demo seed data.
 * Call this from `afterAll`, before `prisma.$disconnect()`.
 */
export async function cleanupTestData() {
  if (createdParentIds.length === 0 && createdTrialClassIds.length === 0) return;

  const bookings = await prisma.booking.findMany({
    where: {
      OR: [
        { student: { parentId: { in: createdParentIds } } },
        { trialClassId: { in: createdTrialClassIds } },
      ],
    },
    select: { id: true },
  });
  const bookingIds = bookings.map((b) => b.id);

  await prisma.paymentAttempt.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
  await prisma.trialClass.deleteMany({ where: { id: { in: createdTrialClassIds } } });
  await prisma.student.deleteMany({ where: { parentId: { in: createdParentIds } } });
  await prisma.parent.deleteMany({ where: { id: { in: createdParentIds } } });

  createdParentIds.length = 0;
  createdTrialClassIds.length = 0;
}

/**
 * Inserts an already-confirmed booking directly, bypassing the payment
 * endpoint. Used only to set up pre-existing seats (e.g. "3 of 4 already
 * confirmed") for a test that isn't itself testing the payment endpoint's
 * confirm path.
 */
export async function createConfirmedBooking(
  studentId: bigint,
  trialClassId: bigint,
) {
  const booking = await prisma.booking.create({
    data: { studentId, trialClassId, status: "confirmed" },
  });
  await prisma.paymentAttempt.create({
    data: {
      bookingId: booking.id,
      attemptNumber: 1,
      paymentMethod: "mock_card",
      status: "success",
    },
  });
  return booking;
}
