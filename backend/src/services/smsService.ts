import https from 'https'

const FAST2SMS_KEY    = process.env.FAST2SMS_API_KEY || ''
const DLT_SENDER_ID   = 'ISANTH'
const DLT_TEMPLATE_ID = '222200'              // Fast2SMS Message ID
const DLT_ENTITY_ID   = '1101098790000097305' // VILPOWER Entity ID

// IMPORTANT: template registered on VILPOWER/Fast2SMS has NO space before the variable:
// "Your Isanthe OTP is{#VAR#}. Valid for 5 minutes. Do not share with anyone."
const buildMessage = (otp: string) =>
  `Your Isanthe OTP is${otp}. Valid for 5 minutes. Do not share with anyone.`

export const sendOTPSms = async (phone: string, otp: string): Promise<void> => {
  if (!FAST2SMS_KEY) {
    console.log(`📱 [DEV] OTP for ${phone}: ${otp}`)
    return
  }

  const message = buildMessage(otp)

  const body = JSON.stringify({
    route:      'dlt',
    sender_id:  DLT_SENDER_ID,
    message,
    flash:      0,
    numbers:    phone,
    dlt_te_id:  DLT_TEMPLATE_ID,
    entity_id:  DLT_ENTITY_ID,
  })

  console.log(`📱 Sending OTP SMS to ${phone}`)

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
      resolve()
    })

    req.write(body)
    req.end()
  })
}
