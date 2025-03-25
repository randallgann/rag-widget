import { generateCodeVerifier, generateCodeChallenge } from '../../../src/utils/pkceUtils';

describe('PKCE Utilities', () => {
  describe('generateCodeVerifier', () => {
    it('should generate a string of the specified length', () => {
      const verifier = generateCodeVerifier();
      expect(verifier).toBeTruthy();
      expect(typeof verifier).toBe('string');
      expect(verifier.length).toBe(43); // Default length
      
      const customVerifier = generateCodeVerifier(64);
      expect(customVerifier.length).toBe(64);
    });
    
    it('should generate a string with valid characters only', () => {
      const verifier = generateCodeVerifier();
      // PKCE spec requires code verifier to only use unreserved URL chars: A-Z, a-z, 0-9, '-', '.', '_', '~'
      expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
    });
    
    it('should generate a different string on each call', () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();
      expect(verifier1).not.toBe(verifier2);
    });
  });
  
  describe('generateCodeChallenge', () => {
    it('should generate a code challenge from a verifier using S256 method', () => {
      const verifier = 'test_verifier_string';
      const challenge = generateCodeChallenge(verifier);
      
      expect(challenge).toBeTruthy();
      expect(typeof challenge).toBe('string');
      
      // Should be a base64url encoded string
      expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
      
      // The challenge should not have any padding characters
      expect(challenge).not.toContain('=');
    });
    
    it('should generate a consistent challenge for the same verifier', () => {
      const verifier = 'consistent_verifier_string';
      const challenge1 = generateCodeChallenge(verifier);
      const challenge2 = generateCodeChallenge(verifier);
      
      expect(challenge1).toBe(challenge2);
    });
    
    it('should generate different challenges for different verifiers', () => {
      const verifier1 = 'verifier_one';
      const verifier2 = 'verifier_two';
      
      const challenge1 = generateCodeChallenge(verifier1);
      const challenge2 = generateCodeChallenge(verifier2);
      
      expect(challenge1).not.toBe(challenge2);
    });
  });
});