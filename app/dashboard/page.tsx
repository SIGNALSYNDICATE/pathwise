'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import DashboardHeader from './components/DashboardHeader'
import SummaryCards from './components/SummaryCards'
import ApplicationTable from './components/ApplicationTable'
import ChartsGrid from './components/ChartsGrid'
import ResumeInsights from './components/ResumeInsights'
import SuccessAnalysis from './components/SuccessAnalysis'
import CareerDiagnosis from './components/CareerDiagnosis'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface JobApplication {
  id: string
  date_applied: string
  company: string
  role: string
  interviewed: boolean
  offered: boolean
  got_job: boolean
  mood: string
  application_expectation: number
  resume_data?: string
  user_id: string
  application_status?: 'applied' | 'assessment' | 'interview' | 'offered' | 'hired' | 'rejected' | 'withdrawn'
  job_description?: string
  rejection_reason?: string
  interview_feedback?: string
}

export default function Dashboard() {
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (error || !session) {
        window.location.href = '/'
        return
      }

      setSession(session)
      await fetchData(session.user.id)
    } catch (error) {
      console.error('Authentication error:', error)
      setLoading(false)
    }
  }

  const fetchData = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .select('*')
        .eq('user_id', userId)
        .order('date_applied', { ascending: false })

      if (error) {
        console.error('Error fetching data:', error.message)
        return
      }

      setApplications(data || [])
    } catch (error) {
      console.error('Unexpected application fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#052525] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#e67600]"></div>
      </div>
    )
  }

  // Pick the most recent application that has a CV + JD for the AI prompt
  const latestWithCv = applications.find((a) => a.resume_data)
  const cvText = latestWithCv?.resume_data
  const jobDescription = latestWithCv?.job_description

  return (
    <div className="min-h-screen bg-[#052525] text-white">
      <DashboardHeader onLogout={handleLogout} />

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards */}
        <SummaryCards applications={applications} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Table & Charts */}
          <div className="lg:col-span-2 space-y-6">
            <ApplicationTable applications={applications} />
            <ChartsGrid applications={applications} />
          </div>

          {/* Right Column - AI Features */}
          <div className="space-y-6">
            <CareerDiagnosis
              supabase={supabase}
              cvText={cvText}
              jobDescription={jobDescription}
            />
            <ResumeInsights applications={applications} />
            <SuccessAnalysis applications={applications} />
          </div>
        </div>
      </div>
    </div>
  )
}