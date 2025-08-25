// WebSocket message types
export enum MessageType {
  CHAT = 'chat',
  NOTIFICATION = 'notification',
  STATUS = 'status',
  ERROR = 'error',
}

// Message interface
export interface WebSocketMessage {
  type: MessageType;
  content: string;
  timestamp?: string;
}

class WebSocketService {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout = 3000; // 3 seconds
  private messageHandlers: ((message: WebSocketMessage) => void)[] = [];

  private constructor() {
    if (typeof window !== 'undefined') {
      this.connect();
    }
  }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  private connect() {
    const wsUrl = `ws://${window.location.hostname}:3001`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('Connected to WebSocket server');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.notifyHandlers(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket connection closed');
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => this.connect(), this.reconnectTimeout);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  public sendMessage(message: WebSocketMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  public addMessageHandler(handler: (message: WebSocketMessage) => void) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  private notifyHandlers(message: WebSocketMessage) {
    this.messageHandlers.forEach(handler => handler(message));
  }
}

// Example usage:
/*
import { WebSocketService, MessageType, WebSocketMessage } from '@/lib/websocket';

// Get WebSocket instance
const ws = WebSocketService.getInstance();

// Send a message
ws.sendMessage({
  type: MessageType.CHAT,
  content: 'Hello, World!'
});

// Listen for messages
const removeHandler = ws.addMessageHandler((message: WebSocketMessage) => {
  console.log('Received message:', message);
});

// Remove handler when done
removeHandler();
*/

export default WebSocketService;
