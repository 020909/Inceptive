import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await admin.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await admin
      .from('users')
      .select('api_provider, api_key_encrypted')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      api_provider: data?.api_provider || 'gemini',
      has_api_key: !!data?.api_key_encrypted,
      masked_key: data?.api_key_encrypted ? '••••••••' + data.api_key_encrypted.slice(-4) : null
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
    const { api_provider, api_key_encrypted } = body

    if (!api_provider || !api_key_encrypted) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const { data: existing } = await admin
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()

    if (existing) {
      await admin
        .from('users')
        .update({ api_provider, api_key_encrypted })
        .eq('id', user.id)
    } else {
      await admin
        .from('users')
        .insert({ id: user.id, email: user.email, api_provider, api_key_encrypted, created_at: new Date().toISOString() })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
