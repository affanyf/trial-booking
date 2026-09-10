import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Wipe in FK-safe order so the script is re-runnable.
  await prisma.paymentAttempt.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.trialClass.deleteMany();
  await prisma.student.deleteMany();
  await prisma.parent.deleteMany();

  // 3 parents, 1-2 students each.
  const budi = await prisma.parent.create({
    data: {
      name: "Budi Santoso",
      students: {
        create: [{ name: "Ani Santoso" }, { name: "Bima Santoso" }],
      },
    },
    include: { students: true },
  });

  const siti = await prisma.parent.create({
    data: {
      name: "Siti Aminah",
      students: { create: [{ name: "Citra Aminah" }] },
    },
    include: { students: true },
  });

  const joko = await prisma.parent.create({
    data: {
      name: "Joko Widodo",
      students: {
        create: [{ name: "Dewi Widodo" }, { name: "Eko Widodo" }],
      },
    },
    include: { students: true },
  });

  const [ani, bima] = budi.students;
  const [citra] = siti.students;
  const [dewi, eko] = joko.students;

  // Class with an empty slot: 1 of 4 confirmed.
  const scienceExplorers = await prisma.trialClass.create({
    data: { name: "Science Explorers", capacity: 4 },
  });

  // Class with exactly 3 of 4 confirmed - the "1 seat left" demo class.
  const mathWizards = await prisma.trialClass.create({
    data: { name: "Math Wizards", capacity: 4 },
  });

  // --- Science Explorers: 1 confirmed, 1 pending -> 3 seats available ---

  const aniBooking = await prisma.booking.create({
    data: {
      studentId: ani.id,
      trialClassId: scienceExplorers.id,
      status: "confirmed",
    },
  });
  await prisma.paymentAttempt.create({
    data: {
      bookingId: aniBooking.id,
      attemptNumber: 1,
      paymentMethod: "mock_card",
      status: "success",
    },
  });

  // Pending booking (no payment yet). Also the target for the duplicate-
  // booking test below: POST /api/bookings again with the same
  // student_id + trial_class_id must be rejected with 409.
  await prisma.booking.create({
    data: {
      studentId: bima.id,
      trialClassId: scienceExplorers.id,
      status: "pending_payment",
    },
  });

  // --- Math Wizards: exactly 3 confirmed -> 1 seat left ---

  for (const student of [citra, dewi, eko]) {
    const booking = await prisma.booking.create({
      data: {
        studentId: student.id,
        trialClassId: mathWizards.id,
        status: "confirmed",
      },
    });
    await prisma.paymentAttempt.create({
      data: {
        bookingId: booking.id,
        attemptNumber: 1,
        paymentMethod: "mock_card",
        status: "success",
      },
    });
  }

  // Payment-failure demo: declined payment must leave the booking as
  // payment_failed and the student out of the confirmed roster (rule #4).
  // Uses a different class than Bima's other booking so it doesn't collide
  // with the unique_active_booking index (payment_failed isn't "active").
  const bimaFailedBooking = await prisma.booking.create({
    data: {
      studentId: bima.id,
      trialClassId: mathWizards.id,
      status: "payment_failed",
    },
  });
  await prisma.paymentAttempt.create({
    data: {
      bookingId: bimaFailedBooking.id,
      attemptNumber: 1,
      paymentMethod: "mock_card",
      status: "failed",
    },
  });

  console.log("Seed complete:");
  console.log(`- Parents: Budi Santoso, Siti Aminah, Joko Widodo`);
  console.log(
    `- Science Explorers (id=${scienceExplorers.id}): 1/4 confirmed (Ani), 1 pending (Bima)`,
  );
  console.log(
    `- Math Wizards (id=${mathWizards.id}): 3/4 confirmed (Citra, Dewi, Eko), 1 payment_failed (Bima)`,
  );
  console.log(
    `- Duplicate booking test: POST /api/bookings with student_id=${ani.id}, trial_class_id=${scienceExplorers.id} (or student_id=${bima.id}) should 409`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
