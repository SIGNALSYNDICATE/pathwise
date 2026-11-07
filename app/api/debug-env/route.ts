import { NextResponse } from 'next/server'
export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({
    hasGemmaKey: !!process.env.GEMMA_API_KEY,
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    keyLength: (process.env.GEMMA_API_KEY ?? process.env.GEMINI_API_KEY ?? '').length,
    keyPrefix: (process.env.GEMMA_API_KEY ?? process.env.GEMINI_API_KEY ?? '').slice(0, 6),
    gemmaModel: process.env.GEMMA_MODEL ?? null,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  })
}