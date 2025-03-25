import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserProfileResponse, ChannelResponse } from '@/types/api';
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
  SidebarSpacer
} from '@/components/sidebar';
import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from '@/components/navbar';
import { Dropdown, DropdownButton, DropdownMenu, DropdownItem, DropdownLabel, DropdownDivider } from '@/components/dropdown';
import { Avatar } from '@/components/avatar';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';
import { Button } from '@/components/button';
import { Badge } from '@/components/badge';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
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
  CodeBracketIcon,
  TrashIcon,
  PencilIcon,
  ArrowPathIcon
} from '@heroicons/react/16/solid';
import {
  Cog6ToothIcon,
  HomeIcon,
  QuestionMarkCircleIcon,
  SparklesIcon,
} from '@heroicons/react/20/solid';

interface ChannelsPageProps {
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

interface VideoStatsProps {
  total: number;
  processed: number;
  processing: number;
  pending: number;
  failed: number;
}

const VideoStats: React.FC<VideoStatsProps> = ({ total, processed, processing, pending, failed }) => {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge color="zinc">Total: {total}</Badge>
      {processed > 0 && <Badge color="green">Processed: {processed}</Badge>}
      {processing > 0 && <Badge color="blue">Processing: {processing}</Badge>}
      {pending > 0 && <Badge color="yellow">Pending: {pending}</Badge>}
      {failed > 0 && <Badge color="red">Failed: {failed}</Badge>}
    </div>
  );
};

const ChannelsPage: React.FC<ChannelsPageProps> = ({ authenticatedFetch, user: initialUser }) => {
  const [user, setUser] = useState<UserProfileResponse['user'] | null>(initialUser || null);
  const [channels, setChannels] = useState<ChannelResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);

  // Create a simple logger for the channels page
  const logger = {
    debug: (message: string, data?: any) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[CHANNELS DEBUG] ${message}`, data || '');
      }
    },
    error: (message: string, data?: any) => {
      console.error(`[CHANNELS ERROR] ${message}`, data || '');
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      logger.debug('Fetching channels');
      
      const response = await authenticatedFetch('/api/channels');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch channels: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      logger.debug('Channels data received', data);
      
      setChannels(data.data.channels || []);
      setLoading(false);
    } catch (error) {
      logger.error('Error fetching channels', error);
      setError('Failed to load channels. Please try again.');
      setLoading(false);
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

  // Function to handle adding a new channel
  const handleAddChannel = () => {
    setIsChannelModalOpen(true);
  };

  // Function to handle refreshing a channel
  const handleRefreshChannel = async (channelId: string) => {
    try {
      // Here you would implement the logic to refresh a channel
      // This would typically involve fetching latest videos from YouTube
      logger.debug(`Refreshing channel ${channelId}`);
      
      // Placeholder for actual implementation
      alert('Channel refresh functionality to be implemented');
      
      // After refreshing, fetch channels again to get updated data
      await fetchChannels();
    } catch (error) {
      logger.error(`Error refreshing channel ${channelId}`, error);
    }
  };

  // Function to delete a channel
  const handleDeleteChannel = async (channelId: string) => {
    if (!confirm('Are you sure you want to delete this channel? This action cannot be undone.')) {
      return;
    }
    
    try {
      logger.debug(`Deleting channel ${channelId}`);
      
      const response = await authenticatedFetch(`/api/channels/${channelId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete channel: ${response.status} ${response.statusText}`);
      }
      
      // Remove the deleted channel from state
      setChannels(channels.filter(channel => channel.id !== channelId));
    } catch (error) {
      logger.error(`Error deleting channel ${channelId}`, error);
      alert('Failed to delete channel. Please try again.');
    }
  };

  if (loading) {
    return <div className="loading">Loading channels...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

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
              <SidebarItem href="/dashboard">
                <HomeIcon />
                <SidebarLabel>Dashboard</SidebarLabel>
              </SidebarItem>
              <SidebarItem current href="/channels">
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
                    src={user?.picture}
                    className="size-6"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm/5 font-medium text-zinc-950 dark:text-white">{user?.name}</span>
                    <span className="block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400">
                      {user?.email}
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
            <Heading level={1} className="text-lg font-medium">YouTube Channels</Heading>
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
                  src={user?.picture}
                  className="size-6" 
                />
              </DropdownButton>
              <AccountDropdownMenu anchor="bottom end" userName={user?.name} onLogout={handleLogout} />
            </Dropdown>
          </NavbarSection>
        </Navbar>
      }
    >
      <div className="mb-6">
        <Heading level={2} className="mb-2">Your YouTube Channels</Heading>
        <Text color="subtle">
          Manage your YouTube channels and videos for your RAG widgets.
        </Text>
      </div>

      {channels.length > 0 ? (
        <div className="bg-white rounded-lg shadow dark:bg-zinc-900">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Channel</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Videos</TableHeader>
                <TableHeader>Created</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {channels.map((channel) => (
                <TableRow key={channel.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      {channel.config?.thumbnailUrl && (
                        <img 
                          src={channel.config.thumbnailUrl} 
                          alt={channel.name} 
                          className="h-10 w-10 rounded-full"
                        />
                      )}
                      <div>
                        <Text className="font-medium">{channel.name}</Text>
                        <Text color="subtle" className="text-sm">{channel.description?.substring(0, 50)}...</Text>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      color={
                        channel.status === 'active' ? 'green' : 
                        channel.status === 'pending' ? 'yellow' : 'red'
                      }
                    >
                      {channel.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {channel.videoStats ? (
                      <VideoStats 
                        total={channel.videoStats.total}
                        processed={channel.videoStats.processed}
                        processing={channel.videoStats.processing}
                        pending={channel.videoStats.pending}
                        failed={channel.videoStats.failed}
                      />
                    ) : (
                      <Badge color="zinc">No videos</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Text color="subtle">{new Date(channel.createdAt).toLocaleDateString()}</Text>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Link to={`/channels/${channel.id}`}>
                        <Button>
                          <DocumentTextIcon className="w-4 h-4 mr-1" />
                          Details
                        </Button>
                      </Link>
                      <Button 
                        color="zinc"
                        onClick={() => handleRefreshChannel(channel.id)}
                      >
                        <ArrowPathIcon className="w-4 h-4 mr-1" />
                        Refresh
                      </Button>
                      <Button 
                        color="red"
                        onClick={() => handleDeleteChannel(channel.id)}
                      >
                        <TrashIcon className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center p-10 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 my-8 dark:bg-zinc-900 dark:border-zinc-700">
          <VideoCameraIcon className="w-16 h-16 text-gray-400 mb-4" />
          <Heading level={3} className="mb-2 font-medium">No YouTube channels added yet</Heading>
          <Text color="subtle" className="mb-6 max-w-md">
            Add your first YouTube channel to start creating AI-powered Q&A widgets for your content.
          </Text>
          <Button onClick={handleAddChannel} color="blue">
            <PlusIcon className="w-5 h-5 mr-2" /> Add YouTube Channel
          </Button>
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
          
          // Show success notification if you have a notification system
          // showNotification({ type: 'success', message: 'Channel added successfully!' });
        }}
      />
    </SidebarLayout>
  );
};

export default ChannelsPage;