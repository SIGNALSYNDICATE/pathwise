// app/dashboard/components/ApplicationTable.tsx
import { useState } from 'react'
import { Search, Filter, ChevronDown } from 'lucide-react'

interface ApplicationTableProps {
  applications: any[]
}

export default function ApplicationTable({ applications }: ApplicationTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState('date_applied')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const filteredApplications = applications
    .filter(app => 
      app.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.role.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const getStatusBadge = (app: any) => {
    if (app.got_job) return <span className="bg-green-500/20 text-green-300 px-2 py-1 rounded-full text-xs">Hired</span>
    if (app.offered) return <span className="bg-orange-500/20 text-orange-300 px-2 py-1 rounded-full text-xs">Offer</span>
    if (app.interviewed) return <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full text-xs">Interviewed</span>
    return <span className="bg-gray-500/20 text-gray-300 px-2 py-1 rounded-full text-xs">Applied</span>
  }

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/20 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-xl font-bold text-white">Application History</h2>
        
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search companies or roles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-[#e67600] transition-colors"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/20">
              {[
                { key: 'date_applied', label: 'Date' },
                { key: 'company', label: 'Company' },
                { key: 'role', label: 'Role' },
                { key: 'status', label: 'Status' },
                { key: 'mood', label: 'Mood' },
                { key: 'application_expectation', label: 'Expectation' }
              ].map(({ key, label }) => (
                <th
                  key={key}
                  className="text-left py-3 px-4 text-orange-200 font-semibold cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort(key)}
                >
                  <div className="flex items-center gap-1">
                    {label}
                    <ChevronDown 
                      className={`h-4 w-4 transition-transform ${
                        sortField === key && sortDirection === 'asc' ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredApplications.map((app, index) => (
              <tr 
                key={app.id} 
                className="border-b border-white/10 hover:bg-white/5 transition-colors"
              >
                <td className="py-3 px-4 text-white">{app.date_applied}</td>
                <td className="py-3 px-4 font-medium text-white">{app.company}</td>
                <td className="py-3 px-4 text-white">{app.role}</td>
                <td className="py-3 px-4">{getStatusBadge(app)}</td>
                <td className="py-3 px-4 text-white capitalize">{app.mood || '-'}</td>
                <td className="py-3 px-4">
                  {typeof app.application_expectation === 'number' ? (
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-white/20 rounded-full h-2">
                        <div 
                          className="bg-[#e67600] h-2 rounded-full" 
                          style={{ width: `${app.application_expectation * 10}%` }}
                        />
                      </div>
                      <span className="text-sm">{app.application_expectation}/10</span>
                    </div>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}