import request from 'supertest';
import express from 'express';
import { validateChannel } from '@/api/controllers/channelController';
import { config } from '@/config/environment';

// Use the same condition to skip tests if no API key
const testWithApiKey = config.youtube.apiKey 
  ? describe 
  : describe.skip;

// Create a simple express app for testing
const app = express();
app.use(express.json());
app.post('/api/channels/validate', validateChannel);

testWithApiKey('Channel Controller Integration Tests', () => {
  // Increase timeout for API calls
  jest.setTimeout(10000);

  describe('POST /api/channels/validate', () => {
    it('should validate a valid YouTube channel URL', async () => {
      const response = await request(app)
        .post('/api/channels/validate')
        .send({ channelIdentifier: 'https://www.youtube.com/@Mikey-and-Me' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.channel).toBeDefined();
      
      const channel = response.body.data.channel;
      expect(channel.id).toBeDefined();
      expect(channel.name).toBeDefined();
      expect(channel.thumbnailUrl).toBeDefined();
      expect(channel.videoCount).toBeDefined();
      expect(channel.subscriberCount).toBeDefined();
      
      // Log channel details for debugging
      console.log('Validated channel:', {
        id: channel.id,
        name: channel.name,
        videos: channel.videoCount,
        subscribers: channel.subscriberCount
      });
    });

    it('should validate a channel handle (@name format)', async () => {
      const response = await request(app)
        .post('/api/channels/validate')
        .send({ channelIdentifier: '@Mikey-and-Me' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.channel).toBeDefined();
      expect(response.body.data.channel.id).toBeDefined();
    });

    it('should validate a direct channel ID', async () => {
      // Using YouTube's official channel ID
      const response = await request(app)
        .post('/api/channels/validate')
        .send({ channelIdentifier: 'UCBR8-60-B28hp2BmDPdntcQ' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.channel).toBeDefined();
    });

    it('should return 400 when no channel identifier is provided', async () => {
      const response = await request(app)
        .post('/api/channels/validate')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Channel identifier is required');
    });

    it('should return 404 when an invalid channel is provided', async () => {
      const response = await request(app)
        .post('/api/channels/validate')
        .send({ channelIdentifier: '@this-channel-definitely-does-not-exist-12345678987654321' });

      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Channel not found');
    });
  });
});