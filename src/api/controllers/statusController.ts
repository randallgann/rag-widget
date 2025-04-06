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
  
  // Handle WebSocket connection
  wss.on('connection', (ws: WebSocket) => {
    // Add new connection to array
    connections.push(ws);
    
    logger.info(`New WebSocket connection established. Total connections: ${connections.length}`);
    
    // Handle disconnection
    ws.on('close', () => {
      connections = connections.filter(conn => conn !== ws);
      logger.info(`WebSocket connection closed. Remaining connections: ${connections.length}`);
    });

    // Send initial ping to verify connection
    ws.send(JSON.stringify({ type: 'connection', message: 'Connected to video processing status updates' }));
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
    const payload = JSON.stringify(statusUpdate);
    
    logger.debug(`Broadcasting status update to ${connections.length} clients:`, statusUpdate);
    
    connections.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  });
  
  logger.info('WebSocket server for status updates initialized');
};