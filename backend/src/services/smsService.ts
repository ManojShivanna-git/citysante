import https from 'https'

const FAST2SMS_KEY = process.env.FAST2SMS_API_KEY || ''

export const sendOTPSms = async (phone: string, otp: string): Promise<void> => {
  if (!FAST2SMS_KEY) {
    // Dev fallback — print OTP to console when no API key is configured
    console.log(`📱 [DEV] OTP for ${phone}: ${otp}`)
    return
  }

  const body = JSON.stringify({
    route: 'otp',
    variables_values: otp,
    numbers: phone,
  })

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'www.fast2sms.com',
        path:     '/dev/bulkV2',
        method:   'POST',
        headers: {
          authorization:    FAST2SMS_KEY,
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`📱 OTP sent to ${phone}`)
          } else {
            console.error(`SMS send failed [${res.statusCode}]:`, data)
            console.log(`📱 [DEV] OTP for ${phone}: ${otp}`)
          }
          resolve()
        })
      }
    )

    req.on('error', (err) => {
      console.error('SMS send error:', err.message)
      console.log(`📱 [DEV] OTP for ${phone}: ${otp}`)
      resolve() // never throw — OTP is always logged as fallback
    })

    req.write(body)
    req.end()
  })
}
