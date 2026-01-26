import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { approveAccessRequest, getPendingAccessRequests, rejectAccessRequest } from '@/services/api';
import { AccessRequest } from '@/types';
import { Bell, ChevronDown, Copy, Home, LogOut, Network, Settings, Shield, User as UserIcon } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

const Layout: React.FC = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<AccessRequest[]>([]);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const navItems = [
    { path: '/', label: t('nav.home', { defaultValue: 'Home' }), icon: Home },
    { path: '/manage', label: t('nav.manage', { defaultValue: 'Manage' }), icon: Network },
    { path: '/settings', label: t('nav.settings', { defaultValue: 'Settings' }), icon: Settings },
  ];

  if (user?.is_superuser) {
      navItems.push({ path: '/admin', label: t('nav.admin', { defaultValue: 'SuperAdmin' }), icon: Shield });
  }

  const fetchPendingRequests = useCallback(async () => {
      if (!user) return;
      try {
          const reqs = await getPendingAccessRequests(user.id);
          setPendingRequests(reqs);
      } catch (error) {
          console.error("Failed to load requests", error);
      }
  }, [user]);

  useEffect(() => {
      if (user) {
          fetchPendingRequests();
          // Poll every 30s
          const interval = setInterval(fetchPendingRequests, 30000);
          return () => clearInterval(interval);
      }
  }, [fetchPendingRequests, user]);
  
  // Re-fetch when location changes (e.g. after navigating back to dashboard)
  useEffect(() => {
      if (user) fetchPendingRequests();
  }, [fetchPendingRequests, location.pathname, user]);

  const handleApprove = async (reqId: string) => {
      try {
          await approveAccessRequest(reqId);
          toast.success(t('family.approved', { defaultValue: 'Approved' }));
          setPendingRequests(prev => prev.filter(r => r.id !== reqId));
      } catch (e) {
          console.error(e);
          toast.error("Failed");
      }
  };

  const handleReject = async (reqId: string) => {
      try {
          await rejectAccessRequest(reqId);
          toast.success(t('family.rejected', { defaultValue: 'Rejected' }));
          setPendingRequests(prev => prev.filter(r => r.id !== reqId));
      } catch (e) {
          console.error(e);
          toast.error("Failed");
      }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
            setIsUserMenuOpen(false);
        }
        if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
            setIsNotificationsOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const copyUserId = () => {
      if (user?.id) {
          navigator.clipboard.writeText(user.id);
          toast.success("User ID copied");
      }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Navbar */}
      <header className="h-14 bg-white border-b flex items-center px-4 justify-between shrink-0 z-50 shadow-sm relative pointer-events-auto">
        <div className="flex items-center gap-2">
            <div className="font-bold text-xl text-blue-600">FamilyTree</div>
        </div>

        <div className="flex items-center gap-4">
            <nav className="flex items-center gap-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            cn(
                                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-blue-50 text-blue-600"
                                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                            )
                        }
                    >
                        <item.icon size={18} />
                        {item.label}
                    </NavLink>
                ))}
            </nav>
            
            {/* Notification Center */}
            <div className="relative" ref={notificationRef}>
                <button 
                    onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                    className="p-2 rounded-full hover:bg-gray-100 relative text-gray-600"
                    title={t('family.pending_requests')}
                >
                    <Bell size={20} />
                    {pendingRequests.length > 0 && (
                        <div className="absolute top-0 right-0 transform translate-x-1/4 -translate-y-1/4">
                            {pendingRequests.length > 9 ? (
                                <span className="flex items-center justify-center w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
                            ) : (
                                <span className="flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white">
                                    {pendingRequests.length}
                                </span>
                            )}
                        </div>
                    )}
                </button>
                
                {isNotificationsOpen && (
                    <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-4 py-2 border-b border-gray-100 font-semibold text-gray-700 flex justify-between items-center">
                            <span>{t('family.pending_requests')}</span>
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{pendingRequests.length}</span>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {pendingRequests.length === 0 ? (
                                <div className="p-4 text-center text-sm text-gray-500">
                                    {t('family.no_requests')}
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {pendingRequests.map(req => (
                                        <div key={req.id} className="p-3 hover:bg-gray-50 transition-colors">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="text-sm font-medium text-gray-900">{req.user?.name || 'Unknown User'}</div>
                                                <div className="text-xs text-gray-500">{new Date(req.created_at).toLocaleDateString()}</div>
                                            </div>
                                            <div className="text-xs text-gray-600 mb-2">
                                                Requesting access to <span className="font-semibold text-blue-600">{req.family?.family_name}</span>
                                            </div>
                                            <div className="flex gap-2 justify-end">
                                                <button 
                                                    onClick={() => handleReject(req.id)}
                                                    className="p-1 px-2 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-600"
                                                >
                                                    {t('family.reject')}
                                                </button>
                                                <button 
                                                    onClick={() => handleApprove(req.id)}
                                                    className="p-1 px-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm"
                                                >
                                                    {t('family.approve')}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2 border-l pl-4 ml-2 relative" ref={userMenuRef}>
                <button 
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors focus:outline-none"
                >
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 relative">
                        <UserIcon size={16} />
                    </div>
                    {/* ... (rest of user menu) ... */}
                    <span className="text-sm text-gray-700 font-medium hidden md:block">{user?.name}</span>
                    <ChevronDown size={14} className={cn("text-gray-500 transition-transform", isUserMenuOpen ? "rotate-180" : "")} />
                </button>

                {isUserMenuOpen && (
                    <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-4 py-3 border-b border-gray-100">
                            <div className="font-semibold text-gray-900">{user?.name}</div>
                            <div className="text-xs text-gray-500 truncate">{user?.email}</div>
                            <div className="mt-2 flex items-center gap-2 text-xs text-gray-400 bg-gray-50 p-1.5 rounded border border-gray-100">
                                <span className="font-mono truncate flex-1" title={user?.id}>ID: {user?.id}</span>
                                <button onClick={copyUserId} className="hover:text-blue-600 transition-colors" title="Copy ID">
                                    <Copy size={12} />
                                </button>
                            </div>
                            {user?.is_superuser && (
                                <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
                                    <Shield size={10} />
                                    SuperAdmin
                                </div>
                            )}
                        </div>
                        
                        <div className="py-1">
                            <button 
                                onClick={() => {
                                    logout();
                                    setIsUserMenuOpen(false);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                            >
                                <LogOut size={16} />
                                {t('auth.logout', { defaultValue: 'Logout' })}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative z-0">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
