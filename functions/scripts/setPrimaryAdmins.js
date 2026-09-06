/**
 * scripts/setPrimaryAdmins.js
 * ------------------------------------------------------------
 * One-time setup script: marks the two named users as PRIMARY
 * admins (isPrimaryAdmin: true) and makes sure they also carry
 * an admin-level `role`, so they pass the site's normal isAdmin()
 * checks too.
 *
 * This talks to Firestore with the Admin SDK, so it bypasses
 * security rules entirely — that's expected for a one-time bootstrap
 * (there's no primary admin yet to approve the first ones!). Run it
 * once, then all future primary-admin changes go through the normal
 * 2-primary-admin-approval flow in the admin dashboard.
 *
 * SETUP:
 *   1. Firebase Console → Project Settings → Service Accounts →
 *      "Generate new private key". Save the JSON file as
 *      functions/scripts/serviceAccountKey.json (already gitignored).
 *   2. cd functions && npm install
 *   3. node scripts/setPrimaryAdmins.js
 *
 * Matches users by the exact `name` field already stored on their
 * `users/{uid}` document (the same field shown on the Members page).
 * If a name below doesn't match anyone (typo, or the account hasn't
 * signed up yet), the script prints a warning and skips it — it
 * never guesses.
 */

const admin = require("firebase-admin");
const path = require("path");

const NAMES_TO_PROMOTE = ["Advait Pardhy", "Samyuktha Sree T"];

const serviceAccount = require(path.join(__dirname, "serviceAccountKey.json"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const usersSnap = await db.collection("users").get();
  for (const name of NAMES_TO_PROMOTE) {
    const match = usersSnap.docs.find((d) => (d.data().name || "").trim() === name);
    if (!match) {
      console.warn(`⚠️  No user found with name "${name}" — skipped. (Check spelling / that they've logged in at least once.)`);
      continue;
    }
    const data = match.data();
    const role = ["admin", "core"].includes(data.role) ? data.role : "admin";
    await match.ref.set({ role, isPrimaryAdmin: true }, { merge: true });
    console.log(`✅ ${name} (${match.id}) set as primary admin, role="${role}".`);
  }
  process.exit(0);
}

run().catch((e) => {
  console.error("❌ Failed:", e);
  process.exit(1);
});
