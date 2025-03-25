import User from '../db/models/User';
import { logger } from '../config/logger';
import sequelize from 'sequelize';

/**
 * Service for managing users
 */
class UserService {
  /**
   * Find or create a user based on Auth0 profile
   * @param auth0Id Auth0 user ID
   * @param email User email
   * @param name User name
   */
  async findOrCreateUser(auth0Id: string, email: string, name: string, picture?: string) {
    try {
      // Check if the name parameter is actually an email (this could happen in the current code)
      // if (name.includes('@') && !email.includes('@')) {
      //   // Swap them if it looks like they're reversed
      //   [email, name] = [name, email];
      //   logger.info(`Swapped name and email as name appeared to contain an email address: ${name}`);
      // }
      
      // Use findOrCreate to handle race conditions
      const [user, created] = await User.findOrCreate({
        where: { auth0Id },
        defaults: {
          auth0Id, // Include auth0Id in defaults to satisfy TypeScript
          email,
          name,
          picture,
          role: 'user' as const,
          isActive: true
        },
      });
      
      if (created) {
        logger.info(`New user created with ID: ${user.id}, email: ${email}`);
      } else {
        // Update the last login timestamp and other fields
        user.lastLogin = new Date();
        // Also update name, email, and picture in case they changed
        user.name = name;
        user.email = email;
        if (picture) {
          user.picture = picture;
        }
        await user.save();
        logger.info(`Existing user updated: ${user.id}, email: ${email}`);
      }
      
      return user;
    } catch (error: unknown) {
      // If there was an error due to duplicate email, log more info
      if (error instanceof Error && error.name === 'SequelizeUniqueConstraintError') {
        logger.error(`Duplicate email error for: ${email}, auth0Id: ${auth0Id}`);
        
        // Try to get the existing user with this email
        try {
          const existingUser = await User.findOne({ where: { email } });
          if (existingUser) {
            logger.info(`Found existing user with email ${email}, returning that user`);
            return existingUser;
          }
        } catch (innerError) {
          logger.error(`Error finding user by email: ${innerError}`);
        }
      }
      
      logger.error(`Error in findOrCreateUser: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Get user by Auth0 ID
   * @param auth0Id Auth0 user ID
   */
  async getUserByAuth0Id(auth0Id: string) {
    try {
      const user = await User.findOne({ where: { auth0Id } });
      
      if (!user) {
        // User not found in local database
        logger.warn(`User with Auth0 ID ${auth0Id} not found in local database`);
        return null;
      }
      
      // Update last login time
      user.lastLogin = new Date();
      await user.save();
      
      return user;
    } catch (error) {
      logger.error(`Error in getUserByAuth0Id: ${error}`);
      throw error;
    }
  }
  
  /**
   * Update user information
   * @param userId User ID
   * @param updateData Data to update
   */
  async updateUser(userId: string, updateData: Partial<User>) {
    try {
      const user = await User.findByPk(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Update user
      await user.update(updateData);
      
      return user;
    } catch (error) {
      logger.error(`Error in updateUser: ${error}`);
      throw error;
    }
  }
  
  /**
   * Update user preferences
   * @param userId User ID
   * @param preferences User preferences to update or set
   */
  async updateUserPreferences(userId: string, preferences: object) {
    try {
      const user = await User.findByPk(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Merge existing preferences with new ones
      const updatedPreferences = {
        ...user.preferences,
        ...preferences
      };
      
      // Update user
      await user.update({ preferences: updatedPreferences });
      
      return user;
    } catch (error) {
      logger.error(`Error in updateUserPreferences: ${error}`);
      throw error;
    }
  }
  
  /**
   * Set user role
   * @param userId User ID
   * @param role Role to set ('admin' or 'user')
   */
  async setUserRole(userId: string, role: 'admin' | 'user') {
    try {
      const user = await User.findByPk(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Update user role
      await user.update({ role });
      
      return user;
    } catch (error) {
      logger.error(`Error in setUserRole: ${error}`);
      throw error;
    }
  }
  
  /**
   * Find a user by their Auth0 ID (used by auth0Service as a replacement for the Management API)
   * @param auth0Id Auth0 user ID
   */
  async findUserById(auth0Id: string) {
    try {
      const user = await User.findOne({ where: { auth0Id } });
      
      if (!user) {
        logger.warn(`User with Auth0 ID ${auth0Id} not found in database`);
        return null;
      }
      
      return user;
    } catch (error) {
      logger.error(`Error in findUserById: ${error}`);
      throw error;
    }
  }
  
  /**
   * Update user metadata (replaces Auth0 metadata functionality)
   * @param auth0Id Auth0 user ID
   * @param metadata Metadata to update or set
   */
  // async updateUserMetadata(auth0Id: string, metadata: object) {
  //   try {
  //     const user = await User.findOne({ where: { auth0Id } });
      
  //     if (!user) {
  //       throw new Error(`User with Auth0 ID ${auth0Id} not found`);
  //     }
      
  //     // Get current metadata or initialize as empty object
  //     const currentMetadata = user.metadata || {};
      
  //     // Merge the new metadata with existing metadata
  //     const updatedMetadata = {
  //       ...currentMetadata,
  //       ...metadata
  //     };
      
  //     // Update the user
  //     await user.update({ metadata: updatedMetadata });
      
  //     return user;
  //   } catch (error) {
  //     logger.error(`Error in updateUserMetadata: ${error}`);
  //     throw error;
  //   }
  // }
}

export const userService = new UserService();