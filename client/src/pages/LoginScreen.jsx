import React, { useState } from 'react';
import { Command } from 'lucide-react';

export default function LoginScreen({ onLogin, loading, error, onFlash }) {
  const [email, setEmail] = useState('owner@counterpoint.local');
  const [password, setPassword] = useState('Owner123!');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(email, password);
  };

  return (
    <div className="login-screen">
      <div className="login-art">
        <div className="brand">
          <div className="brand-mark">
            <Command size={22} />
          </div>
          <span>
            nila<span className="brand-dot">.cafe</span>
          </span>
        </div>

        <div className="login-message">
          <span className="eyebrow">A BETTER WAY TO SERVE & SELL</span>
          <h1>
            Your Cafe,<br />
            in Good Hands.
          </h1>
          <p>
            A calm, fast, and reliable POS platform for Nila Cafe. Orders, inventory, and insights — all in one place.
          </p>
          <div className="login-stats">
            <div>
              <strong>One Workspace</strong>
              <span>Everything Connected</span>
            </div>
            <div>
              <strong>Every Sale</strong>
              <span>Accounted For</span>
            </div>
          </div>
        </div>

        <div className="art-footer">Thoughtfully built for the everyday modern cafe.</div>
      </div>

      <div className="login-panel">
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="mobile-brand brand">
            <div className="brand-mark">
              <Command size={22} />
            </div>
            <span>
              nila<span className="brand-dot">.cafe</span>
            </span>
          </div>

          <span className="eyebrow">WELCOME BACK</span>
          <h2>Sign in to Nila Cafe POS</h2>
          <p className="muted">Enter your account credentials to begin your shift.</p>

          <label>Email address</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="owner@nilacafe.com"
            required
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter password"
            required
          />

          <div className="form-row">
            <label className="check-label">
              <input type="checkbox" defaultChecked /> Keep me signed in
            </label>
            <button
              type="button"
              className="text-button"
              onClick={() => onFlash('Ask your administrator to reset your password.')}
            >
              Forgot password?
            </button>
          </div>

          {error && <div className="error-box">{error}</div>}

          <button className="primary-btn full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'} <span>→</span>
          </button>

          <div className="demo-box">
            <strong>One-click Demo Accounts</strong>
            <button
              type="button"
              onClick={() => {
                setEmail('owner@counterpoint.local');
                setPassword('Owner123!');
              }}
            >
              Cafe Owner <span>owner@counterpoint.local</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail('admin@counterpoint.local');
                setPassword('Admin123!');
              }}
            >
              Platform Admin <span>admin@counterpoint.local</span>
            </button>
            <small>Demo Password: Owner123! or Admin123!</small>
          </div>

          <p className="login-legal">Secure token authentication · Multi-tenant isolated workspace</p>
        </form>
      </div>
    </div>
  );
}
