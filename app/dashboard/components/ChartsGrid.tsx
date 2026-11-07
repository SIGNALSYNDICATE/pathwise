// app/dashboard/components/ChartsGrid.tsx
'use client'

import { Bar, Doughnut, Pie, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
)

interface ChartsGridProps {
  applications: any[]
}

export default function ChartsGrid({ applications }: ChartsGridProps) {
  // Applications per day
  const dailyData = applications.reduce((acc, app) => {
    const date = app.date_applied
    acc[date] = (acc[date] || 0) + 1
    return acc
  }, {})

  const applicationsPerDayChart = {
    labels: Object.keys(dailyData),
    datasets: [
      {
        label: 'Applications per Day',
        data: Object.values(dailyData),
        backgroundColor: '#e67600',
        borderColor: '#ff8c00',
        borderWidth: 2,
        borderRadius: 4,
      },
    ],
  }

  // Success rate
  const offers = applications.filter(d => d.offered).length
  const gotJob = applications.filter(d => d.got_job).length
  const successRateChart = {
    labels: ['Got Job', 'Only Offered', 'No Offer'],
    datasets: [
      {
        data: [gotJob, offers - gotJob, applications.length - offers],
        backgroundColor: ['#10b981', '#e67600', '#6b7280'],
        borderWidth: 2,
        borderColor: '#052525',
      },
    ],
  }

  // Interview rate
  const interviewed = applications.filter(d => d.interviewed).length
  const interviewRateChart = {
    labels: ['Interviewed', 'Not Interviewed'],
    datasets: [
      {
        data: [interviewed, applications.length - interviewed],
        backgroundColor: ['#3b82f6', '#9ca3af'],
        borderWidth: 2,
        borderColor: '#052525',
      },
    ],
  }

  // Mood distribution
  const moodCounts = applications.reduce((acc, app) => {
    const mood = app.mood || 'unknown'
    acc[mood] = (acc[mood] || 0) + 1
    return acc
  }, {})

  const moodChart = {
    labels: Object.keys(moodCounts),
    datasets: [
      {
        label: 'Mood Frequency',
        data: Object.values(moodCounts),
        backgroundColor: [
          '#e67600',
          '#3b82f6',
          '#10b981',
          '#8b5cf6',
          '#f59e0b',
        ],
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: 'white',
          font: {
            size: 12,
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: 'white' },
        grid: { color: 'rgba(255,255,255,0.1)' },
      },
      y: {
        ticks: { color: 'white' },
        grid: { color: 'rgba(255,255,255,0.1)' },
      },
    },
  }

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: 'white',
          font: {
            size: 12,
          },
        },
      },
    },
  }

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/20 p-6">
      <h2 className="text-xl font-bold text-white mb-6">Application Analytics</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/5 rounded-lg p-4 h-64">
          <h3 className="text-orange-200 font-semibold mb-4">Applications Timeline</h3>
          <Bar data={applicationsPerDayChart} options={chartOptions} />
        </div>
        
        <div className="bg-white/5 rounded-lg p-4 h-64">
          <h3 className="text-orange-200 font-semibold mb-4">Success Rate</h3>
          <Doughnut data={successRateChart} options={pieChartOptions} />
        </div>
        
        <div className="bg-white/5 rounded-lg p-4 h-64">
          <h3 className="text-orange-200 font-semibold mb-4">Interview Rate</h3>
          <Pie data={interviewRateChart} options={pieChartOptions} />
        </div>
        
        <div className="bg-white/5 rounded-lg p-4 h-64">
          <h3 className="text-orange-200 font-semibold mb-4">Mood Distribution</h3>
          <Bar data={moodChart} options={chartOptions} />
        </div>
      </div>
    </div>
  )
}