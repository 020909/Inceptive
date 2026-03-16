import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await admin.auth.getUser(token)
  return user
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await admin
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ goals: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { title, description, progress_percent, status, user_id } = body

    if (!title || user_id !== user.id) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('goals')
      .insert({
        user_id,
        title,
        description,
        progress_percent: progress_percent || 0,
        status: status || 'active',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ goal: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { id, progress_percent, status, title, description } = body

    if (!id) return NextResponse.json({ error: 'Missing goal id' }, { status: 400 })

    const updateData: any = {}
    if (progress_percent !== undefined) updateData.progress_percent = progress_percent
    if (status !== undefined) updateData.status = status
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description

    const { data, error } = await admin
      .from('goals')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ goal: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Missing goal id' }, { status: 400 })

    const { error } = await admin
      .from('goals')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
