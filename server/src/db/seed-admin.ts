// backend/scripts/seed-admin.ts
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { hashPassword } from "../lib/auth";
import { eq } from "drizzle-orm";

const db = drizzle(new Database(process.env.DB_FILE_NAME || "database.sqlite"), {
  schema,
});

async function seedAdmin() {
  const adminEmail = "admin@example.com";
  const adminPassword = "admin123";

  // Check if admin exists
  const existing = await db.query.usersTable.findFirst({
    where: eq(schema.usersTable.email, adminEmail),
  });

  if (existing) {
    console.log("⚠️ Admin user already exists");
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    return;
  }

  // Create admin
  const passwordHash = await hashPassword(adminPassword);

  const [admin] = await db
    .insert(schema.usersTable)
    .values({
      username: "admin",
      email: adminEmail,
      passwordHash,
      role: "admin",
      balance: 10000,
    })
    .returning();

  console.log("✅ Admin user created!");
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Password: ${adminPassword}`);
  console.log(`   Balance: $${admin.balance}`);
  console.log(`   Role: ${admin.role}`);
}

seedAdmin().catch(console.error);