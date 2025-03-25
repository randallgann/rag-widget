import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../../config/db';
import Channel from './Channel';

interface WidgetAttributes {
  id: string;
  name: string;
  channelId: string;
  config: object;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  updatedAt: Date;
}

// These are all the attributes that can be null/undefined when creating a new instance
interface WidgetCreationAttributes extends Optional<WidgetAttributes, 'id' | 'createdAt' | 'updatedAt' | 'config'> {}

class Widget extends Model<WidgetAttributes, WidgetCreationAttributes> implements WidgetAttributes {
  public id!: string;
  public name!: string;
  public channelId!: string;
  public config!: object;
  public status!: 'active' | 'inactive' | 'pending';
  public createdAt!: Date;
  public updatedAt!: Date;

  // Define associations
  static associate(models: any) {
    Widget.belongsTo(models.Channel, { 
      foreignKey: 'channelId',
      as: 'channel'
    });
  }
}

Widget.init(
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
    channelId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'channels',
        key: 'id'
      },
      field: 'channel_id'
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
    modelName: 'Widget',
    tableName: 'widgets',
    timestamps: true,
    underscored: true, // This tells Sequelize to use snake_case for all fields
  }
);

export default Widget;