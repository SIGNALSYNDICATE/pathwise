// app/dashboard/components/SummaryCards.tsx
import { TrendingUp, Briefcase, Award, Calendar } from 'lucide-react'

interface SummaryCardsProps {
  applications: any[]
}

export default function SummaryCards({ applications }: SummaryCardsProps) {
  const totalApplications = applications.length
  const offersReceived = applications.filter(app => app.offered).length
  
  const startOfWeek = new Date()
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
  const applicationsThisWeek = applications.filter(app => 
    new Date(app.date_applied) >= startOfWeek
  ).length
  
  const successRate = totalApplications > 0 
    ? ((applications.filter(app => app.got_job).length / totalApplications) * 100).toFixed(1)
    : '0'

  const cards = [
    {
      title: 'Total Applications',
      value: totalApplications,
      icon: Briefcase,
      color: 'from-blue-500 to-cyan-500'
    },
    {
      title: 'Offers Received',
      value: offersReceived,
      icon: Award,
      color: 'from-green-500 to-emerald-500'
    },
    {
      title: 'This Week',
      value: applicationsThisWeek,
      icon: Calendar,
      color: 'from-purple-500 to-pink-500'
    },
    {
      title: 'Success Rate',
      value: `${successRate}%`,
      icon: TrendingUp,
      color: 'from-orange-500 to-red-500'
    }
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <div
          key={index}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:border-[#e67600]/50 transition-all duration-300 transform hover:-translate-y-1"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-200 text-sm font-medium">{card.title}</p>
              <p className="text-3xl font-bold text-white mt-2">{card.value}</p>
            </div>
            <div className={`p-3 rounded-lg bg-gradient-to-br ${card.color}`}>
              <card.icon className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}