import { Request, Response } from 'express';
import WebSocket from 'ws';
import { Server } from 'http';
import { logger } from '../../config/logger';
import { videoProcStatusSubscriber } from '../../services/processing/videoProcStatusSubscriber';

// Store WebSocket connections
let connections: WebSocket[] = [];

// Function to set up WebSocket server
export const setupWebSocketServer = (server: Server) => {
  const wss = new WebSocket.Server({ noServer: true });
  
  // Generate a unique ID for each connection
  const generateConnectionId = (): string => {
    return `conn_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  };
  
  // Handle WebSocket connection
  wss.on('connection', (ws: WebSocket) => {
    // Add connection ID for tracking
    const connectionId = generateConnectionId();
    (ws as any).connectionId = connectionId;
    
    // Add new connection to array
    connections.push(ws);
    
    logger.info(`New WebSocket connection established (ID: ${connectionId}). Total connections: ${connections.length}`);
    
    // Handle disconnection
    ws.on('close', (code, reason) => {
      connections = connections.filter(conn => conn !== ws);
      logger.info(`WebSocket connection closed (ID: ${connectionId}, code: ${code}, reason: ${reason || 'none'}). Remaining connections: ${connections.length}`);
    });
    
    // Track errors
    ws.on('error', (error) => {
      logger.error(`WebSocket error on connection (ID: ${connectionId}):`, error);
    });

    // Send initial ping to verify connection
    ws.send(JSON.stringify({ 
      type: 'connection', 
      connectionId: connectionId,
      message: 'Connected to video processing status updates',
      timestamp: new Date().toISOString()
    }));
  });
  
  // Handle upgrade request
  server.on('upgrade', (request, socket, head) => {
    // Check if the request is for our WebSocket endpoint
    if (request.url === '/api/status-updates') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });
  
  // Set up event listener for status updates from videoProcStatusSubscriber
  videoProcStatusSubscriber.on('statusUpdate', (statusUpdate) => {
    // Broadcast status update to all connected WebSocket clients
    const payload = JSON.stringify({
      ...statusUpdate,
      serverTimestamp: new Date().toISOString()
    });
    
    // Check for completed or failed statuses to log them more prominently
    if (statusUpdate.processingStatus === 'completed' || statusUpdate.processingStatus === 'failed') {
      logger.info(`Broadcasting ${statusUpdate.processingStatus.toUpperCase()} status for video ${statusUpdate.videoId} to ${connections.length} clients:`, statusUpdate);
    } else {
      logger.debug(`Broadcasting status update for video ${statusUpdate.videoId} to ${connections.length} clients:`, statusUpdate);
    }
    
    let sentCount = 0;
    connections.forEach(client => {
      const connectionId = (client as any).connectionId || 'unknown';
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
        sentCount++;
      } else {
        // Log connections that are not in OPEN state
        logger.debug(`Skipping send to connection ${connectionId} - state: ${getWebSocketStateString(client.readyState)}`);
      }
    });
    
    logger.debug(`Sent status update to ${sentCount}/${connections.length} active clients`);
  });
  
  // Helper function to get WebSocket state as string
  const getWebSocketStateString = (state: number): string => {
    switch (state) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'OPEN';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'CLOSED';
      default: return `UNKNOWN (${state})`;
    }
  };
  
  logger.info('WebSocket server for status updates initialized');
};