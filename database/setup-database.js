const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
  user: process.env.PGUSER || 'postgres',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'litloom',
  password: process.env.PGPASSWORD || 'Okazaki1919',
  port: process.env.PGPORT || 5432,
});

async function setupDatabase() {
  try {
    console.log('🔗 Connecting to database...');
    const client = await pool.connect();
    
    console.log('✅ Database connection successful');
    
    // Check if stored procedures exist
    const checkProcs = await client.query(`
      SELECT COUNT(*) as count FROM pg_proc 
      WHERE proname IN ('handle_user_login', 'handle_user_logout')
    `);
    
    const procCount = parseInt(checkProcs.rows[0].count);
    console.log(`📋 Found ${procCount} stored procedures`);
    
    if (procCount < 2) {
      console.log('⚠️  Missing stored procedures. Checking public.sql...');
      
      const publicSqlPath = path.join(__dirname, 'public.sql');
      if (fs.existsSync(publicSqlPath)) {
        console.log('📄 Found public.sql file');
        console.log('💡 To import the database, run:');
        console.log(`   psql -U postgres -d litloom -f "${publicSqlPath}"`);
        console.log('   Or use pgAdmin to import the file');
      } else {
        console.log('❌ public.sql file not found');
      }
    } else {
      console.log('✅ All required stored procedures are present');
      
      // Test the procedures
      console.log('🧪 Testing stored procedures...');
      const testLogin = await client.query('SELECT handle_user_login(1, $1) as result', ['test']);
      console.log('✅ handle_user_login test:', testLogin.rows[0].result);
      
      const testLogout = await client.query('SELECT handle_user_logout(1) as result');
      console.log('✅ handle_user_logout test:', testLogout.rows[0].result);
    }
    
    client.release();
    console.log('🎉 Database setup check complete!');
    
  } catch (error) {
    console.error('❌ Database setup error:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('1. Make sure PostgreSQL is running');
    console.log('2. Check database credentials in .env file');
    console.log('3. Ensure litloom database exists');
    console.log('4. Import public.sql if stored procedures are missing');
  } finally {
    await pool.end();
  }
}

// Run the setup
if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase };