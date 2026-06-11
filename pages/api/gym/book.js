import fetch from 'node-fetch'
import { GYM_BASE, gymHeaders, getCookieValue } from '../../../utils/gymApi'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const jsessionid = getCookieValue(req.headers.cookie, 'gym_jsessionid')
  const { companyUuid, classUuid, exerciserUuid, action } = req.body

  if (!jsessionid || !companyUuid || !classUuid || !exerciserUuid) {
    return res.status(400).json({ error: 'Missing required params' })
  }

  const endpoint = action === 'cancel'
    ? `/np/company/${companyUuid}/class/${classUuid}/removeExerciser`
    : `/np/company/${companyUuid}/class/${classUuid}/addExerciser`

  const formData = new URLSearchParams()
  formData.append('exerciserUuid', exerciserUuid)

  try {
    const upstream = await fetch(`${GYM_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        ...gymHeaders(jsessionid),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })
    let data
    try { data = await upstream.json() } catch { data = {} }
    return res.status(upstream.ok ? 200 : upstream.status).json(data)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
