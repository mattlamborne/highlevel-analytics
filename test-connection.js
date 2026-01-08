const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL);

async function test() {
  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    console.log('✅ Connected to Supabase successfully!\n');
    console.log('📋 Tables found:');
    tables.forEach(t => console.log('  -', t.table_name));
    
    await sql.end();
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

test();
