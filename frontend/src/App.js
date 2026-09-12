import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import {
  TonConnectButton,
  useTonAddress
} from '@tonconnect/ui-react';


/* =========================================================
   MAI NETWORK — FRONTEND CONFIG
   ========================================================= */

const API = (
  process.env.REACT_APP_API_URL ||
  'http://localhost:5000'
).replace(/\/$/, '');

const LOGO = '/assets/mai-logo.jpg';
const BG = '/assets/background.jpg';
const LOADING = '/assets/loading.jpg';

const MAI_JETTON_MASTER =
  'EQD5pWilwl9ypQ1JFxoDktsQl_LAALALnqHjZoxhx_2nET-r';

const STON_BUY_URL =
  'https://app.tonkeeper.com/dapp/https%3A%2F%2Fapp.ston.fi%2Fswap%3Fft%3DGRAM%26utm_source%3Dtonkeeper%26utm_medium%3Dorganic%26utm_campaign%3Ddefi%26utm_content%3DEQDCJL0iQHofcBBvFBHdVG233Ri2V4kCNFgfRT-gqAd3Oc86%26chartVisible%3Dfalse%26tt%3DEQD5pWilwl9ypQ1JFxoDktsQl_LAALALnqHjZoxhx_2nET-r';


/* =========================================================
   TELEGRAM / DEVICE
   ========================================================= */

function tg() {
  return window.Telegram?.WebApp || null;
}

function deviceId() {
  let id = localStorage.getItem('mai_device_id');

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('mai_device_id', id);
  }

  return id;
}


/* =========================================================
   API
   ========================================================= */

