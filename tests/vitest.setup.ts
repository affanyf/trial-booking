// Vitest, unlike next/jest, doesn't load .env files on its own - tests
// import src/lib/prisma.ts, which needs DATABASE_URL set before it runs.
import "dotenv/config";
