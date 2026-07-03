/**
 * Microsoft Graph API Client
 * Production-ready client with token management, error handling, and automatic retry
 */

import { getMSALInstance } from './msalConfig';
import { getStoredMSALResponse, acquireTokenSilently } from './azureAuth';

// ============================================================================
// Types
// ============================================================================

export interface GraphUser {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  givenName?: string;
  surname?: string;
  jobTitle?: string;
  officeLocation?: string;
}

export interface TokenMetadata {
  audience: string;
  issuer: string;
  scopes: string[];
  expiresAt: Date;
  isExpired: boolean;
  expiresInMinutes: number;
}

// ============================================================================
// Error Classes
// ============================================================================

export class GraphError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorCode?: string,
    public requestId?: string
  ) {
    super(message);
    this.name = 'GraphError';
  }
}

export class UnauthorizedError extends GraphError {
  constructor(message: string = 'Access token is invalid or expired') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends GraphError {
  constructor(message: string = 'Insufficient permissions for this operation') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends GraphError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ServiceError extends GraphError {
  constructor(message: string = 'Microsoft Graph service error') {
    super(message, 500, 'SERVICE_ERROR');
    this.name = 'ServiceError';
  }
}

export class NetworkError extends GraphError {
  constructor(message: string = 'Network request failed') {
    super(message, 0, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

export class TokenExpiredError extends GraphError {
  constructor(message: string = 'Session expired. Please reconnect your Microsoft account.') {
    super(message, 401, 'TOKEN_EXPIRED');
    this.name = 'TokenExpiredError';
  }
}

// ============================================================================
// Token Utilities
// ============================================================================

/**
 * Decode a JWT token to extract claims (without verification)
 */
export function decodeToken(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
}

/**
 * Get metadata from a token
 */
export function getTokenMetadata(token: string): TokenMetadata | null {
  const claims = decodeToken(token);
  if (!claims) return null;

  const expiresAt = new Date(claims.exp * 1000);
  const now = new Date();
  const expiresInMinutes = Math.round((expiresAt.getTime() - now.getTime()) / 60000);

  return {
    audience: claims.aud || 'unknown',
    issuer: claims.iss || 'unknown',
    scopes: claims.scp?.split(' ') || [],
    expiresAt,
    isExpired: expiresInMinutes <= 0,
    expiresInMinutes,
  };
}

// ============================================================================
// Token Management
// ============================================================================

/**
 * Get a valid access token, refreshing if necessary
 * @param forceRefresh - Force a token refresh even if current token is valid
 */
export async function getAccessToken(forceRefresh = false): Promise<string> {
  // First check stored response
  const storedResponse = getStoredMSALResponse();
  
  if (storedResponse?.accessToken && !forceRefresh) {
    const metadata = getTokenMetadata(storedResponse.accessToken);
    
    // If token is valid for more than 5 minutes, use it
    if (metadata && metadata.expiresInMinutes > 5) {
      console.log(`[Graph] Using cached token (expires in ${metadata.expiresInMinutes} min)`);
      return storedResponse.accessToken;
    }
    
    console.log('[Graph] Token expiring soon, refreshing...');
  }

  // Try silent token acquisition
  try {
    const silentResult = await acquireTokenSilently();
    if (silentResult?.accessToken) {
      console.log('[Graph] Got fresh token via silent refresh');
      return silentResult.accessToken;
    }
  } catch (error) {
    console.warn('[Graph] Silent token acquisition failed:', error);
  }

  // If we have a stored token (even if expiring), return it as last resort
  if (storedResponse?.accessToken) {
    console.warn('[Graph] Using potentially expired token as fallback');
    return storedResponse.accessToken;
  }

  throw new TokenExpiredError('Your Microsoft session has expired. Please reconnect your account to continue.');
}

// ============================================================================
// API Caller
// ============================================================================

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

interface CallOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  skipRetry?: boolean;
}

/**
 * Make an authenticated call to Microsoft Graph API
 * Automatically handles token refresh and retries on 401
 */
export async function callGraphAPI<T>(
  endpoint: string,
  options: CallOptions = {}
): Promise<T> {
  const { skipRetry = false, headers: customHeaders = {}, ...fetchOptions } = options;
  
  // Get access token
  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (error) {
    throw error;
  }

  // Build request URL
  const url = endpoint.startsWith('http') ? endpoint : `${GRAPH_BASE_URL}${endpoint}`;

  // Build headers
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  console.log(`[Graph] ${fetchOptions.method || 'GET'} ${endpoint}`);

  // Make the request
  let response: Response;
  try {
    response = await fetch(url, {
      ...fetchOptions,
      headers,
    });
  } catch (error) {
    console.error('[Graph] Network error:', error);
    throw new NetworkError('Failed to connect to Microsoft Graph. Please check your network connection.');
  }

  // Handle 401 - try refresh and retry once
  if (response.status === 401 && !skipRetry) {
    console.log('[Graph] Got 401, attempting token refresh and retry...');
    
    try {
      const freshToken = await getAccessToken(true);
      headers['Authorization'] = `Bearer ${freshToken}`;
      
      response = await fetch(url, {
        ...fetchOptions,
        headers,
      });
      
      if (response.status === 401) {
        throw new UnauthorizedError('Token refresh failed. Please sign in again.');
      }
    } catch (error) {
      if (error instanceof GraphError) throw error;
      throw new UnauthorizedError('Failed to refresh token. Please sign in again.');
    }
  }

  // Parse response
  const contentType = response.headers.get('content-type');
  let data: any;
  
  if (contentType?.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  // Handle error responses
  if (!response.ok) {
    const errorMessage = data?.error?.message || data?.message || `Request failed with status ${response.status}`;
    const errorCode = data?.error?.code;
    const requestId = response.headers.get('request-id') || undefined;

    console.error(`[Graph] Error ${response.status}:`, errorMessage);

    switch (response.status) {
      case 401:
        throw new UnauthorizedError(errorMessage);
      case 403:
        throw new ForbiddenError(errorMessage);
      case 404:
        throw new NotFoundError(errorMessage);
      case 500:
      case 502:
      case 503:
      case 504:
        throw new ServiceError(errorMessage);
      default:
        throw new GraphError(errorMessage, response.status, errorCode, requestId);
    }
  }

  console.log('[Graph] Request successful');
  return data as T;
}

// ============================================================================
// Microsoft Teams Types
// ============================================================================

export interface MicrosoftTeam {
  id: string;
  displayName: string;
  description?: string;
  visibility?: 'private' | 'public';
  webUrl?: string;
  isArchived?: boolean;
}

export interface TeamsListResponse {
  '@odata.context': string;
  '@odata.count'?: number;
  value: MicrosoftTeam[];
}

// ============================================================================
// Convenience Methods
// ============================================================================

/**
 * Get the current user's profile (GET /me)
 */
export async function getMyProfile(): Promise<GraphUser> {
  return callGraphAPI<GraphUser>('/me');
}

/**
 * Get the teams the current user has joined (GET /me/joinedTeams)
 * Requires Team.ReadBasic.All scope
 */
export async function getMyJoinedTeams(): Promise<MicrosoftTeam[]> {
  try {
    const response = await callGraphAPI<TeamsListResponse>('/me/joinedTeams');
    return response.value || [];
  } catch (error) {
    if (error instanceof ForbiddenError) {
      throw new ForbiddenError(
        'Missing Team.ReadBasic.All permission. Please reconnect your Microsoft account.'
      );
    }
    throw error;
  }
}

/**
 * Test Graph API connection and return detailed result
 */
export async function testGraphConnection(): Promise<{
  success: boolean;
  user?: GraphUser;
  tokenMetadata?: TokenMetadata;
  error?: string;
  errorType?: string;
}> {
  try {
    const token = await getAccessToken();
    const tokenMetadata = getTokenMetadata(token) || undefined;
    const user = await getMyProfile();
    
    return {
      success: true,
      user,
      tokenMetadata,
    };
  } catch (error) {
    console.error('[Graph] Connection test failed:', error);
    
    if (error instanceof GraphError) {
      return {
        success: false,
        error: error.message,
        errorType: error.name,
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      errorType: 'UnknownError',
    };
  }
}
