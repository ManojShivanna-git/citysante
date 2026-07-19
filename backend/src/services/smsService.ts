import axios from 'axios'

const FAST2SMS_KEY = process.env.FAST2SMS_API_KEY || ''

export const sendOTPSms = async (phone: string, otp: string): Promise<void> => {
  if (!FAST2SMS_KEY) {
    // Dev mode — just log
    console.log(`📱 OTP for ${phone}: ${otp}`)
    return
  }

  try {
    await axios.post(
      'https://www.fast2sms.com/dev/bulkV2',
      {
        route: 'otp',
        variables_values: otp,
        numbers: phone,
      },
      {
        headers: {
          authorization: FAST2SMS_KEY,
          'Content-Type': 'application/json',
        },
      }
    )
    console.log(`📱 OTP sent to ${phone}`)
  } catch (err: any) {
    console.error('SMS send failed:', err?.response?.data || err.message)
    // Don't throw — log OTP as fallback in dev
    console.log(`📱 OTP for ${phone}: ${otp}`)
  }
}
