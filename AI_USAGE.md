# AI_USAGE.md

## Which AI Tools I Used

- **Claude (Claude.ai / web chat)** — for brainstorming, requirement analysis, and architecture planning
- **Claude Code (Sonnet 5)** — for assisted development / implementation

## What I Used AI For

AI was used as a thinking partner to speed up exploring options and validating technical decisions — not to make design decisions unilaterally. Specific uses included:

- Translating and summarizing the requirement document, so I could quickly identify areas that needed clarification
- Discussing trade-offs while evaluating tech stack options, with the final call always made by me based on the requirements and my own familiarity with each option
- Acting as a sparring partner to stress-test the schema and API contract designs I put together — some of my early designs were revised after AI surfaced edge cases I hadn't considered, and conversely, some of AI's suggestions were revised by me because they didn't fit the requirements well (see the disagreement example below)
- Assisted development in Claude Code to speed up writing boilerplate, endpoints, and tests — with me reviewing each output before moving to the next step

## One Place Where AI Helped Me Move Faster

During initial project setup (Next.js scaffolding, Docker Compose configuration for PostgreSQL, and writing the full Prisma schema including the raw SQL migration for the partial unique index), Claude Code completed the entire foundation in a short amount of time — work that would normally take considerably longer to do manually from scratch, especially getting the Docker Compose configuration and Prisma schema/migration in sync.

## One Place Where I Disagreed With, Corrected, or Rejected AI Output

While designing the payment flow for the last-seat race condition scenario, the AI's initial proposal assumed a refund mechanism would be needed for the case where a user "loses" the race after payment had technically succeeded. I pushed back on this — the official scenario in the requirements describes a user "trying to complete payment" (not "succeeding and then being refunded"), so the system could instead be designed to check seat availability **before** running the payment simulation, rather than after. After discussing it, the design was revised: seat availability is checked first within the same transaction, and the payment simulation only runs if a seat is still available — meaning a user who loses the race is never actually charged, eliminating the need for refund logic entirely.

## What I Would Change About My AI Workflow If I Did This Again

Finalize the requirement document (schema, API contract, technical approach) earlier before exploring tech stack options, so that stack discussions don't sprawl before the core technical needs are clear

## How I Verified the Final Implementation

- Automated tests using Vitest for the 4 required scenarios: duplicate booking, overbooking, payment failure, and the last-seat race condition
- The race condition test was run repeatedly (not just once) to confirm the result is consistent and not flaky — evidence that the row-level locking works correctly rather than passing by chance
- Manual verification via curl/Postman for each endpoint, checked against the defined API contract
- Manual line-by-line review of the locking/transaction logic in the payment endpoint, to confirm the operation order (lock → count → decide) matches the intended design
- Manual click-through of the minimal UI to confirm the end-to-end flow (booking → payment → roster) works without errors