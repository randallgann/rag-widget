import React, { SetStateAction, useState } from 'react';
import { Dialog, DialogBody, DialogDescription, DialogActions, DialogTitle } from '@/components/dialog';
import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { Heading } from '@/components/heading';
import { 
  ArrowRightIcon, 
  VideoCameraIcon, 
  GlobeAltIcon, 
  ShieldCheckIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/16/solid';
import { PlusIcon } from '@heroicons/react/20/solid';
// We'll use fetch to call our backend API instead of directly using the YouTube service

// Step names for the wizard
const STEPS = {
  CHANNEL_TYPE: 'channelType',
  OWN_CHANNEL_AUTH: 'ownChannelAuth',
  OWN_CHANNEL_SELECT: 'ownChannelSelect',
  OWN_CHANNEL_CONFIG: 'ownChannelConfig',
  PUBLIC_CHANNEL_ID: 'publicChannelId',
  PUBLIC_CHANNEL_LEGAL: 'publicChannelLegal',
  PUBLIC_CHANNEL_CONFIG: 'publicChannelConfig',
  PROCESSING: 'processing',
  COMPLETED: 'completed'
};

/**
 * Format subscriber count for display (e.g., 1500 -> 1.5K)
 * @param subscriberCount Subscriber count as string
 * @returns Formatted subscriber count
 */
function formatSubscriberCount(subscriberCount: string): string {
  const count = parseInt(subscriberCount, 10);
  
  if (isNaN(count)) {
    return '0';
  }
  
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  
  return count.toString();
}

interface ChannelOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  authenticatedFetch?: (url: string, options?: RequestInit) => Promise<Response>;
  onChannelCreated?: (newChannel: any) => void;
}

interface Channel {
  id: string;
  name: string;
  videoCount: number;
  subscriberCount: string;
  imageUrl: string;
}

interface ProcessingStatus {
  status: 'initializing' | 'processing' | 'completed';
  progress: number;
  processedVideos: number;
  totalVideos: number;
}

