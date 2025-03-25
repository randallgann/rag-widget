# Security Best Practices

This document outlines security best practices for the YouTube RAG Widget platform. Following these guidelines will help ensure the security of user data, API endpoints, and application functionality.

## Authentication & Authorization

### Token Handling

- **Avoid URL Fragments for Tokens**: Never pass tokens in URL fragments or query parameters
- **Secure Storage**: 
  - Store access tokens only in memory (React state/context)
  - Store refresh tokens in HttpOnly, Secure, SameSite=Strict cookies
  - Never store tokens in localStorage or sessionStorage
- **Token Validation**: Thoroughly validate all aspects of tokens (signature, expiration, issuer, audience, scope)
- **Implement Token Refresh**: Use refresh tokens to obtain new access tokens without requiring re-authentication
- **Short Lifetimes**: Keep access token lifetimes short (15-60 minutes)

### Auth0 Configuration

- **Use PKCE**: Always enable PKCE (Proof Key for Code Exchange) for public clients
- **Implement JWKs**: Use JSON Web Key Sets for signature verification
- **Limit Token Scope**: Apply the principle of least privilege when requesting token scopes
- **Set Proper Callback URLs**: Strictly define allowed callback URLs in Auth0 settings
- **Enable MFA**: Encourage or require multi-factor authentication for admin accounts

## API Security

### CORS Configuration

```javascript
// Example of secure CORS configuration
const corsOptions = {
  origin: [
    process.env.ADMIN_PORTAL_URL,
    process.env.WIDGET_DOMAIN
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  credentials: true,
  maxAge: 86400
};
app.use(cors(corsOptions));
```

### CSRF Protection

- **Use CSRF Tokens**: Generate and validate tokens for state-changing operations
- **SameSite Cookies**: Set cookies with SameSite=Strict or SameSite=Lax
- **Custom Headers**: Require custom headers for API requests that change state

### Rate Limiting

```javascript
// Example rate limiting middleware
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, IP otherwise
    return req.auth?.sub || req.ip;
  }
});
```

## Data Protection

### Environment Variables

- **Secure Storage**: Use a secure method for storing environment variables
- **Separate Environments**: Maintain separate configurations for development, testing, and production
- **Secrets Rotation**: Regularly rotate API keys and secrets

### Sensitive Data Handling

- **Data Encryption**: Encrypt sensitive data at rest and in transit
- **PII Minimization**: Collect and store only necessary personally identifiable information
- **Logging Practices**: Never log sensitive information, tokens, or credentials

## Frontend Security

### XSS Prevention

- **Content Security Policy**: Implement a strict CSP to prevent XSS attacks
- **Input Sanitization**: Sanitize user inputs before rendering
- **Output Encoding**: Encode output to prevent script execution

```javascript
// Example CSP middleware
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; object-src 'none'; upgrade-insecure-requests;"
  );
  next();
});
```

### Secure Embedding

- **Frame Protection**: Configure X-Frame-Options to prevent clickjacking
- **Subresource Integrity**: Use SRI for embedded scripts
- **HTTPS Only**: Ensure the widget only loads over HTTPS

## Infrastructure Security

### HTTP Security Headers

```javascript
// Example security headers middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://i.ytimg.com"],
      connectSrc: ["'self'", "https://api.example.com"]
    }
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true }
}));
```

### Database Security

- **Connection Encryption**: Use SSL/TLS for database connections
- **Least Privilege**: Use database users with minimum required permissions
- **Query Parameterization**: Use parameterized queries to prevent SQL injection
- **Backup Encryption**: Encrypt database backups

## Vulnerability Management

### Dependency Scanning

- **Regular Updates**: Keep dependencies updated to patch security vulnerabilities
- **Vulnerability Scanning**: Use tools like npm audit, Snyk, or Dependabot
- **Lock Files**: Commit package lock files to ensure consistent dependency resolution

### Security Testing

- **SAST**: Implement Static Application Security Testing in CI/CD pipeline
- **DAST**: Regularly perform Dynamic Application Security Testing
- **Penetration Testing**: Conduct periodic penetration tests

## Incident Response

### Monitoring & Logging

- **Centralized Logging**: Implement centralized, secure logging
- **Anomaly Detection**: Set up alerts for suspicious activities
- **Audit Trail**: Maintain an audit trail of security-relevant events

### Response Plan

1. **Identification**: Quickly identify and classify security incidents
2. **Containment**: Limit the damage of an active incident
3. **Eradication**: Remove the cause of the incident
4. **Recovery**: Restore systems to normal operation
5. **Lessons Learned**: Review and improve security measures

## Compliance Considerations

- **Data Privacy**: Ensure compliance with GDPR, CCPA, or other applicable regulations
- **Data Retention**: Implement appropriate data retention and deletion policies
- **Terms of Service**: Clearly document security practices in terms of service and privacy policy