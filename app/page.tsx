// app/page.tsx
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

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        alert('Login failed: ' + error.message)
      } else {
        // Success - redirect to dashboard
        router.push('/dashboard')
      }
    } catch (error) {
      alert('Login error: ' + error)
    } finally {
      setLoading(false)
    }
  }

  // Demo credentials notice
  const handleDemoLogin = async () => {
    // For demo purposes, you might want to create a test account
    // or use a bypass. For now, just show a message:
    alert('You need to sign up first! Use the sign up form or check if you have existing credentials.')
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        alert('Sign up failed: ' + error.message)
      } else {
        alert('Sign up successful! Please check your email for verification.')
      }
    } catch (error) {
      alert('Sign up error: ' + error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#052525] flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-white text-center mb-2">
          CareerTracker Pro
        </h1>
        <p className="text-orange-200 text-center mb-6">Sign in to your dashboard</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-orange-200 text-sm font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-[#e67600] transition-colors"
              placeholder="your@email.com"
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
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-[#e67600] transition-colors"
              placeholder="Your password"
              required
            />
          </div>
          
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#e67600] hover:bg-[#d46900] text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? '...' : 'Sign In'}
            </button>
            
            <button
              type="button"
              onClick={handleSignUp}
              disabled={loading}
              className="flex-1 bg-transparent border border-[#e67600] text-[#e67600] hover:bg-[#e67600] hover:text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              Sign Up
            </button>
          </div>
        </form>

        <div className="mt-6 p-4 bg-white/5 rounded-lg">
          <p className="text-orange-200 text-sm text-center">
            <strong>First time here?</strong> Use the Sign Up button to create an account.
          </p>
        </div>
      </div>
    </div>
  )
}