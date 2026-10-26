import { useState, useRef, useEffect, useCallback } from 'react';
import { sendChatMessage } from '../utils/api';

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      content:
        'Hello! 💗 I\'m the Breast Cancer Care Bot. I can help you with breast cancer awareness, symptoms, prevention, and answer your questions. How can I assist you today?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const sparklesRef = useRef(null);
  const sparkleIntervalRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Sparkle effect
  const createSparkle = useCallback(() => {
    if (!sparklesRef.current) return;
    const sparkle = document.createElement('div');
    sparkle.className = 'sparkle';
    sparkle.style.left = Math.random() * 100 + '%';
    sparkle.style.top = Math.random() * 100 + '%';
    sparklesRef.current.appendChild(sparkle);
    setTimeout(() => sparkle.remove(), 2000);
  }, []);

  useEffect(() => {
    if (open) {
      sparkleIntervalRef.current = setInterval(createSparkle, 300);
    } else {
      if (sparkleIntervalRef.current) {
        clearInterval(sparkleIntervalRef.current);
        sparkleIntervalRef.current = null;
      }
    }
    return () => {
      if (sparkleIntervalRef.current) {
        clearInterval(sparkleIntervalRef.current);
      }
    };
  }, [open, createSparkle]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      // Build history (excluding the initial bot greeting)
      const history = messages
        .filter((_, i) => i > 0)
        .map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          content: m.content,
        }));

      const data = await sendChatMessage(text, history);
      setMessages((prev) => [...prev, { role: 'bot', content: data.reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          content: 'Sorry, I encountered an error. Please try again later.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        className="chat-btn"
        onClick={() => setOpen(!open)}
        aria-label="Toggle chatbot"
      >
        {open ? '✕' : '💬'}
      </button>

      {/* Chat Window */}
      {open && (
        <div className="chatbot">
          <div className="chatbot__sparkles" ref={sparklesRef} />

          <div className="chatbot__header">Breast Cancer Chatbot 💗</div>

          <div className="chatbot__messages">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`chat-msg chat-msg--${msg.role === 'user' ? 'user' : 'bot'}`}
              >
                {msg.content}
              </div>
            ))}

            {loading && (
              <div className="chat-msg chat-msg--bot chat-msg--typing">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="chatbot__input-area">
            <input
              className="chatbot__input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about breast cancer..."
              disabled={loading}
            />
            <button
              className="chatbot__send"
              onClick={handleSend}
              disabled={loading || !input.trim()}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
