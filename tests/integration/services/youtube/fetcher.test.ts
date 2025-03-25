import { validateYouTubeChannel, fetchChannelById, searchForChannel, extractChannelIdentifier } from '../../../../src/services/youtube/fetcher';
import { config } from '../../../../src/config/environment';

// Only run these tests if a YouTube API key is available
const testWithApiKey = config.youtube.apiKey 
  ? describe 
  : describe.skip;

// First test the utility functions that don't require API key
describe('Channel Identifier Extraction', () => {
  it('should extract channel ID from /channel/ URL', () => {
    const url = 'https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw';
    expect(extractChannelIdentifier(url)).toBe('UC_x5XG1OV2P6uZZ5FSM9Ttw');
  });
  
  it('should extract handle from @ format', () => {
    const handle = '@Mikey-and-Me';
    expect(extractChannelIdentifier(handle)).toBe('Mikey-and-Me');
  });
  
  it('should extract handle from URL /@handle format', () => {
    const url = 'https://www.youtube.com/@Mikey-and-Me';
    expect(extractChannelIdentifier(url)).toBe('Mikey-and-Me');
  });
  
  it('should extract custom name from /c/ URL', () => {
    const url = 'https://www.youtube.com/c/GoogleDevelopers';
    expect(extractChannelIdentifier(url)).toBe('GoogleDevelopers');
  });
  
  it('should extract username from /user/ URL', () => {
    const url = 'https://www.youtube.com/user/Google';
    expect(extractChannelIdentifier(url)).toBe('Google');
  });
  
  it('should handle non-URL inputs', () => {
    const channelId = 'UC_x5XG1OV2P6uZZ5FSM9Ttw';
    expect(extractChannelIdentifier(channelId)).toBe(channelId);
  });
  
  it('should handle inputs with whitespace', () => {
    const handle = '  @Mikey-and-Me  ';
    expect(extractChannelIdentifier(handle)).toBe('Mikey-and-Me');
  });
});

testWithApiKey('YouTube Fetcher Integration Tests', () => {
  const apiKey = config.youtube.apiKey as string;
  
  // Set longer timeout for API calls
  jest.setTimeout(10000);
  
  describe('validateYouTubeChannel', () => {
    it('should validate a channel by handle (@Mikey-and-Me)', async () => {
      const handle = '@Mikey-and-Me';
      const result = await validateYouTubeChannel(handle, apiKey);
      
      expect(result).not.toBeNull();
      if (result) {
        expect(result.items.length).toBeGreaterThan(0);
        
        const channel = result.items[0];
        expect(channel.id).toBeDefined();
        expect(channel.snippet.title).toBeDefined();
        expect(channel.statistics.subscriberCount).toBeDefined();
        expect(channel.statistics.videoCount).toBeDefined();
        
        // Log the channel info
        console.log('Validated channel:', {
          id: channel.id,
          title: channel.snippet.title,
          subscribers: channel.statistics.subscriberCount,
          videos: channel.statistics.videoCount,
          thumbnailUrl: channel.snippet.thumbnails.default.url
        });
      }
    });
    
    it('should validate a channel by URL (https://www.youtube.com/@Mikey-and-Me)', async () => {
      const url = 'https://www.youtube.com/@Mikey-and-Me';
      const result = await validateYouTubeChannel(url, apiKey);
      
      expect(result).not.toBeNull();
      if (result) {
        expect(result.items.length).toBeGreaterThan(0);
        
        const channel = result.items[0];
        expect(channel.id).toBeDefined();
        expect(channel.snippet.title).toBeDefined();
      }
    });
    
    it('should return null for an invalid channel identifier', async () => {
      const invalidIdentifier = '@this-channel-definitely-does-not-exist-12345678987654321';
      const result = await validateYouTubeChannel(invalidIdentifier, apiKey);
      
      expect(result?.items?.length).toBeFalsy();
    });
  });
  
  describe('fetchChannelById', () => {
    it('should fetch a channel by ID', async () => {
      // Using YouTube's official channel ID as an example
      const channelId = 'UCBR8-60-B28hp2BmDPdntcQ'; // YouTube's own channel ID
      const result = await fetchChannelById(channelId, apiKey);
      
      expect(result).not.toBeNull();
      if (result) {
        expect(result.items.length).toBeGreaterThan(0);
        
        const channel = result.items[0];
        expect(channel.id).toBe(channelId);
        expect(channel.snippet.title).toBeDefined();
      }
    });
    
    it('should handle an invalid channel ID', async () => {
      const invalidId = 'invalidChannelId12345678';
      const result = await fetchChannelById(invalidId, apiKey);
      
      // The API might return various responses for invalid IDs:
      // - null
      // - an object with undefined items
      // - an object with empty items array
      if (result === null) {
        expect(result).toBeNull();
      } else if (!result.items) {
        expect(result.items).toBeUndefined();
      } else {
        expect(result.items.length).toBe(0);
      }
    });
  });
  
  describe('searchForChannel', () => {
    it('should search for a channel by handle', async () => {
      const query = 'Mikey-and-Me';
      const result = await searchForChannel(query, apiKey);
      
      expect(result).not.toBeNull();
      if (result) {
        expect(result.items.length).toBeGreaterThan(0);
        expect(result.items[0].id.channelId).toBeDefined();
      }
    });
  });
});