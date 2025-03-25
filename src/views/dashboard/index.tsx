import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserProfileResponse, DashboardStatsResponse, ChannelResponse, WidgetResponse } from '@/types/api';
import { SidebarLayout } from '@/components/sidebar-layout';
import { ChannelOnboardingModal } from '@/views/channelOnboarding';
import { 
  Sidebar, 
  SidebarHeader, 
  SidebarBody, 
  SidebarFooter, 
  SidebarItem, 
  SidebarLabel,
  SidebarSection,
  SidebarHeading,
  SidebarSpacer
} from '@/components/sidebar';
import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from '@/components/navbar';
import { Dropdown, DropdownButton, DropdownMenu, DropdownItem, DropdownLabel, DropdownDivider } from '@/components/dropdown';
import { Avatar } from '@/components/avatar';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';
import { Button } from '@/components/button';
import {
  ArrowRightStartOnRectangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Cog8ToothIcon,
  LightBulbIcon,
  PlusIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  VideoCameraIcon,
  ArrowRightIcon,
  DocumentTextIcon,
  CodeBracketIcon
} from '@heroicons/react/16/solid';
import {
  Cog6ToothIcon,
  HomeIcon,
  QuestionMarkCircleIcon,
  SparklesIcon,
  Square2StackIcon,
  TicketIcon,
} from '@heroicons/react/20/solid'
import User from '@/db/models/User';

interface DashboardProps {
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  user?: UserProfileResponse['user'] | null;
}

function AccountDropdownMenu({ 
  anchor, 
  userName,
  onLogout 
}: { 
  anchor: 'top start' | 'bottom end'; 
  userName?: string;
  onLogout?: () => void;
}) {
  return (
    <DropdownMenu className="min-w-64" anchor={anchor}>
      <DropdownItem href="/settings/account">
        <UserCircleIcon />
        <DropdownLabel>My Account</DropdownLabel>
      </DropdownItem>
      <DropdownDivider />
      <DropdownItem href="/settings/preferences">
        <Cog8ToothIcon />
        <DropdownLabel>Preferences</DropdownLabel>
      </DropdownItem>
      <DropdownDivider />
      <DropdownItem href="#">
        <ShieldCheckIcon />
        <DropdownLabel>Privacy policy</DropdownLabel>
      </DropdownItem>
      <DropdownItem href="#">
        <LightBulbIcon />
        <DropdownLabel>Share feedback</DropdownLabel>
      </DropdownItem>
      <DropdownDivider />
      <DropdownItem onClick={onLogout}>
        <ArrowRightStartOnRectangleIcon />
        <DropdownLabel>Sign out</DropdownLabel>
      </DropdownItem>
    </DropdownMenu>
  )
}

interface EmptyStateProps {
  onAddChannel: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ onAddChannel }) => (
  <div className="flex flex-col items-center justify-center text-center p-10 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 my-8 dark:bg-zinc-900 dark:border-zinc-700">
    <VideoCameraIcon className="w-16 h-16 text-gray-400 mb-4" />
    <Heading level={3} className="mb-2 font-medium">No YouTube channels added yet</Heading>
    <Text color="subtle" className="mb-6 max-w-md">
      Add your first YouTube channel to start creating AI-powered Q&A widgets for your content.
    </Text>
    <Button onClick={onAddChannel} color="blue">
      <PlusIcon className="w-5 h-5 mr-2" /> Add YouTube Channel
    </Button>
  </div>
);

interface SetupGuideProps {
  onAddChannel: () => void;
}

