# Auth0 Setup Guide for RAG Widget

This guide explains how to set up and test Auth0 authentication with your RAG Widget application.

## Setting Up Auth0

1. **Create Auth0 Account and Tenant:**
   - Sign up for a free Auth0 account at [auth0.com](https://auth0.com)
   - Create a new tenant (or use the default one)

2. **Create a New Application:**
   - Go to Applications > Applications in the Auth0 dashboard
   - Click "Create Application"
   - Name it (e.g., "RAG Widget")
   - Select "Regular Web Application"
   - Click Create

3. **Configure Application Settings:**
   - In your application settings, configure these URLs:
     - Allowed Callback URLs: `http://localhost:3001/api/auth/callback`
     - Allowed Logout URLs: `http://localhost:3001`
     - Allowed Web Origins: `http://localhost:3001`
   - For production, add your production URLs as well
   - Scroll down and click "Save Changes"

4. **Get Auth0 Credentials:**
   - From the application settings, note these values:
     - Domain (e.g., `your-tenant.auth0.com`)
     - Client ID
     - Client Secret
   - These will be used in your application's environment variables

5. **Update Environment Variables:**
   - Create or update your `.env` file with these settings:
   ```
   AUTH0_DOMAIN=your-tenant.auth0.com
   AUTH0_CLIENT_ID=your-client-id
   AUTH0_CLIENT_SECRET=your-client-secret
   ```

## Creating Test Users

You have several options for test users:

1. **Create Database Users:**
   - Go to User Management > Users in the Auth0 dashboard
   - Click "Create User"
   - Enter email, password, and connection (use Username-Password-Authentication)
   - Click "Create"

2. **Enable Social Connections:**
   - Go to Authentication > Social in the Auth0 dashboard
   - Enable providers like Google, GitHub, or Microsoft
   - Configure them according to their documentation
   - This allows you to test social login

## Testing Authentication Flow

### Manual Testing

1. **Create a Simple Login Page:**
   - Create a basic HTML file with a login button:

```html
<!DOCTYPE html>
<html>
<head>
  <title>RAG Widget Login</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 40px; text-align: center; }
    .login-btn { background: #3498db; color: white; padding: 12px 24px; border: none; 
                border-radius: 4px; font-size: 16px; cursor: pointer; }
    .login-btn:hover { background: #2980b9; }
  </style>
</head>
<body>
  <h1>RAG Widget Admin Portal</h1>
  <p>Click the button below to log in with Auth0</p>
  
  <button class="login-btn" onclick="login()">Log In</button>

  <script>
    function login() {
      // Replace these values with your Auth0 credentials
      const domain = 'YOUR_AUTH0_DOMAIN';
      const clientId = 'YOUR_CLIENT_ID';
      const redirectUri = 'http://localhost:3001/api/auth/callback';
      
      // Generate a random state value for security
      const state = Math.random().toString(36).substring(2);
      localStorage.setItem('auth_state', state);
      
      // Build the Auth0 authorization URL
      const authUrl = `https://${domain}/authorize?` +
        `response_type=code&` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=openid%20profile%20email&` +
        `state=${state}`;
      
      // Redirect to Auth0 login page
      window.location.href = authUrl;
    }
  </script>
</body>
</html>
```

2. **Test the Authentication Flow:**
   - Open the login page in a browser
   - Click the login button
   - Log in with your test credentials on the Auth0 login page
   - You should be redirected to your application's callback URL
   - The application should process the authorization code and redirect to the dashboard
   - Verify that user information is displayed correctly

### Testing with Postman (For API Testing)

1. You can use Postman to test your authentication endpoints:
   - Create a new request to your callback URL with appropriate query parameters
   - Test the token validation endpoint with sample tokens
   - Test the user profile endpoint with valid authentication

## Troubleshooting

Common issues and their solutions:

1. **Callback URL Mismatch:**
   - Error: "Invalid redirect_uri"
   - Solution: Ensure the callback URL in your code exactly matches what's configured in Auth0

2. **CORS Issues:**
   - Error: Cross-Origin Request Blocked
   - Solution: Verify Allowed Web Origins in Auth0 settings includes your frontend URL

3. **Invalid Client Secret:**
   - Error: "Invalid client_secret"
   - Solution: Double-check your AUTH0_CLIENT_SECRET environment variable

4. **JWT Validation Errors:**
   - Error: "Invalid token"
   - Solution: Ensure you're using the correct Auth0 domain for validation

## Next Steps

After basic authentication is working:

1. **Implement Role-Based Access Control:**
   - Define roles in Auth0 (admin, user, etc.)
   - Assign roles to users
   - Create middleware to check for specific roles

2. **Add Multi-Factor Authentication:**
   - Enable MFA in Auth0 dashboard
   - Update your login flow to handle the additional authentication steps

3. **Customize Login Experience:**
   - Use Auth0's Universal Login customization
   - Or build a custom login form using Auth0's authorization endpoints

4. **Set Up Automated Testing:**
   - Unit tests with mocked Auth0 responses
   - Integration tests for the authentication flow
   - E2E tests with tools like Cypress or Playwright