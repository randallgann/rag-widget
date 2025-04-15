import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { UserProfileResponse, ChannelResponse } from '../../types/api';
import { SidebarLayout } from '../../components/sidebar-layout';
import { 
  Sidebar, 
  SidebarHeader, 
  SidebarBody, 
  SidebarFooter, 
  SidebarItem, 
  SidebarLabel,
  SidebarSection,
  SidebarSpacer
} from '../../components/sidebar';
import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from '../../components/navbar';
import { Dropdown, DropdownButton, DropdownMenu, DropdownItem, DropdownLabel, DropdownDivider } from '../../components/dropdown';
import { Avatar } from '../../components/avatar';
import { Heading } from '../../components/heading';
import { Text } from '../../components/text';
import { Button } from '../../components/button';
import { Badge } from '../../components/badge';
import {
  ArrowRightStartOnRectangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Cog8ToothIcon,
  LightBulbIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  VideoCameraIcon,
  CodeBracketIcon,
  ChevronLeftIcon,
  PaperAirplaneIcon
} from '@heroicons/react/16/solid';
import {
  Cog6ToothIcon,
  HomeIcon,
  QuestionMarkCircleIcon,
  SparklesIcon,
} from '@heroicons/react/20/solid';

interface ChannelChatProps {
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

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

const ChannelChat: React.FC<ChannelChatProps> = ({ authenticatedFetch, user: initialUser }) => {
  const { channelId } = useParams<{ channelId: string }>();
  const [user, setUser] = useState<UserProfileResponse['user'] | null>(initialUser || null);
  const [channel, setChannel] = useState<ChannelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  
  // Chat messages state
  const [messages, setMessages] = useState<Message[]>([
    // Initial messages for testing
    {
      id: '1',
      content: 'Hello! How can I help you with questions about this channel?',
      sender: 'assistant',
      timestamp: new Date()
    }
  ]);

  // Create a simple logger
  const logger = {
    debug: (message: string, data?: any) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[CHAT DEBUG] ${message}`, data || '');
      }
    },
    error: (message: string, data?: any) => {
      console.error(`[CHAT ERROR] ${message}`, data || '');
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

  // Function to send a message
  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    
    // Add user message to chat
    const userMessage: Message = {
      id: Math.random().toString(36).substring(2, 9),
      content: inputValue,
      sender: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    
    // For demo purposes, we'll add a dummy response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: Math.random().toString(36).substring(2, 9),
        content: `This is a placeholder response. In the future, we'll connect to the chat-copilot webapi to get real responses about channel ID: ${channelId}`,
        sender: 'assistant',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    }, 1000);
  };

  // Handle input enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
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
            <div className="flex items-center">
              <Link to={`/channels/${channelId}`} className="mr-2">
                <Button color="zinc">
                  <ChevronLeftIcon className="w-4 h-4 mr-1" />
                  Back to Channel
                </Button>
              </Link>
              <Heading level={1} className="text-lg font-medium">Channel Chat</Heading>
            </div>
          </NavbarSection>
          <NavbarSpacer />
          <NavbarSection>
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
      {/* Chat Interface */}
      <div className="flex flex-col h-[calc(100vh-10rem)]">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto mb-4 p-4 border rounded-lg bg-gray-50 dark:bg-zinc-800">
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`mb-4 ${message.sender === 'user' ? 'text-right' : ''}`}
            >
              <div 
                className={`inline-block max-w-[80%] p-3 rounded-lg ${
                  message.sender === 'user' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white text-gray-800 dark:bg-zinc-700 dark:text-gray-100'
                }`}
              >
                <p>{message.content}</p>
                <div className={`text-xs mt-1 ${
                  message.sender === 'user'
                    ? 'text-blue-100'
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Message Input */}
        <div className="flex items-center">
          <textarea
            className="flex-1 p-3 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
            placeholder="Ask a question about this channel..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            style={{ resize: 'none' }}
          />
          <Button 
            color="blue" 
            className="rounded-l-none"
            onClick={handleSendMessage}
            disabled={!inputValue.trim()}
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </SidebarLayout>
  );
};

export default ChannelChat;