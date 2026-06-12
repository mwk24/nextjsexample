import fetch from 'node-fetch'
import { GYM_BASE, gymHeaders, getCookieValue } from '../../../utils/gymApi'

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

export default async function handler(req, res) {
  const jsessionid = getCookieValue(req.headers.cookie, 'gym_jsessionid')
  const { locationUuid, dayOfWeek } = req.query
  if (!jsessionid || !locationUuid) return res.status(400).json({ error: 'Missing locationUuid' })

  const days = dayOfWeek ? [dayOfWeek] : DAYS

  try {
    const results = await Promise.all(
      days.map(async day => {
        const upstream = await fetch(
          `${GYM_BASE}/np/thegymgroup/v1.0/locations/${locationUuid}/historical-busyness?dayOfWeek=${day}`,
          { headers: gymHeaders(jsessionid) }
        )
        const data = await upstream.json()
        return { day, data }
      })
    )
    return res.status(200).json(results)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
