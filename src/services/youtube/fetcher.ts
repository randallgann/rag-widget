import { YouTubeChannelListResponse, YouTubeSearchListResponse } from './types';
import fetch from 'node-fetch';

// Default API URL if not provided
const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

/**
 * Extract a channel identifier from various YouTube URL formats
 * @param input The URL or handle to extract from
 * @returns The extracted channel identifier
 */
export function extractChannelIdentifier(input: string): string {
  // Remove whitespace
  const trimmedInput = input.trim();
  
  try {
    // Check if it's a URL
    if (trimmedInput.includes('youtube.com') || trimmedInput.includes('youtu.be')) {
      try {
        const url = new URL(trimmedInput);
        
        // Handle /channel/ID format
        if (url.pathname.includes('/channel/')) {
          const match = url.pathname.match(/\/channel\/([^/]+)/);
          if (match && match[1]) return match[1];
        }
        
        // Handle /c/NAME format
        if (url.pathname.includes('/c/')) {
          const match = url.pathname.match(/\/c\/([^/]+)/);
          if (match && match[1]) return match[1];
        }
        
        // Handle /user/NAME format
        if (url.pathname.includes('/user/')) {
          const match = url.pathname.match(/\/user\/([^/]+)/);
          if (match && match[1]) return match[1];
        }
        
        // Handle /@handle format
        if (url.pathname.includes('/@')) {
          const match = url.pathname.match(/\/@([^/]+)/);
          if (match && match[1]) return match[1];
        }
      } catch (urlError) {
        // URL parsing failed, continue with original input
      }
    }
    
    // Handle @handle format (not a URL)
    if (trimmedInput.startsWith('@')) {
      return trimmedInput.substring(1);
    }
    
    // Return as-is for channel IDs or other formats
    return trimmedInput;
  } catch (error) {
    console.error('Error extracting channel identifier:', error);
    return trimmedInput;
  }
}

/**
 * Validates a YouTube channel by ID, handle, or custom URL
 * @param channelIdentifier Channel ID, handle, or custom URL
 * @param apiKey YouTube API key
 * @param fetch Optional fetch implementation
 * @returns The validated channel data or null if not found
 */
export async function validateYouTubeChannel(
  channelIdentifier: string,
  apiKey: string,
  customFetch = fetch
): Promise<YouTubeChannelListResponse | null> {
  try {
    // Extract clean identifier from URL or handle
    const cleanIdentifier = extractChannelIdentifier(channelIdentifier);
    
    // Try direct channel ID lookup first
    const channelResponse = await fetchChannelById(cleanIdentifier, apiKey, customFetch);
    if (channelResponse && channelResponse.items && channelResponse.items.length > 0) {
      return channelResponse;
    }

    // If direct lookup fails, try searching for the channel
    const searchResponse = await searchForChannel(cleanIdentifier, apiKey, customFetch);
    if (searchResponse && searchResponse.items && searchResponse.items.length > 0) {
      // Get the first result's channel ID
      const channelId = searchResponse.items[0].id.channelId;
      if (channelId) {
        // Look up the full channel details
        return await fetchChannelById(channelId, apiKey, customFetch);
      }
    }

    return null;
  } catch (error) {
    console.error('Error validating YouTube channel:', error);
    return null;
  }
}

/**
 * Fetches a YouTube channel by ID
 * @param channelId Channel ID
 * @param apiKey YouTube API key
 * @param fetch Optional fetch implementation
 * @returns Channel data or null if not found
 */
export async function fetchChannelById(
  channelId: string,
  apiKey: string,
  customFetch = fetch
): Promise<YouTubeChannelListResponse | null> {
  try {
    const url = new URL(`${YOUTUBE_API_BASE_URL}/channels`);
    url.searchParams.append('part', 'snippet,statistics');
    url.searchParams.append('id', channelId);
    url.searchParams.append('key', apiKey);

    const response = await customFetch(url.toString());
    if (!response.ok) {
      throw new Error(`Failed to fetch channel: ${response.statusText}`);
    }

    const data: YouTubeChannelListResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching channel by ID:', error);
    return null;
  }
}

/**
 * Searches for a YouTube channel by handle or custom URL
 * @param query Channel handle or custom URL
 * @param apiKey YouTube API key
 * @param fetch Optional fetch implementation
 * @returns Search results or null if error
 */
export async function searchForChannel(
  query: string,
  apiKey: string,
  customFetch = fetch
): Promise<YouTubeSearchListResponse | null> {
  try {
    // Clean up the query (remove @ symbol if present)
    const cleanQuery = query.startsWith('@') ? query.substring(1) : query;
    
    const url = new URL(`${YOUTUBE_API_BASE_URL}/search`);
    url.searchParams.append('part', 'snippet');
    url.searchParams.append('q', cleanQuery);
    url.searchParams.append('type', 'channel');
    url.searchParams.append('maxResults', '1');
    url.searchParams.append('key', apiKey);

    const response = await customFetch(url.toString());
    if (!response.ok) {
      throw new Error(`Failed to search for channel: ${response.statusText}`);
    }

    const data: YouTubeSearchListResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error searching for channel:', error);
    return null;
  }
}