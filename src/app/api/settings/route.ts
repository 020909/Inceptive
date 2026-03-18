import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const getAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy";
  return createClient(url, key);
};

const admin = getAdmin();

// Helper: upsert with graceful fallback if api_model column doesn't exist yet
async function upsertUserSettings(payload: Record<string, unknown>) {
  // Attempt 1: full payload including api_model
  const r1 = await admin.from('users').upsert(payload, { onConflict: 'id' });
  if (!r1.error) return null; // success

  const msg1 = (r1.error.message || '').toLowerCase();

  // If api_model column doesn't exist, retry without it
  if (msg1.includes('api_model') || (msg1.includes('column') && msg1.includes('exist'))) {
    const { api_model: _omit, ...payloadNoModel } = payload as any;
    const r2 = await admin.from('users').upsert(payloadNoModel, { onConflict: 'id' });
    if (!r2.error) return null; // success without api_model

    const msg2 = (r2.error.message || '').toLowerCase();

    // If provider constraint still blocks, update just key+provider (no api_model col)
    if (msg2.includes('check') || msg2.includes('constraint') || r2.error.code === '23514') {
      const r3 = await admin.from('users').update({
        api_key_encrypted: payload.api_key_encrypted,
        api_provider: payload.api_provider,
      }).eq('id', payload.id as string);
      return r3.error ?? null;
    }

    return r2.error;
  }

  // If provider constraint violation, save everything except check which fields work
  if (msg1.includes('check') || msg1.includes('constraint') || r1.error.code === '23514') {
    // Try update-only (row must exist already — created by auth trigger)
    const r2 = await admin.from('users').update({
      api_key_encrypted: payload.api_key_encrypted,
      api_model: payload.api_model ?? null,
      api_provider: payload.api_provider,
    }).eq('id', payload.id as string);

    if (!r2.error) return null;

    // api_provider still blocked by constraint — save key+model at minimum
    const r3 = await admin.from('users').update({
      api_key_encrypted: payload.api_key_encrypted,
    }).eq('id', payload.id as string);

    if (r3.error) return r1.error; // original error
    // Key saved; return a specific error so caller knows provider wasn't saved
    return { ...r1.error, providerNotSaved: true };
  }

  return r1.error;
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await admin.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Try to select api_model; gracefully degrade if column doesn't exist
    let settingsData: any = null;

    const r1 = await admin
      .from('users')
      .select('api_provider, api_key_encrypted, api_model')
      .eq('id', user.id)
      .single();

    if (r1.error) {
      const msg = (r1.error.message || '').toLowerCase();
      if (msg.includes('api_model') || (msg.includes('column') && msg.includes('exist'))) {
        const r2 = await admin
          .from('users')
          .select('api_provider, api_key_encrypted')
          .eq('id', user.id)
          .single();
        settingsData = r2.data;
      }
      // If totally different error, settingsData stays null — that's fine
    } else {
      settingsData = r1.data;
    }

    return NextResponse.json({
      api_provider: settingsData?.api_provider || '',
      api_model: settingsData?.api_model || '',
      has_api_key: !!settingsData?.api_key_encrypted,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await admin.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { api_provider, api_key_encrypted, api_model } = body

    if (!api_provider || !api_key_encrypted) {
      return NextResponse.json({ error: 'Please select a provider and enter your API key.' }, { status: 400 })
    }

    // Ensure user row exists (created by auth trigger, but ensure just in case)
    await admin.from('users').upsert(
      { id: user.id, email: user.email },
      { onConflict: 'id', ignoreDuplicates: true }
    );

    const saveError = await upsertUserSettings({
      id: user.id,
      email: user.email,
      api_provider,
      api_key_encrypted,
      api_model: api_model || null,
    });

    if (saveError) {
      const err = saveError as any;
      if (err.providerNotSaved) {
        // Key was saved but provider couldn't be stored due to DB constraint
        return NextResponse.json({
          error: `API key saved but provider "${api_provider}" is not allowed by your database. Please run the SQL migration in Supabase: ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_api_provider_check;`,
        }, { status: 500 });
      }
      const msg = (saveError.message || '').toLowerCase();
      if (msg.includes('check') || msg.includes('constraint') || (saveError as any).code === '23514') {
        return NextResponse.json({
          error: `Database constraint is blocking "${api_provider}" as a provider. Please run this SQL in your Supabase SQL Editor:\n\nALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_api_provider_check;`,
        }, { status: 500 });
      }
      console.error('Settings save error:', saveError);
      return NextResponse.json({ error: `Failed to save: ${saveError.message}` }, { status: 500 });
    }

    // Verify both key AND provider were actually stored
    const { data: verify, error: verifyError } = await admin
      .from('users')
      .select('api_key_encrypted, api_provider')
      .eq('id', user.id)
      .single();

    if (verifyError || !verify?.api_key_encrypted) {
      return NextResponse.json({
        error: 'Save appeared to succeed but the key is not in the database. Your Supabase may be missing columns — please run supabase/005_schema_fixes.sql in the SQL Editor.',
      }, { status: 500 });
    }

    if (verify.api_provider !== api_provider) {
      return NextResponse.json({
        error: `API key was saved but provider was not stored correctly (got "${verify.api_provider}", expected "${api_provider}"). Please run: ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_api_provider_check; in your Supabase SQL Editor.`,
      }, { status: 500 });
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Settings PATCH error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
