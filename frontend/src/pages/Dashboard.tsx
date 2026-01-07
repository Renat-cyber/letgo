import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, 
  MessageSquare, 
  Workflow, 
  AlertTriangle,
  TrendingUp,
  Zap,
  Activity
} from 'lucide-react';
import { api, Account } from '../lib/api';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<Account[]>('/accounts'),
  });

  const { data: patterns } = useQuery({
    queryKey: ['patterns'],
    queryFn: () => api.get<any[]>('/patterns'),
  });

  const { data: logs } = useQuery({
    queryKey: ['logs'],
    queryFn: () => api.get<any[]>('/logs?limit=10'),
  });

  const stats = [
    {
      label: 'Аккаунтов',
      value: accounts?.length || 0,
      icon: Users,
      color: 'neon-blue',
      subtext: `${accounts?.filter(a => a.isRunning).length || 0} активных`
    },
    {
      label: 'AI включён',
      value: accounts?.filter(a => a.aiEnabled).length || 0,
      icon: Zap,
      color: 'neon-purple',
      subtext: 'автоответчик'
    },
    {
      label: 'Паттернов',
      value: patterns?.length || 0,
      icon: Workflow,
      color: 'neon-green',
      subtext: `${patterns?.filter(p => p.isActive).length || 0} активных`
    },
    {
      label: 'Ошибок',
      value: logs?.filter(l => l.level === 'error').length || 0,
      icon: AlertTriangle,
      color: 'neon-pink',
      subtext: 'за 24 часа'
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-white tracking-wider">
            DASHBOARD
          </h1>
          <p className="text-dark-500 font-mono text-sm mt-1">
            // система автоматизации telegram
          </p>
        </div>
        <div className="flex items-center gap-2 text-neon-green text-sm font-mono">
          <Activity className="w-4 h-4 animate-pulse" />
          СИСТЕМА АКТИВНА
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="card-cyber rounded-xl p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-dark-500 text-sm font-mono uppercase tracking-wider">
                    {stat.label}
                  </p>
                  <p className={`text-4xl font-display font-bold text-${stat.color} mt-2`}>
                    {stat.value}
                  </p>
                  <p className="text-xs text-dark-500 mt-1">{stat.subtext}</p>
                </div>
                <div className={`p-3 rounded-lg bg-${stat.color}/10`}>
                  <Icon className={`w-6 h-6 text-${stat.color}`} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Accounts List */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="card-cyber rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-lg text-white">
              АККАУНТЫ
            </h2>
            <span className="text-xs text-dark-500 font-mono">
              {accounts?.length || 0} total
            </span>
          </div>

          <div className="space-y-3">
            {accounts?.map((account) => (
              <Link
                key={account.id}
                to={`/accounts/${account.id}`}
                className="flex items-center gap-4 p-4 rounded-lg bg-dark-700/50 hover:bg-dark-700 transition-colors"
              >
                <div className={`w-3 h-3 rounded-full ${
                  account.isRunning 
                    ? 'bg-neon-green animate-pulse' 
                    : 'bg-dark-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-white truncate">
                    {account.firstName || account.username ? 
                      `${account.firstName || ''} ${account.username ? `@${account.username}` : ''}`.trim() 
                      : account.phone || account.sessionId}
                  </p>
                  <p className="text-xs text-dark-500">
                    {account.phone || `ID: ${account.sessionId}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {account.aiEnabled && (
                    <span className="px-2 py-1 rounded text-xs bg-neon-purple/20 text-neon-purple font-mono">
                      AI
                    </span>
                  )}
                  {account.isRecording && (
                    <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400 font-mono animate-pulse">
                      REC
                    </span>
                  )}
                </div>
              </Link>
            ))}

            {(!accounts || accounts.length === 0) && (
              <div className="text-center py-8 text-dark-500">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="font-mono text-sm">Нет аккаунтов</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Recent Logs */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="card-cyber rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-lg text-white">
              ЛОГИ
            </h2>
            <Link to="/logs" className="text-xs text-neon-blue hover:underline font-mono">
              все логи →
            </Link>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {logs?.slice(0, 10).map((log, index) => (
              <div
                key={log.id || index}
                className={`p-3 rounded-lg text-sm font-mono ${
                  log.level === 'error' 
                    ? 'bg-red-500/10 border-l-2 border-red-500' 
                    : log.level === 'warning'
                    ? 'bg-yellow-500/10 border-l-2 border-yellow-500'
                    : 'bg-dark-700/50 border-l-2 border-dark-500'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs uppercase ${
                    log.level === 'error' ? 'text-red-400' 
                    : log.level === 'warning' ? 'text-yellow-400' 
                    : 'text-dark-500'
                  }`}>
                    [{log.level}]
                  </span>
                  <span className="text-dark-500 text-xs">
                    {log.category}
                  </span>
                </div>
                <p className="text-gray-300 text-xs truncate">{log.message}</p>
              </div>
            ))}

            {(!logs || logs.length === 0) && (
              <div className="text-center py-8 text-dark-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="font-mono text-sm">Нет логов</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
