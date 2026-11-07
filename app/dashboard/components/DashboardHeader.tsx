// app/dashboard/components/DashboardHeader.tsx
import Link from 'next/link'

interface DashboardHeaderProps {
  onLogout: () => void
}

export default function DashboardHeader({ onLogout }: DashboardHeaderProps) {
  return (
    <header className="bg-white/10 backdrop-blur-sm border-b border-white/20">
      <div className="container mx-auto px-4 py-4 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">CareerTracker Pro</h1>
          <p className="text-orange-200 text-sm">Your Job Application Command Center</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/opportunities"
            className="border border-[#e67600] text-[#e67600] hover:bg-[#e67600] hover:text-white px-5 py-2 rounded-lg font-semibold transition-all duration-200"
          >
            Opportunities
          </Link>
          <Link
            href="/dashboard/recommendations"
            className="border border-[#e67600] text-[#e67600] hover:bg-[#e67600] hover:text-white px-5 py-2 rounded-lg font-semibold transition-all duration-200"
          >
            Recommended
          </Link>
          <button
            onClick={onLogout}
            className="bg-[#e67600] hover:bg-[#d46900] text-white px-6 py-2 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}