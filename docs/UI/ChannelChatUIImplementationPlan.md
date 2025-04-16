# Channel Chat UI Implementation Plan

## Overview

This document outlines the plan for extending the existing api-service with a chat UI interface that integrates with the chat-copilot webapi service. Each channel will have its own dedicated chat interface, with channel-specific content and context.

## Design Principles

1. **Channel-Specific Context**: Each chat interface will be specific to a single channel
2. **Seamless Navigation**: Users should be able to easily navigate between channel dashboard and chat interface
3. **Real-Time Communication**: SignalR/WebSocket connections for real-time chat with the LLM
4. **Consistent UI**: Maintain the same design language as the existing dashboard
5. **Context Awareness**: Chat should be aware of channel content for relevant responses

## Technical Architecture

### Components

1. **Chat UI React Components**
   - ChatContainer: Main component for chat interface
   - MessageList: Display chat history
   - MessageInput: Text input with send button
   - ChatHeader: Shows channel info and navigation
   - ProcessingIndicator: Visual feedback during LLM processing

2. **Chat Service Layer**
   - SignalR/WebSocket connection management
   - Message formatting and handling
   - Chat history persistence
   - Error handling and reconnection logic

3. **API Integration**
   - Connection to chat-copilot webapi (port 3080)
   - Authentication token forwarding
   - Channel context provider

### Data Flow

1. **Initialization**
   - User navigates to channel chat from channel details page
   - Frontend creates a chat session via HTTP API with the channel ID as contextId
   - Frontend establishes SignalR connection with chat-copilot webapi's MessageRelayHub
   - Connection joins a group specific to the chat session

2. **Sending Messages**
   - User enters a message in the chat interface
   - Message is sent to webapi via HTTP POST to `/chats/{chatId}/messages`
   - The channel ID is included as contextId to maintain channel-specific context

3. **Receiving Updates**
   - Bot responses are received in real-time through the SignalR connection
   - Status updates (like "bot is thinking") come through SignalR events
   - Other user interactions (if implementing multi-user chat) are also received via SignalR

4. **Persistence**
   - Chat history is persisted server-side by the chat-copilot webapi
   - Previous messages can be loaded via HTTP GET to `/chats/{chatId}/messages`
   - Chat sessions for a specific channel can be retrieved via GET to `/chats/context/{channelId}`

## UI/UX Design

1. **Navigation**
   - Add "Chat with this Channel" button on channel details page
   - Include breadcrumb navigation for returning to channel details
   - Consider a slide-in panel design for smoother transition

2. **Chat Interface**
   - Message bubbles with clear user/assistant distinction
   - Markdown support for formatted responses
   - Code block formatting with syntax highlighting
   - Loading indicators during processing
   - Timestamp display for messages
   - Support for scrolling through chat history

3. **Channel Context Display**
   - Show channel title and thumbnail
   - Indicate number of videos processed/available
   - Display any relevant channel metadata

## Implementation Plan

### Phase 1: Foundation

1. Create basic React components for chat interface
2. Implement route for chat UI (`/channels/:channelId/chat`)
3. Add navigation buttons on channel details page
4. Set up basic UI layout and styling

### Phase 2: Chat-Copilot API Integration

1. **HTTP API Integration**
   - Implement chat session creation via POST `/chats`
   - Set up authentication for API requests
   - Create message sending functionality using POST `/chats/{chatId}/messages`
   - Pass channel context using the `contextId` parameter

2. **SignalR Integration**
   - Set up SignalR client connection to MessageRelayHub
   - Configure channel-specific group membership
   - Implement connection management (connect/disconnect/reconnect)
   - Add handlers for receiving bot responses via SignalR events

### Phase 3: Full Chat Experience

1. Implement complete message history display
2. Add user input handling and validation
3. Support markdown rendering for responses
4. Implement loading states and error handling
5. Add typing indicators and other UX enhancements

### Phase 4: Channel Context Integration

1. Pass relevant channel data to chat interface
2. Configure chat-copilot webapi to use channel data as context
3. Implement context-aware prompting
4. Test responses with channel-specific knowledge

## Technical Considerations

### Communication Pattern

The chat interface uses two communication channels with the chat-copilot webapi:

