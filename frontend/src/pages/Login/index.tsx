import { Lock, LogIn, Mail, User, UserPlus } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const Login: React.FC = () => {
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
        toast.success(t('auth.login_success', { defaultValue: 'Login successful' }));
      } else {
        await register(email, name, password);
        toast.success(t('auth.register_success', { defaultValue: 'Registration successful' }));
      }
      navigate('/');
    } catch (error) {
      console.error(error);
      toast.error(isLogin 
        ? t('auth.login_failed', { defaultValue: 'Login failed. Please check credentials.' }) 
        : t('auth.register_failed', { defaultValue: 'Registration failed. Email might be taken.' })
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">FamilyTree</h1>
          <p className="text-gray-500">
            {isLogin 
              ? t('auth.welcome_back', { defaultValue: 'Welcome back!' }) 
              : t('auth.create_account', { defaultValue: 'Create an account' })}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="relative">
              <User className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder={t('member.name', { defaultValue: 'Name' })}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required={!isLogin}
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="email"
              placeholder={t('auth.email', { defaultValue: 'Email' })}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="password"
              placeholder={t('auth.password', { defaultValue: 'Password' })}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loading ? (
              <span>{t('common.processing', { defaultValue: 'Processing...' })}</span>
            ) : isLogin ? (
              <>
                <LogIn size={20} />
                {t('auth.login', { defaultValue: 'Login' })}
              </>
            ) : (
              <>
                <UserPlus size={20} />
                {t('auth.register', { defaultValue: 'Register' })}
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          {isLogin ? (
            <p>
              {t('auth.no_account', { defaultValue: "Don't have an account?" })}{' '}
              <button
                onClick={() => setIsLogin(false)}
                className="text-blue-600 hover:underline font-medium"
              >
                {t('auth.register_now', { defaultValue: 'Register now' })}
              </button>
            </p>
          ) : (
            <p>
              {t('auth.have_account', { defaultValue: 'Already have an account?' })}{' '}
              <button
                onClick={() => setIsLogin(true)}
                className="text-blue-600 hover:underline font-medium"
              >
                {t('auth.login_now', { defaultValue: 'Login now' })}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
