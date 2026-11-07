import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import OpenAI from 'openai'

export const runtime = 'nodejs'
export const maxDuration = 60

const supabase = createServerSupabase()

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  try {
    // 1. Auth
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return NextResponse.json({ error: 'unauthorized', message: 'Missing auth token.' }, { status: 401 })

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'unauthorized', message: 'Session expired.' }, { status: 401 })

    // 2. Get CV and JD from request
    const body = await req.json().catch(() => ({}))
    const { cv_text, job_description } = body

    if (!cv_text || cv_text.trim().length < 50) {
      return NextResponse.json({ error: 'invalid_input', message: 'Please provide a longer CV text.' }, { status: 400 })
    }

    // 3. Call OpenAI
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'config_error', message: 'OPENAI_API_KEY is not set.' }, { status: 500 })
    }

    const prompt = `You are an expert ATS (Applicant Tracking System) resume optimizer. 
Analyze the provided CV against the target Job Description.

${job_description ? `TARGET JOB DESCRIPTION:\n"""\n${job_description.slice(0, 3000)}\n"""` : 'No job description provided. Optimize for general software/tech roles.'}

USER CV TEXT:
"""
${cv_text.slice(0, 4000)}
"""

STRICT RULES:
1. Do NOT invent achievements, metrics, or technologies the user hasn't provided.
2. Highlight missing keywords from the JD that the user should add IF they actually have that experience.
3. Provide a rewritten, optimized version of their CV that is stronger but 100% truthful.
4. Separate your output into specific sections.

Return EXACTLY this JSON shape:
{
  "overall_feedback": "2-3 sentences on the overall quality of the CV against this JD.",
  "missing_keywords": ["keyword1", "keyword2"],
  "improvements": [
    { "section": "Experience", "original_text": "original bullet point", "suggested_rewrite": "stronger bullet point with action verbs" }
  ],
  "optimized_cv": "The full, rewritten CV text ready to be copy-pasted."
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2, // Lower temp for CV rewriting to keep it grounded
      response_format: { type: 'json_object' },
      max_tokens: 4096,
    })

    const content = completion.choices[0].message.content ?? '{}'
    
    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch {
      const match = content.match(/\{[\s\S]*\}/)
      parsed = match ? JSON.parse(match[0]) : {}
    }

    return NextResponse.json(parsed)
  } catch (e: any) {
    console.error('Resume optimizer error:', e)

    if (e?.status === 401) {
      return NextResponse.json({ error: 'ai_failed', message: 'OpenAI API key is invalid.' }, { status: 502 })
    }
    if (e?.status === 429) {
      return NextResponse.json({ error: 'ai_failed', message: 'OpenAI rate limit reached.' }, { status: 502 })
    }

    return NextResponse.json({ error: 'ai_failed', message: e.message ?? 'Unknown error' }, { status: 500 })
  }
}