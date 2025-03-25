import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../config/db';

export interface ISession {
  id?: string;
  userId: string;
  refreshToken: string;
  lastUsed: Date;
  expiresAt: Date;
  requiresReauth?: boolean;
  reauthReason?: string;
  customData?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

interface SessionCreationAttributes extends Optional<ISession, 'id' | 'createdAt' | 'updatedAt'> {}

export class Session extends Model<ISession, SessionCreationAttributes> implements ISession {
  public id!: string;
  public userId!: string;
  public refreshToken!: string;
  public lastUsed!: Date;
  public expiresAt!: Date;
  public requiresReauth?: boolean;
  public reauthReason?: string;
  public customData?: Record<string, any>;
  
  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Session.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  refreshToken: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  lastUsed: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  requiresReauth: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  reauthReason: {
    type: DataTypes.STRING,
  },
  customData: {
    type: DataTypes.JSONB,
  },
}, {
  sequelize,
  modelName: 'Session',
  tableName: 'sessions',
  timestamps: true,
  underscored: true, // This tells Sequelize to use snake_case for createdAt/updatedAt
  indexes: [
    {
      fields: ['user_id'], // Use snake_case column names in indexes
    },
    {
      fields: ['expires_at'], // Use snake_case column names in indexes
    },
    {
      fields: ['user_id', 'expires_at'], // Use snake_case column names in indexes
    }
  ]
});