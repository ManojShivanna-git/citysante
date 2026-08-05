import https from 'https'

const FAST2SMS_KEY = process.env.FAST2SMS_API_KEY || ''
const OTP_ID       = '8d3c061aa8' // Fast2SMS Smart OTP Template ID

export const sendOTPSms = async (phone: string, otp: string): Promise<void> => {
  if (!FAST2SMS_KEY) {
    console.log(`📱 [DEV] OTP for ${phone}: ${otp}`)
    return
  }

  const body = JSON.stringify({
    mobile:           phone,
    otp_id:           OTP_ID,
    otp,              // our own OTP (stored in Redis)
    otp_expiry:       5,
    variables_values: otp,
  })

  console.log(`📱 Sending OTP SMS to ${phone}`)

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'www.fast2sms.com',
        path:     '/dev/otp/send',
        method:   'POST',
        headers: {
          Authorization:    FAST2SMS_KEY,
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(body),
          accept:           'application/json',
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
      resolve()
    })

    req.write(body)
    req.end()
  })
}
