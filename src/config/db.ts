import { Sequelize } from 'sequelize';
import { config } from './environment';
import { logger } from './logger';

const { host, port, username, password, database } = config.database;

// Create Sequelize instance
const sequelize = new Sequelize({
  dialect: 'postgres',
  host,
  port,
  username,
  password,
  database,
  logging: (msg) => {
    // Filter out long INSERT statements that make logs hard to read
    if (msg.includes('INSERT INTO') && msg.length > 1000) {
      const truncatedMsg = msg.substring(0, 200) + '... [SQL truncated for readability]';
      logger.debug(truncatedMsg);
    } else {
      logger.debug(msg);
    }
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

// Test the connection with retries
export const testDbConnection = async (retries = 5, delay = 3000): Promise<void> => {
  let lastError;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await sequelize.authenticate();
      logger.info('Database connection has been established successfully.');
      return;
    } catch (error) {
      lastError = error;
      logger.warn(`Database connection attempt ${attempt}/${retries} failed. Retrying in ${delay/1000} seconds...`);
      
      if (attempt < retries) {
        // Wait before next retry
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  logger.error('Unable to connect to the database after multiple attempts:', lastError);
  throw lastError;
};

export default sequelize;