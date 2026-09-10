import React, { useEffect, useState } from 'react';
import './LoadingScreen.css';

export default function LoadingScreen({ onComplete }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const duration = 2200;

    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const value = Math.min(100, Math.floor((elapsed / duration) * 100));

      setProgress(value);

      if (value >= 100) {
        clearInterval(timer);

        setTimeout(() => {
          if (typeof onComplete === 'function') {
            onComplete();
          }
        }, 250);
      }
    }, 30);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className="mai-loading">

      <div className="mai-loading-bg" />

      <div className="mai-loading-overlay" />

      <div className="mai-loading-content">

        <div className="loading-brand">
          <div className="loading-brand-line" />

          <h1>MAI NETWORK</h1>

          <p>TOGETHER WE BUILD A BRIGHTER FUTURE</p>

          <div className="loading-brand-line" />
        </div>

        <div className="loading-status">
          <span>INITIALIZING MAI NETWORK</span>
          <strong>{progress}%</strong>
        </div>

        <div className="loading-bar">
          <div
            className="loading-bar-fill"
            style={{ width: `${progress}%` }}
          >
            <div className="loading-bar-glow" />
          </div>
        </div>

        <div className="loading-info">
          <div>
            <span className="loading-icon">⚡</span>
            <b>SECURE</b>
            <small>MINING</small>
          </div>

          <div>
            <span className="loading-icon">◈</span>
            <b>BLOCKCHAIN</b>
            <small>TECHNOLOGY</small>
          </div>

          <div>
            <span className="loading-icon">♟</span>
            <b>GLOBAL</b>
            <small>COMMUNITY</small>
          </div>
        </div>

        <div className="loading-footer">
          <span>✦</span>
          <b>MAI NETWORK</b>
          <span>✦</span>
        </div>

      </div>
    </div>
  );
}