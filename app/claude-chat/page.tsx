import { ChatBox } from '@/components/chat-box';

export default function ClaudeChatPage() {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Claude Chat Integration</h1>
          <p className="text-muted-foreground">
            A working chat interface that connects to Claude AI via your backend API
          </p>
        </div>
        
        <ChatBox />
        
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            Make sure your backend server is running on port 3001 and the ANTHROPIC_API_KEY is configured.
          </p>
          <p className="mt-2">
            Start the backend with: <code className="bg-muted px-2 py-1 rounded">cd backend && npm run dev</code>
          </p>
        </div>
      </div>
    </div>
  );
}
