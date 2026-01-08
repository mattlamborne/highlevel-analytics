require('dotenv').config();

async function test() {
  console.log('Testing database connection...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set (length: ' + process.env.DATABASE_URL.length + ')' : 'NOT SET');

  try {
    // Try to import postgres
    const postgres = require('postgres');
    console.log('✅ postgres package loaded');

    // Create connection
    const sql = postgres(process.env.DATABASE_URL, {
      connect_timeout: 10,
      idle_timeout: 20,
      max_lifetime: 60,
    });

    console.log('✅ Connection object created');

    // Try a simple query
    const result = await sql`SELECT current_database(), version()`;
    console.log('✅ Query successful!');
    console.log('Database:', result[0].current_database);
    console.log('Version:', result[0].version.substring(0, 50) + '...');

    await sql.end();
    console.log('✅ Connection closed');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

test();
