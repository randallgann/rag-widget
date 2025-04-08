import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../../config/db';
import Channel from './Channel';

import { ChannelAttributes } from './Channel';

export interface VideoAttributes {
  id: string;
  youtubeId: string;
  title: string;
  description?: string;
  channelId: string;
  thumbnailUrl?: string;
  duration?: string;
  durationSeconds?: number;
  viewCount?: number;
  likeCount?: number;
  publishedAt?: Date;
  selectedForProcessing?: boolean;
  processingProgress?: number;
  processingError?: string | null;
  processingStage?: string | null;
  processingLastUpdated?: Date | null;
  status: 'active' | 'inactive' | 'pending';
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  // Optional virtual association properties
  channel?: ChannelAttributes;
}

// These are all the attributes that can be null/undefined when creating a new instance
export interface VideoCreationAttributes extends Optional<VideoAttributes, 
  'id' | 'createdAt' | 'updatedAt' | 'title' | 'description' | 'thumbnailUrl' | 
  'duration' | 'durationSeconds' | 'viewCount' | 'likeCount' | 'publishedAt' | 
  'selectedForProcessing' | 'processingProgress' | 'processingError' | 'processingStage' | 'processingLastUpdated'> {}

class Video extends Model<VideoAttributes, VideoCreationAttributes> implements VideoAttributes {
  public id!: string;
  public youtubeId!: string;
  public title!: string;
  public description!: string;
  public channelId!: string;
  public thumbnailUrl!: string;
  public duration!: string;
  public durationSeconds!: number;
  public viewCount!: number;
  public likeCount!: number;
  public publishedAt!: Date;
  public selectedForProcessing!: boolean;
  public processingProgress!: number;
  public processingError!: string | null;
  public processingStage!: string;
  public processingLastUpdated!: Date;
  public status!: 'active' | 'inactive' | 'pending';
  public processingStatus!: 'pending' | 'processing' | 'completed' | 'failed';
  public createdAt!: Date;
  public updatedAt!: Date;
  
  // Virtual association properties
  public readonly channel?: Channel;

  // Define associations
  static associate(models: any) {
    Video.belongsTo(models.Channel, { 
      foreignKey: 'channelId',
      as: 'channel'
    });
  }
}

Video.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    youtubeId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: 'youtube_id'
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    channelId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'channels',
        key: 'id'
      },
      field: 'channel_id'
    },
    thumbnailUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'thumbnail_url'
    },
    duration: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    durationSeconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'duration_seconds'
    },
    viewCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'view_count'
    },
    likeCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'like_count'
    },
    publishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'published_at'
    },
    selectedForProcessing: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'selected_for_processing'
    },
    processingProgress: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
      field: 'processing_progress'
    },
    processingError: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'processing_error'
    },
    processingStage: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'processing_stage'
    },
    processingLastUpdated: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'processing_last_updated'
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'pending'),
      defaultValue: 'active',
    },
    processingStatus: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
      defaultValue: 'pending',
      field: 'processing_status'
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
    modelName: 'Video',
    tableName: 'videos',
    timestamps: true,
    underscored: true, // This tells Sequelize to use snake_case for all fields
  }
);

export default Video;