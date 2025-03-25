import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../../config/db';

interface UserAttributes {
  id: string;
  email: string;
  name: string;
  auth0Id: string;
  lastLogin: Date | null;
  role: 'admin' | 'user';
  preferences: object;
  picture: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// These are all the attributes that can be null/undefined when creating a new instance
interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'createdAt' | 'updatedAt' | 'lastLogin' | 'preferences' | 'picture'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: string;
  public email!: string;
  public name!: string;
  public auth0Id!: string;
  public lastLogin!: Date | null;
  public role!: 'admin' | 'user';
  public preferences!: object;
  public picture!: string | null;
  public isActive!: boolean;
  public createdAt!: Date;
  public updatedAt!: Date;

  // You can define associations here
  static associate(models: any) {
    // define association here
    // e.g., User.hasMany(models.Channel)
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    auth0Id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: 'auth0_id' // Map to snake_case column name in database
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_login' // Map to snake_case column name in database
    },
    role: {
      type: DataTypes.ENUM('admin', 'user'),
      defaultValue: 'user',
    },
    preferences: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    picture: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'picture' // Map to snake_case column name in database
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active' // Map to snake_case column name in database
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at' // Map to snake_case column name in database
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at' // Map to snake_case column name in database
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    underscored: true, // This tells Sequelize to use snake_case for all fields
  }
);

export default User;