import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

const NotFound = () => {
  const navigate = useNavigate();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div style={{
      height: '100%',
      minHeight: '600px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px',
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      borderRadius: '24px',
      boxShadow: 'inset 0 0 100px rgba(255,255,255,0.5)'
    }}>
      {/* Animated Background Orbs */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '20%',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(74,114,250,0.2) 0%, rgba(74,114,250,0) 70%)',
        borderRadius: '50%',
        transform: `translate(${mousePosition.x * -30}px, ${mousePosition.y * -30}px)`,
        transition: 'transform 0.1s ease-out',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '10%',
        right: '15%',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(185,66,230,0.15) 0%, rgba(185,66,230,0) 70%)',
        borderRadius: '50%',
        transform: `translate(${mousePosition.x * 40}px, ${mousePosition.y * 40}px)`,
        transition: 'transform 0.1s ease-out',
        pointerEvents: 'none'
      }} />

      {/* Glassmorphism Card */}
      <div style={{
        position: 'relative',
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.8)',
        borderRadius: '32px',
        padding: '70px 60px',
        textAlign: 'center',
        maxWidth: '650px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255,255,255,0.5) inset',
        zIndex: 10
      }}>
        <div style={{
          fontSize: '140px',
          fontWeight: 900,
          lineHeight: 1,
          background: 'linear-gradient(135deg, #4a72fa 0%, #b942e6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '20px',
          filter: 'drop-shadow(0 10px 20px rgba(74,114,250,0.2))'
        }}>
          404
        </div>
        
        <h1 style={{
          fontSize: '36px',
          fontWeight: 800,
          color: '#1e293b',
          marginBottom: '16px',
          letterSpacing: '-0.03em'
        }}>
          Page not found
        </h1>
        
        <p style={{
          fontSize: '18px',
          color: '#64748b',
          lineHeight: 1.6,
          marginBottom: '40px',
          fontWeight: 500,
          maxWidth: '80%',
          margin: '0 auto 40px auto'
        }}>
          The page you are looking for doesn't exist or has been moved. Let's get you back on track.
        </p>
        
        <div style={{
          display: 'flex',
          gap: '16px',
          justifyContent: 'center'
        }}>
          <button 
            onClick={() => navigate(-1)}
            style={{
              padding: '14px 28px',
              borderRadius: '14px',
              border: '2px solid #e2e8f0',
              background: 'white',
              color: '#475569',
              fontWeight: 600,
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <ArrowLeft size={20} />
            Go Back
          </button>
          
          <button 
            onClick={() => navigate('/')}
            style={{
              padding: '14px 28px',
              borderRadius: '14px',
              border: 'none',
              background: 'linear-gradient(135deg, #4a72fa 0%, #3b5bdb 100%)',
              color: 'white',
              fontWeight: 600,
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 10px 20px -10px rgba(74,114,250,0.5)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 15px 25px -10px rgba(74,114,250,0.6)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 10px 20px -10px rgba(74,114,250,0.5)';
            }}
          >
            <Home size={20} />
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