const ChannelOnboardingModal: React.FC<ChannelOnboardingModalProps> = ({ 
  isOpen, 
  onClose,
  authenticatedFetch,
  onChannelCreated
 }) => {
  const [currentStep, setCurrentStep] = useState(STEPS.CHANNEL_TYPE);
  const [channelType, setChannelType] = useState<'own' | 'public' | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [legalAgreed, setLegalAgreed] = useState(false);
  const [channelInput, setChannelInput] = useState('');
  const [channelError, setChannelError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    status: 'initializing',
    progress: 0,
    processedVideos: 0,
    totalVideos: 0
  });

  // Sample data for demonstration
  const sampleChannels = [
    { id: '1', name: 'My Tech Channel', videoCount: 42, subscriberCount: '5.2K', imageUrl: '/api/placeholder/48/48' },
    { id: '2', name: 'Cooking with Code', videoCount: 28, subscriberCount: '3.1K', imageUrl: '/api/placeholder/48/48' }
  ];
  
  const resetFlow = () => {
    setCurrentStep(STEPS.CHANNEL_TYPE);
    setChannelType(null);
    setSelectedChannel(null);
    setLegalAgreed(false);
    setChannelInput('');
    setChannelError(null);
    setProcessingStatus({
      status: 'initializing',
      progress: 0,
      processedVideos: 0,
      totalVideos: 0
    });
  };

  const handleChannelTypeSelect = (type: SetStateAction<"own" | "public" | null>) => {
    setChannelType(type);
    if (type === 'own') {
      setCurrentStep(STEPS.OWN_CHANNEL_AUTH);
    } else {
      setCurrentStep(STEPS.PUBLIC_CHANNEL_ID);
    }
  };

  const handleYouTubeAuth = () => {
    // In a real implementation, this would trigger the OAuth flow
    console.log('Initializing YouTube OAuth...');
    // Mock successful authentication
    setCurrentStep(STEPS.OWN_CHANNEL_SELECT);
  };

  const handleChannelSelect = (channel: Channel) => {
    setSelectedChannel(channel);
    setCurrentStep(STEPS.OWN_CHANNEL_CONFIG);
  };

  const handlePublicChannelSubmit = async (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    
    if (!channelInput.trim()) {
      setChannelError('Please enter a YouTube channel URL or ID');
      return;
    }
    
    // Set a loading state
    setChannelError('Validating channel...');
    
    try {
      // Call our backend API to validate the channel
      const response = await fetch('/api/channels/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channelIdentifier: channelInput })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setChannelError(data.message || 'Failed to validate channel');
        return;
      }
      
      const channelData = data.data.channel;
      
      // Set the selected channel with data from our backend
      setSelectedChannel({
        id: channelData.id,
        name: channelData.name,
        videoCount: channelData.videoCount,
        subscriberCount: formatSubscriberCount(channelData.subscriberCount),
        imageUrl: channelData.thumbnailUrl
      });
      
      // Clear any errors
      setChannelError(null);
      
      // Proceed to the next step
      setCurrentStep(STEPS.PUBLIC_CHANNEL_LEGAL);
    } catch (error) {
      console.error('Error validating channel:', error);
      setChannelError('Failed to validate the channel. Please check your input and try again.');
    }
  };

  const handleLegalAgreement = () => {
    setLegalAgreed(true);
    setCurrentStep(STEPS.PUBLIC_CHANNEL_CONFIG);
  };

  const startProcessing = async () => {
    setCurrentStep(STEPS.PROCESSING);
    
    // Set initial processing status
    setProcessingStatus({
      status: 'initializing',
      progress: 0,
      processedVideos: 0,
      totalVideos: selectedChannel?.videoCount || 0
    });
    
    try {
      if (!authenticatedFetch) {
        throw new Error('Authentication fetch function not available');
      }
      
      if (!selectedChannel) {
        throw new Error('No channel selected');
      }
      
      // First, update processing status to show we're creating the channel
      setProcessingStatus(prev => ({
        ...prev,
        status: 'processing',
        progress: 10,
        processedVideos: 0
      }));
      
      // Create the channel and retrieve video metadata
      const response = await authenticatedFetch('/api/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelDetails: selectedChannel,
          // Use the current user's ID from the authenticated request
          // The authenticatedFetch should automatically include the user's auth token
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create channel');
      }
      
      const data = await response.json();
      const createdChannel = data.data.channel;
      
      // Update progress to indicate metadata retrieval is complete
      setProcessingStatus(prev => ({
        ...prev,
        progress: 50,
        processedVideos: Math.floor(prev.totalVideos * 0.5)
      }));
      
      // Simulate processing completion for now
      // In the future, this would poll the actual processing status
      const interval = setInterval(() => {
        setProcessingStatus(prev => {
          const newProgress = Math.min(prev.progress + 10, 100);
          const newProcessedVideos = Math.floor((newProgress / 100) * prev.totalVideos);
          
          if (newProgress >= 100) {
            clearInterval(interval);
            setTimeout(() => setCurrentStep(STEPS.COMPLETED), 500);
          }
          
          return {
            ...prev,
            status: newProgress < 100 ? 'processing' : 'completed',
            progress: newProgress,
            processedVideos: newProcessedVideos
          };
        });
      }, 1000);
      
      // If a callback was provided for channel creation, call it
      if (onChannelCreated) {
        onChannelCreated(createdChannel);
      }
    } catch (error) {
      console.error('Error creating channel:', error);
      
      // Update status to show error
      setProcessingStatus(prev => ({
        ...prev,
        status: 'initializing',
        progress: 0
      }));
      
      // Set error message (would need to add this to component state)
      // setProcessingError(error.message);
      
      // Revert to previous step
      setCurrentStep(prev => 
        prev === STEPS.PUBLIC_CHANNEL_CONFIG 
          ? STEPS.PUBLIC_CHANNEL_CONFIG 
          : STEPS.OWN_CHANNEL_CONFIG
      );
    }
  };

  const finalizeSetup = () => {
    // In a real implementation, this would save final settings
    // and redirect to the channel management page
    onClose();
    resetFlow();
  };

  // Render different content based on the current step
  const renderStepContent = () => {
    switch (currentStep) {
      case STEPS.CHANNEL_TYPE:
        return (
          <>
            <DialogTitle>Add YouTube Channel</DialogTitle>
            <DialogDescription>
                Select the type of YouTube channel you want to add.
            </DialogDescription>
            
            <div className="grid grid-cols-1 gap-4 py-4 md:grid-cols-2">
              <button
                onClick={() => handleChannelTypeSelect('own')}
                className="flex flex-col items-center rounded-lg border-2 border-transparent bg-white p-6 text-center shadow-sm transition-all hover:border-blue-500 hover:shadow-md dark:bg-zinc-800"
              >
                <div className="mb-4 rounded-full bg-blue-100 p-3 dark:bg-blue-900/30">
                  <VideoCameraIcon className="h-8 w-8 text-blue-600" />
                </div>
                <Heading level={4} className="mb-2">My Own YouTube Channel</Heading>
                <Text color="subtle">
                  Connect your own channel to create AI-powered Q&A widgets for your content.
                </Text>
              </button>
              
              <button
                onClick={() => handleChannelTypeSelect('public')}
                className="flex flex-col items-center rounded-lg border-2 border-transparent bg-white p-6 text-center shadow-sm transition-all hover:border-blue-500 hover:shadow-md dark:bg-zinc-800"
              >
                <div className="mb-4 rounded-full bg-purple-100 p-3 dark:bg-purple-900/30">
                  <GlobeAltIcon className="h-8 w-8 text-purple-600" />
                </div>
                <Heading level={4} className="mb-2">Public YouTube Channel</Heading>
                <Text color="subtle">
                  Create widgets for public YouTube channels with proper attribution.
                </Text>
              </button>
            </div>
            
            <div className="mt-4 flex justify-end space-x-2">
              <Button onClick={onClose}>Cancel</Button>
            </div>
          </>
        );
        
      case STEPS.OWN_CHANNEL_AUTH:
        return (
          <>
              <DialogTitle>Connect to YouTube</DialogTitle>
              <DialogDescription>
                Authorize access to your YouTube channel to create AI-powered Q&A widgets.
              </DialogDescription>
            
            <div className="py-6">
              <div className="mb-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
                <Heading level={4} className="mb-2 flex items-center">
                  <ShieldCheckIcon className="mr-2 h-5 w-5 text-green-600" />
                  Required Permissions
                </Heading>
                <ul className="ml-6 list-disc space-y-2 text-sm">
                  <li>Read-only access to your channel information</li>
                  <li>Access to view your videos (content and metadata)</li>
                  <li>We <strong>cannot</strong> modify your channel or videos</li>
                </ul>
              </div>
              
              <Button color="blue" onClick={handleYouTubeAuth}>
                <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M21.582,6.186c-0.23-0.86-0.908-1.538-1.768-1.768C18.254,4,12,4,12,4S5.746,4,4.186,4.418 c-0.86,0.23-1.538,0.908-1.768,1.768C2,7.746,2,12,2,12s0,4.254,0.418,5.814c0.23,0.86,0.908,1.538,1.768,1.768 C5.746,20,12,20,12,20s6.254,0,7.814-0.418c0.861-0.23,1.538-0.908,1.768-1.768C22,16.254,22,12,22,12S22,7.746,21.582,6.186z M10,15.464V8.536L16,12L10,15.464z" />
                </svg>
                Connect to YouTube
              </Button>
            </div>
            
            <div className="mt-4 flex justify-between">
              <Button onClick={() => setCurrentStep(STEPS.CHANNEL_TYPE)}>
                Back
              </Button>
              <Button disabled>
                Next <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </>
        );
        
      case STEPS.OWN_CHANNEL_SELECT:
        return (
          <>
              <DialogTitle>Select YouTube Channel</DialogTitle>
              <DialogDescription>
                Choose which of your YouTube channels you want to add.
              </DialogDescription>
            
            <div className="py-6">
              <div className="space-y-4">
                {sampleChannels.map(channel => (
                  <button
                    key={channel.id}
                    onClick={() => handleChannelSelect(channel)}
                    className="w-full rounded-lg border border-zinc-200 bg-white p-4 text-left transition-all hover:border-blue-500 hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <div className="flex items-center">
                      <img 
                        src={channel.imageUrl}
                        alt={channel.name}
                        className="mr-4 h-12 w-12 rounded-full"
                      />
                      <div>
                        <Heading level={4} className="mb-1">{channel.name}</Heading>
                        <div className="flex text-sm text-zinc-500 dark:text-zinc-400">
                          <span className="mr-4">{channel.subscriberCount} subscribers</span>
                          <span>{channel.videoCount} videos</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mt-4 flex justify-between">
              <Button onClick={() => setCurrentStep(STEPS.OWN_CHANNEL_AUTH)}>
                Back
              </Button>
              <Button disabled>
                Next <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </>
        );

      case STEPS.OWN_CHANNEL_CONFIG:
        return (
          <>
              <DialogTitle>Configure Channel</DialogTitle>
              <DialogDescription>
                Choose which videos to include and set processing options.
              </DialogDescription>
            
            <div className="py-6">
              <div className="mb-6">
                <Heading level={4} className="mb-2">Content Selection</Heading>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input type="radio" name="content-selection" value="all" defaultChecked />
                    <span>All videos ({selectedChannel?.videoCount || 0} videos)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="radio" name="content-selection" value="playlists" />
                    <span>Selected playlists</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="radio" name="content-selection" value="individual" />
                    <span>Individual videos</span>
                  </label>
                </div>
              </div>
              
              <div className="mb-6">
                <Heading level={4} className="mb-2">Processing Options</Heading>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" name="high-quality" defaultChecked />
                    <span>High-quality transcription (recommended)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" name="auto-update" defaultChecked />
                    <span>Auto-update when new videos are published</span>
                  </label>
                </div>
              </div>
              
              <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
                <Heading level={4} className="mb-2">Processing Summary</Heading>
                <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
                  <li>• Channel: {selectedChannel?.name}</li>
                  <li>• Videos to process: {selectedChannel?.videoCount || 0}</li>
                  <li>• Estimated processing time: ~{Math.ceil((selectedChannel?.videoCount || 0) * 0.5)} minutes</li>
                </ul>
              </div>
            </div>
            
            <div className="mt-4 flex justify-between">
              <Button onClick={() => setCurrentStep(STEPS.OWN_CHANNEL_SELECT)}>
                Back
              </Button>
              <Button color="blue" onClick={startProcessing}>
                Start Processing <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </>
        );

      case STEPS.PUBLIC_CHANNEL_ID:
        return (
          <>
              <DialogTitle>Enter YouTube Channel</DialogTitle>
              <DialogDescription>
                Enter the URL, ID, or name of the public YouTube channel you want to add.
              </DialogDescription>
            
            <form onSubmit={handlePublicChannelSubmit} className="py-6">
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium">
                  YouTube Channel URL or ID
                </label>
                <input 
                  type="text"
                  placeholder="e.g., https://www.youtube.com/c/ChannelName or @ChannelHandle"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:border-zinc-600 dark:bg-zinc-800"
                  value={channelInput}
                  onChange={(e) => setChannelInput(e.target.value)}
                  required
                />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  You can use the channel URL, custom URL, or @handle
                </p>
                {channelError && (
                  <p className="mt-2 text-sm text-red-500">
                    {channelError === 'Validating channel...' ? (
                      <span className="flex items-center">
                        <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Validating channel...
                      </span>
                    ) : (
                      channelError
                    )}
                  </p>
                )}
              </div>
              
              <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/20">
                <Heading level={4} className="mb-2 flex items-center text-amber-800 dark:text-amber-400">
                  <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Important Notice
                </Heading>
                <Text className="text-sm text-amber-700 dark:text-amber-300">
                  When creating a widget for a public channel, you are responsible for ensuring compliance with 
                  YouTube's Terms of Service and proper attribution to the original content creators.
                </Text>
              </div>
              
              <div className="flex justify-between">
                <Button type="button" onClick={() => setCurrentStep(STEPS.CHANNEL_TYPE)}>
                  Back
                </Button>
                <Button type="submit" color="blue">
                  Next <ArrowRightIcon className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          </>
        );
        
      case STEPS.PUBLIC_CHANNEL_LEGAL:
        return (
          <>
              <DialogTitle>Legal Acknowledgment</DialogTitle>
              <DialogDescription>
                Please review and acknowledge the following terms before proceeding.
              </DialogDescription>
            
            <div className="py-6">
              <div className="max-h-64 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
                <Heading level={4} className="mb-2">Terms for Using Public YouTube Content</Heading>
                
                <div className="space-y-4 text-sm">
                  <p>By creating a widget for a public YouTube channel, you agree to:</p>
                  
                  <ol className="ml-6 list-decimal space-y-2">
                    <li>Respect the intellectual property rights of the original content creators</li>
                    <li>Include clear and visible attribution to the original YouTube channel and creator in your widget</li>
                    <li>Use the content for informational and educational purposes only</li>
                    <li>Immediately remove or disable any content upon request from the original creator</li>
                    <li>Comply with YouTube's Terms of Service and API policies</li>
                    <li>Not misrepresent your relationship with the channel or creator</li>
                    <li>Take full responsibility for any legal claims that may arise from your use of the content</li>
                  </ol>
                  
                  <p>Additionally, you understand that:</p>
                  
                  <ul className="ml-6 list-disc space-y-2">
                    <li>Creating AI-powered widgets for others' content may be subject to copyright limitations</li>
                    <li>The original content creators may request the removal of their content from your widget at any time</li>
                    <li>RAG Widget is not responsible for any legal disputes that may arise from your use of public content</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-4">
                <label className="flex items-start space-x-2">
                  <input 
                    type="checkbox" 
                    className="mt-1"
                    checked={legalAgreed}
                    onChange={() => setLegalAgreed(!legalAgreed)}
                  />
                  <span className="text-sm">
                    I acknowledge and agree to the terms above, and I take full responsibility for my use of public YouTube content.
                  </span>
                </label>
              </div>
            </div>
            
            <div className="mt-4 flex justify-between">
              <Button onClick={() => setCurrentStep(STEPS.PUBLIC_CHANNEL_ID)}>
                Back
              </Button>
              <Button 
                color="blue" 
                disabled={!legalAgreed}
                onClick={handleLegalAgreement}
              >
                I Agree <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </>
        );
        
      case STEPS.PUBLIC_CHANNEL_CONFIG:
        return (
          <>
              <DialogTitle>Configure Public Channel</DialogTitle>
              <DialogDescription>
                Choose content selection and attribution settings.
              </DialogDescription>
            
            <div className="py-6">
              <div className="mb-6">
                <Heading level={4} className="mb-2">Content Selection</Heading>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input type="radio" name="content-selection" value="recent" defaultChecked />
                    <span>Recent videos (last 50 videos)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="radio" name="content-selection" value="popular" />
                    <span>Most popular videos (top 50 by views)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="radio" name="content-selection" value="playlists" />
                    <span>Specific playlists</span>
                  </label>
                </div>
              </div>
              
              <div className="mb-6">
                <Heading level={4} className="mb-2">Attribution Settings</Heading>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Attribution Text
                    </label>
                    <input 
                      type="text"
                      placeholder="Content provided by [Channel Name]"
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:border-zinc-600 dark:bg-zinc-800"
                      defaultValue={`Content provided by ${selectedChannel?.name || 'Channel Name'} on YouTube`}
                    />
                  </div>
                  
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Attribution Display
                    </label>
                    <select 
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:border-zinc-600 dark:bg-zinc-800"
                    >
                      <option value="widget-footer">Widget footer (always visible)</option>
                      <option value="responses">Include in responses</option>
                      <option value="both">Both footer and responses</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
                <Heading level={4} className="mb-2">Attribution Preview</Heading>
                <div className="rounded-md bg-white p-3 dark:bg-zinc-900">
                  <div className="mb-2 text-sm font-medium">Widget Footer:</div>
                  <div className="flex items-center text-xs text-zinc-600 dark:text-zinc-400">
                    <svg className="mr-1 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M21.582,6.186c-0.23-0.86-0.908-1.538-1.768-1.768C18.254,4,12,4,12,4S5.746,4,4.186,4.418 c-0.86,0.23-1.538,0.908-1.768,1.768C2,7.746,2,12,2,12s0,4.254,0.418,5.814c0.23,0.86,0.908,1.538,1.768,1.768 C5.746,20,12,20,12,20s6.254,0,7.814-0.418c0.861-0.23,1.538-0.908,1.768-1.768C22,16.254,22,12,22,12S22,7.746,21.582,6.186z M10,15.464V8.536L16,12L10,15.464z" />
                    </svg>
                    Content provided by {selectedChannel?.name || 'Channel Name'} on YouTube
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 flex justify-between">
              <Button onClick={() => setCurrentStep(STEPS.PUBLIC_CHANNEL_LEGAL)}>
                Back
              </Button>
              <Button color="blue" onClick={startProcessing}>
                Start Processing <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </>
        );
        
      case STEPS.PROCESSING:
        return (
          <>
              <DialogTitle>Processing Channel Content</DialogTitle>
              <DialogDescription>
                We're fetching and processing videos from the YouTube channel.
              </DialogDescription>
            
            <div className="py-6">
              <div className="mb-6">
                <div className="mb-2 flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{processingStatus.progress}%</span>
                </div>
                <div className="h-4 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                  <div 
                    className="h-full bg-blue-600 transition-all duration-300 ease-in-out" 
                    style={{ width: `${processingStatus.progress}%` }}
                  ></div>
                </div>
                <div className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
                  Processed {processingStatus.processedVideos} of {processingStatus.totalVideos} videos
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center">
                  <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                    <CheckIcon className="h-5 w-5" />
                  </div>
                  <span>Channel metadata retrieved</span>
                </div>
                
                <div className="flex items-center">
                  <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                    <CheckIcon className="h-5 w-5" />
                  </div>
                  <span>Video list fetched</span>
                </div>
                
                <div className="flex items-center">
                  {processingStatus.progress < 50 ? (
                    <div className="mr-3 flex h-8 w-8 animate-pulse items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                      <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  ) : (
                    <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                      <CheckIcon className="h-5 w-5" />
                    </div>
                  )}
                  <span>Processing videos ({processingStatus.processedVideos}/{processingStatus.totalVideos})</span>
                </div>
                
                <div className="flex items-center">
                  {processingStatus.progress < 100 ? (
                    <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
                      <span className="h-5 w-5"></span>
                    </div>
                  ) : (
                    <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                      <CheckIcon className="h-5 w-5" />
                    </div>
                  )}
                  <span className={processingStatus.progress < 100 ? "text-zinc-400 dark:text-zinc-500" : ""}>
                    Creating AI knowledge base
                  </span>
                </div>
              </div>
              
              <div className="mt-6 rounded-lg border border-amber-100 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/10">
                <Text className="text-sm text-amber-800 dark:text-amber-300">
                  This process may take some time depending on the number and length of videos.
                  You can close this dialog and continue using the application.
                  We'll notify you when processing is complete.
                </Text>
              </div>
            </div>
            
            <div className="mt-4 flex justify-end">
              <Button onClick={onClose}>Close</Button>
            </div>
          </>
        );
        
      case STEPS.COMPLETED:
        return (
          <>
              <DialogTitle>Processing Complete</DialogTitle>
              <DialogDescription>
                Your YouTube channel has been processed successfully.
              </DialogDescription>
            
            <div className="py-6">
              <div className="mb-6 flex flex-col items-center justify-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                  <CheckIcon className="h-8 w-8" />
                </div>
                <Heading level={3} className="mb-2 text-center">Channel Ready!</Heading>
                <Text color="subtle" className="text-center">
                  Your YouTube channel has been processed and is ready to use.
                </Text>
              </div>
              
              <div className="mb-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
                <Heading level={4} className="mb-2">Processing Summary</Heading>
                <ul className="space-y-1 text-sm">
                  <li>• Successfully processed: {processingStatus.processedVideos} videos</li>
                  <li>• Total processing time: 5 minutes, 32 seconds</li>
                  <li>• Knowledge base size: 42MB</li>
                </ul>
              </div>
              
              <div className="space-y-4">
                <Button color="blue" className="w-full justify-center" onClick={() => window.location.href = '/widgets/new'}>
                  <PlusIcon className="mr-2 h-5 w-5" />
                  Create Widget Now
                </Button>
                
                <Button color="white" className="w-full justify-center" onClick={() => window.location.href = '/channels'}>
                  Manage Channel
                </Button>
              </div>
            </div>
            
            <div className="mt-4 flex justify-end">
              <Button onClick={finalizeSetup}>Done</Button>
            </div>
          </>
        );
        
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogBody className="sm:max-w-lg">
        {renderStepContent()}
      </DialogBody>
    </Dialog>
  );
};

// Sample usage component
const AddChannelButton = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  return (
    <div className="p-8">
      <Button color="blue" onClick={() => setIsModalOpen(true)}>
        <PlusIcon className="mr-2 h-5 w-5" />
        Add YouTube Channel
      </Button>
      
      <ChannelOnboardingModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

export { ChannelOnboardingModal };
export default AddChannelButton;