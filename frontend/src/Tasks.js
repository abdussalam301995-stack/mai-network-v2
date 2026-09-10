import React, { useEffect, useState } from 'react';
import './Tasks.css';

const API_URL = (process.env.REACT_APP_API_URL || 'https://maitoken.onrender.com').replace(/\/$/, '');

async function api(path, { method = 'GET', body, initData } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (initData) headers['X-Telegram-Init-Data'] = initData;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

const tiers = [
  { completions: 100, mai: 5000, gram: 0.5 },
  { completions: 500, mai: 25000, gram: 2.5 },
  { completions: 1000, mai: 50000, gram: 5 },
  { completions: 2000, mai: 100000, gram: 10 },
  { completions: 5000, mai: 250000, gram: 25 },
  { completions: 10000, mai: 500000, gram: 50 }
];

export default function Tasks({ initData, onUserUpdate }) {
  const [tab, setTab] = useState('Daily');
  const [tasks, setTasks] = useState([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [adSession, setAdSession] = useState(null);
  const [adSeconds, setAdSeconds] = useState(0);
  const [adOpened, setAdOpened] = useState(false);
  const [adCount, setAdCount] = useState(0);
  const [payMethod, setPayMethod] = useState('MAI');
  const [category, setCategory] = useState('Channel');
  const [selectedTier, setSelectedTier] = useState(null);
  const [targetUrl, setTargetUrl] = useState('');

  const loadTasks = async () => {
    try {
      const data = await api('/api/tasks', { initData });
      setTasks(data.tasks || []);
    } catch (e) { setMessage(e.message); }
  };

  useEffect(() => { loadTasks(); }, []); // initData is stable for this Mini App

  useEffect(() => {
    if (!adSession || adSeconds <= 0) return;
    const id = setInterval(() => setAdSeconds(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [adSession, adSeconds]);

  const startAd = async () => {
    setMessage('');
    try {
      const data = await api('/api/ads/start', { method: 'POST', initData });
      setAdSession(data.sessionId);
      setAdSeconds(data.watchSeconds);
      setAdOpened(false);
    } catch (e) { setMessage(e.message); }
  };

  const openAd = async () => {
    if (!adSession) return;
    try {
      window.open('https://t.me/MAICommunityChat', '_blank');
      await api('/api/ads/open', { method: 'POST', initData, body: { sessionId: adSession } });
      setAdOpened(true);
    } catch (e) { setMessage(e.message); }
  };

  const claimAd = async () => {
    if (adSeconds > 0 || !adOpened) return;
    setBusy('ad');
    try {
      const data = await api('/api/ads/claim', { method: 'POST', initData, body: { sessionId: adSession } });
      onUserUpdate?.(data.user);
      setAdCount(c => c + 1);
      setAdSession(null);
      setAdOpened(false);
      setMessage(`+${data.reward.toFixed(4)} MAI received.`);
    } catch (e) { setMessage(e.message); }
    finally { setBusy(''); }
  };

  const verifyTask = async task => {
    if (task.completed || busy) return;
    setBusy(task.key);
    setMessage('');
    try {
      const webApp = window.Telegram?.WebApp;
      if (webApp?.openTelegramLink) webApp.openTelegramLink(task.link);
      else window.open(task.link, '_blank');

      const data = await api(`/api/tasks/${task.key}/verify`, { method: 'POST', initData });
      if (!data.verified) throw new Error(data.message || 'Please join the task and try again.');
      onUserUpdate?.(data.user);
      setTasks(prev => prev.map(t => t.key === task.key ? { ...t, completed: true } : t));
      setMessage(`+${data.reward.toFixed(4)} MAI received.`);
    } catch (e) { setMessage(e.message); }
    finally { setBusy(''); }
  };

  const submitCampaign = async () => {
    if (selectedTier === null) return setMessage('Select a completion tier.');
    setBusy('campaign');
    try {
      const data = await api('/api/campaigns', {
        method: 'POST',
        initData,
        body: {
          category,
          targetUrl,
          completions: tiers[selectedTier].completions,
          paymentMethod: payMethod
        }
      });
      onUserUpdate?.(data.user);
      setMessage(data.message);
      setTargetUrl('');
      setSelectedTier(null);
    } catch (e) { setMessage(e.message); }
    finally { setBusy(''); }
  };

  return (
    <section className="tasks-page">
      <div className="task-tabs">
        {['Daily', 'Partner', 'Exclusive'].map(t => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {message && <div className="task-message" onClick={() => setMessage('')}>{message} ×</div>}

      {tab === 'Daily' && (
        <>
          <div className="task-hero">
            <span>DAILY REWARDS</span>
            <h2>Earn MAI</h2>
            <p>Rewards are verified by the server.</p>
          </div>

          <div className="task-card ad-card">
            <div className="task-icon">◉</div>
            <div className="task-info"><b>Sponsored Ad</b><span>10s engagement · Daily {adCount}/20</span></div>
            <button className="task-btn" onClick={startAd} disabled={!!adSession}>{adSession ? `${adSeconds}s` : 'WATCH'}</button>
          </div>

          <div className="task-label">SOCIAL TASKS</div>
          {tasks.map(task => (
            <div className="task-card" key={task.key}>
              <div className="task-icon">✦</div>
              <div className="task-info"><b>{task.title}</b><span>Reward +{task.reward} MAI</span></div>
              <button className={`task-btn ${task.completed ? 'done' : ''}`} onClick={() => verifyTask(task)} disabled={task.completed || busy === task.key}>
                {task.completed ? 'CLAIMED ✓' : busy === task.key ? 'VERIFY…' : 'JOIN'}
              </button>
            </div>
          ))}

          {adSession && (
            <div className="task-modal-backdrop">
              <div className="task-modal">
                <div className="modal-tag">SPONSORED</div>
                <h3>Watch Advertisement</h3>
                <div className="ad-countdown">{adSeconds > 0 ? `${adSeconds}s` : 'READY'}</div>
                <p>Keep this window open, then tap Open Now and claim when the timer finishes.</p>
                <button className="task-btn full" onClick={openAd}>{adOpened ? '✓ OPENED' : 'OPEN NOW'}</button>
                <button className="cancel-btn" onClick={() => setAdSession(null)}>CANCEL</button>
                <button className="gold-btn full" disabled={adSeconds > 0 || !adOpened || busy === 'ad'} onClick={claimAd}>CLAIM +2 MAI</button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'Partner' && (
        <div className="partner-box">
          <div className="task-hero"><span>MARKETING MARKETPLACE</span><h2>Promote</h2><p>Submit a campaign for review.</p></div>

          <div className="toggle-row">
            <button className={payMethod === 'MAI' ? 'active' : ''} onClick={() => setPayMethod('MAI')}>💎 PAY MAI</button>
            <button className={payMethod === 'GRAM' ? 'active' : ''} onClick={() => setPayMethod('GRAM')}>✈ PAY GRAM</button>
          </div>

          {payMethod === 'GRAM' && <div className="notice">GRAM payment is not enabled in this version. Choose MAI.</div>}

          <div className="field-label">CATEGORY</div>
          <div className="toggle-row">
            <button className={category === 'Channel' ? 'active' : ''} onClick={() => setCategory('Channel')}>CHANNEL / GROUP</button>
            <button className={category === 'Bot' ? 'active' : ''} onClick={() => setCategory('Bot')}>WEBSITE / BOT</button>
          </div>

          <div className="field-label">TARGET URL</div>
          <input className="task-input" value={targetUrl} onChange={e => setTargetUrl(e.target.value)} placeholder="https://t.me/yourchannel" />

          <div className="field-label">COMPLETIONS</div>
          <div className="tier-grid">
            {tiers.map((t, i) => (
              <button key={t.completions} className={`tier ${selectedTier === i ? 'active' : ''}`} onClick={() => setSelectedTier(i)}>
                <b>{t.completions.toLocaleString()}</b><span>{t.mai.toLocaleString()} MAI</span>
              </button>
            ))}
          </div>

          {selectedTier !== null && (
            <div className="burn-row"><span>Users receive 80%</span><b>20% BURN</b></div>
          )}

          <button className="gold-btn full" disabled={busy === 'campaign' || payMethod !== 'MAI' || !targetUrl} onClick={submitCampaign}>
            {busy === 'campaign' ? 'SUBMITTING…' : 'SUBMIT CAMPAIGN'}
          </button>
          <small className="disclaimer">Payment is deducted server-side and the campaign enters pending review.</small>
        </div>
      )}

      {tab === 'Exclusive' && (
        <div className="exclusive-box">
          <div className="exclusive-glow">✦</div>
          <h2>Exclusive</h2>
          <p>Exclusive missions can be enabled later without changing the security architecture.</p>
          <span>COMING SOON</span>
        </div>
      )}
    </section>
  );
}
