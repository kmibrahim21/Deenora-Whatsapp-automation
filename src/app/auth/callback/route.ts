import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type') as EmailOtpType | null
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  const origin = requestUrl.origin

  if (error) {
    console.error('[auth/callback] Redirect error from Supabase:', { error, error_description })
    const loginUrl = new URL('/login', origin)
    loginUrl.searchParams.set('error', error_description || error)
    return NextResponse.redirect(loginUrl.toString())
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Can be ignored if called from server route handler
          }
        },
      },
    }
  )

  // Exchange code for session (PKCE flow)
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (!exchangeError) {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
    console.error('[auth/callback] exchangeCodeForSession error:', exchangeError)
  }

  // Token hash verification for email confirmation / recovery
  if (token_hash && type) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    if (!verifyError) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('[auth/callback] verifyOtp error:', verifyError)
  }

  // If callback failed or expired, redirect to login with actionable message
  const redirectUrl = new URL('/login', origin)
  redirectUrl.searchParams.set(
    'error',
    'Confirmation link is invalid or expired. Please sign in or request a new link.'
  )
  return NextResponse.redirect(redirectUrl.toString())
}
