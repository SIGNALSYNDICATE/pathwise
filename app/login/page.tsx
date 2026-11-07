// app/login/page.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const SUPABASE_URL = 'https://aofvzgqksbhgljzowyby.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvZnZ6Z3Frc2JoZ2xqem93eWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MzAxMTEsImV4cCI6MjA3MDAwNjExMX0.XA4xgMqrMy9finlY9xvOhPdrQIsKYlRGmrNx_1D6db4'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // For demo purposes, allow any login
    // In real app, you'd validate credentials
    router.push('/dashboard')
    
    // Or with actual auth:
    // const { data, error } = await supabase.auth.signInWithPassword({
    //   email,
    //   password,
    // })
    // 
    // if (error) {
    //   alert('Login failed: ' + error.message)
    //   setLoading(false)
    //   return
    // }
    // 
    // router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#052525] flex items-center justify-center">
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-white text-center mb-6">Login</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-orange-200 text-sm font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-[#e67600]"
              placeholder="Enter any email for demo"
              required
            />
          </div>
          <div>
            <label className="block text-orange-200 text-sm font-medium mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-[#e67600]"
              placeholder="Enter any password for demo"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#e67600] hover:bg-[#d46900] text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <p className="text-orange-200 text-sm text-center mt-4">
          For demo: Enter any email and password
        </p>
      </div>
    </div>
  )
}