require('dotenv').config();

const bcrypt = require('bcrypt');
const { Client } = require('pg');

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required.');
  }

  const database = new Client({ connectionString: process.env.DATABASE_URL });
  await database.connect();

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await database.query(
      `UPDATE users
       SET email = $1, password_hash = $2, is_active = true, updated_at = NOW()
       WHERE role = 'ORG_ADMIN'
       RETURNING email, is_active, password_hash`,
      [email, passwordHash],
    );

    console.log(
      JSON.stringify({
        updatedUsers: result.rowCount,
        email: result.rows[0]?.email,
        isActive: result.rows[0]?.is_active,
        passwordVerified: result.rows[0]
          ? await bcrypt.compare(password, result.rows[0].password_hash)
          : false,
      }),
    );
  } finally {
    await database.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
