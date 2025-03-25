// API response and request types

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

export interface UserProfileResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'user';
    lastLogin: string | null;
    preferences: any;
    picture: string | null;
    isActive: boolean;
    createdAt: string;
  };
}

export interface VideoStats {
  total: number;
  processed: number;
  processing: number;
  pending: number;
  failed: number;
}

export interface ChannelResponse {
  id: string;
  name: string;
  description: string;
  userId: string;
  config: {
    youtubeChannelId: string;
    thumbnailUrl: string;
    subscriberCount: string;
    viewCount: string;
    videoCount: number;
    totalProcessed: number;
    processingStatus: 'idle' | 'processing' | 'completed' | 'failed';
    [key: string]: any;
  };
  status: 'active' | 'inactive' | 'pending' | 'processing';
  videoStats?: VideoStats;
  createdAt: string;
  updatedAt: string;
}

export interface WidgetResponse {
  id: string;
  name: string;
  channelId: string;
  config: any;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface VideoResponse {
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
  publishedAt?: string;
  status: 'active' | 'inactive' | 'pending' | 'processing';
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  selectedForProcessing?: boolean;
  processingProgress?: number;
  processingError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStatsResponse {
  channelCount: number;
  widgetCount: number;
  videoCount: number;
  totalQueries: number;
  recentActivity: {
    timestamp: string;
    action: string;
    details: string;
  }[];
}