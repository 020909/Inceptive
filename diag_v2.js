
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

const envPath = path.resolve(__dirname, '.env.local');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser(id) {
  console.log(`Checking User: ${id}`);
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error("User Check Error:", error);
  } else {
    console.log("USER DATA:", {
      id: data.id,
      email: data.email,
      api_provider: data.api_provider,
      has_key: !!data.api_key_encrypted,
      key_preview: data.api_key_encrypted ? data.api_key_encrypted.substring(0, 10) + "..." : "NONE"
    });
  }
}

const userId = "ed959d64-6a16-4cec-a398-42f35adc1bd1";
checkUser(userId);