const SetupGuide: React.FC<SetupGuideProps> = ({ onAddChannel }) => {
  const [expandedStep, setExpandedStep] = useState(1);
  
  const steps = [
    {
      title: "Add your YouTube channel",
      description: "Connect to your YouTube channel to access your videos.",
      icon: VideoCameraIcon,
      action: onAddChannel,
      actionText: "Add Channel"
    },
    {
      title: "Select videos for your widget",
      description: "Choose which videos you want to include in your Q&A widget.",
      icon: DocumentTextIcon,
      disabled: true
    },
    {
      title: "Customize your widget",
      description: "Personalize the appearance and behavior of your Q&A widget.",
      icon: Cog8ToothIcon,
      disabled: true
    },
    {
      title: "Add the widget to your website",
      description: "Copy the code snippet and add it to your website to deploy the widget.",
      icon: CodeBracketIcon,
      disabled: true
    }
  ];

  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <div 
          key={index}
          className={`border rounded-lg overflow-hidden ${
            expandedStep === index + 1 
              ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20' 
              : 'border-zinc-200 dark:border-zinc-700'
          }`}
        >
          <div 
            className="flex items-center justify-between p-4 cursor-pointer"
            onClick={() => setExpandedStep(index + 1)}
          >
            <div className="flex items-center">
              <div className={`rounded-full p-2 mr-4 ${
                expandedStep === index + 1 
                  ? 'bg-blue-100 dark:bg-blue-900/40' 
                  : 'bg-zinc-100 dark:bg-zinc-800'
              }`}>
                <step.icon className={`w-5 h-5 ${
                  expandedStep === index + 1 
                    ? 'text-blue-600 dark:text-blue-400' 
                    : 'text-zinc-500 dark:text-zinc-400'
                }`} />
              </div>
              <div>
                <Text className="font-medium">Step {index + 1}: {step.title}</Text>
              </div>
            </div>
            {expandedStep === index + 1 ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
          </div>
          
          {expandedStep === index + 1 && (
            <div className="p-4 pt-0 border-t border-zinc-200 dark:border-zinc-700">
              <Text color="subtle" className="mb-4">{step.description}</Text>
              {step.action && (
                <Button 
                  onClick={step.action}
                  disabled={step.disabled}
                  color="blue"
                >
                  {step.actionText} {!step.disabled && <ArrowRightIcon className="w-4 h-4 ml-2" />}
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ authenticatedFetch, user: initialUser }) => {
  const [user, setUser] = useState<UserProfileResponse['user'] | null>(initialUser || null);
  const [stats, setStats] = useState<DashboardStatsResponse | null>(null);
  const [channels, setChannels] = useState<ChannelResponse[]>([]);
  const [widgets, setWidgets] = useState<WidgetResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);

  // Create a simple logger for the dashboard
  const dashboardLogger = {
    debug: (message: string, data?: any) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DASHBOARD DEBUG] ${message}`, data || '');
      }
    },
    error: (message: string, data?: any) => {
      console.error(`[DASHBOARD ERROR] ${message}`, data || '');
    }
  };

  useEffect(() => {
    dashboardLogger.debug('Dashboard component mounted', {
      authenticatedFetchAvailable: !!authenticatedFetch,
      initialUserProvided: !!initialUser,
      initialUserDetails: initialUser ? {
        id: initialUser.id,
        email: initialUser.email ? initialUser.email.substring(0, 3) + '***' : 'none'
      } : 'none'
    });
    
    // Check if user is authenticated using the new /api/auth/check endpoint
    checkAuthentication()
      .then(authResult => {
        dashboardLogger.debug('Authentication check result:', authResult);
        
        if (!authResult.isAuthenticated) {
          // Redirect to login page if not authenticated
          dashboardLogger.debug('User not authenticated, redirecting to login');
          window.location.href = '/api/auth/login';
          return;
        }
        
        // User is authenticated and we have basic user info from check endpoint
        if (authResult.user) {
          dashboardLogger.debug('Setting basic user info from auth check');
          setUser(authResult.user);
        }
        
        dashboardLogger.debug('Starting API data fetching');
        
        // If we already have user from props, and it has email (indicating it's complete), 
        // don't fetch profile again to avoid redundant requests
        const shouldFetchProfile = !user || !user.email;
        dashboardLogger.debug('Determining if profile fetch is needed:', {
          hasUser: !!user,
          hasUserEmail: user?.email ? true : false,
          shouldFetchProfile
        });
        
        // Fetch full user profile and other data
        return Promise.all([
          shouldFetchProfile ? fetchUserProfile() : Promise.resolve(user),
          fetchDashboardStats(),
          fetchUserChannels(),
          fetchUserWidgets()
        ]);
      })
      .then(results => {
        dashboardLogger.debug(`Results of user data fetches from api: ${results}`)
        if (results) {
          dashboardLogger.debug('All API requests completed', { 
            userDataSuccess: !!results[0],
            statsSuccess: !!results[1],
            channelsSuccess: !!results[2],
            widgetsSuccess: !!results[3]
          });
          
          const [userData, statsData, channelsData, widgetsData] = results;

          // Update user with full profile data
          setUser(userData);
          setStats(statsData);
          setChannels(channelsData);
          setWidgets(widgetsData);
        } else {
          dashboardLogger.debug('No results from API calls');
        }
        dashboardLogger.debug('Setting loading to false.')
        setLoading(false);
      })
      .catch(err => {
        dashboardLogger.error('Error loading dashboard data:', err);
        setError('Error loading dashboard data. Please refresh the page or try again later.');
        setLoading(false);
      });
  }, [authenticatedFetch]);

  // Check if user is authenticated
  const checkAuthentication = async (): Promise<{ isAuthenticated: boolean, user?: any }> => {
    try {
      const response = await authenticatedFetch('/api/auth/check');
      
      if (!response.ok) {
        throw new Error('Failed to check authentication status');
      }
      
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Authentication check failed:', error);
      return { isAuthenticated: false };
    }
  };

  // API fetch functions
  const fetchUserProfile = async (): Promise<UserProfileResponse['user']> => {
    dashboardLogger.debug('Fetching user profile');
    try {
      const response = await authenticatedFetch('/api/auth/profile');
      
      dashboardLogger.debug('User profile response status:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch user profile: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      dashboardLogger.debug('User profile data received', data);
      
      // Handle different response formats from profile endpoint
      if (data.data && data.data.user) {
        return data.data.user;
      } else if (data.data) {
        // If the user is directly in data.data (no nested user property)
        return data.data;
      } else if (data.user) {
        // If user is at the top level
        return data.user;
      } else {
        dashboardLogger.error('Unexpected profile response structure:', data);
        throw new Error('Invalid user profile data structure');
      }
    } catch (error) {
      dashboardLogger.error('Error fetching user profile:', error);
      throw error;
    }
  };

  const fetchDashboardStats = async (): Promise<DashboardStatsResponse> => {
    dashboardLogger.debug('Fetching dashboard stats');
    try {
      const response = await authenticatedFetch('/api/dashboard/stats');
      
      dashboardLogger.debug('Dashboard stats response status:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard stats: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      dashboardLogger.debug('Dashboard stats data received');
      return data.data;
    } catch (error) {
      dashboardLogger.error('Error fetching dashboard stats:', error);
      throw error;
    }
  };

  const fetchUserChannels = async (): Promise<ChannelResponse[]> => {
    dashboardLogger.debug('Fetching user channels');
    try {
      const response = await authenticatedFetch('/api/dashboard/channels');
      
      dashboardLogger.debug('User channels response status:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch user channels: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      dashboardLogger.debug('User channels data received');
      return data.data.channels || [];
    } catch (error) {
      dashboardLogger.error('Error fetching user channels:', error);
      throw error;
    }
  };

  const fetchUserWidgets = async (): Promise<WidgetResponse[]> => {
    dashboardLogger.debug('Fetching user widgets');
    try {
      const response = await authenticatedFetch('/api/dashboard/widgets');
      
      dashboardLogger.debug('User widgets response status:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch user widgets: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      dashboardLogger.debug('User widgets data received');
      return data.data.widgets || [];
    } catch (error) {
      dashboardLogger.error('Error fetching user widgets:', error);
      throw error;
    }
  };

  const updateUserPreferences = async (preferences: any): Promise<void> => {
    const response = await authenticatedFetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ preferences })
    });
    
    if (!response.ok) {
      throw new Error('Failed to update user preferences');
    }
    
    // Update local user state with new preferences
    if (user) {
      setUser({
        ...user,
        preferences
      });
    }
  };

  // Function to handle user logout
  const handleLogout = async (): Promise<void> => {
    try {
      await authenticatedFetch('/api/auth/logout', {
        method: 'POST'
      });
      
      // Redirect to test landing page after logout
      window.location.href = 'http://localhost:3003';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (!user) {
    return <div className="error">Failed to load user data. Please refresh the page.</div>;
  }

  // Function to handle adding a new channel
  const handleAddChannel = () => {
    setIsChannelModalOpen(true);
  };

  return (
    <SidebarLayout
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center">
              <img src="/logo.svg" alt="RAG Widget" className="h-8 w-8 mr-2" />
              <span className="text-lg font-bold">RAG Widget</span>
            </div>
          </SidebarHeader>

          <SidebarBody>
            <SidebarSection>
              <SidebarItem current href="/dashboard">
                <HomeIcon />
                <SidebarLabel>Dashboard</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/channels">
                <VideoCameraIcon />
                <SidebarLabel>Channels</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/widgets">
                <CodeBracketIcon />
                <SidebarLabel>Widgets</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/settings">
                <Cog6ToothIcon />
                <SidebarLabel>Settings</SidebarLabel>
              </SidebarItem>
            </SidebarSection>

            <SidebarSpacer />

            <SidebarSection>
              <SidebarItem href="#">
                <QuestionMarkCircleIcon />
                <SidebarLabel>Support</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="#">
                <SparklesIcon />
                <SidebarLabel>Changelog</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarBody>

          <SidebarFooter className="max-lg:hidden">
            <Dropdown>
              <DropdownButton as={SidebarItem}>
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar 
                    src={user.picture}
                    className="size-6"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm/5 font-medium text-zinc-950 dark:text-white">{user.name}</span>
                    <span className="block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400">
                      {user.email}
                    </span>
                  </span>
                </span>
                <ChevronUpIcon />
              </DropdownButton>
              <AccountDropdownMenu anchor="top start" onLogout={handleLogout} />
            </Dropdown>
          </SidebarFooter>
        </Sidebar>
      }
      navbar={
        <Navbar>
          <NavbarSection>
            <Heading level={1} className="text-lg font-medium">Dashboard</Heading>
          </NavbarSection>
          <NavbarSpacer />
          <NavbarSection>
            <Button color="blue" onClick={handleAddChannel}>
              <PlusIcon className="w-5 h-5 mr-2" />
              Add Channel
            </Button>
            <Dropdown>
              <DropdownButton as={NavbarItem}>
                <Avatar 
                  src={user.picture}
                  className="size-6" 
                />
              </DropdownButton>
              <AccountDropdownMenu anchor="bottom end" userName={user.name} onLogout={handleLogout} />
            </Dropdown>
          </NavbarSection>
        </Navbar>
      }
    >
      {/* Welcome Section */}
      <div className="mb-8">
        <Heading level={2} className="mb-2">Welcome, {user.name || 'User'}</Heading>
        <Text color="subtle">
          {user.lastLogin 
            ? `Last login: ${new Date(user.lastLogin).toLocaleString()}` 
            : 'Welcome to your RAG Widget dashboard!'}
        </Text>
      </div>

      {/* Dashboard Overview */}
      <div className="mb-8">
        <Heading level={3} className="mb-4">Dashboard Overview</Heading>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Stats Cards */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center">
              <div className="mr-4 rounded-full bg-blue-100 p-3 dark:bg-blue-900/30">
                <VideoCameraIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <Text color="subtle">Channels</Text>
                <Heading level={4} className="font-medium">{stats?.channelCount || 0}</Heading>
              </div>
            </div>
          </div>
          
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center">
              <div className="mr-4 rounded-full bg-indigo-100 p-3 dark:bg-indigo-900/30">
                <CodeBracketIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <Text color="subtle">Widgets</Text>
                <Heading level={4} className="font-medium">{stats?.widgetCount || 0}</Heading>
              </div>
            </div>
          </div>
          
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center">
              <div className="mr-4 rounded-full bg-green-100 p-3 dark:bg-green-900/30">
                <DocumentTextIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <Text color="subtle">Videos</Text>
                <Heading level={4} className="font-medium">{stats?.videoCount || 0}</Heading>
              </div>
            </div>
          </div>
          
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center">
              <div className="mr-4 rounded-full bg-purple-100 p-3 dark:bg-purple-900/30">
                <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <Text color="subtle">Total Queries</Text>
                <Heading level={4} className="font-medium">{stats?.totalQueries || 0}</Heading>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Setup Guide (Only shown for new users with no channels) */}
      {channels.length === 0 && (
        <div className="mb-10">
          <Heading level={3} className="mb-4">Getting Started</Heading>
          <SetupGuide onAddChannel={handleAddChannel} />
        </div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Channels Section */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <Heading level={3} className="font-medium">Your Channels</Heading>
            <Button onClick={handleAddChannel} color="blue">
              <PlusIcon className="w-5 h-5 mr-2" />
              New Channel
            </Button>
          </div>
          
          {channels.length > 0 ? (
            <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {channels.map((channel) => (
                  <li key={channel.id} className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <div className="mb-2 sm:mb-0">
                        <Heading level={4} className="font-medium">{channel.name}</Heading>
                        <Text color="subtle" className="mt-1">{channel.description}</Text>
                        <div className="flex items-center mt-2">
                          <span className={`inline-block h-2.5 w-2.5 rounded-full mr-2 ${
                            channel.status === 'active' ? 'bg-green-500' : 
                            channel.status === 'processing' ? 'bg-yellow-500' : 'bg-gray-500'
                          }`}></span>
                          <Text color="subtle">Status: {channel.status}</Text>
                          <Text color="subtle" className="ml-4">Created: {new Date(channel.createdAt).toLocaleDateString()}</Text>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Link to={`/channels/${channel.id}`}>
                          <Button>Manage</Button>
                        </Link>
                        <Button href={`/channels/${channel.id}/edit`}>Edit</Button>
                        <Button color="red">Delete</Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState onAddChannel={handleAddChannel} />
          )}
        </div>

        {/* Widgets Section */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <Heading level={3} className="font-medium">Your Widgets</Heading>
            <Button href="/widgets/new" color="blue">
              <PlusIcon className="w-5 h-5 mr-2" />
              New Widget
            </Button>
          </div>
          
          {widgets.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {widgets.map((widget) => (
                <div key={widget.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="mb-3 flex items-center justify-between">
                    <Heading level={4} className="font-medium">{widget.name}</Heading>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      widget.status === 'active' ? 'bg-green-100 text-green-800' : 
                      widget.status === 'draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {widget.status}
                    </span>
                  </div>
                  
                  {/* Widget Preview Placeholder */}
                  <div className="mb-3 aspect-video rounded bg-zinc-100 dark:bg-zinc-800">
                    <div className="flex h-full items-center justify-center">
                      <CodeBracketIcon className="h-10 w-10 text-zinc-400" />
                    </div>
                  </div>
                  
                  <Text color="subtle" className="mb-3">Channel: {widget.channelId}</Text>
                  
                  <div className="flex justify-between space-x-2">
                    <Button href={`/widgets/${widget.id}/embed`}>Get Code</Button>
                    <Button href={`/widgets/${widget.id}/edit`}>Edit</Button>
                    <Button color="red">Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <CodeBracketIcon className="mx-auto h-12 w-12 text-zinc-400" />
              <Heading level={4} className="mt-2 font-medium">No widgets yet</Heading>
              <Text color="subtle" className="mb-4">Create your first widget to embed on your website.</Text>
              <Button href="/widgets/new" color="blue">
                <PlusIcon className="w-5 h-5 mr-2" />
                Create Your First Widget
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      {stats?.recentActivity && stats.recentActivity.length > 0 && (
        <div className="mt-8">
          <Heading level={3} className="mb-4 font-medium">Recent Activity</Heading>
          
          <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {stats.recentActivity.map((activity, index) => (
                <li key={index} className="p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900/30">
                        <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4">
                      <Text className="font-medium">{activity.action}</Text>
                      <Text color="subtle">{activity.details}</Text>
                      <Text color="subtle">{new Date(activity.timestamp).toLocaleString()}</Text>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Channel Onboarding Modal */}
  <ChannelOnboardingModal
    isOpen={isChannelModalOpen}
    onClose={() => setIsChannelModalOpen(false)}
    authenticatedFetch={authenticatedFetch}
    onChannelCreated={(newChannel) => {
      // Update channels list with the new channel
      setChannels(prevChannels => [...prevChannels, newChannel]);
      
      // Update stats
      if (stats) {
        setStats({
          ...stats,
          channelCount: (stats.channelCount || 0) + 1
        });
      }
      
      // Show success notification if you have a notification system
      // showNotification({ type: 'success', message: 'Channel added successfully!' });
    }}
  />

    </SidebarLayout>
  );
};

export default Dashboard;