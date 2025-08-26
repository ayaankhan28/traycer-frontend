'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { HighlightedMarkdown } from '@/components/highlighted-markdown';
import WebSocketService, { MessageType } from '@/lib/websocket';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'normal' | 'deep_thinking';
}

interface ChatBoxProps {
  apiUrl?: string;
}

export function ChatBox({ apiUrl = 'http://localhost:3001' }: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deepThinkingContent, setDeepThinkingContent] = useState<string>('');
  const [isDeepThinking, setIsDeepThinking] = useState(false);
  const wsRef = useRef<WebSocketService | null>(null);
  const deepThinkingContentRef = useRef<string>('');
  const isDeepThinkingRef = useRef<boolean>(false);

  useEffect(() => {
    // Initialize WebSocket connection
    wsRef.current = WebSocketService.getInstance();
    
    // Add message handler
    const removeHandler = wsRef.current.addMessageHandler((message) => {
      if (message.type === 'chat') {
        // If we were deep thinking, finalize that message first
        setMessages(prev => {
          const updatedMessages = [...prev];
          
          // Add accumulated deep thinking message if exists
          if (deepThinkingContentRef.current) {
            const deepThinkingMessage: Message = {
              role: 'assistant',
              content: deepThinkingContentRef.current,
              timestamp: new Date(),
              type: 'deep_thinking'
            };
            updatedMessages.push(deepThinkingMessage);
          }
          
          // Add the regular chat message
          const assistantMessage: Message = {
            role: 'assistant',
            content: message.content,
            timestamp: new Date(),
            type: 'normal'
          };
          updatedMessages.push(assistantMessage);
          
          return updatedMessages;
        });
        
        // Reset deep thinking state
        deepThinkingContentRef.current = '';
        isDeepThinkingRef.current = false;
        setDeepThinkingContent('');
        setIsDeepThinking(false);
        setIsLoading(false);
      } else if (message.type === MessageType.DEEP_THINKING) {
        // Accumulate deep thinking content
        const newContent = deepThinkingContentRef.current + message.content;
        deepThinkingContentRef.current = newContent;
        isDeepThinkingRef.current = true;
        setIsDeepThinking(true);
        setDeepThinkingContent(newContent);
      }
    });

    // Cleanup on unmount
    return () => {
      removeHandler();
    };
  }, []); // Remove dependencies to prevent re-registering handlers

  const sendMessage = async () => {
    console.log(inputMessage);
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content
        }),
      });

      const data = await response.json();
      console.log(data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }
      // Assistant message will come through WebSocket
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto h-[600px] flex flex-col">
      <CardHeader>
        <CardTitle>Chat with Claude</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Messages */}
        <ScrollArea className="flex-1 w-full rounded border p-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Start a conversation with Claude!
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={`${message.timestamp.getTime()}-${index}`}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : message.type === 'deep_thinking'
                        ? 'bg-blue-100 border border-blue-300 dark:bg-blue-900 dark:border-blue-600'
                        : 'bg-muted'
                    }`}
                  >
                    {message.type === 'deep_thinking' && (
                      <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">
                        🧠 Deep Thinking
                      </div>
                    )}
                    {message.role === 'user' ? (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    ) : (
                      <HighlightedMarkdown 
                        content={message.content}
                        className="chat-markdown"
                      />
                    )}
                    <div className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Show live deep thinking accumulation */}
              {isDeepThinking && deepThinkingContent && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-blue-50 border border-blue-200 dark:bg-blue-950 dark:border-blue-700">
                    <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2 flex items-center">
                      🧠 Deep Thinking <Loader2 className="w-3 h-3 animate-spin ml-2" />
                    </div>
                    <HighlightedMarkdown 
                      content={deepThinkingContent}
                      className="chat-markdown"
                    />
                  </div>
                </div>
              )}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Error Message */}
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded border">
            {error}
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading}
            size="icon"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
