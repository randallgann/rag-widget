/**
 * Generate user initials from a full name
 * @param name User's full name
 * @returns Up to 2 characters representing the user's initials
 */
export function generateInitials(name: string | null | undefined): string {
  if (!name) return '';
  
  const names = name.trim().split(/\s+/);
  
  if (names.length === 0) return '';
  
  if (names.length === 1) {
    // Just return the first 1-2 characters of the single name
    return names[0].substring(0, 2).toUpperCase();
  }
  
  // Get first character of first name and first character of last name
  return (names[0][0] + names[names.length - 1][0]).toUpperCase();
}

/**
 * Parse ISO 8601 duration format used by YouTube API
 * Converts strings like "PT1H2M3S" to seconds
 * 
 * @param duration ISO 8601 duration string (e.g., "PT1H2M3S")
 * @returns Total duration in seconds
 */
export function parseDuration(duration: string | null | undefined): number {
  // Default return if parsing fails
  if (!duration) return 0;
  
  try {
    // Remove the "PT" prefix
    const time = duration.substring(2);
    
    // Initialize variables
    let hours = 0;
    let minutes = 0;
    let seconds = 0;
    
    // Extract hours if present
    const hoursMatch = time.match(/(\d+)H/);
    if (hoursMatch) {
      hours = parseInt(hoursMatch[1], 10);
    }
    
    // Extract minutes if present
    const minutesMatch = time.match(/(\d+)M/);
    if (minutesMatch) {
      minutes = parseInt(minutesMatch[1], 10);
    }
    
    // Extract seconds if present
    const secondsMatch = time.match(/(\d+)S/);
    if (secondsMatch) {
      seconds = parseInt(secondsMatch[1], 10);
    }
    
    // Calculate total seconds
    return hours * 3600 + minutes * 60 + seconds;
  } catch (error) {
    console.error('Error parsing duration:', error);
    return 0;
  }
}