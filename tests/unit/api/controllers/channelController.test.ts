import { Request, Response } from 'express';
import { validateChannel } from '@/api/controllers/channelController';
import * as youtubeService from '@/services/youtube/fetcher';
import * as environment from '@/config/environment';

// Mock the YouTube service
jest.mock('@/services/youtube/fetcher');
jest.mock('@/config/environment', () => ({
  config: {
    youtube: {
      apiKey: 'test-api-key' // Default to having an API key
    }
  }
}));

const mockValidateYouTubeChannel = youtubeService.validateYouTubeChannel as jest.Mock;

describe('Channel Controller Unit Tests', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Reset the environment config mock to have an API key
    jest.mock('@/config/environment', () => ({
      config: {
        youtube: {
          apiKey: 'test-api-key'
        }
      }
    }));
    
    // Create mock request and response objects
    req = {
      body: {}
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });
  
  describe('validateChannel', () => {
    it('should return 400 if no channel identifier is provided', async () => {
      await validateChannel(req as Request, res as Response);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Channel identifier is required'
      });
    });
    
    it('should return channel data for a valid channel', async () => {
      // Mock a successful YouTube API response
      const mockChannel = {
        items: [{
          id: 'test-channel-id',
          snippet: {
            title: 'Test Channel',
            description: 'Test Description',
            thumbnails: {
              default: {
                url: 'https://example.com/thumbnail.jpg'
              }
            }
          },
          statistics: {
            viewCount: '1000',
            subscriberCount: '5000',
            videoCount: '42'
          }
        }]
      };
      
      mockValidateYouTubeChannel.mockResolvedValue(mockChannel);
      
      req.body = { channelIdentifier: '@TestChannel' };
      
      await validateChannel(req as Request, res as Response);
      
      expect(mockValidateYouTubeChannel).toHaveBeenCalledWith('@TestChannel', expect.any(String));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          channel: {
            id: 'test-channel-id',
            name: 'Test Channel',
            description: 'Test Description',
            thumbnailUrl: 'https://example.com/thumbnail.jpg',
            videoCount: 42,
            subscriberCount: '5000',
            viewCount: '1000'
          }
        }
      });
    });
    
    it('should return 404 when channel is not found', async () => {
      // Mock a response where no channel is found
      mockValidateYouTubeChannel.mockResolvedValue({ items: [] });
      
      req.body = { channelIdentifier: '@NonExistentChannel' };
      
      await validateChannel(req as Request, res as Response);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Channel not found'
      });
    });
    
    it('should return 500 when YouTube API call fails', async () => {
      // Mock a failed YouTube API call (could be API key error or any other error)
      mockValidateYouTubeChannel.mockRejectedValue(new Error('API error'));
      
      req.body = { channelIdentifier: '@TestChannel' };
      
      await validateChannel(req as Request, res as Response);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Failed to validate channel'
      });
    });
    
    it('should return 500 when API key is not configured', async () => {
      // Set up a test-specific mock for this one test
      const originalModule = jest.requireMock('@/config/environment');
      const mockModule = {
        ...originalModule,
        config: {
          ...originalModule.config,
          youtube: {
            apiKey: '' // Empty API key
          }
        }
      };
      
      // Replace the mock implementation just for this test
      jest.mock('@/config/environment', () => mockModule);
      
      // Re-import the controller to use the new mock
      jest.resetModules();
      const { validateChannel: testValidateChannel } = require('@/api/controllers/channelController');
      
      req.body = { channelIdentifier: '@TestChannel' };
      
      await testValidateChannel(req as Request, res as Response);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'YouTube API key is not configured on the server'
      });
    });
  });
});