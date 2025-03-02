// Constants for Cognito
const COGNITO_CONFIG = {
  clientId: "CLIENT_ID", // Replace with your actual App Client ID
  userPoolId: "USER_POOL_ID", // Replace with your actual User Pool ID
  region: "REGION", // Replace with your actual region
  endpoint: "ENDPOINT" // Replace with your actual Cognito endpoint
};

/**
 * Authenticate with Cognito using username and password
 */
export async function authenticateUser(email, password, newPassword = null, session = null) {
  try {
    let response, authResult;
    
    // If this is a new password challenge response
    if (session && newPassword) {
      const challengeParams = {
        ChallengeName: "NEW_PASSWORD_REQUIRED",
        ClientId: COGNITO_CONFIG.clientId,
        ChallengeResponses: {
          USERNAME: email,
          NEW_PASSWORD: newPassword
        },
        Session: session
      };

      // Make request to respond to the challenge
      response = await fetch(`${COGNITO_CONFIG.endpoint}`, {
        method: 'POST',
        headers: {
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.RespondToAuthChallenge',
          'Content-Type': 'application/x-amz-json-1.1'
        },
        body: JSON.stringify(challengeParams)
      });
      
      authResult = await response.json();
      
      if (authResult.ChallengeName) {
        // If there's another challenge, throw an error for now
        throw new Error(`Additional challenge required: ${authResult.ChallengeName}`);
      }
    } else {
      // Step 1: Initialize the authentication
      const authParams = {
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: COGNITO_CONFIG.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      };

      // Step 2: Make the authentication request
      response = await fetch(`${COGNITO_CONFIG.endpoint}`, {
        method: 'POST',
        headers: {
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
          'Content-Type': 'application/x-amz-json-1.1'
        },
        body: JSON.stringify(authParams)
      });
      
      authResult = await response.json();
      
      // Check if NEW_PASSWORD_REQUIRED challenge is present
      if (authResult.ChallengeName === "NEW_PASSWORD_REQUIRED") {
        return {
          requiresNewPassword: true,
          session: authResult.Session,
          email: email
        };
      }
    }

    if (response.status !== 200) {
      throw new Error(authResult.message || 'Authentication failed');
    }

    // Step 3: Process and store tokens
    const tokens = {
      id_token: authResult.AuthenticationResult.IdToken,
      access_token: authResult.AuthenticationResult.AccessToken,
      refresh_token: authResult.AuthenticationResult.RefreshToken,
      expires_in: authResult.AuthenticationResult.ExpiresIn
    };

    // Store tokens in chrome storage
    await chrome.storage.local.set({ tokens });
    
    // Parse and return user info
    const userInfo = parseJwt(tokens.id_token);
    return { tokens, userInfo };
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
}

/**
 * Refresh authentication tokens
 */
export async function refreshTokens(refreshToken) {
  try {
    const refreshParams = {
      AuthFlow: "REFRESH_TOKEN_AUTH",
      ClientId: COGNITO_CONFIG.clientId,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken
      }
    };

    const response = await fetch(`${COGNITO_CONFIG.endpoint}`, {
      method: 'POST',
      headers: {
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
        'Content-Type': 'application/x-amz-json-1.1'
      },
      body: JSON.stringify(refreshParams)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Token refresh failed');
    }

    const result = await response.json();
    
    // Update stored tokens but keep the refresh token
    const tokens = {
      id_token: result.AuthenticationResult.IdToken,
      access_token: result.AuthenticationResult.AccessToken,
      refresh_token: refreshToken, // Keep the original refresh token
      expires_in: result.AuthenticationResult.ExpiresIn
    };

    await chrome.storage.local.set({ tokens });
    return tokens;
  } catch (error) {
    console.error('Token refresh error:', error);
    throw error;
  }
}

/**
 * Sign out user by clearing tokens
 */
export async function signOutUser() {
  try {
    // Simply remove tokens from storage
    await chrome.storage.local.remove('tokens');
    return true;
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}

/**
 * Parse JWT token to extract payload
 */
export function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error parsing JWT:', error);
    return null;
  }
}

/**
 * Check if the user is authenticated
 */
export async function isAuthenticated() {
  try {
    const data = await chrome.storage.local.get(['tokens']);
    if (data.tokens && data.tokens.id_token) {
      // Optionally validate token expiration here
      const payload = parseJwt(data.tokens.id_token);
      const currentTime = Math.floor(Date.now() / 1000);
      
      if (payload && payload.exp && payload.exp > currentTime) {
        return { isAuth: true, userInfo: payload };
      } else {
        // Token expired, try refresh if we have a refresh token
        if (data.tokens.refresh_token) {
          try {
            const newTokens = await refreshTokens(data.tokens.refresh_token);
            return { isAuth: true, userInfo: parseJwt(newTokens.id_token) };
          } catch (e) {
            // Refresh failed
            await signOutUser();
            return { isAuth: false };
          }
        }
      }
    }
    return { isAuth: false };
  } catch (error) {
    console.error('Auth check error:', error);
    return { isAuth: false };
  }
}