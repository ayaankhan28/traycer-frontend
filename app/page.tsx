"use client"

/* 
 * THINKING BOX IMPLEMENTATION:
 * - Each AI response now has its own persistent thinking box
 * - Thinking boxes remain visible and collapsible even after new messages
 * - Individual collapse states are maintained per message
 * - Easy conditional control via shouldShowThinkingBox and shouldShowThinkingForMessage
 * - Future conditions can be easily added to control visibility
 */

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { HighlightedMarkdown } from '@/components/highlighted-markdown'
import WebSocketService, { MessageType } from "@/lib/websocket"

import {
  Send,
  Bot,
  ChevronDown,
  ChevronUp,
  Plus,
  Paperclip,
  Clock,
  Loader2,
  Check,
} from "lucide-react"

interface Message {
  id: string
  content: string
  sender: "user" | "ai"
  timestamp: Date
  status?: "thinking" | "complete"
  sessionId?: string
  thinkingMessages?: ThinkingMessage[]
  showThinking?: boolean
  thinkingStartTime?: Date
  thinkingEndTime?: Date
}

interface ThinkingMessage {
  id: string
  content: string
  timestamp: Date
}

export default function ChatApp() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [thinkingMessages, setThinkingMessages] = useState<ThinkingMessage[]>([])
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null)
  const [thinkingCollapsedStates, setThinkingCollapsedStates] = useState<Record<string, boolean>>({})
  const [thinkingTimers, setThinkingTimers] = useState<Record<string, { startTime: Date, endTime?: Date }>>({})
  const API_URL = "http://localhost:3001"
  const wsRef = useRef<WebSocketService | null>(null)
  const thinkingMessagesRef = useRef<ThinkingMessage[]>([])
  const currentMessageIdRef = useRef<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const thinkingMessageCounterRef = useRef<number>(0)
  const messageCounterRef = useRef<number>(0)
  const thinkingTimersRef = useRef<Record<string, { startTime: Date, endTime?: Date }>>({})
  
  // Helper function to generate unique IDs
  const generateUniqueId = () => {
    messageCounterRef.current += 1
    return `${Date.now()}-${messageCounterRef.current}`
  }

  // Helper function to format duration
  const formatDuration = (startTime: Date, endTime?: Date): string => {
    const end = endTime || new Date()
    const durationMs = end.getTime() - startTime.getTime()
    const seconds = Math.floor(durationMs / 1000)
    const milliseconds = durationMs % 1000
    
    if (seconds > 0) {
      return `${seconds}.${Math.floor(milliseconds / 100)}s`
    } else {
      return `${milliseconds}ms`
    }
  }
  
  // Keep refs in sync with state
  useEffect(() => {
    thinkingMessagesRef.current = thinkingMessages
  }, [thinkingMessages])
  
  useEffect(() => {
    currentMessageIdRef.current = currentMessageId
  }, [currentMessageId])
  
  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  useEffect(() => {
    thinkingTimersRef.current = thinkingTimers
  }, [thinkingTimers])
  
  // Global setting to control thinking box visibility - can be easily modified for conditions
  // You can add more complex conditions here in the future, such as:
  // - User preferences: const shouldShowThinkingBox = userPreferences.showThinking
  // - Message type: const shouldShowThinkingBox = messageType !== 'simple'
  // - Performance mode: const shouldShowThinkingBox = !performanceMode
  // - User role: const shouldShowThinkingBox = userRole === 'developer'
  const shouldShowThinkingBox = true // Set to false to hide all thinking boxes

  // Helper function to determine if thinking box should be shown for a specific message
  // You can add message-specific conditions here
  const shouldShowThinkingForMessage = (message: Message): boolean => {
    if (!shouldShowThinkingBox) return false
    
    // Show thinking card if at least one thinking message contains "Using tool" OR "Deep Thinking"
    if (message.thinkingMessages && message.thinkingMessages.length > 0) {
      const hasUsingTool = message.thinkingMessages.some(thinking => 
        thinking.content.toLowerCase().includes('using tool')
      )
      const hasDeepThinking = message.thinkingMessages.some(thinking => 
        thinking.content.includes('🧠 Deep Thinking')
      )
      if (!hasUsingTool && !hasDeepThinking) return false
    }
    
    // Add custom conditions here, for example:
    // if (message.content.length < 50) return false // Hide for short messages
    // if (message.sessionId === 'guest') return false // Hide for guest users
    // if (message.timestamp < someDate) return false // Hide for old messages
    
    return true
  }

  useEffect(() => {
    // Initialize WebSocket connection
    wsRef.current = WebSocketService.getInstance()
    
    // Add message handler
    const removeHandler = wsRef.current.addMessageHandler((message) => {
      if (message.type === MessageType.CHAT) {
        // Use refs to get current values and avoid stale closures
        const currentThinking = [...thinkingMessagesRef.current]
        const currentMsgId = currentMessageIdRef.current
        const currentSessionId = sessionIdRef.current
        const endTime = new Date()
        
        // Get timer data from ref and update end time
        const timerData = currentMsgId ? thinkingTimersRef.current[currentMsgId] : undefined
        let finalTimerData = timerData
        if (currentMsgId && timerData) {
          // Update timer end time
          finalTimerData = {
            ...timerData,
            endTime: endTime
          }
          thinkingTimersRef.current[currentMsgId] = finalTimerData
          setThinkingTimers(prev => ({
            ...prev,
            [currentMsgId]: finalTimerData!
          }))
        }
        
        // Debug timer data
        console.log('Creating AI message with timer data:', {
          messageId: currentMsgId,
          timerData: finalTimerData,
          startTime: finalTimerData?.startTime?.toISOString(),
          endTime: endTime.toISOString()
        })

        const aiMessage: Message = {
          id: currentMsgId || generateUniqueId(),
          content: message.content,
          sender: "ai",
          timestamp: new Date(),
          sessionId: currentSessionId || undefined,
          status: "complete",
          thinkingMessages: currentThinking, // Attach current thinking messages to this message
          showThinking: currentThinking.length > 0,
          thinkingStartTime: finalTimerData?.startTime,
          thinkingEndTime: endTime
        }
        
        setMessages(prev => [...prev, aiMessage])
        setIsLoading(false)
        setCurrentMessageId(null)
        // Clear thinking messages for next conversation ONLY after AI message is added
        setThinkingMessages([])
        
        // Auto-collapse the thinking card for this message when AI response is complete
        if (currentMsgId && currentThinking.length > 0) {
          setThinkingCollapsedStates(prev => ({
            ...prev,
            [currentMsgId]: true // Set to collapsed (true) when AI response is received
          }))
        }
      } else if (message.type === MessageType.THINKING) {
        const currentMsgId = currentMessageIdRef.current
        
        // Start timer on first thinking message
        if (currentMsgId && thinkingMessagesRef.current.length === 0) {
          const timerStart = {
            startTime: new Date()
          }
          console.log('Starting timer for message:', currentMsgId, timerStart.startTime.toISOString())
          thinkingTimersRef.current[currentMsgId] = timerStart
          setThinkingTimers(prev => ({
            ...prev,
            [currentMsgId]: timerStart
          }))
        }
        
        thinkingMessageCounterRef.current += 1
        const thinkingMessage: ThinkingMessage = {
          id: `thinking-${Date.now()}-${thinkingMessageCounterRef.current}`,
          content: message.content,
          timestamp: new Date()
        }
        setThinkingMessages(prev => [...prev, thinkingMessage])
      } else if (message.type === MessageType.DEEP_THINKING) {
        const currentMsgId = currentMessageIdRef.current
        
        // Start timer on first deep thinking message
        if (currentMsgId && thinkingMessagesRef.current.length === 0) {
          const timerStart = {
            startTime: new Date()
          }
          console.log('Starting timer for deep thinking message:', currentMsgId, timerStart.startTime.toISOString())
          thinkingTimersRef.current[currentMsgId] = timerStart
          setThinkingTimers(prev => ({
            ...prev,
            [currentMsgId]: timerStart
          }))
        }
        
        // Check if we already have a deep thinking message to append to
        const existingDeepThinkingIndex = thinkingMessagesRef.current.findIndex(
          msg => msg.content.includes('🧠 Deep Thinking')
        )
        
        if (existingDeepThinkingIndex >= 0) {
          // Append to existing deep thinking message
          setThinkingMessages(prev => {
            const updated = [...prev]
            const existing = updated[existingDeepThinkingIndex]
            updated[existingDeepThinkingIndex] = {
              ...existing,
              content: existing.content + message.content
            }
            return updated
          })
        } else {
          // Create new deep thinking message
          thinkingMessageCounterRef.current += 1
          const thinkingMessage: ThinkingMessage = {
            id: `deep-thinking-${Date.now()}-${thinkingMessageCounterRef.current}`,
            content: `🧠 Deep Thinking\n\n${message.content}`,
            timestamp: new Date()
          }
          setThinkingMessages(prev => [...prev, thinkingMessage])
        }
      }
    })

    // Cleanup on unmount
    return () => {
      removeHandler()
    }
  }, []) // Empty dependency array since we use refs for current values

      const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: generateUniqueId(),
      content: inputValue.trim(),
      sender: "user",
      timestamp: new Date(),
      sessionId: sessionId || undefined
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setIsLoading(true)
    setError(null)
    // Clear thinking messages for NEW request (previous messages are already stored with their messages)
    setThinkingMessages([])
    // Generate a current message ID for tracking thinking messages for the upcoming AI response
    const newMessageId = generateUniqueId()
    setCurrentMessageId(newMessageId)

    try {
      const response = await fetch(`${API_URL}/api/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId: sessionId || undefined
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message')
      }

      if (data.success) {
        // Store the session ID if it's returned
        if (data.data.sessionId) {
          setSessionId(data.data.sessionId)
        }
        // AI message will come through WebSocket
      } else {
        throw new Error(data.error || 'Unknown error')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      console.error('Chat error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Component for thinking card - now takes message-specific thinking data with timer
  const ThinkingCard = ({ 
    messageId, 
    thinkingData, 
    startTime, 
    endTime,
    isLive = false
  }: { 
    messageId: string
    thinkingData: ThinkingMessage[]
    startTime?: Date
    endTime?: Date
    isLive?: boolean
  }) => {
    const [currentTime, setCurrentTime] = useState(new Date())

    // Update current time every 100ms for live timer when thinking is in progress
    useEffect(() => {
      if (!endTime && startTime) {
        const interval = setInterval(() => {
          setCurrentTime(new Date())
        }, 100)
        return () => clearInterval(interval)
      }
    }, [endTime, startTime])

    if (thinkingData.length === 0) return null

    const isCollapsed = thinkingCollapsedStates[messageId] || false

    const toggleCollapsed = () => {
      setThinkingCollapsedStates(prev => ({
        ...prev,
        [messageId]: !isCollapsed
      }))
    }

    // Get duration text
    const getDurationText = () => {
      if (!startTime) return ""
      const duration = formatDuration(startTime, endTime || currentTime)
      return endTime ? duration : `${duration} (ongoing)`
    }

    // Debug logging
    console.log(`ThinkingCard ${messageId}:`, { 
      startTime: startTime?.toISOString(), 
      endTime: endTime?.toISOString(), 
      hasStartTime: !!startTime,
      hasEndTime: !!endTime,
      duration: startTime ? getDurationText() : 'no start time'
    })

    return (
      <div className="mb-4 mr-8">
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg overflow-hidden">
          <button
            onClick={toggleCollapsed}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-800/70 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-zinc-300">Thinking</span>
              <span className="text-xs text-zinc-500">({thinkingData.length} steps)</span>
            </div>
            <div className="flex items-center gap-2">
              {startTime && (
                <div className="flex items-center gap-1 text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-md border border-blue-500/30">
                  <Clock className="w-3 h-3" />
                  <span className="font-medium">{getDurationText() || 'calculating...'}</span>
                </div>
              )}
              {isCollapsed ? (
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              ) : (
                <ChevronUp className="w-4 h-4 text-zinc-400" />
              )}
            </div>
          </button>
          
          {!isCollapsed && (
            <div className="px-4 pb-4 space-y-2 border-t border-zinc-700/30">
              {thinkingData.map((thinking, index) => {
                // For live messages: latest message shows loading, others show green checkmarks
                // For completed messages: all show green checkmarks
                const isLatestMessage = isLive && index === thinkingData.length - 1
                const isCompleted = !isLive || (isLive && index < thinkingData.length - 1)
                
                return (
                  <div key={thinking.id} className="flex items-start gap-3 py-2">
                    <div className="mt-2 flex-shrink-0">
                      {isLatestMessage ? (
                        <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                      ) : isCompleted ? (
                        <Check className="w-3 h-3 text-green-400" />
                      ) : (
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <HighlightedMarkdown 
                        content={thinking.content}
                        className="thinking-markdown"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="dark min-h-screen bg-zinc-950 text-white">
      <div className="flex h-screen">
        {/* Chat Area - Full Width */}
        <div className="flex flex-col w-full">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-4xl mx-auto w-full">
            {messages.length === 0 && !isLoading && (
              <div className="flex items-center justify-center h-full text-center">
                <div className="space-y-3">
                  <Bot className="w-12 h-12 text-zinc-600 mx-auto" />
                  <div>
                    <h3 className="text-lg font-medium text-zinc-300">Start a conversation</h3>
                    <p className="text-sm text-zinc-500 mt-1">Ask Claude anything to get started!</p>
                  </div>
                </div>
              </div>
            )}
            
            {messages.map((message, index) => (
              <div key={message.id} className="space-y-2">
                {/* Show thinking card for AI responses that have thinking data */}
                {message.sender === "ai" && shouldShowThinkingForMessage(message) && message.thinkingMessages && message.thinkingMessages.length > 0 && (
                  <ThinkingCard 
                    messageId={message.id} 
                    thinkingData={message.thinkingMessages}
                    startTime={message.thinkingStartTime}
                    endTime={message.thinkingEndTime}
                    isLive={false}
                  />
                )}
                
                <div
                  className={`rounded-lg p-4 ${message.sender === "user" ? "bg-zinc-800 ml-8" : "bg-zinc-900 mr-8"}`}
                >
                  {message.sender === "user" ? (
                    <p className="text-sm leading-relaxed text-zinc-100">{message.content}</p>
                  ) : (
                    <HighlightedMarkdown 
                      content={message.content}
                      className="chat-markdown"
                    />
                  )}
                </div>
                {message.sender === "user" && (
                  <div className="flex items-center gap-2 text-xs text-zinc-500 ml-4">
                    <span>image.png</span>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="space-y-4">
                {thinkingMessages.length > 0 && currentMessageId && 
                 (thinkingMessages.some(thinking => thinking.content.toLowerCase().includes('using tool')) ||
                  thinkingMessages.some(thinking => thinking.content.includes('🧠 Deep Thinking'))) && (
                  <ThinkingCard 
                    messageId={currentMessageId} 
                    thinkingData={thinkingMessages}
                    startTime={thinkingTimers[currentMessageId]?.startTime}
                    endTime={thinkingTimers[currentMessageId]?.endTime}
                    isLive={true}
                  />
                )}
                <div className="bg-zinc-900 rounded-lg p-4 mr-8">
                  <div className="flex items-center gap-2 text-xs text-zinc-400 mb-2">
                    <Bot className="w-3 h-3 animate-pulse" />
                    <span>Claude is thinking...</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mx-4">
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <span className="font-medium">Error:</span>
                  <span>{error}</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-zinc-800 max-w-4xl mx-auto w-full">
            <div className="relative">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Chat with Claude..."
                className="pr-20 bg-zinc-900 border-zinc-700 text-white placeholder-zinc-400"
                disabled={isLoading}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-zinc-400 hover:text-white">
                  <Plus className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-zinc-400 hover:text-white">
                  <Paperclip className="w-3 h-3" />
                </Button>
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  size="sm"
                  className="h-6 w-6 p-0 bg-blue-500 hover:bg-blue-600"
                >
                  <Send className="w-3 h-3" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 text-xs text-zinc-500">
              <span>Powered by Claude API - {sessionId ? 'Conversation history is maintained' : 'Start a new conversation'}</span>
              {error && (
                <Button 
                  variant="link" 
                  className="text-blue-400 hover:text-blue-300 p-0 h-auto text-xs"
                  onClick={() => setError(null)}
                >
                  Clear Error ×
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
