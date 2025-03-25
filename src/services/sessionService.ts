import { Session, ISession } from '../db/models/Session';
import { logger } from '../config/logger';
import { Op } from 'sequelize';

/**
 * Store a refresh token for a user in the database
 * Used for fallback refresh token handling with browsers that restrict cookies
 */
export const storeUserRefreshToken = async (userId: string, refreshToken: string): Promise<boolean> => {
  try {
    // Store in database with 30-day expiration to match Auth0 rotation settings
    await Session.create({
      userId,
      refreshToken,
      lastUsed: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });
    
    logger.info(`Stored refresh token for user ${userId} (server-side fallback)`);
    return true;
  } catch (error: any) {
    logger.error(`Error storing user refresh token: ${error.message}`);
    throw error;
  }
};

/**
 * Get user session containing refresh token
 * Used for fallback refresh token handling
 */
export const getSessionForUser = async (userId: string): Promise<ISession | null> => {
  try {
    // Only return non-expired sessions
    const session = await Session.findOne({
      where: {
        userId,
        expiresAt: { [Op.gt]: new Date() }
      }
    });
    
    return session;
  } catch (error: any) {
    logger.error(`Error retrieving user session: ${error.message}`);
    return null;
  }
};

/**
 * Update a user session with new data
 * Typically used to update refresh token after rotation
 */
export const updateUserSession = async (userId: string, data: Record<string, any>): Promise<boolean> => {
  try {
    await Session.update(
      {
        ...data,
        lastUsed: new Date()
      }, 
      {
        where: { userId }
      }
    );
    
    return true;
  } catch (error: any) {
    logger.error(`Error updating user session: ${error.message}`);
    throw error;
  }
};