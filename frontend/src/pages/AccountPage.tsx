import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Play, 
  Square, 
  MessageSquare, 
  Zap,
  RefreshCw, 
  Circle,
  Send,
  Bot,
  User,
  Settings
} from 'lucide-react';
import { api, Account, Conversation, Message } from '../lib/api';

export default function AccountPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [useAi, setUseAi] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: account, isLoading } = useQuery({
    queryKey: ['account', id],
    queryFn: () => api.get<Account>(`/accounts/${id}`),
  });

  const { data: conversations } = useQuery({
    queryKey: ['conversations', id],
    queryFn: () => api.get<Conversation[]>(`/accounts/${id}/conversations`),
    refetchInterval: 5000,
  });

  const { data: messages } = useQuery({
    queryKey: ['messages', selectedConversation],
    queryFn: () => api.get<Message[]>(`/conversations/${selectedConversation}/messages`),
    enabled: !!selectedConversation,
    refetchInterval: 3000,
  });

  const startMutation = useMutation({
    mutationFn: () => api.post(`/accounts/${id}/start`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account', id] }),
  });

  const stopMutation = useMutation({
    mutationFn: () => api.post(`/accounts/${id}/stop`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account', id] }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Account>) => api.patch(`/accounts/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account', id] }),
  });

  const sendMessageMutation = useMutation({
    mutationFn: (data: { text: string; useAi: boolean }) => 
      api.post(`/conversations/${selectedConversation}/messages`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation] });
      setMessageInput('');
    },
  });

  const toggleAiMutation = useMutation({
    mutationFn: (enabled: boolean) => 
      api.patch(`/conversations/${selectedConversation}/ai-mode`, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations', id] }),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectedConv = conversations?.find(c => c.id === selectedConversation);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-neon-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="text-center py-20">
        <p className="text-dark-500">Аккаунт не найден</p>
        <Link to="/" className="text-neon-blue hover:underline mt-4 inline-block">
          ← Назад
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          to="/" 
          className="p-2 rounded-lg bg-dark-700 hover:bg-dark-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-display font-bold text-white">
              {account.firstName || account.username ? 
                `${account.firstName || ''} ${account.username ? `@${account.username}` : ''}`.trim() 
                : account.phone || account.sessionId}
            </h1>
            <div className={`w-3 h-3 rounded-full ${
              account.isRunning ? 'bg-neon-green animate-pulse' : 'bg-dark-500'
            }`} />
          </div>
          <p className="text-dark-500 font-mono text-sm">
            {account.phone || `Session: ${account.sessionId}`}
          </p>
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-3">
          {account.isRunning ? (
            <button
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
              className="btn-cyber btn-danger flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              Остановить
            </button>
          ) : (
            <button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="btn-cyber btn-success flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Запустить
            </button>
          )}
        </div>
      </div>

      {/* Settings Card */}
      <div className="card-cyber rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-neon-blue" />
            <h2 className="font-display font-bold text-lg text-white">Настройки аккаунта</h2>
          </div>
          <button
            onClick={async () => {
              try {
                await api.post(`/accounts/${id}/sync-conversations`, {});
                alert('Синхронизация диалогов запущена. Обновите страницу через несколько секунд.');
                setTimeout(() => {
                  queryClient.invalidateQueries({ queryKey: ['conversations', id] });
                }, 3000);
              } catch (error) {
                alert('Ошибка синхронизации');
              }
            }}
            className="btn-cyber flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Синхронизировать диалоги
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* AI Toggle */}
          <div className="flex items-center justify-between p-4 bg-dark-700/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-neon-purple" />
              <div>
                <p className="font-medium text-white">AI Автоответчик</p>
                <p className="text-xs text-dark-500">Автоматические ответы через AI</p>
              </div>
            </div>
            <button
              onClick={() => updateMutation.mutate({ aiEnabled: !account.aiEnabled })}
              className={`toggle-cyber ${account.aiEnabled ? 'active' : ''}`}
            />
          </div>

          {/* Recording */}
          <div className="flex items-center justify-between p-4 bg-dark-700/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Circle className={`w-5 h-5 ${account.isRecording ? 'text-red-500 animate-pulse' : 'text-dark-500'}`} />
              <div>
                <p className="font-medium text-white">Запись паттерна</p>
                <p className="text-xs text-dark-500">
                  {account.isRecording ? 'Идёт запись...' : 'Не активна'}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (account.isRecording) {
                  const name = prompt('Название паттерна:');
                  if (name) {
                    api.post(`/accounts/${id}/recording/stop`, { name });
                  }
                } else {
                  api.post(`/accounts/${id}/recording/start`);
                }
                queryClient.invalidateQueries({ queryKey: ['account', id] });
              }}
              className={`btn-cyber ${account.isRecording ? 'btn-danger' : ''}`}
            >
              {account.isRecording ? 'Стоп' : 'Записать'}
            </button>
          </div>
        </div>

        {/* System Prompt */}
        <div className="mt-6">
          <label className="block text-sm font-mono text-dark-500 mb-2">
            Системный промпт для AI
          </label>
          <textarea
            value={account.systemPrompt || ''}
            onChange={(e) => updateMutation.mutate({ systemPrompt: e.target.value })}
            placeholder="Опишите персонажа AI для этого аккаунта..."
            className="input-cyber h-32 resize-none"
          />
        </div>
      </div>

      {/* Chat Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversations List */}
        <div className="card-cyber rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-white">Диалоги</h3>
            <button 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['conversations', id] })}
              className="p-1.5 rounded bg-dark-700 hover:bg-dark-600"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {conversations?.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedConversation === conv.id
                    ? 'bg-neon-blue/20 border border-neon-blue/30'
                    : 'bg-dark-700/50 hover:bg-dark-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm text-white truncate">
                      {conv.peerFirstName || conv.peerUsername || `Chat ${conv.chatId}`}
                    </p>
                    {conv.peerUsername && (
                      <p className="text-xs text-dark-500">@{conv.peerUsername}</p>
                    )}
                  </div>
                  {conv.aiMode && (
                    <Zap className="w-4 h-4 text-neon-purple flex-shrink-0" />
                  )}
                </div>
              </button>
            ))}
            
            {(!conversations || conversations.length === 0) && (
              <div className="text-center py-8 text-dark-500">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Нет диалогов</p>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="lg:col-span-2 card-cyber rounded-xl flex flex-col h-[600px]">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-dark-600 flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">
                    {selectedConv?.peerFirstName || selectedConv?.peerUsername || 'Чат'}
                  </p>
                  {selectedConv?.peerDescription && (
                    <p className="text-xs text-dark-500 truncate max-w-xs">
                      {selectedConv.peerDescription}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-dark-500">AI режим</span>
                  <button
                    onClick={() => toggleAiMutation.mutate(!selectedConv?.aiMode)}
                    className={`toggle-cyber ${selectedConv?.aiMode ? 'active' : ''}`}
                  />
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages?.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === 'assistant' ? '' : 'flex-row-reverse'}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.role === 'assistant' ? 'bg-neon-green/20' : 'bg-neon-blue/20'
                    }`}>
                      {msg.role === 'assistant' ? (
                        <Bot className="w-4 h-4 text-neon-green" />
                      ) : (
                        <User className="w-4 h-4 text-neon-blue" />
                      )}
                    </div>
                    <div className={`max-w-[70%] p-3 rounded-lg ${
                      msg.role === 'assistant' ? 'message-assistant' : 'message-user'
                    }`}>
                      <p className="text-sm text-gray-200 whitespace-pre-wrap">{msg.content}</p>
                      <p className="text-xs text-dark-500 mt-1">
                        {new Date(msg.createdAt).toLocaleTimeString('ru-RU')}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-dark-600">
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && messageInput.trim()) {
                          sendMessageMutation.mutate({ text: messageInput, useAi });
                        }
                      }}
                      placeholder="Введите сообщение..."
                      className="input-cyber pr-24"
                    />
                    <button
                      onClick={() => setUseAi(!useAi)}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded text-xs font-mono transition-colors ${
                        useAi 
                          ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30' 
                          : 'bg-dark-600 text-dark-500'
                      }`}
                    >
                      <Zap className="w-3 h-3 inline mr-1" />
                      AI
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      if (messageInput.trim()) {
                        sendMessageMutation.mutate({ text: messageInput, useAi });
                      }
                    }}
                    disabled={!messageInput.trim() || sendMessageMutation.isPending}
                    className="btn-cyber flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-dark-500">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-mono">Выберите диалог</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
