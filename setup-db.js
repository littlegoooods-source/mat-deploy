const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const client = new Client({
    host: '79.174.88.21',
    port: 16396,
    user: 'mat',
    password: 'admin_Mat123',
    database: 'mat',
    ssl: false,
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    const version = await client.query('SELECT version()');
    console.log('Version:', version.rows[0].version);

    const sql = fs.readFileSync('init-db.sql', 'utf8');
    await client.query(sql);
    console.log('Schema applied successfully!');

    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('\nCreated tables:');
    tables.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.table_name}`);
    });

    const migrations = await client.query('SELECT * FROM "__EFMigrationsHistory"');
    console.log('\nEF Migrations:', migrations.rows);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
    console.log('\nConnection closed.');
  }
}

main();
