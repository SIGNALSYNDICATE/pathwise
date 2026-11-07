// app/dashboard/components/DashboardHeader.tsx
interface DashboardHeaderProps {
  onLogout: () => void
}

export default function DashboardHeader({ onLogout }: DashboardHeaderProps) {
  return (
    <header className="bg-white/10 backdrop-blur-sm border-b border-white/20">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">CareerTracker Pro</h1>
          <p className="text-orange-200 text-sm">Your Job Application Command Center</p>
        </div>
        
        <button
          onClick={onLogout}
          className="bg-[#e67600] hover:bg-[#d46900] text-white px-6 py-2 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg"
        >
          Logout
        </button>
      </div>
    </header>
  )
}