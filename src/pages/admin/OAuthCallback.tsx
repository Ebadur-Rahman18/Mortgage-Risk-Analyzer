/**
 * OAuth Callback Page
 * Handles redirect from OAuth providers (e.g. LendingPad) and completes token exchange
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getLendingPadOAuthRedirectUri } from '@/lib/lendingpad-oauth';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const provider = searchParams.get('provider') || state?.split(':')[0];

    if (!code) {
      setStatus('error');
      setMessage('No authorization code received.');
      return;
    }

    if (provider === 'lendingpad') {
      const redirectUri = getLendingPadOAuthRedirectUri();
      supabase.functions
        .invoke('lendingpad-oauth-callback', {
          body: { code, state: state || '', redirect_uri: redirectUri },
        })
        .then(({ data, error }) => {
          if (error) {
            setStatus('error');
            setMessage(error.message || 'OAuth callback failed.');
            return;
          }
          if (data?.error) {
            setStatus('error');
            setMessage(data.error);
            return;
          }
          setStatus('success');
          setMessage('LendingPad connected successfully.');
          setTimeout(() => navigate('/admin/integrations'), 2000);
        })
        .catch((e) => {
          setStatus('error');
          setMessage(e?.message || 'Connection failed.');
        });
      return;
    }

    setStatus('error');
    setMessage('Unknown provider. Redirecting to integrations.');
    setTimeout(() => navigate('/admin/integrations'), 3000);
  }, [navigate, searchParams]);

  return (
    <div className="container max-w-2xl mx-auto py-12">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            {status === 'pending' && <Loader2 className="h-8 w-8 animate-spin text-primary" />}
            {status === 'success' && <CheckCircle2 className="h-8 w-8 text-green-500" />}
            {(status === 'error') && <AlertCircle className="h-8 w-8 text-destructive" />}
            <div>
              <CardTitle>OAuth Callback</CardTitle>
              <CardDescription>
                {status === 'pending' && 'Completing connection...'}
                {status === 'success' && message}
                {status === 'error' && message}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'success' && (
            <p className="text-sm text-muted-foreground">Redirecting to Integration Hub...</p>
          )}
          <Button onClick={() => navigate('/admin/integrations')}>
            Go to Integrations
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
