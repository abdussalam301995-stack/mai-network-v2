import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import {
  TonConnectUIProvider,
  TonConnectButton,
  useTonAddress,
  useTonConnectUI
} from '@tonconnect/ui-react';

import HeroCoin from './HeroCoin';
import Tasks from './Tasks';
import Friends from './Friends2/friends';
import LoadingScreen from './LoadingScreen';
import './App.css';

const API_URL = (
  process.env.REACT_APP_API_URL ||
  'https://mai-network-v2-backend.onrender.com'
).replace(/\/$/, '');

/*
  IMPORTANT:
  This image must exist inside:
  frontend/public/mai-main-logo.png
*/
const LOGO = '/logo.svg';

/* ----------------------------------
   TELEGRAM
----------------------------------- */

function tg() {
  return (
    typeof window !== 'undefined' &&
    window.Telegram?.WebApp
  )
    ? window.Telegram.WebApp
    : null;
}

/* ----------------------------------
   API
----------------------------------- */

async function api(
  path,
  {
    method = 'GET',
    body,
    initData,
    signal
  } = {}
) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (initData) {
    headers['X-Telegram-Init-Data'] = initData;
  }

  const response = await fetch(
    `${API_URL}${path}`,
    {
      method,
      headers,
      body: body
        ? JSON.stringify(body)
        : undefined,
      signal
    }
  );

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message ||
      `Request failed (${response.status})`
    );
  }

  return data;
}

/* ----------------------------------
   HELPERS
----------------------------------- */

function formatNumber(value, decimals = 4) {
  const n = Number(value || 0);

  return n.toLocaleString(
    'en-US',
    {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }
  );
}

function formatTime(seconds) {
  const s = Math.max(
    0,
    Math.floor(Number(seconds || 0))
  );

  const h = String(
    Math.floor(s / 3600)
  ).padStart(2, '0');

  const m = String(
    Math.floor((s % 3600) / 60)
  ).padStart(2, '0');

  const sec = String(
    s % 60
  ).padStart(2, '0');

  return `${h}:${m}:${sec}`;
}

/* ----------------------------------
   NAV ICON
----------------------------------- */

