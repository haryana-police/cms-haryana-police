import fs from 'fs';
import pg from 'pg';

const { Client } = pg;

function createClient() {
  return new Client({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    // 'postgres' is only a local-development fallback; set PGPASSWORD explicitly.
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'cms_haryana_police'
  });
}

// Run a whole batch inside ONE connection/transaction. BEGIN and COMMIT must
// happen on the same client, otherwise the transaction is meaningless.
async function runBatch(client, queries) {
  await client.query('BEGIN');
  try {
    const data = [];
    const rowCounts = [];
    for (const query of queries) {
      const res = await client.query(query.sql, query.params || []);
      data.push(res.rows);
      rowCounts.push(res.rowCount);
    }
    await client.query('COMMIT');
    return { data, rowCounts };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('PostgreSQL ROLLBACK failed:', rollbackErr.message);
    }
    throw err;
  }
}

async function main() {
  // db.js writes the payload to stdin; the base64 argv form is kept for
  // backwards compatibility with older callers.
  let rawPayload;
  if (process.argv[2]) {
    rawPayload = Buffer.from(process.argv[2], 'base64').toString('utf-8');
  } else if (!process.stdin.isTTY) {
    try {
      rawPayload = fs.readFileSync(0, 'utf-8');
    } catch (e) {
      console.log(JSON.stringify({ error: `Unable to read payload from stdin: ${e.message}` }));
      process.exit(1);
    }
  }
  if (!rawPayload || !rawPayload.trim()) {
    console.log(JSON.stringify({ error: 'No payload provided' }));
    process.exit(1);
  }

  let payload;
  try {
    payload = JSON.parse(rawPayload);
  } catch (e) {
    console.log(JSON.stringify({ error: `Invalid payload: ${e.message}` }));
    process.exit(1);
  }
  const client = createClient();

  try {
    await client.connect();

    let result;
    if (Array.isArray(payload.queries)) {
      result = await runBatch(client, payload.queries);
    } else {
      const res = await client.query(payload.sql, payload.params || []);
      // Keep `data` for existing .get()/.all() consumers and add rowCount so
      // callers can report accurate change counts.
      result = { data: res.rows, rowCount: res.rowCount };
    }
    console.log(JSON.stringify(result));
  } catch (err) {
    console.log(JSON.stringify({ error: err.message }));
  } finally {
    await client.end();
  }
}

main();
