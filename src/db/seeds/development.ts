import { QueryInterface } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    // Seed users
    const userId = uuidv4();
    
    await queryInterface.bulkInsert('users', [
      {
        id: userId,
        email: 'demo@example.com',
        name: 'Demo User',
        auth0_id: 'auth0|demo',
        role: 'user',
        preferences: JSON.stringify({
          defaultTheme: 'light',
          notificationsEnabled: true,
          dateFormat: 'MM/DD/YYYY'
        }),
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    // Seed channels
    const channelId = uuidv4();
    
    await queryInterface.bulkInsert('channels', [
      {
        id: channelId,
        name: 'Demo Channel',
        description: 'This is a demo channel for testing purposes',
        user_id: userId,
        config: JSON.stringify({}),
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    // Seed widgets
    await queryInterface.bulkInsert('widgets', [
      {
        id: uuidv4(),
        name: 'Demo Widget',
        channel_id: channelId,
        config: JSON.stringify({
          theme: 'light',
          position: 'bottom-right'
        }),
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    // Seed videos
    await queryInterface.bulkInsert('videos', [
      {
        id: uuidv4(),
        youtube_id: 'dQw4w9WgXcQ', // Just a sample YouTube ID
        title: 'Demo Video',
        channel_id: channelId,
        status: 'active',
        processing_status: 'completed',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    // Remove seeded data in reverse order
    await queryInterface.bulkDelete('videos', {});
    await queryInterface.bulkDelete('widgets', {});
    await queryInterface.bulkDelete('channels', {});
    await queryInterface.bulkDelete('users', {});
  }
};