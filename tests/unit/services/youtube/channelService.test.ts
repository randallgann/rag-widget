import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ChannelService } from '../../../../src/services/youtube/channelService';
import Channel from '../../../../src/db/models/Channel';
import Video from '../../../../src/db/models/Video';
import { fetchChannelVideos, fetchVideoDetails } from '../../../../src/services/youtube/videoFetcher';
import { mocked } from 'jest-mock';
import { 
  YouTubeSearchListResponse, 
  YouTubeVideoListResponse, 
  YouTubeSearchItem,
  YouTubeVideo
} from '../../../../src/services/youtube/types';

// Mock dependencies
jest.mock('../../../../src/db/models/Channel');
jest.mock('../../../../src/db/models/Video');
jest.mock('../../../../src/services/youtube/videoFetcher');

// Import the function we need to mock
import { extractVideoIdsFromSearchResults } from '../../../../src/services/youtube/videoFetcher';

// Create mocked versions of the dependencies
const mockedFetchChannelVideos = mocked(fetchChannelVideos);
const mockedFetchVideoDetails = mocked(fetchVideoDetails);
const mockedExtractVideoIds = mocked(extractVideoIdsFromSearchResults);
const mockedChannelCreate = mocked(Channel.create);
const mockedVideoBulkCreate = mocked(Video.bulkCreate);

