import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../../config/db';
import User from './User';

export interface ChannelAttributes {
  id: string;
  name: string;
  description: string;
  userId: string;
  config: object;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  updatedAt: Date;
}

// These are all the attributes that can be null/undefined when creating a new instance
interface ChannelCreationAttributes extends Optional<ChannelAttributes, 'id' | 'createdAt' | 'updatedAt' | 'description' | 'config'> {}

class Channel extends Model<ChannelAttributes, ChannelCreationAttributes> implements ChannelAttributes {
  public id!: string;
  public name!: string;
  public description!: string;
  public userId!: string;
  public config!: object;
  public status!: 'active' | 'inactive' | 'pending';
  public createdAt!: Date;
  public updatedAt!: Date;

  // Define associations
  static associate(models: any) {
    Channel.belongsTo(models.User, { 
      foreignKey: 'userId',
      as: 'user'
    });
    Channel.hasMany(models.Widget, {
      foreignKey: 'channelId',
      as: 'widgets'
    });
    Channel.hasMany(models.Video, {
      foreignKey: 'channelId',
      as: 'videos'
    });
  }
}

Channel.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      field: 'user_id'
    },
    config: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'pending'),
      defaultValue: 'active',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at'
    },
  },
  {
    sequelize,
    modelName: 'Channel',
    tableName: 'channels',
    timestamps: true,
    underscored: true, // This tells Sequelize to use snake_case for all fields
  }
);

export default Channel;