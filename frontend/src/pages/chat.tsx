import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send, Bot, User } from "lucide-react";

import { useAiChat } from "@/api";
import { useProfileStore } from "@/hooks/use-profile";
import { usePageTitle } from "@/hooks/use-page-title";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "What courses suit a Physical Science student with Z-score 1.5?",
  "How do I choose between Engineering and Medicine?",
  "What careers are available after a Commerce degree?",
];

export default function Chat() {
  usePageTitle("AI Mentor");
  const profile = useProfileStore();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const context = profile.isComplete()
    ? `Student stream: ${profile.stream}, Z-score: ${profile.zscore}, language: ${profile.language}`
    : undefined;

  const { mutate: sendMessage, isPending } = useAiChat({
    mutation: {
      onSuccess: (data) => {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      },
      onError: () => {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I couldn't process your question right now. Please try again.",
          },
        ]);
        toast({
          title: "AI mentor unavailable",
          description: "Please try again in a moment.",
          variant: "destructive",
        });
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      },
    },
  });

  function handleSend(text: string) {
    if (!text.trim() || isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: text.trim() }]);
    setInput("");
    sendMessage({ data: { message: text.trim(), context: context ?? null } });
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  return (
    <div className="space-y-6 pb-10 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Bot className="h-8 w-8 text-primary" />
          AI Mentor
        </h1>
        <p className="text-muted-foreground mt-2">Ask questions about courses, careers, and university life.</p>
      </div>

      {messages.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Get started</CardTitle>
            <CardDescription>Try one of these questions</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((q) => (
              <Button key={q} variant="outline" size="sm" onClick={() => handleSend(q)}>
                {q}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4 min-h-[300px]">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
          >
            {msg.role === "assistant" && (
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
            )}
            <div
              className={`rounded-lg px-4 py-3 max-w-[80%] text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {msg.content}
            </div>
            {msg.role === "user" && (
              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-secondary-foreground" />
              </div>
            )}
          </motion.div>
        ))}
        {isPending && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary-foreground animate-pulse" />
            </div>
            <div className="rounded-lg px-4 py-3 bg-muted text-sm text-muted-foreground">Thinking...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <Textarea
          placeholder="Ask your question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend(input);
            }
          }}
          rows={2}
          className="resize-none"
        />
        <Button
          onClick={() => handleSend(input)}
          disabled={isPending || !input.trim()}
          size="icon"
          className="shrink-0 h-auto"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
