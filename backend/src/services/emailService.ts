import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export const sendOTPEmail = async (email: string, otp: string): Promise<void> => {
  if (!process.env.RESEND_API_KEY) {
    console.log(`📧 [DEV EMAIL OTP] To: ${email} | OTP: ${otp}`)
    return
  }

  await resend.emails.send({
    from: 'Isanthe <noreply@isanthe.com>',
    to: email,
    subject: `${otp} is your Isanthe verification code`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;padding:32px;background:#fff;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="width:56px;height:56px;background:#dc2626;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;">
            <span style="color:#fff;font-weight:800;font-size:20px;">IS</span>
          </div>
          <h2 style="margin:12px 0 4px;color:#111;">Isanthe Verification</h2>
        </div>
        <p style="color:#374151;margin-bottom:8px;">Use the code below to sign in. It expires in <b>5 minutes</b>.</p>
        <div style="background:#fef2f2;border:2px solid #fca5a5;border-radius:12px;text-align:center;padding:20px;margin:20px 0;">
          <span style="font-size:40px;font-weight:800;color:#dc2626;letter-spacing:10px;">${otp}</span>
        </div>
        <p style="color:#9ca3af;font-size:13px;">If you didn't request this, ignore this email. Never share your OTP with anyone.</p>
      </div>
    `,
  })
}
