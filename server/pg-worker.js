import pg from 'pg';

const { Client } = pg;

async function main() {
  const base64Payload = process.argv[2];
  if (!base64Payload) {
    console.log(JSON.stringify({ error: 'No payload provided' }));
    process.exit(1);
  }

  const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString('utf-8'));
  const { sql, params } = payload;

  const client = new Client({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'Pankaj@36085260',
    database: process.env.PGDATABASE || 'cms_haryana_police'
  });

  try {
    await client.connect();
    const res = await client.query(sql, params);
    
    // In PostgreSQL, SELECT queries return rows.
    console.log(JSON.stringify({ data: res.rows }));
  } catch (err) {
    console.log(JSON.stringify({ error: err.message }));
  } finally {
    await client.end();
  }
}

main();
