import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users, 
  Workflow, 
  Settings, 
  LogOut,
  Bot,
  Zap
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useQuery } from '@tanstack/react-query';
import { api, Account } from '../lib/api';

export default function Sidebar() {
  const location = useLocation();
  const { logout } = useAuthStore();

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<Account[]>('/accounts'),
    refetchInterval: 5000,
  });

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Дашборд' },
    { to: '/patterns', icon: Workflow, label: 'Паттерны' },
    { to: '/settings', icon: Settings, label: 'Настройки' },
  ];

  return (
    <motion.aside
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="fixed left-0 top-0 h-screen w-64 bg-dark-800 border-r border-dark-600 flex flex-col z-50"
    >
      {/* Logo */}
      <div className="p-6 border-b border-dark-600">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg text-white tracking-wider">TG AUTO</h1>
            <p className="text-xs text-dark-500 font-mono">v1.0.0</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;
          
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-neon-blue/10 text-neon-blue border border-neon-blue/30'
                  : 'text-gray-400 hover:bg-dark-700 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className="ml-auto w-2 h-2 rounded-full bg-neon-blue"
                />
              )}
            </NavLink>
          );
        })}

        {/* Accounts Section */}
        <div className="pt-4 mt-4 border-t border-dark-600">
          <div className="flex items-center gap-2 px-4 py-2 text-xs font-mono text-dark-500 uppercase tracking-wider">
            <Users className="w-4 h-4" />
            Аккаунты
          </div>
          
          <div className="space-y-1 mt-2">
            {accounts?.map((account) => {
              const isAccountActive = location.pathname === `/accounts/${account.id}`;
              
              return (
                <NavLink
                  key={account.id}
                  to={`/accounts/${account.id}`}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                    isAccountActive
                      ? 'bg-neon-green/10 text-neon-green border border-neon-green/30'
                      : 'text-gray-400 hover:bg-dark-700 hover:text-white'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${
                    account.isRunning ? 'bg-neon-green animate-pulse' : 'bg-gray-600'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-mono truncate">
                      {account.firstName || account.username ? 
                        `${account.firstName || ''} ${account.username ? `@${account.username}` : ''}`.trim() 
                        : account.phone || account.sessionId}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {account.aiEnabled && (
                        <span className="text-xs text-neon-purple flex items-center gap-1">
                          <Zap className="w-3 h-3" /> AI
                        </span>
                      )}
                      {account.isRecording && (
                        <span className="text-xs text-red-500 flex items-center gap-1 animate-pulse">
                          ● REC
                        </span>
                      )}
                    </div>
                  </div>
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-dark-600">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Выйти</span>
        </button>
      </div>
    </motion.aside>
  );
}
