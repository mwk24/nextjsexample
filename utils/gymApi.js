export const GYM_BASE = 'https://thegymgroup.netpulse.com'

export function gymHeaders(jsessionid) {
  return {
    'User-Agent': 'okhttp/3.12.3',
    'Accept': 'application/json',
    'X-NP-API-Version': '1.5',
    'X-NP-App-Version': '9999',
    'X-NP-User-Agent': [
      'clientType=MOBILE_DEVICE',
      'devicePlatform=ANDROID',
      'deviceUid=poc-device-uid-12345',
      'applicationName=The Gym Group',
      'applicationVersion=7.4',
      'applicationVersionCode=1',
    ].join('; '),
    ...(jsessionid ? { Cookie: `JSESSIONID=${jsessionid}` } : {}),
  }
}

export function getCookieValue(cookieHeader, name) {
  if (!cookieHeader) return null
  const match = (cookieHeader + ';').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return match ? match[1] : null
}
