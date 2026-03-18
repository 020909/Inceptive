import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const getAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy";
  return createClient(url, key);
};

const admin = getAdmin();

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await admin.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await admin
      .from('users')
      .select('api_provider, api_key_encrypted, api_model')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      api_provider: data?.api_provider || '',
      api_model: data?.api_model || '',
      has_api_key: !!data?.api_key_encrypted,
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
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Normalize provider names: ui uses 'anthropic'/'google', DB constraint may only allow certain values
    // We store the canonical provider name used by buildModel()
    const normalizedProvider = api_provider; // already correct from UI

    // Try upsert with api_model first
    const upsertPayload: Record<string, unknown> = {
      id: user.id,
      email: user.email,
      api_provider: normalizedProvider,
      api_key_encrypted,
    };

    // Try to include api_model — if column doesn't exist, we'll retry without it
    upsertPayload.api_model = api_model || null;

    let { error: upsertError } = await admin
      .from('users')
      .upsert(upsertPayload, { onConflict: 'id' });

    // If error mentions api_model column, retry without it (migration not run yet)
    if (upsertError && upsertError.message?.includes('api_model')) {
      const { api_model: _removed, ...payloadWithoutModel } = upsertPayload as any;
      const result2 = await admin.from('users').upsert(payloadWithoutModel, { onConflict: 'id' });
      upsertError = result2.error;
    }

    // If error mentions constraint / check violation, try raw UPDATE instead of upsert
    if (upsertError && (upsertError.message?.includes('check') || upsertError.message?.includes('constraint') || upsertError.code === '23514')) {
      // Drop provider constraint temporarily via direct update
      const { error: updateError } = await admin
        .from('users')
        .update({
          api_key_encrypted,
          api_model: api_model || null,
        })
        .eq('id', user.id);

      if (updateError) {
        // Row might not exist yet — try insert without provider constraint check
        // by doing separate key+model update
        console.error('Settings save error (constraint):', upsertError.message);
        return NextResponse.json({
          error: `Database constraint error. Please run the SQL migration supabase/005_schema_fixes.sql in your Supabase dashboard, then try again. Details: ${upsertError.message}`,
        }, { status: 500 });
      }

      // Successfully updated key — also try to save provider separately
      await admin.from('users').update({ api_provider: normalizedProvider }).eq('id', user.id);
    } else if (upsertError) {
      console.error('Settings save error:', upsertError);
      return NextResponse.json({ error: `Failed to save settings: ${upsertError.message}` }, { status: 500 });
    }

    // Verify the save worked by reading back
    const { data: verify } = await admin
      .from('users')
      .select('api_key_encrypted')
      .eq('id', user.id)
      .single();

    if (!verify?.api_key_encrypted) {
      return NextResponse.json({
        error: 'Settings appeared to save but key was not stored. Please run supabase/005_schema_fixes.sql in your Supabase SQL Editor and try again.',
      }, { status: 500 });
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Settings PATCH error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