async function api(
  path,
  {
    method = 'GET',
    body,
    idempotency
  } = {}
) {
  const web = tg();

  const headers = {
    'Content-Type': 'application/json',
    'X-MAI-Device-ID': deviceId()
  };

  if (web?.initData) {
    headers['X-Telegram-Init-Data'] = web.initData;
  } else if (process.env.REACT_APP_DEV_USER_ID) {
    headers['X-Dev-User'] =
      process.env.REACT_APP_DEV_USER_ID;
  }

  if (idempotency) {
    headers['X-Idempotency-Key'] = idempotency;
  }

  const response = await fetch(
    `${API}${path}`,
    {
      method,
      headers,
      body: body
        ? JSON.stringify(body)
        : undefined
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


/* =========================================================
   HELPERS
   ========================================================= */

const fmt = (n, d = 4) =>
  Number(n || 0).toLocaleString(
    'en-US',
    {
      minimumFractionDigits: d,
      maximumFractionDigits: d
    }
  );

function fmtHolding(n) {
  const value = Number(n || 0);

  return value.toLocaleString(
    'en-US',
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4
    }
  );
}

function hms(s) {
  s = Math.max(
    0,
    Math.floor(s || 0)
  );

  return (
    `${String(Math.floor(s / 3600)).padStart(2, '0')}:` +
    `${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:` +
    `${String(s % 60).padStart(2, '0')}`
  );
}

function short(a) {
  if (!a) return 'Not connected';

  return a.length > 18
    ? `${a.slice(0, 8)}…${a.slice(-6)}`
    : a;
}


/* =========================================================
   ICON
   ========================================================= */

function Icon({ name }) {
  const map = {
    home: '⌂',
    task: '✓',
    friends: '♟',
    profile: '♙',
    gift: '🎁',
    rocket: '🚀',
    wallet: '◈',
    bolt: 'ϟ',
    clock: '◷'
  };

  return (
    <span className="ico">
      {map[name] || '✦'}
    </span>
  );
}


/* =========================================================
   STABLE MAI LOGO
   ========================================================= */

function MaiLogo({
  className = '',
  alt = 'MAI'
}) {
  return (
    <img
      className={className}
      src={LOGO}
      alt={alt}
      draggable="false"
      decoding="sync"
      loading="eager"
    />
  );
}


/* =========================================================
   TOAST
   ========================================================= */

function Toast({
  text,
  onDone
}) {
  useEffect(() => {
    const timer = setTimeout(
      onDone,
      2600
    );

    return () =>
      clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="toast">
      {text}
    </div>
  );
}


/* =========================================================
   LOADING
   ========================================================= */

function LoadingScreen({
  done
}) {
  const [p, setP] =
    useState(0);

  useEffect(() => {
    let n = 0;

    const timer =
      setInterval(() => {
        n = Math.min(
          100,
          n +
            Math.ceil(
              Math.random() * 8
            )
        );

        setP(n);

        if (n >= 100) {
          clearInterval(timer);

          setTimeout(
            done,
            250
          );
        }
      }, 90);

    return () =>
      clearInterval(timer);
  }, [done]);

  return (
    <div
      className="loading"
      style={{
        backgroundImage:
          `url(${LOADING})`
      }}
    >
      <div className="loadBox">
        <div className="initializing">
          INITIALIZING...
        </div>

        <div className="bar">
          <i
            style={{
              width: `${p}%`
            }}
          />
        </div>

        <b>{p}%</b>
      </div>
    </div>
  );
}


/* =========================================================
   BACKGROUND
   ========================================================= */

function Background() {
  return (
    <div
      className="bg"
      aria-hidden="true"
    >
      <div
        className="bgImage"
        style={{
          backgroundImage:
            `url(${BG})`
        }}
      />

      <div className="bgShade" />

      <div className="cloud c1" />
      <div className="cloud c2" />

      <div className="water" />
      <div className="stars" />
      <div className="beam" />
    </div>
  );
}


/* =========================================================
   APP
   ========================================================= */

function App() {

  const [loading, setLoading] =
    useState(true);

  const [boot, setBoot] =
    useState(null);

  const [tab, setTab] =
    useState('home');

  const [view, setView] =
    useState('main');

  const [toast, setToast] =
    useState('');

  const [busy, setBusy] =
    useState(false);

  const [
    selectedLevel,
    setSelectedLevel
  ] = useState(null);

  const [
    tasks,
    setTasks
  ] = useState(null);

  const [
    referrals,
    setReferrals
  ] = useState(null);

  const [
    withdrawals,
    setWithdrawals
  ] = useState(null);

  const address =
    useTonAddress();

  const [
    walletHolding,
    setWalletHolding
  ] = useState(null);

  const [
    holdingLoading,
    setHoldingLoading
  ] = useState(false);


  /* -------------------------------------------------------
     PRELOAD IMPORTANT IMAGES
     ------------------------------------------------------- */

  useEffect(() => {
    [
      LOGO,
      BG,
      LOADING
    ].forEach(src => {
      const image =
        new Image();

      image.src = src;

      if (image.decode) {
        image
          .decode()
          .catch(() => {});
      }
    });
  }, []);


  /* -------------------------------------------------------
     BOOTSTRAP
     ------------------------------------------------------- */

  const refresh =
    useCallback(
      async () => {
        const data =
          await api(
            '/api/bootstrap'
          );

        setBoot(data);
        setTasks(data.tasks);

        return data;
      },
      []
    );


  useEffect(() => {
    const web = tg();

    if (web) {
      web.ready();
      web.expand();

      web.setHeaderColor?.(
        '#05070d'
      );

      web.setBackgroundColor?.(
        '#05070d'
      );
    }

    refresh()
      .catch(error =>
        setToast(
          error.message
        )
      );
  }, [refresh]);


  /* -------------------------------------------------------
     WALLET BINDING
     ------------------------------------------------------- */

  useEffect(() => {
    if (
      !address ||
      !boot?.user
    ) {
      return;
    }

    if (
      address !==
      boot.user.walletAddress
    ) {
      api(
        '/api/wallet/bind',
        {
          method: 'POST',
          body: {
            address
          }
        }
      )
        .then(data =>
          setBoot(old => ({
            ...old,
            user: data.user
          }))
        )
        .catch(error =>
          setToast(
            error.message
          )
        );
    }
  }, [
    address,
    boot?.user?.telegramId,
    boot?.user?.walletAddress
  ]);


  /* -------------------------------------------------------
     LIVE MAI WALLET HOLDING
     ------------------------------------------------------- */

  const activeWalletAddress =
    address ||
    boot?.user?.walletAddress ||
    '';

  const loadWalletHolding =
    useCallback(
      async (
        silent = false
      ) => {

        if (!activeWalletAddress) {
          setWalletHolding(null);
          return;
        }

        if (!silent) {
          setHoldingLoading(true);
        }

        try {
          const data =
            await api(
              '/api/wallet/mai-balance'
            );

          setWalletHolding(
            Number(
              data.balance || 0
            )
          );

        } catch (error) {
          console.warn(
            'MAI wallet balance:',
            error
          );

          setWalletHolding(null);

        } finally {
          if (!silent) {
            setHoldingLoading(false);
          }
        }
      },
      [activeWalletAddress]
    );


  useEffect(() => {

    loadWalletHolding();

    if (!activeWalletAddress) {
      return;
    }

    const timer =
      setInterval(
        () =>
          loadWalletHolding(
            true
          ),
        30000
      );

    return () =>
      clearInterval(timer);

  }, [
    activeWalletAddress,
    loadWalletHolding
  ]);


  const action =
    async fn => {
      if (busy) return;

      setBusy(true);

      try {
        await fn();
      } catch (error) {
        setToast(
          error.message
        );
      } finally {
        setBusy(false);
      }
    };


  const user =
    boot?.user;

  const safeWalletHolding =
    Number.isFinite(
      Number(walletHolding)
    )
      ? Number(walletHolding)
      : 0;

  const totalHolding =
    user
      ? Number(user.balance || 0) +
        safeWalletHolding
      : 0;

  const displayLevel =
    user
      ? Math.max(
          0,
          Math.min(
            Number(
              user.maxLevel || 0
            ),
            Math.floor(
              totalHolding /
              Math.max(
                1,
                Number(
                  user.holdingStep ||
                  1000
                )
              )
            )
          )
        )
      : 0;

  const displayLevelSpeed =
    displayLevel > 0
      ? 10 +
        (
          displayLevel - 1
        ) *
          2
      : 0;

  const displayMiningSpeed =
    user
      ? Number(
          user.freeMiningSpeed || 0
        ) +
        displayLevelSpeed
      : 0;


  if (loading) {
    return (
      <LoadingScreen
        done={() =>
          setLoading(false)
        }
      />
    );
  }


  if (!boot) {
    return (
      <div className="fatal">

        <MaiLogo />

        <h2>
          MAI NETWORK
        </h2>

        <p>
          Open this Mini App
          inside Telegram.
        </p>

        {toast && (
          <p>{toast}</p>
        )}

      </div>
    );
  }


  const go = t => {
    setTab(t);
    setView('main');
  };


  return (
    <div className="app">

      <Background />

      {toast && (
        <Toast
          text={toast}
          onDone={() =>
            setToast('')
          }
        />
      )}

      <main className="screen">

        {view === 'boost'
          ? (
            <BoostPage
              user={user}
              walletHolding={
                safeWalletHolding
              }
              totalHolding={
                totalHolding
              }
              currentLevel={
                displayLevel
              }
              selectedLevel={
                selectedLevel
              }
              setSelectedLevel={
                setSelectedLevel
              }
              back={() =>
                setView('main')
              }
            />
          )

          : view === 'promote'
          ? (
            <PromotePage
              back={() =>
                setView('main')
              }
              user={user}
              toast={setToast}
              refresh={refresh}
            />
          )

          : view === 'withdraw'
          ? (
            <WithdrawPage
              back={() =>
                setView('main')
              }
              user={user}
              setBoot={setBoot}
              toast={setToast}
            />
          )

          : tab === 'home'
          ? (
            <Home
              user={user}
              walletAddress={
                activeWalletAddress
              }
              walletHolding={
                walletHolding
              }
              holdingLoading={
                holdingLoading
              }
              loadWalletHolding={
                loadWalletHolding
              }
              totalHolding={
                totalHolding
              }
              displayLevel={
                displayLevel
              }
              displayMiningSpeed={
                displayMiningSpeed
              }
              tasks={tasks}
              setTab={go}
              setView={setView}
              refresh={refresh}
              toast={setToast}
              busy={busy}
              action={action}
            />
          )

          : tab === 'task'
          ? (
            <TasksPage
              tasks={tasks}
              setTasks={setTasks}
              user={user}
              setBoot={setBoot}
              openPromote={() =>
                setView(
                  'promote'
                )
              }
              toast={setToast}
              action={action}
            />
          )

          : tab === 'friends'
          ? (
            <FriendsPage
              data={referrals}
              setData={
                setReferrals
              }
              toast={setToast}
              setBoot={setBoot}
            />
          )

          : (
            <ProfilePage
              user={user}
              openWithdraw={() =>
                setView(
                  'withdraw'
                )
              }
              withdrawals={
                withdrawals
              }
              setWithdrawals={
                setWithdrawals
              }
              toast={setToast}
            />
          )
        }

      </main>

      <BottomNav
        tab={tab}
        go={go}
      />

    </div>
  );
}


/* =========================================================
   HOME
   ========================================================= */

function Home({
  user,
  walletAddress,
  walletHolding,
  holdingLoading,
  loadWalletHolding,
  totalHolding,
  displayLevel,
  displayMiningSpeed,
  tasks,
  setTab,
  setView,
  refresh,
  toast,
  busy,
  action
}) {

  const [remain, setRemain] =
    useState(
      user.farm.remaining
    );

  const [
    sparks,
    setSparks
  ] = useState([]);

  const [
    coinPressed,
    setCoinPressed
  ] = useState(false);

  const audioContextRef =
    useRef(null);


  /* -------------------------------------------------------
     FARM COUNTDOWN
     ------------------------------------------------------- */

  useEffect(() => {
    setRemain(
      user.farm.remaining
    );
  }, [
    user.farm.remaining
  ]);


  useEffect(() => {
    const timer =
      setInterval(
        () =>
          setRemain(
            value =>
              Math.max(
                0,
                value - 1
              )
          ),
        1000
      );

    return () =>
      clearInterval(timer);
  }, []);


  /* -------------------------------------------------------
     COIN SOUND
     ------------------------------------------------------- */

  const playCoinSound =
    () => {

      try {

        const AudioContext =
          window.AudioContext ||
          window.webkitAudioContext;

        if (!AudioContext) {
          return;
        }

        if (
          !audioContextRef.current
        ) {
          audioContextRef.current =
            new AudioContext();
        }

        const ctx =
          audioContextRef.current;

        if (
          ctx.state ===
          'suspended'
        ) {
          ctx.resume();
        }

        const now =
          ctx.currentTime;


        /* First gold chime */

        const osc1 =
          ctx.createOscillator();

        const gain1 =
          ctx.createGain();

        osc1.type =
          'sine';

        osc1.frequency
          .setValueAtTime(
            880,
            now
          );

        osc1.frequency
          .exponentialRampToValueAtTime(
            1320,
            now + 0.12
          );

        gain1.gain
          .setValueAtTime(
            0.0001,
            now
          );

        gain1.gain
          .exponentialRampToValueAtTime(
            0.12,
            now + 0.012
          );

        gain1.gain
          .exponentialRampToValueAtTime(
            0.0001,
            now + 0.28
          );

        osc1.connect(gain1);
        gain1.connect(
          ctx.destination
        );

        osc1.start(now);
        osc1.stop(
          now + 0.3
        );


        /* Second soft sparkle tone */

        const osc2 =
          ctx.createOscillator();

        const gain2 =
          ctx.createGain();

        osc2.type =
          'triangle';

        osc2.frequency
          .setValueAtTime(
            1760,
            now + 0.035
          );

        osc2.frequency
          .exponentialRampToValueAtTime(
            2200,
            now + 0.13
          );

        gain2.gain
          .setValueAtTime(
            0.0001,
            now
          );

        gain2.gain
          .exponentialRampToValueAtTime(
            0.045,
            now + 0.045
          );

        gain2.gain
          .exponentialRampToValueAtTime(
            0.0001,
            now + 0.22
          );

        osc2.connect(gain2);
        gain2.connect(
          ctx.destination
        );

        osc2.start(
          now + 0.03
        );

        osc2.stop(
          now + 0.24
        );

      } catch (error) {
        console.warn(
          'Coin audio unavailable',
          error
        );
      }
    };


  /* -------------------------------------------------------
     COIN TAP
     ------------------------------------------------------- */

  const tap = event => {

    const rect =
      event.currentTarget
        .getBoundingClientRect();

    const centerX =
      rect.width / 2;

    const centerY =
      rect.height / 2;

    const now =
      Date.now();
          const burst =
      Array.from(
        { length: 18 },
        (_, index) => {

          const angle =
            (
              Math.PI * 2 *
              index
            ) / 18 +
            Math.random() *
              0.35;

          const distance =
            55 +
            Math.random() *
              95;

          return {
            id:
              `${now}-${index}`,

            x:
              centerX +
              (
                Math.random() -
                0.5
              ) *
                22,

            y:
              centerY +
              (
                Math.random() -
                0.5
              ) *
                22,

            dx:
              Math.cos(angle) *
              distance,

            dy:
              Math.sin(angle) *
              distance,

            size:
              4 +
              Math.random() *
                7,

            rotate:
              Math.floor(
                Math.random() *
                  360
              ),

            delay:
              Math.random() *
              0.08
          };
        }
      );


    setSparks(burst);

    setCoinPressed(true);

    playCoinSound();


    try {
      tg()
        ?.HapticFeedback
        ?.impactOccurred(
          'light'
        );
    } catch {}


    setTimeout(
      () =>
        setCoinPressed(
          false
        ),
      430
    );


    setTimeout(
      () =>
        setSparks([]),
      850
    );
  };


  /* -------------------------------------------------------
     HOLDING DISPLAY
     ------------------------------------------------------- */

  const holdingText =
    !walletAddress
      ? 'Connect Wallet'

      : holdingLoading
      ? 'Loading...'

      : walletHolding === null
      ? '-- MAI'

      : `${fmtHolding(
          walletHolding
        )} MAI`;


  const gameBalance =
    Number(
      user.balance || 0
    );


  return (
    <div className="homePage">

      {/* ===================================================
          TOP
          =================================================== */}

      <section className="topGrid">

        <div className="brand glass">

          <MaiLogo />

          <div>

            <strong>
              MAI NETWORK
            </strong>

            <span>
              <i className="online" />
              {' '}
              Online
            </span>

            <small>
              Bigger Dreams · Higher Goals
            </small>

          </div>

        </div>


        {/* =================================================
            TOTAL MAI BALANCE
            IN-GAME + TON WALLET
            ================================================= */}

        <button
          className="balance glass"
          onClick={() =>
            setTab('profile')
          }
        >

          <Icon name="wallet" />

          <MaiLogo />

          <div>

            <b>
              {fmtHolding(
                totalHolding
              )}
            </b>

            <span>
              MAI BALANCE
            </span>

            <small>
              Game + Wallet
            </small>

          </div>

          <em>›</em>

        </button>


        {/* =================================================
            USER PROFILE
            ================================================= */}

        <div className="profileMini glass">

          <div className="avatar">

            {user.photoUrl
              ? (
                <img
                  src={
                    user.photoUrl
                  }
                  alt=""
                />
              )
              : (
                <span>
                  {
                    user
                      .firstName
                      ?.slice(
                        0,
                        1
                      )
                      ?.toUpperCase() ||
                    'M'
                  }
                </span>
              )
            }

          </div>


          <div className="profileMiniText">

            <span>
              PLAYER
            </span>

            <b>
              {
                user.firstName ||
                'MAI User'
              }
            </b>

            <small>
              LVL {displayLevel}
            </small>

          </div>

        </div>


        {/* =================================================
            WALLET HOLDING
            ================================================= */}

        <button
          className="walletHoldingCard glass"
          onClick={() => {

            if (
              walletAddress
            ) {
              loadWalletHolding();
            }

          }}
        >

          <div className="holdingIcon">

            <MaiLogo />

          </div>


          <div className="holdingContent">

            <span>
              WALLET HOLDING
            </span>

            <b>
              {holdingText}
            </b>

            <small>
              {
                walletAddress
                  ? short(
                      walletAddress
                    )
                  : 'TON Wallet'
              }
            </small>

          </div>


          {
            walletAddress &&
            (
              <span
                className={
                  holdingLoading
                    ? 'holdingRefresh spinning'
                    : 'holdingRefresh'
                }
              >
                ↻
              </span>
            )
          }

        </button>


        {/* =================================================
            TASK CARD — RIGHT SIDE
            ================================================= */}

        <button
          className="taskTopCard glass"
          onClick={() =>
            setTab('task')
          }
        >

          <div className="taskTopIcon">
            <Icon name="task" />
          </div>

          <div>

            <span>
              TASK
            </span>

            <b>
              {
                tasks?.filter?.(
                  item =>
                    !item.completed
                )?.length ??
                tasks?.length ??
                0
              }
              {' '}
              Available
            </b>

            <small>
              Earn more MAI
            </small>

          </div>

          <em>›</em>

        </button>

      </section>


      {/* ===================================================
          MAIN MINING COIN
          =================================================== */}

      <section className="coinArea">

        <div className="coinAura coinAuraOne" />
        <div className="coinAura coinAuraTwo" />
        <div className="coinAura coinAuraThree" />


        <button
          type="button"
          className={
            coinPressed
              ? 'mainCoin coinPressed'
              : 'mainCoin'
          }
          onClick={tap}
          aria-label="MAI Coin"
        >

          <span className="coinOuterRing">

            <span className="coinMiddleRing">

              <span className="coinInner">

                <MaiLogo
                  className="mainCoinLogo"
                />

              </span>

            </span>

          </span>


          <span className="coinShine" />

          <span className="coinShineSecond" />


          {sparks.map(
            spark => (

              <i
                key={spark.id}
                className="goldSpark"
                style={{
                  left:
                    `${spark.x}px`,

                  top:
                    `${spark.y}px`,

                  width:
                    `${spark.size}px`,

                  height:
                    `${spark.size}px`,

                  '--spark-x':
                    `${spark.dx}px`,

                  '--spark-y':
                    `${spark.dy}px`,

                  '--spark-rotate':
                    `${spark.rotate}deg`,

                  animationDelay:
                    `${spark.delay}s`
                }}
              />

            )
          )}

        </button>


        <div className="coinTapHint">

          <span>
            TAP MAI COIN
          </span>

          <small>
            ✦ Feel the MAI energy ✦
          </small>

        </div>

      </section>


      {/* ===================================================
          BALANCE / MINING INFORMATION
          =================================================== */}

      <section className="miningSummary glass">

        <div className="summaryMain">

          <span>
            TOTAL MAI BALANCE
          </span>

          <strong>
            {fmtHolding(
              totalHolding
            )}
          </strong>

          <small>
            MAI
          </small>

        </div>


        <div className="summaryDivider" />


        <div className="summaryStats">

          <div>

            <span>
              IN-GAME
            </span>

            <b>
              {fmtHolding(
                gameBalance
              )}
            </b>

          </div>


          <div>

            <span>
              WALLET
            </span>

            <b>
              {
                walletHolding ===
                null
                  ? '—'
                  : fmtHolding(
                      walletHolding
                    )
              }
            </b>

          </div>


          <div>

            <span>
              LEVEL
            </span>

            <b>
              LVL {displayLevel}
            </b>

          </div>

        </div>

      </section>


      {/* ===================================================
          HOME CARDS
          =================================================== */}

      <section className="homeCards">

        <div className="infoCard glass">

          <Icon name="bolt" />

          <div>

            <span>
              AUTO MINING
            </span>

            <b>
              +
              {
                fmt(
                  user.farm
                    .rateSecond,
                  8
                )
              }
              {' '}
              MAI / SEC
            </b>

            <small>
              LVL {displayLevel}
              {' · '}
              {
                fmt(
                  displayMiningSpeed,
                  2
                )
              }
              {' '}
              MAI / Day
            </small>

          </div>

        </div>


        <div className="infoCard glass">

          <Icon name="clock" />

          <div>

            <span>
              FARMING TIME
            </span>

            <b>
              {
                user.farm.ready
                  ? 'READY'
                  : hms(remain)
              }
            </b>

            <small>
              {
                user.farm.ready
                  ? 'Claim your reward'
                  : 'Server-counted mining'
              }
            </small>

          </div>

        </div>


        <button
          className="infoCard glass clickable"
          onClick={() =>
            setView('boost')
          }
        >

          <Icon name="rocket" />

          <div>

            <span>
              BOOST
            </span>

            <b>
              LVL {displayLevel}
            </b>

            <small>
              {
                fmt(
                  displayMiningSpeed,
                  2
                )
              }
              {' '}
              MAI / Day total
            </small>

          </div>

          <em>›</em>

        </button>


        <button
          className="infoCard glass clickable"
          disabled={busy}
          onClick={() =>
            action(
              async () => {

                if (
                  !user.farm.active
                ) {

                  await api(
                    '/api/farm/start',
                    {
                      method:
                        'POST'
                    }
                  );

                  toast(
                    '24h farming started'
                  );

                } else if (
                  user.farm.ready
                ) {

                  const data =
                    await api(
                      '/api/farm/claim',
                      {
                        method:
                          'POST'
                      }
                    );

                  toast(
                    `+${fmt(
                      data.reward,
                      4
                    )} MAI claimed`
                  );

                } else {

                  toast(
                    `Available in ${hms(
                      remain
                    )}`
                  );
                }


                await refresh();

                await loadWalletHolding(
                  true
                );
              }
            )
          }
        >

          <Icon name="gift" />

          <div>

            <span>
              {
                !user.farm.active
                  ? 'START FARMING'
                  : user.farm.ready
                  ? 'CLAIM'
                  : 'FARM REWARD'
              }
            </span>

            <b>
              {
                user.farm.ready
                  ? `${fmt(
                      user.farm
                        .rateDaily,
                      2
                    )} MAI`

                  : `${fmt(
                      user.farm
                        .pending,
                      4
                    )} pending`
              }
            </b>

            <small>
              {
                user.farm.ready
                  ? 'Starts next 24h automatically'
                  : hms(remain)
              }
            </small>

          </div>

          <em>›</em>

        </button>

      </section>


      <div className="tagline">

        ✦ MAI NETWORK ✦

        <small>
          TOGETHER WE BUILD A BRIGHTER FUTURE
        </small>

      </div>

    </div>
  );
}


/* =========================================================
   BOOST PAGE
   ========================================================= */

function BoostPage({
  user,
  walletHolding,
  totalHolding,
  currentLevel,
  selectedLevel,
  setSelectedLevel,
  back
}) {

  const [page, setPage] =
    useState(1);

  const per = 20;

  const maxLevel =
    Number(
      user.maxLevel || 100
    );

  const holdingStep =
    Math.max(
      1,
      Number(
        user.holdingStep ||
        1000
      )
    );

  const pages =
    Math.ceil(
      maxLevel / per
    );


  const levels =
    useMemo(
      () =>
        Array.from(
          {
            length:
              Math.min(
                per,
                maxLevel -
                  (
                    page - 1
                  ) *
                    per
              )
          },
          (_, i) =>
            (
              page - 1
            ) *
              per +
            i +
            1
        ),
      [
        page,
        maxLevel
      ]
    );


  /* -------------------------------------------------------
     SELECTED LEVEL DETAILS
     ------------------------------------------------------- */

  if (selectedLevel) {

    const n =
      selectedLevel;

    const need =
      n * holdingStep;

    const speed =
      10 +
      (
        n - 1
      ) *
        2;

    const missing =
      Math.max(
        0,
        need -
          totalHolding
      );

    const unlocked =
      totalHolding >=
      need;


    return (
      <PageShell
        title={`LEVEL ${n}`}
        back={() =>
          setSelectedLevel(
            null
          )
        }
      >

        <div className="levelHero">

          <div
            className={
              unlocked
                ? 'levelSeal unlocked'
                : 'levelSeal locked'
            }
          >

            <div className="levelLogoWrap">

              <MaiLogo
                className="levelMaiLogo"
              />

              {!unlocked && (
                <div className="levelLockShade">
                  🔒
                </div>
              )}

            </div>


            <div className="levelNumberBadge">
              LVL {n}
            </div>

          </div>

        </div>


        <div className="levelStatusTitle">

          <span
            className={
              unlocked
                ? 'statusDot unlocked'
                : 'statusDot locked'
            }
          />

          {
            unlocked
              ? `LEVEL ${n} UNLOCKED`
              : `LEVEL ${n} LOCKED`
          }

        </div>


        <div className="detailRows">

          <Row
            a="Mining Speed"
            b={`${fmt(
              speed,
              0
            )} MAI / Day`}
          />

          <Row
            a="Required MAI Holding"
            b={`${fmtHolding(
              need
            )} MAI`}
          />

          <Row
            a="In-Game Balance"
            b={`${fmtHolding(
              user.balance
            )} MAI`}
          />

          <Row
            a="TON Wallet Holding"
            b={`${fmtHolding(
              walletHolding
            )} MAI`}
          />

          <Row
            a="Total MAI Balance"
            b={`${fmtHolding(
              totalHolding
            )} MAI`}
            big
          />

          <Row
            a={
              unlocked
                ? 'Level Status'
                : 'MAI Needed'
            }
            b={
              unlocked
                ? 'UNLOCKED'
                : `${fmtHolding(
                    missing
                  )} MAI`
            }
            danger={
              !unlocked
            }
          />

        </div>


        {unlocked
          ? (
            <>

              <div className="unlockedBtn">
                🔓 LEVEL {n} UNLOCKED
              </div>

              <button
                className="secondary"
                onClick={() =>
                  setSelectedLevel(
                    null
                  )
                }
              >
                CLOSE
              </button>

            </>
          )

          : (
            <div className="twoBtns">

              <button
                className="goldBtn"
                onClick={() => {

                  try {

                    const web =
                      tg();

                    if (
                      web?.openLink
                    ) {
                      web.openLink(
                        STON_BUY_URL
                      );
                    } else {
                      window.open(
                        STON_BUY_URL,
                        '_blank',
                        'noopener,noreferrer'
                      );
                    }

                  } catch {

                    window.location.href =
                      STON_BUY_URL;
                  }

                }}
              >
                BUY MAI
              </button>


              <button
                className="secondary"
                onClick={() =>
                  setSelectedLevel(
                    null
                  )
                }
              >
                BACK
              </button>

            </div>
          )
        }

      </PageShell>
    );
  }


  /* -------------------------------------------------------
     LEVEL LIST
     ------------------------------------------------------- */

  return (
    <PageShell
      title="BOOST LEVEL"
      back={back}
    >

      <section className="boostBalance glass">

        <div className="boostBalanceLogo">
          <MaiLogo />
        </div>


        <div>

          <span>
            TOTAL MAI BALANCE
          </span>

          <strong>
            {fmtHolding(
              totalHolding
            )}
          </strong>

          <small>
            In-game + TON wallet
          </small>

        </div>


        <div className="currentLevelPill">

          <span>
            CURRENT
          </span>

          <b>
            LVL {currentLevel}
          </b>

        </div>

      </section>


      <div className="boostIntro">

        <h3>
          MAI HOLDING LEVEL
        </h3>

        <p>
          Your level automatically
          follows your total MAI
          balance.
        </p>

        <small>
          Every {fmtHolding(
            holdingStep
          )} MAI unlocks the next level.
        </small>

      </div>


      <div className="levels">

        {levels.map(
          n => {

            const need =
              n *
              holdingStep;

            const unlocked =
              totalHolding >=
              need;

            const isCurrent =
              n ===
              currentLevel;

            return (
              <button
                key={n}
                className={[
                  'levelCard',
                  unlocked
                    ? 'unlocked'
                    : 'locked',
                  isCurrent
                    ? 'current'
                    : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() =>
                  setSelectedLevel(
                    n
                  )
                }
              >

                <div className="levelCoin">

                  <MaiLogo
                    className="levelCoinLogo"
                  />

                  {!unlocked && (
                    <span className="levelCoinLock">
                      🔒
                    </span>
                  )}

                </div>


                <div className="levelCardText">

                  <strong>
                    LVL {n}
                  </strong>

                  <span>
                    {
                      unlocked
                        ? 'UNLOCKED'
                        : `${fmtHolding(
                            need
                          )} MAI`
                    }
                  </span>

                </div>


                {isCurrent && (
                  <span className="currentMark">
                    CURRENT
                  </span>
                )}

              </button>
            );
          }
        )}

      </div>


      <div className="pager">

        <button
          disabled={
            page <= 1
          }
          onClick={() =>
            setPage(
              old =>
                Math.max(
                  1,
                  old - 1
                )
            )
          }
        >
          ‹
        </button>


        <span>
          PAGE {page} / {pages}
        </span>


        <button
          disabled={
            page >= pages
          }
          onClick={() =>
            setPage(
              old =>
                Math.min(
                  pages,
                  old + 1
                )
            )
          }
        >
          ›
        </button>

      </div>

    </PageShell>
  );
}


/* =========================================================
   SIMPLE ROW
   ========================================================= */

function Row({
  a,
  b,
  big,
  danger
}) {
  return (
    <div
      className={[
        'detailRow',
        big
          ? 'big'
          : '',
        danger
          ? 'danger'
          : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >

      <span>
        {a}
      </span>

      <b>
        {b}
      </b>

    </div>
  );
}


/* =========================================================
   PAGE SHELL
   ========================================================= */

function PageShell({
  title,
  back,
  children
}) {
  return (
    <div className="pageShell">

      <header className="pageHeader">

        <button
          className="backBtn"
          onClick={back}
        >
          ‹
        </button>

        <div>

          <MaiLogo />

          <strong>
            {title}
          </strong>

        </div>

        <span className="headerSpace" />

      </header>

      <div className="pageContent">
        {children}
      </div>

    </div>
  );
}
/* =========================================================
   TASKS
   ========================================================= */

function TasksPage({
  tasks,
  setTasks,
  user,
  setBoot,
  openPromote,
  toast,
  action
}) {

  const [sub, setSub] =
    useState('daily');

  const [
    adsBusy,
    setAdsBusy
  ] = useState(false);

  const [
    campaigns,
    setCampaigns
  ] = useState([]);

  const [cool, setCool] =
    useState(0);


  useEffect(() => {

    if (
      sub ===
      'exclusive'
    ) {

      api(
        '/api/campaigns/exclusive'
      )
        .then(data =>
          setCampaigns(
            data.items
          )
        )
        .catch(error =>
          toast(
            error.message
          )
        );
    }

  }, [sub, toast]);


  useEffect(() => {

    if (cool <= 0) {
      return;
    }

    const timer =
      setInterval(
        () =>
          setCool(
            value =>
              Math.max(
                0,
                value - 1
              )
          ),
        1000
      );

    return () =>
      clearInterval(timer);

  }, [cool]);


  const watch =
    () =>
      action(
        async () => {

          setAdsBusy(true);

          try {

            const data =
              await api(
                '/api/ads/start',
                {
                  method: 'POST'
                }
              );


            if (!data.url) {
              throw new Error(
                'Ad provider did not return a URL'
              );
            }


            const web =
              tg();

            if (web?.openLink) {
              web.openLink(
                data.url
              );
            } else {
              window.open(
                data.url,
                '_blank'
              );
            }


            toast(
              'Finish the ad completely, then return here.'
            );


            let tries = 0;


            const poll =
              setInterval(
                async () => {

                  tries++;

                  try {

                    const status =
                      await api(
                        `/api/ads/status/${data.sessionId}`
                      );


                    if (
                      status.status ===
                        'completed' &&
                      !status.claimed_at
                    ) {

                      clearInterval(
                        poll
                      );


                      const claim =
                        await api(
                          `/api/ads/claim/${data.sessionId}`,
                          {
                            method:
                              'POST'
                          }
                        );


                      setBoot(
                        old => ({
                          ...old,
                          user:
                            claim.user
                        })
                      );


                      setTasks(
                        claim.tasks
                      );


                      setCool(
                        tasks.ads
                          .cooldown
                      );


                      toast(
                        '+1 MAI — ad verified'
                      );

                    } else if (
                      tries > 90
                    ) {

                      clearInterval(
                        poll
                      );

                      toast(
                        'Ad viewing was not completed.'
                      );
                    }

                  } catch {}

                },
                2000
              );

          } finally {

            setAdsBusy(
              false
            );
          }
        }
      );


  return (
    <div className="tasksPage">

      <div className="tabs">

        <button
          className={
            sub === 'daily'
              ? 'active'
              : ''
          }
          onClick={() =>
            setSub('daily')
          }
        >
          Daily
        </button>

        <button
          className={
            sub === 'partner'
              ? 'active'
              : ''
          }
          onClick={() =>
            setSub('partner')
          }
        >
          Partner
        </button>

        <button
          className={
            sub === 'exclusive'
              ? 'active'
              : ''
          }
          onClick={() =>
            setSub('exclusive')
          }
        >
          Exclusive
        </button>

      </div>


      {sub === 'daily' && (

        <div className="stack">

          <div className="taskCard feature glass">

            <div>

              <b>
                Watch Ads & Earn
              </b>

              <span>
                Reward: +
                {tasks.ads.reward}
                {' '}
                MAI
              </span>

              <small>
                Daily limit:{' '}
                {
                  tasks.ads
                    .remaining
                }
                /
                {
                  tasks.ads
                    .limit
                }
                {' '}
                · UTC reset
              </small>

            </div>


            <button
              disabled={
                adsBusy ||
                cool > 0 ||
                tasks.ads
                  .remaining <= 0
              }
              onClick={watch}
            >
              {
                cool > 0
                  ? `${cool}s`
                  : tasks.ads
                      .remaining <=
                    0
                  ? 'Done'
                  : 'Watch'
              }
            </button>

          </div>


          {tasks.joins.map(
            task => (

              <div
                className="taskCard glass"
                key={
                  task.key
                }
              >

                <div>

                  <b>
                    {task.title}
                  </b>

                  <span>
                    +
                    {
                      task.reward
                    }
                    {' '}
                    MAI
                  </span>

                  <small>
                    {
                      task.completed
                        ? 'Completed today'
                        : 'Verified Telegram membership required'
                    }
                  </small>

                </div>


                <button
                  className={
                    task.completed
                      ? 'done'
                      : ''
                  }
                  disabled={
                    task.completed
                  }
                  onClick={() =>
                    action(
                      async () => {

                        if (
                          task.completed
                        ) {
                          return;
                        }


                        const web =
                          tg();


                        if (
                          web
                            ?.openTelegramLink
                        ) {
                          web.openTelegramLink(
                            task.link
                          );
                        } else {
                          window.open(
                            task.link,
                            '_blank'
                          );
                        }


                        await new Promise(
                          resolve =>
                            setTimeout(
                              resolve,
                              800
                            )
                        );


                        const data =
                          await api(
                            `/api/tasks/verify/${task.key}`,
                            {
                              method:
                                'POST'
                            }
                          );


                        setTasks(
                          data.tasks
                        );


                        setBoot(
                          old => ({
                            ...old,
                            user:
                              data.user
                          })
                        );


                        toast(
                          data.rewarded
                            ? `+${task.reward} MAI verified`
                            : 'Already completed'
                        );
                      }
                    )
                  }
                >
                  {
                    task.completed
                      ? '✓ Done'
                      : 'Join & Check'
                  }
                </button>

              </div>
            )
          )}

        </div>
      )}


      {sub === 'partner' && (

        <div className="partner">

          <div className="sectionHead">

            <div>

              <h3>
                Partner Promotions
              </h3>

              <p>
                Promote a channel,
                group, bot, website
                or link.
              </p>

            </div>


            <button
              className="goldBtn compact"
              onClick={
                openPromote
              }
            >
              ＋ Add to Promote
            </button>

          </div>


          <div className="promoInfo glass">

            <Icon name="rocket" />

            <div>

              <b>
                Reach the MAI community
              </b>

              <p>
                Choose a promotion
                limit and pay with
                MAI or GRAM. Every
                campaign stays pending
                until admin approval.
              </p>

              <div className="chips">

                <span>
                  ✓ Approval control
                </span>

                <span>
                  ✓ Limit tracking
                </span>

                <span>
                  ✓ MAI / GRAM
                </span>

              </div>

            </div>

          </div>

        </div>
      )}


      {sub === 'exclusive' && (

        <div className="stack">

          <div className="sectionHead">

            <div>

              <h3>
                Exclusive
              </h3>

              <p>
                Approved partner
                missions and official
                MAI gifts.
              </p>

            </div>

          </div>


          {campaigns.length
            ? campaigns.map(
                campaign => (

                  <div
                    className="taskCard glass"
                    key={
                      campaign.id
                    }
                  >

                    <div>

                      <b>
                        {
                          campaign
                            .title
                        }
                      </b>

                      <span>
                        {
                          campaign
                            .type
                        }
                        {' '}
                        ·{' '}
                        {
                          campaign
                            .reward_per_user >
                          0
                            ? `+${campaign.reward_per_user} MAI`
                            : 'Partner mission'
                        }
                      </span>

                      <small>
                        {
                          campaign
                            .completed_count
                        }
                        /
                        {
                          campaign
                            .target_count
                        }
                        {' '}
                        completed
                      </small>

                    </div>


                    <button
                      onClick={() =>
                        action(
                          async () => {

                            window.open(
                              campaign.target_url,
                              '_blank'
                            );


                            if (
                              campaign.verification_type ===
                                'telegram_member' ||
                              campaign.verification_type ===
                                'manual'
                            ) {

                              await new Promise(
                                resolve =>
                                  setTimeout(
                                    resolve,
                                    900
                                  )
                              );


                              const data =
                                await api(
                                  `/api/campaigns/${campaign.id}/complete`,
                                  {
                                    method:
                                      'POST'
                                  }
                                );


                              setBoot(
                                old => ({
                                  ...old,
                                  user:
                                    data.user
                                })
                              );


                              toast(
                                data.reward
                                  ? `+${data.reward} MAI`
                                  : 'Mission completed'
                              );
                            }
                          }
                        )
                      }
                    >
                      Open
                    </button>

                  </div>
                )
              )

            : (
              <div className="empty glass">
                No exclusive campaigns yet.
              </div>
            )
          }

        </div>
      )}

    </div>
  );
}


/* =========================================================
   PROMOTE
   ========================================================= */

function PromotePage({
  back,
  user,
  toast,
  refresh
}) {

  const [type, setType] =
    useState('Channel');

  const [
    title,
    setTitle
  ] = useState('');

  const [url, setUrl] =
    useState('');

  const [desc, setDesc] =
    useState('');

  const [
    count,
    setCount
  ] = useState(100);

  const [pay, setPay] =
    useState('MAI');

  const [
    quote,
    setQuote
  ] = useState({
    MAI: 10,
    GRAM: 0.1
  });

  const [busy, setBusy] =
    useState(false);


  useEffect(() => {

    const timer =
      setTimeout(
        () => {

          api(
            '/api/campaigns/quote',
            {
              method: 'POST',
              body: {
                targetCount:
                  count
              }
            }
          )
            .then(data =>
              setQuote(data)
            )
            .catch(() => {});

        },
        250
      );

    return () =>
      clearTimeout(timer);

  }, [count]);


  const submit =
    async () => {

      setBusy(true);

      try {

        const data =
          await api(
            '/api/campaigns',
            {
              method: 'POST',

              body: {
                type,
                title,
                targetUrl: url,
                description:
                  desc,
                targetCount:
                  Number(count),
                paymentMethod:
                  pay
              }
            }
          );


        toast(
          `Campaign #${data.campaign.id} submitted for approval`
        );


        await refresh();

        back();

      } catch (error) {

        toast(
          error.message
        );

      } finally {

        setBusy(false);
      }
    };


  return (
    <PageShell
      title="ADD TO PROMOTE"
      back={back}
    >

      <div className="form glass">

        <label>
          Promotion Type

          <select
            value={type}
            onChange={
              event =>
                setType(
                  event
                    .target
                    .value
                )
            }
          >
            {[
              'Channel',
              'Group',
              'Bot',
              'Website',
              'Link'
            ].map(
              value => (
                <option
                  key={value}
                >
                  {value}
                </option>
              )
            )}
          </select>
        </label>


        <label>
          Title

          <input
            value={title}
            onChange={
              event =>
                setTitle(
                  event
                    .target
                    .value
                )
            }
            placeholder="Your campaign name"
          />
        </label>


        <label>
          Link

          <input
            value={url}
            onChange={
              event =>
                setUrl(
                  event
                    .target
                    .value
                )
            }
            placeholder="https://..."
          />
        </label>


        <label>
          Description

          <textarea
            value={desc}
            onChange={
              event =>
                setDesc(
                  event
                    .target
                    .value
                )
            }
            placeholder="Short description"
          />
        </label>


        <label>
          Promote Limit

          <input
            type="number"
            min="1"
            value={count}
            onChange={
              event =>
                setCount(
                  event
                    .target
                    .value
                )
            }
          />
        </label>


        <div className="payTabs">

          <button
            className={
              pay === 'MAI'
                ? 'active'
                : ''
            }
            onClick={() =>
              setPay('MAI')
            }
          >
            Pay MAI
          </button>

          <button
            className={
              pay === 'GRAM'
                ? 'active'
                : ''
            }
            onClick={() =>
              setPay('GRAM')
            }
          >
            Pay GRAM
          </button>

        </div>


        <div className="quote">

          <span>
            Promotion cost
          </span>

          <b>
            {
              fmt(
                quote[pay],
                pay === 'GRAM'
                  ? 3
                  : 2
              )
            }
            {' '}
            {pay}
          </b>

        </div>


        <small className="hint">
          MAI payment is deducted
          immediately. GRAM campaigns
          stay payment-pending until
          your payment is verified and
          admin approves the campaign.
        </small>


        <button
          className="goldBtn full"
          disabled={
            busy ||
            !title ||
            !url
          }
          onClick={submit}
        >
          {
            busy
              ? 'Submitting…'
              : 'Submit Promotion'
          }
        </button>

      </div>

    </PageShell>
  );
}


/* =========================================================
   FRIENDS
   ========================================================= */

function FriendsPage({
  data,
  setData,
  toast,
  setBoot
}) {

  const load =
    useCallback(
      () =>
        api(
          '/api/referrals'
        )
          .then(result =>
            setData(
              result
            )
          )
          .catch(error =>
            toast(
              error.message
            )
          ),
      [
        setData,
        toast
      ]
    );


  useEffect(() => {
    load();
  }, [load]);


  if (!data) {
    return (
      <div className="empty glass">
        Loading referrals…
      </div>
    );
  }


  const share =
    () => {

      const text =
        'Join MAI Network and start mining with me 🚀';

      const url =
        `https://t.me/share/url?url=${
          encodeURIComponent(
            data.link
          )
        }&text=${
          encodeURIComponent(
            text
          )
        }`;


      if (
        tg()?.openTelegramLink
      ) {
        tg().openTelegramLink(
          url
        );
      } else {
        window.open(
          url,
          '_blank'
        );
      }
    };


  return (
    <div className="friendsPage">

      <div className="refHero glass">

        <MaiLogo />

        <h2>
          Invite Friends
        </h2>

        <p>
          Build your network.
          Rewards unlock only
          after your friend becomes
          an active MAI user.
        </p>


        <div className="refStats">

          <div>
            <b>
              {data.successful}
            </b>
            <span>
              Successful
            </span>
          </div>

          <div>
            <b>
              {data.pending}
            </b>
            <span>
              Pending
            </span>
          </div>

          <div>
            <b>
              {fmt(
                data.totalEarned,
                0
              )}
            </b>
            <span>
              MAI Earned
            </span>
          </div>

        </div>


        <button
          className="goldBtn full"
          onClick={share}
        >
          Invite Friend
        </button>


        <button
          className="copyBtn"
          onClick={() =>
            navigator
              .clipboard
              .writeText(
                data.link
              )
              .then(() =>
                toast(
                  'Referral link copied'
                )
              )
          }
        >
          Copy Link
        </button>

      </div>


      <h3>
        Milestone Rewards
      </h3>


      <div className="milestones">

        {data.milestones.map(
          milestone => (

            <div
              className={
                `mile glass ${
                  milestone.unlocked
                    ? 'ready'
                    : ''
                }`
              }
              key={
                milestone.count
              }
            >

              <div>

                <b>
                  {
                    milestone
                      .count
                  }
                  {' '}
                  Friends
                </b>

                <span>
                  +
                  {
                    milestone
                      .reward
                  }
                  {' '}
                  MAI
                </span>

              </div>


              <button
                disabled={
                  !milestone.unlocked ||
                  milestone.claimed
                }
                onClick={() =>
                  api(
                    `/api/referrals/milestones/${milestone.count}`,
                    {
                      method:
                        'POST'
                    }
                  )
                    .then(
                      result => {

                        setBoot(
                          old => ({
                            ...old,
                            user:
                              result.user
                          })
                        );

                        toast(
                          `+${result.reward} MAI milestone`
                        );

                        load();
                      }
                    )
                    .catch(
                      error =>
                        toast(
                          error.message
                        )
                    )
                }
              >
                {
                  milestone.claimed
                    ? 'Claimed'
                    : milestone.unlocked
                    ? 'Claim'
                    : 'Locked'
                }
              </button>

            </div>
          )
        )}

      </div>


      <h3>
        Referral History
      </h3>


      <div className="stack">

        {data.items.length
          ? data.items.map(
              item => (

                <div
                  className="refRow glass"
                  key={
                    item.telegram_id
                  }
                >

                  <div className="avatar small">

                    {item.photo_url
                      ? (
                        <img
                          src={
                            item
                              .photo_url
                          }
                          alt=""
                        />
                      )
                      : (
                        <span>
                          {
                            item
                              .first_name
                              ?.[0]
                          }
                        </span>
                      )
                    }

                  </div>


                  <div>

                    <b>
                      {
                        item
                          .first_name
                      }
                    </b>

                    <span>
                      {
                        new Date(
                          item
                            .created_at
                        )
                          .toLocaleDateString()
                      }
                    </span>

                  </div>


                  <em
                    className={
                      item
                        .referral_qualified
                        ? 'ok'
                        : 'pending'
                    }
                  >
                    {
                      item
                        .referral_qualified
                        ? 'Successful'
                        : 'Pending'
                    }
                  </em>

                </div>
              )
            )

          : (
            <div className="empty glass">
              No referrals yet.
            </div>
          )
        }

      </div>

    </div>
  );
}


/* =========================================================
   PROFILE
   ========================================================= */

function ProfilePage({
  user,
  openWithdraw,
  withdrawals,
  setWithdrawals,
  toast
}) {

  useEffect(() => {

    api(
      '/api/withdrawals'
    )
      .then(data =>
        setWithdrawals(
          data
        )
      )
      .catch(() => {});

  }, [
    setWithdrawals
  ]);


  const next =
    Math.min(
      user.maxLevel,
      user.level + 1
    );

  const need =
    next *
    user.holdingStep;

  const remain =
    Math.max(
      0,
      need -
        user.balance
    );

  const pct =
    user.level >=
    user.maxLevel
      ? 100

      : Math.min(
          100,
          (
            user.balance -
            (
              user.level *
              user.holdingStep
            )
          ) /
            user.holdingStep *
            100
        );


  return (
    <div className="profilePage">

      <div className="profileHero glass">

        <div className="avatar big">

          {user.photoUrl
            ? (
              <img
                src={
                  user.photoUrl
                }
                alt=""
              />
            )
            : (
              <span>
                {
                  user
                    .firstName
                    ?.[0]
                }
              </span>
            )
          }

        </div>


        <h2>
          {user.firstName}
        </h2>

        <span>
          @
          {
            user.username ||
            'telegram-user'
          }
        </span>


        <div className="badges">

          <i>
            LVL {user.level}
          </i>

          <i>
            {
              user.referrals
                .successful
            }
            {' '}
            Referrals
          </i>

          <i>
            Verified Telegram
          </i>

        </div>

      </div>


      <div className="walletCard glass">

        <div className="sectionHead">

          <div>

            <h3>
              Wallet Center
            </h3>

            <p>
              {
                short(
                  user
                    .walletAddress
                )
              }
            </p>

          </div>

          <TonConnectButton />

        </div>


        <div className="securityLine">

          <span>
            TON Connect
          </span>

          <b
            className={
              user.walletAddress
                ? 'green'
                : ''
            }
          >
            {
              user.walletAddress
                ? 'Connected'
                : 'Not connected'
            }
          </b>

        </div>

      </div>


      <div className="holding glass">

        <div className="sectionHead">

          <div>

            <h3>
              MAI Holding
            </h3>

            <p>
              Holding determines
              your mining level.
            </p>

          </div>

          <b>
            {
              fmt(
                user.balance,
                2
              )
            }
            {' '}
            MAI
          </b>

        </div>


        <div className="progress">

          <i
            style={{
              width:
                `${pct}%`
            }}
          />

        </div>


        <div className="next">

          <span>
            Current LVL{' '}
            {user.level}
          </span>

          <span>
            {
              user.level <
              user.maxLevel
                ? `${fmt(
                    remain,
                    0
                  )} MAI to LVL ${next}`
                : 'MAX LEVEL'
            }
          </span>

        </div>

      </div>


      <button
        className="withdrawHero glass"
        onClick={
          openWithdraw
        }
      >

        <Icon name="wallet" />

        <div>

          <b>
            Withdraw MAI
          </b>

          <span>
            Secure withdrawal center
          </span>

        </div>

        <em>›</em>

      </button>


      <div className="security glass">

        <h3>
          Security Center
        </h3>


        <div className="securityLine">

          <span>
            Telegram Authentication
          </span>

          <b className="green">
            Verified
          </b>

        </div>


        <div className="securityLine">

          <span>
            Wallet Binding
          </span>

          <b
            className={
              user.walletAddress
                ? 'green'
                : ''
            }
          >
            {
              user.walletAddress
                ? 'Active'
                : 'Required'
            }
          </b>

        </div>


        <div className="securityLine">

          <span>
            Locked Balance
          </span>

          <b>
            {
              fmt(
                user.lockedBalance,
                2
              )
            }
            {' '}
            MAI
          </b>

        </div>


        <p className="hint">
          Withdrawals use server-side
          balance checks, idempotency,
          rate limits, wallet-change
          lock, risk scoring and admin
          review thresholds.
        </p>

      </div>


      <div className="settings glass">

        <h3>
          Settings & Help
        </h3>

        <button>
          🔔 Notifications
          <em>›</em>
        </button>

        <button>
          🌐 Language
          <em>›</em>
        </button>

        <button>
          🛡 Terms & Privacy
          <em>›</em>
        </button>

        <button>
          💬 Support
          <em>›</em>
        </button>

      </div>

    </div>
  );
}


/* =========================================================
   WITHDRAW
   ========================================================= */

function WithdrawPage({
  back,
  user,
  setBoot,
  toast
}) {

  const [
    amount,
    setAmount
  ] = useState('');

  const [
    history,
    setHistory
  ] = useState([]);

  const [min, setMin] =
    useState(500);

  const [busy, setBusy] =
    useState(false);


  const load =
    useCallback(
      () =>
        api(
          '/api/withdrawals'
        )
          .then(data => {

            setHistory(
              data.items
            );

            setMin(
              data.minWithdrawal
            );

          })
          .catch(error =>
            toast(
              error.message
            )
          ),
      [toast]
    );


  useEffect(() => {
    load();
  }, [load]);


  const submit =
    async () => {

      const value =
        Number(amount);


      if (
        !window.confirm(
          `Withdraw ${value} MAI to ${short(
            user.walletAddress
          )}?`
        )
      ) {
        return;
      }


      setBusy(true);


      try {

        const data =
          await api(
            '/api/withdrawals',
            {
              method: 'POST',

              body: {
                amount:
                  value
              },

              idempotency:
                crypto.randomUUID()
            }
          );


        setBoot(
          old => ({
            ...old,
            user: data.user
          })
        );


        toast(
          `Withdrawal submitted: ${data.withdrawal.status}`
        );


        setAmount('');

        load();

      } catch (error) {

        toast(
          error.message
        );

      } finally {

        setBusy(false);
      }
    };


  return (
    <PageShell
      title="WITHDRAW"
      back={back}
    >

      <div className="withdrawBox glass">

        <div className="balanceBig">

          <span>
            Available Balance
                      </span>

          <b>
            {
              fmt(
                user.balance,
                4
              )
            }
            {' '}
            MAI
          </b>

        </div>


        <div className="miniGrid">

          <div>

            <span>
              Minimum
            </span>

            <b>
              {
                fmt(
                  min,
                  0
                )
              }
              {' '}
              MAI
            </b>

          </div>


          <div>

            <span>
              Locked
            </span>

            <b>
              {
                fmt(
                  user
                    .lockedBalance,
                  2
                )
              }
              {' '}
              MAI
            </b>

          </div>

        </div>


        <label>
          Amount

          <div className="amount">

            <input
              type="number"
              value={amount}
              onChange={
                event =>
                  setAmount(
                    event
                      .target
                      .value
                  )
              }
              placeholder={
                `Min ${min}`
              }
            />

            <button
              onClick={() =>
                setAmount(
                  String(
                    user.balance
                  )
                )
              }
            >
              MAX
            </button>

          </div>

        </label>


        <div className="walletDest">

          <span>
            Destination
          </span>

          <b>
            {
              short(
                user
                  .walletAddress
              )
            }
          </b>

        </div>


        <button
          className="goldBtn full holdBtn"
          disabled={
            busy ||
            !user.walletAddress ||
            Number(amount) <
              min ||
            Number(amount) >
              user.balance
          }
          onClick={submit}
        >
          {
            busy
              ? 'Checking…'
              : 'HOLD TO WITHDRAW'
          }
        </button>


        <p className="hint">
          New wallet bindings may
          have a security lock.
          Suspicious multi-account
          or device patterns can be
          sent to manual review.
        </p>

      </div>


      <h3>
        Withdrawal History
      </h3>


      <div className="stack">

        {history.length
          ? history.map(
              item => (

                <div
                  className="history glass"
                  key={item.id}
                >

                  <div>

                    <b>
                      {
                        fmt(
                          item.amount,
                          2
                        )
                      }
                      {' '}
                      MAI
                    </b>

                    <span>
                      {
                        new Date(
                          item
                            .created_at
                        )
                          .toLocaleString()
                      }
                    </span>

                    <small>
                      {
                        short(
                          item
                            .wallet_address
                        )
                      }
                    </small>

                  </div>


                  <em
                    className={
                      `st ${
                        item.status
                      }`
                    }
                  >
                    {
                      item.status
                    }
                  </em>

                </div>
              )
            )

          : (
            <div className="empty glass">
              No withdrawals yet.
            </div>
          )
        }

      </div>

    </PageShell>
  );
}


/* =========================================================
   BOTTOM NAVIGATION
   ========================================================= */

function BottomNav({
  tab,
  go
}) {

  return (
    <nav className="bottomNav">

      {[
        [
          'home',
          'Home'
        ],
        [
          'task',
          'Tasks'
        ],
        [
          'friends',
          'Friends'
        ],
        [
          'profile',
          'Profile'
        ]
      ].map(
        ([id, label]) => (

          <button
            key={id}
            className={
              tab === id
                ? 'active'
                : ''
            }
            onClick={() =>
              go(id)
            }
          >

            <Icon
              name={id}
            />

            <span>
              {label}
            </span>

          </button>
        )
      )}

    </nav>
  );
}


export default App;