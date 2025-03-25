import { describe, it, expect } from '@jest/globals';
import { generateInitials, parseDuration } from '../../../src/utils/helpers';

describe('Helper functions', () => {
  describe('generateInitials', () => {
    it('should return empty string for null or undefined', () => {
      expect(generateInitials(null)).toBe('');
      expect(generateInitials(undefined)).toBe('');
    });

    it('should return up to two characters for a single name', () => {
      expect(generateInitials('John')).toBe('JO');
      expect(generateInitials('J')).toBe('J');
    });

    it('should return first letter of first and last name', () => {
      expect(generateInitials('John Doe')).toBe('JD');
      expect(generateInitials('John James Doe')).toBe('JD');
    });

    it('should handle whitespace correctly', () => {
      expect(generateInitials('   John   Doe   ')).toBe('JD');
    });

    it('should return uppercase letters', () => {
      expect(generateInitials('john doe')).toBe('JD');
    });
  });
  
  describe('parseDuration', () => {
    it('should return 0 for empty or invalid input', () => {
      expect(parseDuration('')).toBe(0);
      expect(parseDuration(null)).toBe(0);
      expect(parseDuration(undefined)).toBe(0);
      expect(parseDuration('invalid')).toBe(0);
    });
    
    it('should parse hours correctly', () => {
      expect(parseDuration('PT1H')).toBe(3600);
      expect(parseDuration('PT2H')).toBe(7200);
    });
    
    it('should parse minutes correctly', () => {
      expect(parseDuration('PT1M')).toBe(60);
      expect(parseDuration('PT30M')).toBe(1800);
    });
    
    it('should parse seconds correctly', () => {
      expect(parseDuration('PT15S')).toBe(15);
      expect(parseDuration('PT45S')).toBe(45);
    });
    
    it('should parse combined duration correctly', () => {
      expect(parseDuration('PT1H30M')).toBe(5400);
      expect(parseDuration('PT1H30M15S')).toBe(5415);
      expect(parseDuration('PT2H5S')).toBe(7205);
      expect(parseDuration('PT10M30S')).toBe(630);
    });
    
    it('should handle unusual but valid formats', () => {
      expect(parseDuration('PT0H0M0S')).toBe(0);
      expect(parseDuration('PT61M61S')).toBe(3721); // 61 minutes and 61 seconds
      expect(parseDuration('P0DT1H30M15S')).toBe(5415); // With day component
    });
  });
});