function NavIcon({
  id,
  active
}) {
  const color = active
    ? '#ffd76a'
    : '#8792a5';

  const common = {
    width: 23,
    height: 23,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  };

  if (id === 'home') {
    return (
      <svg {...common}>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
        <path d="M9 21v-6h6v6" />
      </svg>
    );
  }

  if (id === 'task') {
    return (
      <svg {...common}>
        <rect
          x="4"
          y="3"
          width="16"
          height="18"
          rx="3"
        />
        <path d="M8 3v3h8V3" />
        <path d="m8 12 2.5 2.5L16 9" />
      </svg>
    );
  }

  if (id === 'friends') {
    return (
      <svg {...common}>
        <circle
          cx="9"
          cy="8"
          r="3.5"
        />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        <path d="M16 5.5a3.5 3.5 0 0 1 0 6.8" />
        <path d="M17 14.5a5.5 5.5 0 0 1 4.5 5.5" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle
        cx="12"
        cy="8"
        r="4"
      />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

/* ----------------------------------
   MAIN APP
----------------------------------- */

function MainApp() {
  const [showLoading, setShowLoading] =
    useState(true);

  const [tab, setTab] =
    useState('home');

  const [view, setView] =
    useState('main');

  const [user, setUser] =
    useState(null);

  const [error, setError] =
    useState('');

  const [claimRemaining, setClaimRemaining] =
    useState(0);

  const [selectedLevel, setSelectedLevel] =
    useState(null);

  const [transactions, setTransactions] =
    useState([]);

  const [syncing, setSyncing] =
    useState(false);

  const [coinPulse, setCoinPulse] =
    useState(false);

  const [referralCount, setReferralCount] =
    useState(0);

  const initDataRef =
    useRef('');

  const userAddress =
    useTonAddress();

  const [tonConnectUI] =
    useTonConnectUI();

  /* ------------------------------
     TELEGRAM INIT
  ------------------------------- */

  const initTelegram = useCallback(() => {
    const webApp = tg();

    if (!webApp) {
      throw new Error(
        'Open MAI Network inside Telegram.'
      );
    }

    webApp.ready();
    webApp.expand();

    initDataRef.current =
      webApp.initData || '';

    if (!initDataRef.current) {
      throw new Error(
        'Telegram authorization data is unavailable.'
      );
    }

    return initDataRef.current;
  }, []);

  /* ------------------------------
     AUTH
  ------------------------------- */

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const initData =
          initTelegram();

        const auth =
          await api(
            '/api/auth',
            {
              method: 'POST',
              body: {
                initData
              }
            }
          );

        if (cancelled) {
          return;
        }

        setUser(auth.user);
        setError('');

      } catch (e) {
        if (cancelled) {
          return;
        }

        setError(
          e.message ||
          'Unable to connect.'
        );
      }
    }

    start();

    return () => {
      cancelled = true;
    };
  }, [initTelegram]);

  /* ------------------------------
     SERVER SYNC
  ------------------------------- */

  const syncState =
    useCallback(
      async (silent = false) => {
        try {
          const initData =
            initDataRef.current ||
            initTelegram();

          if (!silent) {
            setSyncing(true);
          }

          const data =
            await api(
              '/api/state',
              {
                initData
              }
            );

          setUser(data.user);

          const lastClaim =
            data.user.lastClaimAt;

          const remaining =
            lastClaim
              ? Math.max(
                  0,
                  8 * 3600 -
                  Math.floor(
                    (
                      Date.now() -
                      new Date(
                        lastClaim
                      ).getTime()
                    ) / 1000
                  )
                )
              : 0;

          setClaimRemaining(
            remaining
          );

          setError('');

        } catch (e) {
          setError(
            e.message ||
            'Unable to sync with server.'
          );

        } finally {
          if (!silent) {
            setSyncing(false);
          }
        }
      },
      [initTelegram]
    );

  /* ------------------------------
     REFERRAL SUMMARY
  ------------------------------- */

  useEffect(() => {
    if (!user || !initDataRef.current) {
      return;
    }

    let cancelled = false;

    api('/api/referrals', {
      initData: initDataRef.current
    })
      .then(data => {
        if (!cancelled) {
          setReferralCount(
            Number(
              data?.totalFriends ??
              data?.referralCount ??
              data?.friends?.length ??
              0
            )
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReferralCount(0);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  /* ------------------------------
     PERIODIC SYNC
  ------------------------------- */

  useEffect(() => {
    if (!user) {
      return;
    }

    const timer =
      setInterval(
        () => {
          syncState(true);
        },
        15000
      );

    return () =>
      clearInterval(timer);

  }, [
    user,
    syncState
  ]);

  /* ------------------------------
     CLAIM TIMER
  ------------------------------- */

  useEffect(() => {
    if (claimRemaining <= 0) {
      return;
    }

    const timer =
      setInterval(() => {
        setClaimRemaining(
          value =>
            Math.max(
              0,
              value - 1
            )
        );
      }, 1000);

    return () =>
      clearInterval(timer);

  }, [claimRemaining]);

  /* ------------------------------
     WALLET
  ------------------------------- */

  useEffect(() => {
    if (
      !userAddress ||
      !initDataRef.current
    ) {
      return;
    }

    api(
      '/api/wallet',
      {
        method: 'POST',
        initData:
          initDataRef.current,
        body: {
          address: userAddress
        }
      }
    )
      .then(data => {
        setUser(data.user);
      })
      .catch(() => {});

  }, [userAddress]);

  /* ------------------------------
     BALANCE
  ------------------------------- */

  const displayBalance =
    useMemo(() => {
      if (!user) {
        return 0;
      }

      const lastMining =
        user.lastMiningAt
          ? new Date(
              user.lastMiningAt
            ).getTime()
          : Date.now();

      const elapsed =
        Math.min(
          Math.max(
            0,
            (
              Date.now() -
              lastMining
            ) / 1000
          ),
          86400
        );

      return (
        Number(user.balance || 0) +
        (
          Number(
            user.miningPerSecond || 0
          ) *
          elapsed
        )
      );
    }, [user]);

  const level =
    user?.level || 0;

  const miningSpeed =
    Number(
      user?.miningSpeed ||
      5
    );

  const miningRate =
    Number(
      user?.miningPerSecond ||
      0.00005787
    );

  /* ------------------------------
     CLAIM
  ------------------------------- */

  const handleClaim =
    async () => {
      if (
        claimRemaining > 0 ||
        syncing
      ) {
        return;
      }

      try {
        setSyncing(true);

        const data =
          await api(
            '/api/claim',
            {
              method: 'POST',
              initData:
                initDataRef.current
            }
          );

        setUser(data.user);

        setClaimRemaining(
          8 * 3600
        );

        tg()
          ?.HapticFeedback
          ?.notificationOccurred(
            'success'
          );

      } catch (e) {
        setError(
          e.message ||
          'Unable to claim reward.'
        );

      } finally {
        setSyncing(false);
      }
    };

  /* ------------------------------
     LEVELS
  ------------------------------- */

  const levels =
    useMemo(
      () =>
        Array.from(
          {
            length: 500
          },
          (_, i) => ({
            level: i + 1,
            needHolding:
              (i + 1) * 1000,
            miningSpeed:
              10 + i * 2
          })
        ),
      []
    );

  /* ------------------------------
     TRANSACTIONS
  ------------------------------- */

  const loadTransactions =
    async () => {
      try {
        const data =
          await api(
            '/api/transactions',
            {
              initData:
                initDataRef.current
            }
          );

        setTransactions(
          data.transactions || []
        );

      } catch (e) {
        setError(
          e.message ||
          'Unable to load transactions.'
        );
      }
    };

  /* ------------------------------
     LOADING SCREEN
  ------------------------------- */

  if (showLoading) {
    return (
      <LoadingScreen
        onComplete={() =>
          setShowLoading(false)
        }
      />
    );
  }

  /* ------------------------------
     FATAL ERROR
  ------------------------------- */

  if (error && !user) {
    return (
      <div className="fatal-screen">
        <div className="fatal-card">

          <img
            src={LOGO}
            alt="MAI"
          />

          <h2>
            Unable to connect
          </h2>

          <p>
            {error}
          </p>

          <button
            className="gold-button"
            onClick={() =>
              window.location.reload()
            }
          >
            RETRY
          </button>

          <small>
            Open this Mini App from
            the official Telegram bot.
          </small>

        </div>
      </div>
    );
  }

  const canClaim =
    claimRemaining <= 0;

  return (
    <div className="mai-app">

      {/* COSMIC BACKGROUND */}

      <div className="cosmic-bg">

        <div className="cosmic-glow glow-one" />
        <div className="cosmic-glow glow-two" />
        <div className="cosmic-glow glow-three" />

        <div className="stars stars-a" />
        <div className="stars stars-b" />

        <div className="planet" />
        <div className="planet-light" />

        <div className="floating-island island-one" />
        <div className="floating-island island-two" />

      </div>

      {/* TOP HEADER */}

      <header className="main-header">

        <div className="brand-area">

          <div className="brand-logo">
            <img
              src={LOGO}
              alt="MAI"
            />
          </div>

          <div className="brand-copy">

            <strong>
              MAI NETWORK
            </strong>

            <span className="online-status">
              <i />
              Online
            </span>

            <em>
              Bigger Dreams · Higher Goals
            </em>

          </div>

        </div>

        <div className="header-balance">

          <div className="wallet-icon">
            ◈
          </div>

          <img
            src={LOGO}
            alt=""
          />

          <div>

            <strong>
              {formatNumber(
                displayBalance
              )}
            </strong>

            <span>
              MAI
            </span>

          </div>

          <b>
            ›
          </b>

        </div>

      </header>

      {/* USER CARD */}

      <div className="user-summary">

        <div className="avatar-ring">

          {user?.photoUrl ? (
            <img
              src={user.photoUrl}
              alt=""
            />
          ) : (
            <span>
              {(user?.firstName || 'M')
                .charAt(0)
                .toUpperCase()}
            </span>
          )}

        </div>

        <div className="user-summary-text">

          <strong>
            {user?.firstName ||
              'MAI Miner'}
          </strong>

          <span>
            ♛ {level > 0
              ? `Level ${level} Miner`
              : 'Diamond Miner'}
          </span>

          <small>
            👥 Referrals: {referralCount}
          </small>

        </div>

      </div>

      {/* QUICK ACTIONS */}

      <div className="quick-actions">

        <button
          onClick={handleClaim}
          disabled={
            !canClaim ||
            syncing
          }
          className={
            canClaim
              ? 'quick-card ready'
              : 'quick-card'
          }
        >

          <div className="quick-icon">
            🎁
          </div>

          <div>

            <strong>
              Daily Bonus
            </strong>

            <span>
              {canClaim
                ? 'Claim now!'
                : `Available in ${formatTime(
                    claimRemaining
                  )}`}
            </span>

          </div>

          <b>
            ›
          </b>

        </button>

        <button
          className="quick-card"
          onClick={() =>
            setTab('task')
          }
        >

          <div className="quick-icon">
            ✓
          </div>

          <div>

            <strong>
              Tasks
            </strong>

            <span>
              Complete & Earn
            </span>

          </div>

          <b>
            ›
          </b>

        </button>

      </div>

      {/* MAIN CONTENT */}

      {view === 'boost' ? (

        <main className="boost-page">

          <button
            className="back-button"
            onClick={() =>
              setView('main')
            }
          >
            ← BACK TO MINING
          </button>

          <div className="page-title">

            <span>
              LEVEL SYSTEM
            </span>

            <h2>
              Boost Your Mining
            </h2>

            <p>
              Higher MAI balance unlocks
              higher mining speed.
            </p>

          </div>

          <div className="level-grid">

            {levels.map(item => {

              const unlocked =
                displayBalance >=
                item.needHolding;

              return (
                <button
                  key={item.level}
                  className={
                    `level-card ${
                      unlocked
                        ? 'unlocked'
                        : ''
                    }`
                  }
                  onClick={() =>
                    setSelectedLevel(item)
                  }
                >

                  <span>
                    LVL {item.level}
                  </span>

                  <strong>
                    {item.needHolding.toLocaleString()}
                    {' '}MAI
                  </strong>

                  <small>
                    {item.miningSpeed}
                    {' '} / DAY
                  </small>

                  <em>
                    {unlocked
                      ? 'UNLOCKED'
                      : 'LOCKED'}
                  </em>

                </button>
              );
            })}

          </div>

        </main>

      ) : (

        <main className="content-area">

          {/* HOME */}

          {tab === 'home' && (
            <section className="home-content">

              <div className="speed-chip">
                ⚡{' '}
                {miningSpeed.toFixed(2)}
                {' '}MAI / 24H
              </div>

              <HeroCoin
                balance={displayBalance}
                miningRate={miningRate}
                pulse={coinPulse}
                onMine={() => {

                  setCoinPulse(true);

                  tg()
                    ?.HapticFeedback
                    ?.impactOccurred(
                      'light'
                    );

                  setTimeout(
                    () =>
                      setCoinPulse(false),
                    450
                  );

                }}
              />

              <button
                className="main-mine-button"
                onClick={() => {

                  setCoinPulse(true);

                  tg()
                    ?.HapticFeedback
                    ?.impactOccurred(
                      'medium'
                    );

                  setTimeout(
                    () =>
                      setCoinPulse(false),
                    450
                  );

                }}
              >

                <span>
                  ☝
                </span>

                TAP TO MINE

                <b>
                  ›
                </b>

              </button>

              <div className="mining-panels">

                <div className="mining-panel">

                  <div className="panel-icon">
                    ⚡
                  </div>

                  <div className="panel-copy">

                    <span>
                      AUTO MINING
                    </span>

                    <strong>
                      +
                      {miningRate.toFixed(8)}
                      {' '}MAI / SEC
                    </strong>

                  </div>

                  <div className="toggle active">
                    <i />
                  </div>

                </div>

                <div className="mining-panel">

                  <div className="panel-icon">
                    ⏱
                  </div>

                  <div className="panel-copy">

                    <span>
                      FARMING TIME
                    </span>

                    <strong>
                      {formatTime(
                        claimRemaining > 0
                          ? claimRemaining
                          : 86400
                      )}
                    </strong>

                    <small>
                      Keep mining,
                      build your future
                    </small>

                  </div>

                </div>

              </div>

              <div className="bottom-actions">

                <button
                  className="action-tile"
                  onClick={() =>
                    setView('boost')
                  }
                >

                  <div className="action-icon">
                    🚀
                  </div>

                  <div>

                    <strong>
                      BOOST
                    </strong>

                    <span>
                      +100%
                    </span>

                    <small>
                      Increase your earnings
                    </small>

                  </div>

                  <b>
                    ›
                  </b>

                </button>

                <button
                  className={
                    `action-tile ${
                      canClaim
                        ? 'claim-ready'
                        : ''
                    }`
                  }
                  onClick={
                    handleClaim
                  }
                  disabled={
                    !canClaim ||
                    syncing
                  }
                >

                  <div className="action-icon">
                    🎁
                  </div>

                  <div>

                    <strong>
                      CLAIM BONUS
                    </strong>

                    <span>
                      {canClaim
                        ? '+1.6667 MAI'
                        : `Available in ${formatTime(
                            claimRemaining
                          )}`}
                    </span>

                    <small>
                      {canClaim
                        ? 'Claim your daily reward'
                        : 'Come back later'}
                    </small>

                  </div>

                  <b>
                    ›
                  </b>

                </button>

              </div>

              <div className="stats-row">

                <div>
                  <span>
                    LEVEL
                  </span>

                  <strong>
                    {level}
                  </strong>
                </div>

                <div>
                  <span>
                    RATE
                  </span>

                  <strong>
                    {miningSpeed.toFixed(2)}
                    /D
                  </strong>
                </div>

                <div>
                  <span>
                    STATUS
                  </span>

                  <strong className="green">
                    ● ONLINE
                  </strong>
                </div>

              </div>

              <div className="server-note">

                🔐 SERVER-VERIFIED MINING

                <p>
                  Your balance is calculated
                  by the server. Browser
                  storage is not used as the
                  source of truth.
                </p>

              </div>

            </section>
          )}

          {/* TASKS */}

          {tab === 'task' && (
            <div className="tab-page">

              <Tasks
                initData={
                  initDataRef.current
                }
                onUserUpdate={
                  setUser
                }
              />

            </div>
          )}

          {/* FRIENDS */}

          {tab === 'friends' && (
            <div className="tab-page">

              <Friends
                user={user}
                initData={
                  initDataRef.current
                }
                apiUrl={API_URL}
              />

            </div>
          )}

          {/* PROFILE */}

          {tab === 'profile' && (
            <section className="profile-page">

              <div className="page-title">

                <span>
                  ACCOUNT
                </span>

                <h2>
                  Profile
                </h2>

                <p>
                  {user?.firstName ||
                    'User'}
                  {' · '}
                  Telegram ID{' '}
                  {user?.telegramId}
                </p>

              </div>

              <div className="profile-card">

                <div className="profile-logo">

                  <img
                    src={LOGO}
                    alt="MAI"
                  />

                </div>

                <div className="profile-balance">

                  {formatNumber(
                    displayBalance
                  )}

                  <span>
                    MAI
                  </span>

                </div>

                <div className="wallet-title">
                  TON WALLET
                </div>

                <TonConnectButton />

                {userAddress && (
                  <div className="wallet-address">

                    {userAddress.slice(0, 8)}
                    ...
                    {userAddress.slice(-6)}

                  </div>
                )}

                <button
                  className="secondary-button"
                  onClick={
                    loadTransactions
                  }
                >
                  VIEW TRANSACTIONS
                </button>

              </div>

              {transactions.length > 0 && (
                <div className="transaction-card">

                  {transactions.map(
                    (tx, index) => (
                      <div
                        className="transaction-row"
                        key={
                          `${tx.reference}-${index}`
                        }
                      >

                        <span>
                          {tx.type}
                        </span>

                        <strong
                          className={
                            Number(
                              tx.amount
                            ) >= 0
                              ? 'green'
                              : 'red'
                          }
                        >

                          {Number(
                            tx.amount
                          ) >= 0
                            ? '+'
                            : ''}

                          {Number(
                            tx.amount
                          ).toFixed(4)}

                        </strong>

                      </div>
                    )
                  )}

                </div>
              )}

            </section>
          )}

        </main>
      )}

      {/* LEVEL MODAL */}

      {selectedLevel && (
        <div
          className="modal-overlay"
          onClick={() =>
            setSelectedLevel(null)
          }
        >

          <div
            className="level-modal"
            onClick={e =>
              e.stopPropagation()
            }
          >

            <div className="modal-level">
              LVL {selectedLevel.level}
            </div>

            <div className="modal-line">

              <span>
                Mining Speed
              </span>

              <strong>
                {selectedLevel.miningSpeed}
                {' '}MAI / day
              </strong>

            </div>

            <div className="modal-line">

              <span>
                Required Balance
              </span>

              <strong>
                {selectedLevel.needHolding.toLocaleString()}
                {' '}MAI
              </strong>

            </div>

            <div className="modal-line">

              <span>
                Your Balance
              </span>

              <strong>
                {formatNumber(
                  displayBalance
                )}
                {' '}MAI
              </strong>

            </div>

            <button
              className="gold-button"
              onClick={() =>
                setSelectedLevel(null)
              }
            >
              CLOSE
            </button>

          </div>

        </div>
      )}

      {/* BOTTOM NAV */}

      <nav className="bottom-navigation">

        {[
          ['home', 'Home'],
          ['task', 'Tasks'],
          ['friends', 'Friends'],
          ['profile', 'Profile']
        ].map(
          ([id, label]) => (
            <button
              key={id}
              className={
                tab === id
                  ? 'active'
                  : ''
              }
              onClick={() => {
                setTab(id);
                setView('main');
              }}
            >

              <NavIcon
                id={id}
                active={
                  tab === id
                }
              />

              <span>
                {label}
              </span>

            </button>
          )
        )}

      </nav>

    </div>
  );
}

/* ----------------------------------
   APP WRAPPER
----------------------------------- */

export default function App() {
  return (
    <TonConnectUIProvider
      manifestUrl={
        process.env
          .REACT_APP_TONCONNECT_MANIFEST_URL ||
        'https://mai-network-v2-frontend.onrender.com/tonconnect.manifest.json'
      }
    >
      <MainApp />
    </TonConnectUIProvider>
  );
}