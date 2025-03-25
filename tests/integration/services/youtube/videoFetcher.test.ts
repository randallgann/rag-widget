import {
  fetchChannelVideos,
  fetchVideoDetails,
  extractVideoId,
  extractVideoIdsFromSearchResults
} from '../../../../src/services/youtube/videoFetcher';
import { config } from '../../../../src/config/environment';
import { YouTubeSearchListResponse, YouTubeVideoListResponse } from '../../../../src/services/youtube/types';

// Import the actual node-fetch type
import fetch, { RequestInfo, RequestInit, Response } from 'node-fetch';

// Create a type for a function compatible with the fetch API signature
type FetchLike = (url: RequestInfo, init?: RequestInit) => Promise<Response>;

// Mock fetch implementation for testing
//const mockFetch = jest.fn() as jest.MockedFunction<FetchLike>;

//const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('YouTube Video Fetcher', () => {
  let apiKey: string = '';

  beforeAll(() => {
    // Get API key from environment or use a test key
    apiKey = config.youtube?.apiKey || 'TEST_API_KEY';
    console.log('Using API key:', apiKey ? apiKey : 'No API key available');
  });

//   beforeEach(() => {
//     mockFetch.mockClear();
//   });

  describe('extractVideoId', () => {
    it('should extract video ID from youtube.com/watch URL', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      expect(extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from youtu.be URL', () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ';
      expect(extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from youtube.com/embed URL', () => {
      const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
      expect(extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from youtube.com/v URL', () => {
      const url = 'https://www.youtube.com/v/dQw4w9WgXcQ';
      expect(extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    it('should return null for invalid URLs', () => {
      const url = 'https://example.com';
      expect(extractVideoId(url)).toBeNull();
    });
  });

  describe('extractVideoIdsFromSearchResults', () => {
    it('should extract video IDs from search results', () => {
      const mockSearchResults: YouTubeSearchListResponse = {
        kind: 'youtube#searchListResponse',
        etag: 'etag',
        pageInfo: {
          totalResults: 2,
          resultsPerPage: 2
        },
        items: [
          {
            kind: 'youtube#searchResult',
            etag: 'etag1',
            id: {
              kind: 'youtube#video',
              videoId: 'video1'
            },
            snippet: {
              publishedAt: '2021-01-01T00:00:00Z',
              channelId: 'channel1',
              title: 'Video 1',
              description: 'Description 1',
              thumbnails: {
                default: {
                  url: 'https://example.com/1.jpg',
                  width: 120,
                  height: 90
                },
                medium: {
                  url: 'https://example.com/1_medium.jpg',
                  width: 320,
                  height: 180
                },
                high: {
                  url: 'https://example.com/1_high.jpg',
                  width: 480,
                  height: 360
                }
              },
              channelTitle: 'Channel 1',
              liveBroadcastContent: 'none',
              publishTime: '2021-01-01T00:00:00Z'
            }
          },
          {
            kind: 'youtube#searchResult',
            etag: 'etag2',
            id: {
              kind: 'youtube#video',
              videoId: 'video2'
            },
            snippet: {
              publishedAt: '2021-01-02T00:00:00Z',
              channelId: 'channel1',
              title: 'Video 2',
              description: 'Description 2',
              thumbnails: {
                default: {
                  url: 'https://example.com/2.jpg',
                  width: 120,
                  height: 90
                },
                medium: {
                  url: 'https://example.com/2_medium.jpg',
                  width: 320,
                  height: 180
                },
                high: {
                  url: 'https://example.com/2_high.jpg',
                  width: 480,
                  height: 360
                }
              },
              channelTitle: 'Channel 1',
              liveBroadcastContent: 'none',
              publishTime: '2021-01-02T00:00:00Z'
            }
          }
        ]
      };

      const videoIds = extractVideoIdsFromSearchResults(mockSearchResults);
      expect(videoIds).toEqual(['video1', 'video2']);
    });

    it('should return empty array for empty results', () => {
      const emptyResults: YouTubeSearchListResponse = {
        kind: 'youtube#searchListResponse',
        etag: 'etag',
        pageInfo: {
          totalResults: 0,
          resultsPerPage: 0
        },
        items: []
      };

      const videoIds = extractVideoIdsFromSearchResults(emptyResults);
      expect(videoIds).toEqual([]);
    });
  });

  // These tests require a real API key to run
  describe('API integration', () => {
    // Use a real, public YouTube channel ID for testing
    // Google Developers is a good choice as it's public and has many videos
    const testChannelId = 'UC_x5XG1OV2P6uZZ5FSM9Ttw'; // Google Developers channel

    it('should fetch videos from a channel and log the response structure', async () => {
      // Only run test if we have an API key
      if (!apiKey) {
        console.log('Skipping API test - no API key available');
        return;
      }

      const response = await fetchChannelVideos(
        testChannelId,
        apiKey,
        5 // Just fetch a few videos
      );

      // Log the response structure to help with debugging and understanding
      console.log('Channel videos response structure:');
      console.log(JSON.stringify({
        kind: response?.kind,
        etag: response?.etag,
        pageInfo: response?.pageInfo,
        nextPageToken: response?.nextPageToken,
        itemsCount: response?.items?.length,
        firstItem: response?.items?.[0] ? {
          kind: response.items[0].kind,
          id: response.items[0].id,
          snippet: {
            title: response.items[0].snippet.title,
            publishedAt: response.items[0].snippet.publishedAt,
            // Just log a subset for clarity
          }
        } : null
      }, null, 2));

      expect(response).not.toBeNull();
      expect(response?.items?.length).toBeGreaterThan(0);
    });

    it('should fetch video details and log the response structure', async () => {
      // Only run test if we have an API key
      if (!apiKey) {
        console.log('Skipping API test - no API key available');
        return;
      }

      // First, get video IDs from the channel
      const channelVideos = await fetchChannelVideos(
        testChannelId,
        apiKey,
        2 // Just fetch a couple videos
      );

      const videoIds = extractVideoIdsFromSearchResults(channelVideos!);
      expect(videoIds.length).toBeGreaterThan(0);

      // Then fetch details for those videos
      const videoDetails = await fetchVideoDetails(videoIds, apiKey);

      // Log the response structure to help with debugging and understanding
      console.log('Video details response structure:');
      console.log(JSON.stringify({
        kind: videoDetails?.kind,
        etag: videoDetails?.etag,
        pageInfo: videoDetails?.pageInfo,
        itemsCount: videoDetails?.items?.length,
        firstItem: videoDetails?.items?.[0] ? {
          id: videoDetails.items[0].id,
          snippet: {
            title: videoDetails.items[0].snippet.title,
            description: videoDetails.items[0].snippet.description.substring(0, 100) + '...',
            // Just log a subset for clarity
          },
          contentDetails: {
            duration: videoDetails.items[0].contentDetails.duration,
            // Add more fields as needed
          },
          statistics: {
            viewCount: videoDetails.items[0].statistics.viewCount,
            likeCount: videoDetails.items[0].statistics.likeCount,
            // Add more fields as needed
          }
        } : null
      }, null, 2));

      expect(videoDetails).not.toBeNull();
      expect(videoDetails?.items?.length).toBeGreaterThan(0);
    });
  });

//   describe('Mock API tests', () => {
//     // Create a simpler mock response that works with the tests
//     const mockResponse = (status: number, data: any) => {
//       // Create a simplified response with just the properties we need
//       const response = {
//         ok: status >= 200 && status < 300,
//         status,
//         statusText: status === 200 ? 'OK' : 'Error',
//         json: () => Promise.resolve(data)
//       };
      
//       // Cast to any first to avoid type errors
//       return Promise.resolve(response as any as Response);
//     };

//     // Our mockFetch is already properly typed

//     it('should handle channel videos fetch failure', async () => {
//       mockFetch.mockImplementation((_url: RequestInfo, _init?: RequestInit) => mockResponse(400, { error: 'Bad request' }));

//       const result = await fetchChannelVideos('invalid-channel', 'invalid-key', 10, undefined, mockFetch);
//       expect(result).toBeNull();
//     });

//     it('should handle video details fetch failure', async () => {
//       mockFetch.mockImplementation((_url: RequestInfo, _init?: RequestInit) => mockResponse(400, { error: 'Bad request' }));

//       const result = await fetchVideoDetails(['invalid-video'], 'invalid-key', mockFetch);
//       expect(result).toBeNull();
//     });

//     it('should return null when no video IDs are provided', async () => {
//       const result = await fetchVideoDetails([], 'test-key', mockFetch);
//       expect(result).toBeNull();
//       expect(mockFetch).not.toHaveBeenCalled();
//     });
//   });
});