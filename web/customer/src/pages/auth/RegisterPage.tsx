import { Navigate } from 'react-router-dom'

// Customers no longer need a separate register page.
// Phone OTP on LoginPage auto-creates an account for new numbers.
export default function RegisterPage() {
  return <Navigate to="/login" replace />
}
