"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import WebSocketService from "@/lib/websocket"

import {
  Send,
  Bot,
  Eye,
  Code,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Paperclip,
} from "lucide-react"

interface Message {
  id: string
  content: string
  sender: "user" | "ai"
  timestamp: Date
  status?: "thinking" | "complete"
  sessionId?: string
}

export default function ChatApp() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [activeRightTab, setActiveRightTab] = useState<"preview" | "code">("preview")
  const API_URL = "http://localhost:3001"
  const wsRef = useRef<WebSocketService | null>(null)

  useEffect(() => {
    // Initialize WebSocket connection
    wsRef.current = WebSocketService.getInstance()
    
    // Add message handler
    const removeHandler = wsRef.current.addMessageHandler((message) => {
      if (message.type === 'chat') {
        const aiMessage: Message = {
          id: Date.now().toString(),
          content: message.content,
          sender: "ai",
          timestamp: new Date(),
          sessionId: sessionId || undefined,
          status: "complete"
        }
        setMessages(prev => [...prev, aiMessage])
        setIsLoading(false)
      }
    })

    // Cleanup on unmount
    return () => {
      removeHandler()
    }
  }, [])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      sender: "user",
      timestamp: new Date(),
      sessionId: sessionId || undefined
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setIsLoading(true)
    setError(null)

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

  return (
    <div className="dark min-h-screen bg-zinc-950 text-white">
      <div className="flex h-screen">
        {/* Left Panel - Chat */}
        <div className="flex flex-col w-1/2 border-r border-zinc-800">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
            
            {messages.map((message) => (
              <div key={message.id} className="space-y-2">
                <div
                  className={`rounded-lg p-4 ${message.sender === "user" ? "bg-zinc-800 ml-8" : "bg-zinc-900 mr-8"}`}
                >
                  {message.sender === "user" ? (
                    <p className="text-sm leading-relaxed text-zinc-100">{message.content}</p>
                  ) : (
                    <div className="chat-markdown">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
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

          <div className="p-4 border-t border-zinc-800">
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

        {/* Right Panel - Preview Only */}
        <div className="flex flex-col w-1/2">
          <div className="flex items-center justify-between border-b border-zinc-800">
            <div className="flex items-center">
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex">
                <button
                  onClick={() => setActiveRightTab("preview")}
                  className={`px-3 py-2 text-sm flex items-center gap-2 ${
                    activeRightTab === "preview" ? "text-white bg-zinc-800" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 px-4">
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
                <ChevronRight className="w-4 h-4" />
              </Button>
              <span className="text-zinc-400 text-sm">/</span>
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Preview Area */}
          <div className="flex-1 flex items-center justify-center bg-zinc-900">
            <div className="text-center space-y-4">
              <div className="w-24 h-24 bg-zinc-800 rounded-full flex items-center justify-center mx-auto">
                <span className="text-4xl font-bold text-zinc-600">v0</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-zinc-300">Preview Area</h3>
                <p className="text-zinc-500 max-w-md">
                  Your generated components and applications will appear here for live preview and testing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
