import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Normalize provider IDs for DB storage.
 * The original migration has a CHECK constraint:
 *   CHECK (api_provider IN ('claude', 'openai', 'gemini', 'openrouter'))
 * UI uses 'anthropic' and 'google' — map these so they always save correctly.
 */
function normalizeProvider(provider: string): string {
  switch (provider.toLowerCase()) {
    case 'anthropic': return 'claude';   // DB stores 'claude', buildModel handles both
    case 'google':    return 'gemini';   // DB stores 'gemini', buildModel handles both
    default:          return provider.toLowerCase();
  }
}

/** Read back the canonical provider ID used by buildModel. */
function denormalizeProvider(dbProvider: string): string {
  switch (dbProvider) {
    case 'claude':  return 'anthropic';  // UI shows Anthropic, but stored as claude
    case 'gemini':  return 'google';     // UI shows Google, but stored as gemini
    default:        return dbProvider;
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Select only guaranteed columns first
    const { data, error } = await admin
      .from('users')
      .select('api_provider, api_key_encrypted')
      .eq('id', user.id)
      .single();

    // Try to get api_model (column may not exist if migration not run)
    const { data: modelRow } = await admin
      .from('users')
      .select('api_model')
      .eq('id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = row not found (new user) — that's fine
      console.error('Settings GET error:', error);
    }

    const storedProvider = data?.api_provider || '';
    const uiProvider = storedProvider ? denormalizeProvider(storedProvider) : '';

    return NextResponse.json({
      api_provider: uiProvider,
      api_model: (modelRow as any)?.api_model || '',
      has_api_key: !!data?.api_key_encrypted,
    });
  } catch (err: any) {
    console.error('Settings GET crash:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { api_provider, api_key_encrypted, api_model } = body;

    if (!api_provider || !api_key_encrypted?.trim()) {
      return NextResponse.json({ error: 'Please select a provider and enter your API key.' }, { status: 400 });
    }

    const dbProvider = normalizeProvider(api_provider);

    // Step 1: Ensure user row exists (auth trigger should create it, but be safe)
    await admin.from('users').upsert(
      { id: user.id, email: user.email },
      { onConflict: 'id', ignoreDuplicates: true }
    );

    // Step 2: Save key + provider (these columns always exist)
    const { error: updateErr } = await admin
      .from('users')
      .update({ api_key_encrypted: api_key_encrypted.trim(), api_provider: dbProvider })
      .eq('id', user.id);

    if (updateErr) {
      console.error('Settings save error (key+provider):', updateErr);
      if (updateErr.code === '23514') {
        return NextResponse.json({
          error: `Provider "${api_provider}" is blocked by a database constraint. Go to your Supabase SQL Editor and run:\n\nALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_api_provider_check;`,
        }, { status: 500 });
      }
      return NextResponse.json({ error: `Database error: ${updateErr.message}` }, { status: 500 });
    }

    // Step 3: Save model (column may not exist — ignore error if so)
    if (api_model) {
      const { error: modelErr } = await admin
        .from('users')
        .update({ api_model: api_model })
        .eq('id', user.id);

      if (modelErr && !modelErr.message?.toLowerCase().includes('api_model') && modelErr.code !== '42703') {
        // 42703 = undefined_column in Postgres — ignore it (migration not run yet)
        console.error('Settings save error (api_model):', modelErr);
      }
    }

    // Step 4: Verify the save actually worked
    const { data: verify, error: verifyErr } = await admin
      .from('users')
      .select('api_key_encrypted, api_provider')
      .eq('id', user.id)
      .single();

    if (verifyErr || !verify) {
      return NextResponse.json({
        error: 'Could not verify save. Check your Supabase connection and run supabase/006_fix_api_key_storage.sql.',
      }, { status: 500 });
    }

    if (!verify.api_key_encrypted) {
      return NextResponse.json({
        error: 'API key was not stored. Please run supabase/006_fix_api_key_storage.sql in your Supabase SQL Editor.',
      }, { status: 500 });
    }

    if (verify.api_provider !== dbProvider) {
      return NextResponse.json({
        error: `Provider "${api_provider}" could not be saved (constraint issue). Run in Supabase SQL Editor:\n\nALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_api_provider_check;`,
      }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Settings PATCH crash:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
