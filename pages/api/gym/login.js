import fetch from 'node-fetch'
import { GYM_BASE, gymHeaders } from '../../../utils/gymApi'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  const formData = new URLSearchParams()
  formData.append('username', email)
  formData.append('password', password)

  try {
    const upstream = await fetch(`${GYM_BASE}/np/exerciser/login`, {
      method: 'POST',
      headers: {
        ...gymHeaders(null),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    let data
    try { data = await upstream.json() } catch { data = {} }

    if (!upstream.ok) {
      return res.status(401).json({ error: 'Invalid email or PIN. Check your Gym Group app credentials.' })
    }

    const rawCookie = upstream.headers.get('set-cookie') || ''
    const jidMatch = rawCookie.match(/JSESSIONID=([^;,\s]+)/)
    if (jidMatch) {
      res.setHeader('Set-Cookie', `gym_jsessionid=${jidMatch[1]}; Path=/; HttpOnly; SameSite=Strict`)
    }

    return res.status(200).json(data)
  } catch (e) {
    return res.status(500).json({ error: `Connection failed: ${e.message}` })
  }
}
