/* eslint-disable @typescript-eslint/no-misused-promises */
import { db } from "./index";
import { discordServer } from "./schema/auth";

const seedCasaServer = async () => {
  await db.insert(discordServer).values({
    id: "1217866693125341305",
    name: "Test",
    memberCount: 6,
  });
};

export const seed = async () => {
  await seedCasaServer();
};

async function main() {
  // NOTE: This is commented out as we do not want to run this with every migration. Seeding these is going to be a manual process for now to ensure safety.
  // await seedIOUTokenMetadata();
  await seed();
}
main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    console.log("Seeding complete");
  });
