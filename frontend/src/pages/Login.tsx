import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn, Eye, EyeOff, Building2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { UserAPI } from '../api/user.api';
import { getSystemSettings } from '../api/settings.api';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hostelName, setHostelName] = useState('Hostel Management System');

  useEffect(() => {
    getSystemSettings().then(data => {
      if (data && data.hostelName) setHostelName(data.hostelName);
    }).catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await UserAPI.login({ email, password });
      if (response.access_token) {
        localStorage.setItem('access_token', response.access_token);
      }
      toast.success('Login successful!');
      navigate('/');
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Invalid email or password';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">

      {/* Brand panel — logo + name only */}
      <aside className="login-brand">
        <div className="login-brand-inner">
          <div className="login-logo">
            <Building2 size={25} strokeWidth={2.2} />
          </div>
          <h1 className="login-brand-title">{hostelName}</h1>
        </div>
      </aside>

      {/* Form panel */}
      <main className="login-panel">
        <form className="login-form" onSubmit={handleLogin}>
          <header className="login-head">
            <h2 className="login-title">Welcome back</h2>
            <p className="login-sub">Sign in to continue to your dashboard</p>
          </header>

          <div className="login-field">
            <label className="login-label" htmlFor="login-email">Email Address</label>
            <div className="login-input-wrap">
              <Mail size={17} className="login-input-icon" />
              <input
                id="login-email"
                type="email"
                className="login-input"
                placeholder="admin@sunrise.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="login-password">Password</label>
            <div className="login-input-wrap">
              <Lock size={17} className="login-input-icon" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="login-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="login-eye"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <button type="submit" className="login-submit" disabled={isLoading}>
            {isLoading ? <span className="login-spinner" /> : <LogIn size={17} />}
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      </main>

    </div>
  );
};

export default Login;