1. **HTTP API for Command Operations**
   ```typescript
   // Example HTTP API for sending messages
   const sendChatMessage = async (chatId: string, message: string, channelId: string) => {
     const response = await fetch(`http://localhost:3080/chats/${chatId}/messages`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'Authorization': `Bearer ${accessToken}`
       },
       body: JSON.stringify({
         input: message,
         contextId: channelId // Pass channel context to isolate conversations
       })
     });
     
     return await response.json();
   };
   ```

2. **SignalR for Real-time Updates**
   ```typescript
   // Example SignalR connection setup with channel scoping
   const initializeSignalRConnection = async (chatId: string, authToken: string) => {
     const connection = new HubConnectionBuilder()
       .withUrl(`http://localhost:3080/messageRelayHub`, {
         accessTokenFactory: () => authToken
       })
       .withAutomaticReconnect()
       .build();
       
     // Add handlers for different types of messages
     connection.on("ReceiveMessage", (chatId, senderId, message) => {
       // Handle incoming message from other users
       updateChatHistory(message);
     });
     
     connection.on("ReceiveBotResponseStatus", (chatId, status) => {
       // Handle bot response status updates
       updateBotStatus(status);
     });
     
     // Start the connection
     await connection.start();
     
     // Join the specific chat group using the chat ID
     await connection.invoke("AddClientToGroupAsync", chatId);
     
     return connection;
   };
```

### Chat Component Structure

```tsx
// Example component structure using hybrid HTTP/SignalR approach
const ChannelChat: React.FC = () => {
  const { channelId } = useParams<{ channelId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const connectionRef = useRef<HubConnection | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  
  // Initialize chat session and SignalR connection on component mount
  useEffect(() => {
    const initializeChat = async () => {
      try {
        // 1. Create or get existing chat session for this channel
        const session = await createOrGetChatSession(channelId);
        setChatSession(session);
        
        // 2. Load chat history
        const history = await getChatMessages(session.id);
        setMessages(history);
        
        // 3. Initialize SignalR connection for real-time updates
        const connection = await initializeSignalRConnection(session.id, await getAuthToken());
        connectionRef.current = connection;
        setConnectionStatus('connected');
      } catch (error) {
        console.error('Failed to initialize chat:', error);
        setConnectionStatus('error');
      }
    };
    
    initializeChat();
    
    // Cleanup connection on unmount
    return () => {
      if (connectionRef.current) {
        connectionRef.current.stop();
      }
    };
  }, [channelId]);
  
  // Send message via HTTP API
  const sendMessage = async () => {
    if (!inputValue.trim() || !chatSession) return;
    
    setIsLoading(true);
    const userMessage = {
      id: uuidv4(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date()
    };
    
    // Add user message to UI immediately (optimistic update)
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    
    try {
      // Send message via HTTP API
      await sendChatMessage(
        chatSession.id,
        userMessage.content, 
        channelId // Pass channelId as contextId
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      // Handle error (possibly remove the message from UI)
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="chat-container">
      <ChatHeader 
        channelId={channelId}
        connectionStatus={connectionStatus} 
      />
      <MessageList 
        messages={messages} 
        isLoading={isLoading} 
      />
      <MessageInput 
        value={inputValue} 
        onChange={setInputValue}
        onSend={sendMessage}
        disabled={isLoading || connectionStatus !== 'connected'}
      />
    </div>
  );
};
```

## Next Steps

### Implementation Sequence

1. **Foundation (Already Completed)**
   - Created basic UI components and navigation
   - Set up routing in App.tsx
   - Added "Chat with this Channel" button on channel details page

2. **Chat Session Management**
   - Implement HTTP service for creating chat sessions
   - Add functions to retrieve chat history
   - Create authentication token handling for chat-copilot API

3. **Real-time Updates with SignalR**
   - Implement SignalR connection to MessageRelayHub
   - Add handlers for different message types
   - Create connection management with reconnection logic
   - Implement real-time bot response display

4. **Complete Chat Experience**
   - Enhance UI with message styling and formatting
   - Add loading states and typing indicators
   - Implement error handling and reconnection logic
   - Add chat history persistence and retrieval

5. **Channel-Kernel Integration**
   - Implement kernel management for channel-specific AI contexts:
     - Create a kernel for each YouTube channel during channel creation
     - Store the mapping between channel ID and kernel ID in the database
     - Add a kernelService to manage kernel creation, retrieval and configuration
     - Update the channel onboarding process to create associated kernels
     - Enhance the chat session creation to use channel-specific kernels
   - Add database schema updates:
     - New column in Channels table to store the kernel ID
     - Migration script to update existing channels

6. **Channel Context Integration**
   - Pass channel metadata to chat-copilot for context
   - Configure prompt templates with channel-specific knowledge
   - Test responses with channel-specific understanding
   - Fine-tune the experience for YouTube content questions
   - Add video content indexing to provide relevant information to the chat:
     - Extract transcripts and metadata from processed videos
     - Store embeddings in the vector database
     - Configure the chat service to query channel-specific vectors