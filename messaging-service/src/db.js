const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS oomi_messages (
      id SERIAL PRIMARY KEY,
      office_id INTEGER,
      group_id INTEGER,
      phone VARCHAR NOT NULL,
      direction VARCHAR NOT NULL,
      status VARCHAR NOT NULL,
      provider_msg_id VARCHAR,
      body TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

async function saveMessage({ office_id, group_id, phone, direction, status, body, provider_msg_id }) {
  const result = await pool.query(
    `INSERT INTO oomi_messages
      (office_id, group_id, phone, direction, status, body, provider_msg_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [office_id, group_id, phone, direction, status, body, provider_msg_id || null]
  );
  return result.rows[0].id;
}

async function updateMessageStatus(id, status, provider_msg_id) {
  await pool.query(
    `UPDATE oomi_messages
     SET status = $1, provider_msg_id = COALESCE($2, provider_msg_id)
     WHERE id = $3`,
    [status, provider_msg_id || null, id]
  );
}

async function findOfficeByPhone(phone) {
  const normalized = phone.replace(/\D/g, "");
  const result = await pool.query(
    `SELECT id
     FROM offices
     WHERE regexp_replace(phone, '\\D', '', 'g') = $1
     LIMIT 1`,
    [normalized]
  );
  return result.rows[0] || null;
}

async function findGroupByOffice(officeId) {
  const result = await pool.query(
    `SELECT group_id
     FROM office_group_members
     WHERE office_id = $1
     LIMIT 1`,
    [officeId]
  );
  return result.rows[0] || null;
}

module.exports = {
  pool,
  initDb,
  saveMessage,
  updateMessageStatus,
  findOfficeByPhone,
  findGroupByOffice
};