describe('ChannelService', () => {
  // Sample test data
  const userId = 'test-user-id';
  const apiKey = 'test-api-key';
  const channelDetails = {
    id: 'channel-youtube-id',
    name: 'Test Channel',
    description: 'Channel description',
    thumbnailUrl: 'https://example.com/thumbnail.jpg',
    videoCount: 50,
    subscriberCount: '1000',
    viewCount: '5000'
  };

  // Mock video data
  const mockSearchResponse: YouTubeSearchListResponse = {
    kind: "youtube#searchListResponse",
    etag: "etag_value",
    pageInfo: {
      totalResults: 2,
      resultsPerPage: 2
    },
    items: [
      {
        kind: "youtube#searchResult",
        etag: "etag_search_1",
        id: {
          kind: "youtube#video",
          videoId: 'video1'
        },
        snippet: {
          publishedAt: '2023-01-01T00:00:00Z',
          channelId: 'channel-youtube-id',
          title: 'Video 1',
          description: 'Description 1',
          thumbnails: {
            default: {
              url: 'https://example.com/thumb1.jpg',
              width: 120,
              height: 90
            },
            medium: {
              url: 'https://example.com/thumb1_medium.jpg',
              width: 320,
              height: 180
            },
            high: {
              url: 'https://example.com/thumb1_high.jpg',
              width: 480,
              height: 360
            }
          },
          channelTitle: 'Test Channel',
          liveBroadcastContent: 'none',
          publishTime: '2023-01-01T00:00:00Z'
        }
      },
      {
        kind: "youtube#searchResult",
        etag: "etag_search_2",
        id: {
          kind: "youtube#video",
          videoId: 'video2'
        },
        snippet: {
          publishedAt: '2023-01-02T00:00:00Z',
          channelId: 'channel-youtube-id',
          title: 'Video 2',
          description: 'Description 2', 
          thumbnails: {
            default: {
              url: 'https://example.com/thumb2.jpg',
              width: 120,
              height: 90
            },
            medium: {
              url: 'https://example.com/thumb2_medium.jpg',
              width: 320,
              height: 180
            },
            high: {
              url: 'https://example.com/thumb2_high.jpg',
              width: 480,
              height: 360
            }
          },
          channelTitle: 'Test Channel',
          liveBroadcastContent: 'none',
          publishTime: '2023-01-02T00:00:00Z'
        }
      }
    ]
  };

  const mockVideoDetailsResponse: YouTubeVideoListResponse = {
    kind: "youtube#videoListResponse",
    etag: "etag_value",
    pageInfo: {
      totalResults: 2,
      resultsPerPage: 2
    },
    items: [
      {
        id: 'video1',
        snippet: {
          publishedAt: '2023-01-01T00:00:00Z',
          channelId: 'channel-youtube-id',
          title: 'Video 1 Full',
          description: 'Full description 1',
          thumbnails: {
            default: {
              url: 'https://example.com/thumb1.jpg',
              width: 120,
              height: 90
            },
            medium: {
              url: 'https://example.com/thumb1_medium.jpg',
              width: 320,
              height: 180
            },
            high: {
              url: 'https://example.com/thumb1_high.jpg',
              width: 480,
              height: 360
            }
          },
          channelTitle: 'Test Channel',
          tags: ['tag1', 'tag2'],
          categoryId: '22',
          liveBroadcastContent: 'none',
          localized: {
            title: 'Video 1 Full',
            description: 'Full description 1'
          }
        },
        contentDetails: {
          duration: 'PT10M30S',
          dimension: '2d',
          definition: 'hd',
          caption: 'false',
          licensedContent: true,
          projection: 'rectangular'
        },
        statistics: {
          viewCount: '1000',
          likeCount: '100',
          favoriteCount: '0',
          commentCount: '50'
        }
      },
      {
        id: 'video2',
        snippet: {
          publishedAt: '2023-01-02T00:00:00Z',
          channelId: 'channel-youtube-id',
          title: 'Video 2 Full',
          description: 'Full description 2',
          thumbnails: {
            default: {
              url: 'https://example.com/thumb2.jpg',
              width: 120,
              height: 90
            },
            medium: {
              url: 'https://example.com/thumb2_medium.jpg',
              width: 320,
              height: 180
            },
            high: {
              url: 'https://example.com/thumb2_high.jpg',
              width: 480,
              height: 360
            }
          },
          channelTitle: 'Test Channel',
          categoryId: '22',
          liveBroadcastContent: 'none',
          localized: {
            title: 'Video 2 Full',
            description: 'Full description 2'
          }
        },
        contentDetails: {
          duration: 'PT5M15S',
          dimension: '2d',
          definition: 'hd',
          caption: 'false',
          licensedContent: true,
          projection: 'rectangular'
        },
        statistics: {
          viewCount: '2000',
          likeCount: '200',
          favoriteCount: '0',
          commentCount: '75'
        }
      }
    ]
  };

  let channelService: ChannelService;

  beforeEach(() => {
    // Reset mocks
    jest.resetAllMocks();

    // Mock implementation of fetchChannelVideos
    mockedFetchChannelVideos.mockResolvedValue(mockSearchResponse);
    mockedFetchVideoDetails.mockResolvedValue(mockVideoDetailsResponse);
    
    // Mock implementation of extractVideoIdsFromSearchResults
    mockedExtractVideoIds.mockImplementation((searchResults) => {
      return searchResults.items
        .filter(item => item.id && item.id.videoId)
        .map(item => item.id.videoId as string);
    });

    // Mock Channel.create to return a channel with an ID
    mockedChannelCreate.mockResolvedValue({
        ...channelDetails,
        id: 'db-channel-id'
    });

    // Mock Video.bulkCreate to return the created videos
    mockedVideoBulkCreate.mockResolvedValue([
      { id: 'db-video-id-1', youtubeId: 'video1' } as unknown as Video,
      { id: 'db-video-id-2', youtubeId: 'video2' } as unknown as Video
    ]);

    // Instantiate the service
    channelService = new ChannelService();
  });

  describe('createChannelWithMetadata', () => {
    it('should create a channel in the database', async () => {
      await channelService.createChannelWithMetadata(channelDetails, userId, apiKey);

      // Verify Channel.create was called with the right arguments
      expect(Channel.create).toHaveBeenCalledWith({
        name: channelDetails.name,
        description: channelDetails.description,
        userId: userId,
        config: expect.objectContaining({
          youtubeChannelId: channelDetails.id,
          thumbnailUrl: channelDetails.thumbnailUrl,
          processingStatus: 'idle',
          totalProcessed: 0,
          videoCount: channelDetails.videoCount,
        }),
        status: 'active',   
      });
    });

    it('should fetch videos from YouTube API', async () => {
      await channelService.createChannelWithMetadata(channelDetails, userId, apiKey);

      // Verify fetchChannelVideos was called
      expect(fetchChannelVideos).toHaveBeenCalledWith(
        channelDetails.id,
        apiKey,
        50, // Default maxResults
        undefined // No page token for first page
      );
    });

    it('should fetch video details for all retrieved videos', async () => {
      await channelService.createChannelWithMetadata(channelDetails, userId, apiKey);

      // Verify fetchVideoDetails was called with the right video IDs
      expect(fetchVideoDetails).toHaveBeenCalledWith(
        ['video1', 'video2'], // Video IDs from search results
        apiKey
      );
    });

    it('should store all video metadata in the database', async () => {
      // Call the method and store the result to check it
      const result = await channelService.createChannelWithMetadata(channelDetails, userId, apiKey);

      // Get the channel ID from the mock Channel.create response
      //const dbChannelId = mockedChannelCreate.mock.results[0].value.id;

      // Verify Video.bulkCreate was called with the right arguments
      expect(Video.bulkCreate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            youtubeId: 'video1',
            title: 'Video 1 Full',
            channelId: 'db-channel-id',
            description: 'Full description 1',
            thumbnailUrl: expect.any(String),
            status: 'active',
            processingError: null,
            processingStatus: 'pending',
            selectedForProcessing: false,
            publishedAt: expect.any(Date),
            duration: 'PT10M30S',
            durationSeconds: 630, // 10*60 + 30
            viewCount: 1000,
            likeCount: 100,
            processingProgress: 0
          }),
          expect.objectContaining({
            youtubeId: 'video2',
            title: 'Video 2 Full',
            channelId: 'db-channel-id',
            description: 'Full description 2',
            thumbnailUrl: expect.any(String),
            status: 'active',
            processingStatus: 'pending',
            processingError: null,
            selectedForProcessing: false,
            publishedAt: expect.any(Date),
            duration: 'PT5M15S',
            durationSeconds: 315, // 5*60 + 15
            viewCount: 2000,
            likeCount: 200,
            processingProgress: 0
          })
        ])
      );
    });

    it('should handle empty video results', async () => {
      // Mock empty video results
      const emptyResponse: YouTubeSearchListResponse = {
        kind: "youtube#searchListResponse",
        etag: "empty_etag",
        pageInfo: {
          totalResults: 0,
          resultsPerPage: 0
        },
        items: []
      };
      
      mockedFetchChannelVideos.mockResolvedValue(emptyResponse);
      
      // Make sure the extract function returns an empty array for empty results
      mockedExtractVideoIds.mockReturnValue([]);

      await channelService.createChannelWithMetadata(channelDetails, userId, apiKey);

      // Verify extractVideoIdsFromSearchResults was called once
      expect(extractVideoIdsFromSearchResults).toHaveBeenCalledTimes(1);
      expect(extractVideoIdsFromSearchResults).toHaveBeenCalledWith(emptyResponse);

      // Verify fetchVideoDetails was not called
      expect(fetchVideoDetails).not.toHaveBeenCalled();

      // Verify Video.bulkCreate was called with an empty array
      // This doesn't get called if there are not videos - the code returns the Channel
      //expect(Video.bulkCreate).toHaveBeenCalledWith([]);
    });

    it('should handle pagination for channels with many videos', async () => {
      // Mock pagination in search results
      const firstPageResults: YouTubeSearchListResponse = {
        ...mockSearchResponse,
        nextPageToken: 'next-page-token'
      };
      
      const secondPageResults: YouTubeSearchListResponse = {
        kind: "youtube#searchListResponse",
        etag: "etag_value_page2",
        pageInfo: {
          totalResults: 1,
          resultsPerPage: 1
        },
        items: [
          {
            kind: "youtube#searchResult",
            etag: "etag_search_3",
            id: {
              kind: "youtube#video",
              videoId: 'video3'
            },
            snippet: {
              publishedAt: '2023-01-03T00:00:00Z',
              channelId: 'channel-youtube-id',
              title: 'Video 3',
              description: 'Description 3',
              thumbnails: {
                default: {
                  url: 'https://example.com/thumb3.jpg',
                  width: 120,
                  height: 90
                },
                medium: {
                  url: 'https://example.com/thumb3_medium.jpg',
                  width: 320,
                  height: 180
                },
                high: {
                  url: 'https://example.com/thumb3_high.jpg',
                  width: 480,
                  height: 360
                }
              },
              channelTitle: 'Test Channel',
              liveBroadcastContent: 'none',
              publishTime: '2023-01-03T00:00:00Z'
            }
          }
        ]
      };

      // Update mock implementations for this test case
      mockedFetchChannelVideos
        .mockResolvedValueOnce(firstPageResults)
        .mockResolvedValueOnce(secondPageResults);
      
      // Make sure the extract function is called with the correct results
      mockedExtractVideoIds
        .mockImplementationOnce((results) => ['video1', 'video2']) // First page result
        .mockImplementationOnce((results) => ['video3']);          // Second page result

      // Add third video to the mock video details response
      const extendedVideoDetailsResponse = {
        ...mockVideoDetailsResponse,
        items: [
          ...mockVideoDetailsResponse.items,
          {
            id: 'video3',
            snippet: {
              publishedAt: '2023-01-03T00:00:00Z',
              channelId: 'channel-youtube-id',
              title: 'Video 3 Full',
              description: 'Full description 3',
              thumbnails: {
                default: {
                  url: 'https://example.com/thumb3.jpg',
                  width: 120,
                  height: 90
                },
                medium: {
                  url: 'https://example.com/thumb3_medium.jpg',
                  width: 320,
                  height: 180
                },
                high: {
                  url: 'https://example.com/thumb3_high.jpg',
                  width: 480,
                  height: 360
                }
              },
              channelTitle: 'Test Channel',
              categoryId: '22',
              liveBroadcastContent: 'none',
              localized: {
                title: 'Video 3 Full',
                description: 'Full description 3'
              }
            },
            contentDetails: {
              duration: 'PT3M15S',
              dimension: '2d',
              definition: 'hd',
              caption: 'false',
              licensedContent: true,
              projection: 'rectangular'
            },
            statistics: {
              viewCount: '3000',
              likeCount: '300',
              favoriteCount: '0',
              commentCount: '100'
            }
          }
        ]
      };
      
      mockedFetchVideoDetails.mockResolvedValue(extendedVideoDetailsResponse);

      await channelService.createChannelWithMetadata(channelDetails, userId, apiKey);

      // Verify fetchChannelVideos was called twice, second time with page token
      expect(fetchChannelVideos).toHaveBeenCalledTimes(2);
      expect(fetchChannelVideos).toHaveBeenNthCalledWith(
        2,
        channelDetails.id,
        apiKey,
        50,
        'next-page-token'
      );

      // Verify extractVideoIdsFromSearchResults was called for both pages
      expect(extractVideoIdsFromSearchResults).toHaveBeenCalledTimes(2);

      // Verify fetchVideoDetails was called with all video IDs
      expect(fetchVideoDetails).toHaveBeenCalledWith(
        expect.arrayContaining(['video1', 'video2', 'video3']),
        apiKey
      );
    });

    it('should update channel with metadata fetch timestamp', async () => {
      // Mock Channel.update
      const mockedChannelUpdate = mocked(Channel.update);
      mockedChannelUpdate.mockResolvedValue([1]); // Typically returns number of rows updated

      await channelService.createChannelWithMetadata(channelDetails, userId, apiKey);

      // Get the channel ID from the mock Channel.create response
      //const dbChannelId = mockedChannelCreate.mock.results[0].value.id;

      // Verify Channel.update was called to update the timestamp
      expect(Channel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          updatedAt: expect.any(Date)
        }),
        {
          where: { id: 'db-channel-id' }
        }
      );
    });
  });
});