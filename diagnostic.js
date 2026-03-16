
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

const envPath = path.resolve(__dirname, '.env.local');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnostic() {
  console.log('--- DIAGNOSTIC START ---');
  
  // 1. Check user data
  console.log('Checking user data for alymaknojiya7@gmail.com...');
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'alymaknojiya7@gmail.com')
    .single();

  if (userError) {
    console.error('User Error:', userError.message);
  } else {
    console.log('User Record:', JSON.stringify(user, null, 2));
  }

  // 2. Test Upsert with 'openrouter'
  console.log('\nTesting "openrouter" provider update...');
  const { error: upsertError } = await supabase
    .from('users')
    .update({ api_provider: 'openrouter' })
    .eq('email', 'alymaknojiya7@gmail.com');

  if (upsertError) {
    console.error('❌ UPDATE FAILED:', upsertError.message);
    console.error('Detail:', upsertError.details || 'Check constraint likely failed');
  } else {
    console.log('✅ UPDATE SUCCESSFUL: "openrouter" is allowed.');
  }

  // 3. Verify Table Structure (best effort via error message)
  console.log('\nVerifying constraint existence...');
  // This query will fail if the constraint doesn't exist, giving us info
  const { error: checkError } = await supabase.rpc('none_existent_function_to_force_error');
  // (Optional: skip rpc, just rely on upsert test)

  console.log('--- DIAGNOSTIC END ---');
}

diagnostic();
