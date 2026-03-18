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

    await admin
      .from('users')
      .upsert({
        id: user.id,
        email: user.email,
        api_provider,
        api_key_encrypted,
        api_model: api_model || null,
      }, { onConflict: 'id' })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
