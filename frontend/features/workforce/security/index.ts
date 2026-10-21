/**
 * Workforce security (Segment 6a): the phone question, My phones, "This wasn't me" with the password reset, and the System Admin's
 * Security alerts. The app shell wraps the signed-in app in `SecurityGate`; the route files render the screens. See README.md.
 */
export { SecurityGate } from './components/security-gate';
export { MyPhonesScreen } from './components/my-phones-screen';
export { WasntMePage } from './components/wasnt-me-page';
export { AlertsScreen } from './components/alerts-screen';
// Front end B (Activity on my record): "This wasn't me" there ends in this same password page, so there is one flow.
export { ResetPasswordScreen } from './components/reset-password-screen';
