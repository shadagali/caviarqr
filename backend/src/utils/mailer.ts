import { Resend } from 'resend'

export const sendResetEmail = async (to: string, link: string) => {
  const resend = new Resend(process.env.RESEND_API_KEY)

  const response = await resend.emails.send({
    from: 'CaviarQR <onboarding@resend.dev>',
    to: 'kingjith24@gmail.com',
    subject: 'CaviarQR Reset ' + new Date().toLocaleTimeString(),
    html: `
      <h2>Password Reset</h2>
      <p>Click below:</p>
      <a href="${link}" style="padding:10px 20px;background:black;color:white;border-radius:6px;">
        Reset Password
      </a>
    `,
  })

  if (response.error) {
    console.log("EMAIL ERROR ❌:", response.error)
  } else {
    console.log("EMAIL SENT ✅")
  }
}