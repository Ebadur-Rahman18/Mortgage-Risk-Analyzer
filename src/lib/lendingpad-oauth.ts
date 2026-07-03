/**
 * LendingPad OAuth redirect URI — must match exactly in authorize request and token exchange.
 */
export function getLendingPadOAuthRedirectUri(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return `${window.location.origin}/admin/integrations/oauth/callback?provider=lendingpad`;
}
