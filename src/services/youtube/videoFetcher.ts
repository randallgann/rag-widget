import { YouTubeSearchListResponse, YouTubeVideoListResponse } from './types';
import fetch from 'node-fetch';

// Default API URL if not provided
const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

/**
 * Fetches videos from a YouTube channel
 * @param channelId YouTube channel ID 
 * @param apiKey YouTube API key
 * @param maxResults Maximum number of results to return (default 50)
 * @param pageToken Token for pagination
 * @param customFetch Optional fetch implementation
 * @returns List of videos from the channel or null if error
 */
export async function fetchChannelVideos(
  channelId: string,
  apiKey: string,
  maxResults = 50,
  pageToken?: string,
  customFetch = fetch
): Promise<YouTubeSearchListResponse | null> {
  try {
    // Use search endpoint to get videos from the channel
    const url = new URL(`${YOUTUBE_API_BASE_URL}/search`);
    url.searchParams.append('part', 'snippet');
    url.searchParams.append('channelId', channelId);
    url.searchParams.append('type', 'video');
    url.searchParams.append('maxResults', maxResults.toString());
    url.searchParams.append('order', 'date'); // Sort by upload date (newest first)
    url.searchParams.append('key', apiKey);
    
    if (pageToken) {
      url.searchParams.append('pageToken', pageToken);
    }

    const response = await customFetch(url.toString());
    if (!response.ok) {
      throw new Error(`Failed to fetch channel videos: ${response.statusText}`);
    }

    const data: YouTubeSearchListResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching channel videos:', error);
    return null;
  }
}

/**
 * Fetches detailed information for a list of video IDs
 * @param videoIds Array of YouTube video IDs
 * @param apiKey YouTube API key
 * @param customFetch Optional fetch implementation
 * @param batchSize Number of videos to fetch in each batch (max 50)
 * @returns Detailed video information or null if error
 */
export async function fetchVideoDetails(
  videoIds: string[],
  apiKey: string,
  customFetch = fetch,
  batchSize = 50
): Promise<YouTubeVideoListResponse | null> {
  try {
    if (!videoIds.length) {
      return null;
    }

    console.log(`Fetching details for ${videoIds.length} videos in batches of ${batchSize}`);
    
    // YouTube API has a limit of 50 videos per request, so we need to batch them
    const batches: string[][] = [];
    for (let i = 0; i < videoIds.length; i += batchSize) {
      batches.push(videoIds.slice(i, i + batchSize));
    }
    
    console.log(`Split into ${batches.length} batches`);
    
    // Process each batch and combine the results
    const allResults: YouTubeVideoListResponse = { 
      kind: 'youtube#videoListResponse',
      etag: '',
      items: [],
      pageInfo: { totalResults: 0, resultsPerPage: 0 }
    };
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i+1}/${batches.length} with ${batch.length} videos`);
      
      const url = new URL(`${YOUTUBE_API_BASE_URL}/videos`);
      url.searchParams.append('part', 'snippet,contentDetails,statistics');
      url.searchParams.append('id', batch.join(','));
      url.searchParams.append('key', apiKey);

      const response = await customFetch(url.toString());
      if (!response.ok) {
        console.error(`Failed to fetch batch ${i+1} with status ${response.status}: ${response.statusText}`);
        continue; // Skip this batch but continue with others
      }

      const batchData: YouTubeVideoListResponse = await response.json();
      
      if (batchData.items && batchData.items.length > 0) {
        console.log(`Received ${batchData.items.length} videos in batch ${i+1}`);
        allResults.items = [...allResults.items, ...batchData.items];
        allResults.pageInfo.totalResults += batchData.items.length;
      }
      
      // Add a short delay between batches to avoid rate limiting
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    console.log(`Total videos fetched: ${allResults.items.length}`);
    allResults.pageInfo.resultsPerPage = allResults.items.length;
    
    return allResults.items.length > 0 ? allResults : null;
  } catch (error) {
    console.error('Error fetching video details:', error);
    return null;
  }
}

/**
 * Extract video ID from a YouTube URL
 * @param url YouTube video URL
 * @returns Video ID or null if not found
 */
export function extractVideoId(url: string): string | null {
  try {
    const videoUrl = new URL(url);
    
    // youtube.com/watch?v=VIDEO_ID format
    if (videoUrl.hostname.includes('youtube.com') && videoUrl.pathname.includes('/watch')) {
      return videoUrl.searchParams.get('v');
    }
    
    // youtu.be/VIDEO_ID format
    if (videoUrl.hostname === 'youtu.be') {
      return videoUrl.pathname.substring(1);
    }
    
    // youtube.com/v/VIDEO_ID format
    if (videoUrl.hostname.includes('youtube.com') && videoUrl.pathname.startsWith('/v/')) {
      return videoUrl.pathname.split('/')[2];
    }
    
    // youtube.com/embed/VIDEO_ID format
    if (videoUrl.hostname.includes('youtube.com') && videoUrl.pathname.startsWith('/embed/')) {
      return videoUrl.pathname.split('/')[2];
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting video ID:', error);
    return null;
  }
}

/**
 * Process search results to extract video IDs
 * @param searchResults YouTube search results
 * @returns Array of video IDs
 */
export function extractVideoIdsFromSearchResults(searchResults: YouTubeSearchListResponse): string[] {
  console.log('Extracting video ids from search results.')
  if (!searchResults || !searchResults.items || searchResults.items.length === 0) {
    return [];
  }
  
  return searchResults.items
    .filter(item => item.id.videoId)
    .map(item => item.id.videoId as string);
}