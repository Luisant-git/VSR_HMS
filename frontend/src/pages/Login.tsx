import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn } from 'lucide-react';
import { toast } from 'react-toastify';
import { UserAPI } from '../api/user.api';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
      toast.error(err.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100vw',
      backgroundColor: 'var(--sidebar-bg)', // Dark navy background
      margin: 0,
      padding: 0
    }}>

      {/* Centered White Card */}
      <div style={{
        backgroundColor: 'var(--content-bg)',
        width: '100%',
        maxWidth: '420px',
        padding: '50px 40px',
        borderRadius: '12px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column'
      }}>

        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
            Hostel Management
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Sign in to your admin account
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-main)', marginBottom: '8px' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="email"
                placeholder="admin@sunrise.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 15px 12px 42px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  outline: 'none',
                  fontSize: '14px',
                  backgroundColor: '#fff',
                  transition: 'border-color 0.2s'
                }}
                required
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-main)' }}>
                Password
              </label>
              {/* <span style={{ fontSize: '12px', color: 'var(--card-blue)', cursor: 'pointer', fontWeight: 500 }}>
                Forgot Password?
              </span> */}
            </div>

            <div style={{ position: 'relative' }}>
              <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 15px 12px 42px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  outline: 'none',
                  fontSize: '14px',
                  backgroundColor: '#fff',
                  transition: 'border-color 0.2s'
                }}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            style={{
              marginTop: '10px',
              backgroundColor: 'var(--card-blue)',
              color: 'white',
              border: 'none',
              padding: '14px',
              borderRadius: '6px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              opacity: isLoading ? 0.7 : 1,
              pointerEvents: isLoading ? 'none' : 'auto'
            }}
          >
            <LogIn size={18} /> {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

      </div>
    </div>
  );
};

export default Login;
