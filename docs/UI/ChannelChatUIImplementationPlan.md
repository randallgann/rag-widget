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

1. User navigates to channel chat from channel details
2. Frontend establishes SignalR connection with chat-copilot webapi
   - Connection includes channel ID and authentication context
   - Connection is scoped to receive updates only for this channel
3. User messages are sent to webapi through SignalR connection
4. Responses from LLM are received in real-time through the same connection
5. Chat history is persisted server-side and loaded on reconnection

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

### Phase 2: SignalR Integration

1. Set up SignalR client connection in frontend
2. Configure channel-specific connection parameters
3. Implement connection management (connect/disconnect/reconnect)
4. Test basic message sending and receiving

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

### SignalR Connection Management

```typescript
// Example SignalR connection setup with channel scoping
const initializeSignalRConnection = async (channelId: string, authToken: string) => {
  const connection = new HubConnectionBuilder()
    .withUrl(`http://chat-copilot-webapi:8080/chat?channelId=${channelId}`, {
      accessTokenFactory: () => authToken
    })
    .withAutomaticReconnect()
    .build();
    
  connection.on("ReceiveMessage", (message) => {
    // Handle incoming message from LLM
    updateChatHistory(message);
  });
  
  await connection.start();
  return connection;
};
```

### Chat Component Structure

```tsx
// Example component structure
const ChannelChat: React.FC = () => {
  const { channelId } = useParams<{ channelId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const connection = useSignalRConnection(channelId);
  
  const sendMessage = async () => {
    if (!inputValue.trim() || !connection) return;
    
    setIsLoading(true);
    const userMessage = {
      id: uuidv4(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    
    try {
      await connection.invoke("SendMessage", {
        channelId,
        message: userMessage.content
      });
    } catch (error) {
      // Handle error
    }
  };
  
  return (
    <div className="chat-container">
      <ChatHeader channelId={channelId} />
      <MessageList messages={messages} isLoading={isLoading} />
      <MessageInput 
        value={inputValue} 
        onChange={setInputValue}
        onSend={sendMessage}
        disabled={isLoading || !connection}
      />
    </div>
  );
};
```

## Next Steps

1. Create UI wireframes for chat interface
2. Set up routing and navigation
3. Implement basic SignalR connection
4. Build core chat components
5. Test integration with chat-copilot webapi