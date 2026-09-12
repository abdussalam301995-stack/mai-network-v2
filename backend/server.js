require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();

app.set('trust proxy', 1);


/* =========================================================
   BASIC CONFIG
   ========================================================= */

const PORT =
  Number(process.env.PORT || 5000);

const BOT_TOKEN =
  process.env.BOT_TOKEN || '';

const BOT_USERNAME =
  String(
    process.env.BOT_USERNAME ||
    'maitoken_bot'
  ).replace(/^@+/, '');

const CLIENT_ORIGIN =
  process.env.CLIENT_ORIGIN ||
  'http://localhost:3000';

const ALLOW_DEV_AUTH =
  process.env.ALLOW_DEV_AUTH ===
  'true';

const ADMIN_KEY =
  process.env.ADMIN_KEY || '';

const allowedOrigins =
  CLIENT_ORIGIN
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);


/* =========================================================
   MAI TOKEN / TON API CONFIG
   ========================================================= */

const MAI_JETTON_MASTER =
  process.env.MAI_JETTON_MASTER ||
  'EQD5pWilwl9ypQ1JFxoDktsQl_LAALALnqHjZoxhx_2nET-r';

const TONAPI_BASE =
  String(
    process.env.TONAPI_BASE ||
    'https://tonapi.io/v2'
  ).replace(/\/$/, '');

const TONAPI_KEY =
  process.env.TONAPI_KEY || '';

const MAI_DECIMALS =
  Number(
    process.env.MAI_DECIMALS || 9
  );


/* =========================================================
   APP CONFIG
   ========================================================= */

function num(name, fallback) {
  const n =
    Number(
      process.env[name]
    );

  return Number.isFinite(n)
    ? n
    : fallback;
}


const cfg = {
  initialBalance:
    num(
      'INITIAL_BALANCE',
      0
    ),

  freeDaily:
    num(
      'FREE_MINING_PER_DAY',
      5
    ),

  level1Daily:
    num(
      'LEVEL1_MINING_PER_DAY',
      10
    ),

  levelStep:
    num(
      'LEVEL_SPEED_STEP',
      2
    ),

  holdingStep:
    num(
      'LEVEL_HOLDING_STEP',
      1000
    ),

  maxLevel:
    num(
      'MAX_LEVEL',
      1000
    ),

  farmSeconds:
    num(
      'FARM_CYCLE_SECONDS',
      86400
    ),

  dailyBonus:
    num(
      'DAILY_BONUS',
      1
    ),

  adReward:
    num(
      'AD_REWARD',
      1
    ),

  adDailyLimit:
    num(
      'AD_DAILY_LIMIT',
      200
    ),

  adCooldown:
    num(
      'AD_COOLDOWN_SECONDS',
      5
    ),

  adProviderMode:
    process.env.AD_PROVIDER_MODE ||
    'external',

  adProviderUrl:
    process.env.AD_PROVIDER_URL ||
    '',

  adWebhookSecret:
    process.env.AD_WEBHOOK_SECRET ||
    '',

  taskReward:
    num(
      'TASK_REWARD',
      2
    ),

  referrerReward:
    num(
      'REFERRER_REWARD',
      10
    ),

  referredReward:
    num(
      'REFERRED_REWARD',
      5
    ),

  promoteMaiPerSlot:
    num(
      'PROMOTE_MAI_PER_SLOT',
      0.1
    ),

  promoteGramPerSlot:
    num(
      'PROMOTE_GRAM_PER_SLOT',
      0.001
    ),

  minWithdrawal:
    num(
      'MIN_WITHDRAWAL',
      500
    ),

  withdrawFeeFixed:
    num(
      'WITHDRAW_FEE_FIXED',
      0
    ),

  withdrawFeePercent:
    num(
      'WITHDRAW_FEE_PERCENT',
      0
    ),

  withdrawMax:
    num(
      'WITHDRAW_MAX_PER_REQUEST',
      1000000
    ),

  withdrawDailyCount:
    num(
      'WITHDRAW_MAX_REQUESTS_PER_DAY',
      3
    ),

  withdrawCooldown:
    num(
      'WITHDRAW_REQUEST_COOLDOWN_SECONDS',
      30
    ),

  walletLock:
    num(
      'WALLET_CHANGE_LOCK_SECONDS',
      86400
    ),

  manualReview:
    num(
      'MANUAL_REVIEW_THRESHOLD',
      10000
    ),

  devicePolicy:
    (
      process.env.DEVICE_POLICY ||
      'observe'
    ).toLowerCase(),

  maxAccountsDevice:
    num(
      'MAX_ACCOUNTS_PER_DEVICE',
      2
    ),

  maxAccountsIpDay:
    num(
      'MAX_ACCOUNTS_PER_IP_DAY',
      8
    ),

  blockWithdrawOnRisk:
    process.env.BLOCK_WITHDRAW_ON_RISK !==
    'false'
};


/* =========================================================
   DAILY TASK CONFIG
   ========================================================= */

const tasks = {
  news: {
    key: 'news',

    title: 'MAI News',

    chatId:
      process.env.NEWS_CHAT_ID ||
      '@MAI_News_Official',

    link:
      process.env.NEWS_LINK ||
      'https://t.me/MAI_News_Official'
  },

  payout: {
    key: 'payout',

    title: 'MAI Pay Out',

    chatId:
      process.env.PAYOUT_CHAT_ID ||
      '@MAI_Payout_Proof',

    link:
      process.env.PAYOUT_LINK ||
      'https://t.me/MAI_Payout_Proof'
  },

  chat: {
    key: 'chat',

    title: 'MAI Chat Group',

    chatId:
      process.env.COMMUNITY_CHAT_ID ||
      '@MAICommunityChat',

    link:
      process.env.COMMUNITY_LINK ||
      'https://t.me/MAICommunityChat'
  }
};


/* =========================================================
   DATABASE
   ========================================================= */

const pool =
  new Pool({
    connectionString:
      process.env.DATABASE_URL,

    ssl:
      process.env.DATABASE_SSL ===
      'false'
        ? false
        : {
            rejectUnauthorized:
              false
          },

    max: 12,

    idleTimeoutMillis:
      30000,

    connectionTimeoutMillis:
      10000
  });


/* =========================================================
   EXPRESS MIDDLEWARE
   ========================================================= */

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy:
        'cross-origin'
    }
  })
);


app.use(
  cors({
    origin(origin, cb) {
      if (
        !origin ||
        allowedOrigins.includes(
          origin
        )
      ) {
        return cb(
          null,
          true
        );
      }

      return cb(
        new Error(
          'CORS blocked'
        )
      );
    },

    methods: [
      'GET',
      'POST',
      'OPTIONS'
    ],

    allowedHeaders: [
      'Content-Type',
      'X-Telegram-Init-Data',
      'X-MAI-Device-ID',
      'X-Idempotency-Key',
      'X-Admin-Key',
      'X-Dev-User'
    ]
  })
);


app.use(
  express.json({
    limit:
      '64kb'
  })
);


/* =========================================================
   GENERAL HELPERS
   ========================================================= */

function utcDay(
  d = new Date()
) {
  return d
    .toISOString()
    .slice(
      0,
      10
    );
}


function hash(v) {
  return crypto
    .createHash(
      'sha256'
    )
    .update(
      String(
        v || ''
      )
    )
    .digest(
      'hex'
    );
}


function safeNumber(v) {
  const n =
    Number(v);

  return Number.isFinite(n)
    ? n
    : 0;
}


function levelFor(balance) {
  return Math.max(
    0,
    Math.min(
      cfg.maxLevel,

      Math.floor(
        safeNumber(
          balance
        ) /
        Math.max(
          1,
          cfg.holdingStep
        )
      )
    )
  );
}


function levelSpeed(level) {
  return level > 0
    ? cfg.level1Daily +
        (
          level - 1
        ) *
          cfg.levelStep
    : 0;
}


function totalDailyFor(balance) {
  return (
    cfg.freeDaily +
    levelSpeed(
      levelFor(
        balance
      )
    )
  );
}


function referralLink(id) {
  return (
    `https://t.me/${BOT_USERNAME}` +
    `?startapp=r_${id}`
  );
}


function milestoneConfig() {
  return String(
    process.env.REFERRAL_MILESTONES ||
    '5:25,10:60,25:175,50:400,100:1000'
  )
    .split(',')
    .map(x => {
      const [
        count,
        reward
      ] =
        x
          .split(':')
          .map(Number);

      return {
        count,
        reward
      };
    })
    .filter(
      x =>
        x.count > 0 &&
        x.reward > 0
    );
}


function computeFee(amount) {
  return Math.max(
    0,

    cfg.withdrawFeeFixed +
    amount *
      (
        cfg.withdrawFeePercent /
        100
      )
  );
}


/* =========================================================
   ADMIN MIDDLEWARE
   ========================================================= */

function admin(
  req,
  res,
  next
) {
  if (
    !ADMIN_KEY ||
    req.get(
      'X-Admin-Key'
    ) !==
      ADMIN_KEY
  ) {
    return res
      .status(401)
      .json({
        success:
          false,

        message:
          'Admin authorization failed'
      });
  }

  next();
}


/* =========================================================
   RATE LIMIT
   ========================================================= */

const buckets =
  new Map();


function rateLimit(
  max = 120,
  windowMs = 60000
) {
  return (
    req,
    res,
    next
  ) => {
    const key =
      `${req.ip}:${req.path}`;

    const now =
      Date.now();

    let bucket =
      buckets.get(
        key
      );

    if (
      !bucket ||
      now -
        bucket.start >
        windowMs
    ) {
      bucket = {
        start: now,
        count: 0
      };
    }

    bucket.count++;

    buckets.set(
      key,
      bucket
    );

    if (
      bucket.count >
      max
    ) {
      return res
        .status(429)
        .json({
          success:
            false,

          message:
            'Too many requests'
        });
    }

    next();
  };
}


app.use(
  rateLimit(180)
);


/* =========================================================
   TON / MAI WALLET HELPERS
   ========================================================= */

function atomicToTokenAmount(
  value,
  decimals = MAI_DECIMALS
) {
  const raw =
    String(
      value ?? '0'
    ).trim();

  if (
    !/^-?\d+$/.test(
      raw
    )
  ) {
    return 0;
  }

  const negative =
    raw.startsWith(
      '-'
    );

  const digits =
    negative
      ? raw.slice(1)
      : raw;

  if (
    decimals <= 0
  ) {
    return safeNumber(
      `${negative ? '-' : ''}${digits}`
    );
  }

  const padded =
    digits.padStart(
      decimals + 1,
      '0'
    );

  const whole =
    padded.slice(
      0,
      -decimals
    ) || '0';

  const fraction =
    padded.slice(
      -decimals
    );

  const text =
    `${negative ? '-' : ''}` +
    `${whole}.` +
    `${fraction}`;

  return safeNumber(
    text
  );
}


async function fetchMaiWalletBalance(
  walletAddress
) {
  const address =
    String(
      walletAddress ||
      ''
    ).trim();

  if (!address) {
    return 0;
  }

  const url =
    `${TONAPI_BASE}/accounts/` +
    `${encodeURIComponent(address)}` +
    `/jettons/` +
    `${encodeURIComponent(MAI_JETTON_MASTER)}`;

  const headers = {
    Accept:
      'application/json'
  };

  if (TONAPI_KEY) {
    headers.Authorization =
      `Bearer ${TONAPI_KEY}`;
  }

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      10000
    );

  try {
    const response =
      await fetch(
        url,
        {
          headers,
          signal:
            controller.signal
        }
      );

    if (
      response.status ===
      404
    ) {
      return 0;
    }

    const data =
      await response
        .json()
        .catch(
          () => ({})
        );

    if (!response.ok) {
      throw new Error(
        data?.error ||
        data?.message ||
        `TON API error ${response.status}`
      );
    }

    const rawBalance =
      data?.balance ??
      data?.jetton_balance ??
      0;

    const decimals =
      Number(
        data?.jetton
          ?.decimals ??
        data?.decimals ??
        MAI_DECIMALS
      );

    return atomicToTokenAmount(
      rawBalance,

      Number.isFinite(
        decimals
      )
        ? decimals
        : MAI_DECIMALS
    );

  } finally {
    clearTimeout(
      timeout
    );
  }
}


/* =========================================================
   HOLDING SNAPSHOT
   In-game + TON wallet = total holding
   ========================================================= */

async function getUserHoldingSnapshot(
  userOrId,
  client = pool
) {
  let user;

  if (
    typeof userOrId ===
      'object' &&
    userOrId !== null
  ) {
    user =
      userOrId;

  } else {
    const q =
      await client.query(
        `
        SELECT
          telegram_id,
          balance,
          wallet_address
        FROM users
        WHERE telegram_id=$1
        `,
        [
          userOrId
        ]
      );

    user =
      q.rows[0];
  }

  if (!user) {
    return {
      inGame:
        0,

      wallet:
        0,

      total:
        0,

      level:
        0,

      levelSpeed:
        0,

      totalDaily:
        cfg.freeDaily
    };
  }

  const inGame =
    safeNumber(
      user.balance
    );

  let wallet = 0;

  if (
    user.wallet_address
  ) {
    try {
      wallet =
        await fetchMaiWalletBalance(
          user.wallet_address
        );

    } catch (error) {
      console.error(
        'MAI wallet balance read failed:',
        error.message
      );

      wallet = 0;
    }
  }

  const total =
    inGame +
    wallet;

  const level =
    levelFor(
      total
    );

  const levelSpeedValue =
    levelSpeed(
      level
    );

  const totalDaily =
    cfg.freeDaily +
    levelSpeedValue;

  return {
    inGame,
    wallet,
    total,
    level,
    levelSpeed:
      levelSpeedValue,
    totalDaily
  };
}


/* =========================================================
   DATABASE INITIALIZATION
   ========================================================= */

async function initDb() {

  if (
    !process.env.DATABASE_URL
  ) {
    throw new Error(
      'DATABASE_URL is required'
    );
  }


  /* -------------------------------------------------------
     USERS TABLE FIRST
     ------------------------------------------------------- */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users(
      telegram_id BIGINT PRIMARY KEY,

      username TEXT
        NOT NULL
        DEFAULT '',

      first_name TEXT
        NOT NULL
        DEFAULT 'User',

      photo_url TEXT,

      balance NUMERIC(30,8)
        NOT NULL
        DEFAULT 0,

      locked_balance NUMERIC(30,8)
        NOT NULL
        DEFAULT 0,

      wallet_address TEXT,

      wallet_connected_at TIMESTAMPTZ,

      farm_started_at TIMESTAMPTZ,

      farm_rate_daily NUMERIC(30,8),

      daily_bonus_date DATE,

      referred_by BIGINT,

      referral_qualified BOOLEAN
        NOT NULL
        DEFAULT FALSE,

      created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

      updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()
    );
  `);


  /* -------------------------------------------------------
     MIGRATE OLD USERS TABLE SAFELY
     ------------------------------------------------------- */

  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS username TEXT
      NOT NULL
      DEFAULT '';

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS first_name TEXT
      NOT NULL
      DEFAULT 'User';

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS photo_url TEXT;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS balance NUMERIC(30,8)
      NOT NULL
      DEFAULT 0;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS locked_balance NUMERIC(30,8)
      NOT NULL
      DEFAULT 0;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS wallet_address TEXT;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS wallet_connected_at TIMESTAMPTZ;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS farm_started_at TIMESTAMPTZ;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS farm_rate_daily NUMERIC(30,8);

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS daily_bonus_date DATE;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS referred_by BIGINT;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS referral_qualified BOOLEAN
      NOT NULL
      DEFAULT FALSE;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ
      NOT NULL
      DEFAULT NOW();

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ
      NOT NULL
      DEFAULT NOW();
  `);


  /* -------------------------------------------------------
     TRANSACTIONS
     ------------------------------------------------------- */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions(
      id BIGSERIAL PRIMARY KEY,

      telegram_id BIGINT,

      type TEXT
        NOT NULL,

      amount NUMERIC(30,8)
        NOT NULL,

      reference TEXT,

      metadata JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

      created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()
    );
  `);


  await pool.query(`
    ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS telegram_id BIGINT;

    ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS type TEXT;

    ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS amount NUMERIC(30,8);

    ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS reference TEXT;

    ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS metadata JSONB
      NOT NULL
      DEFAULT '{}'::jsonb;

    ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ
      NOT NULL
      DEFAULT NOW();
  `);


  /* -------------------------------------------------------
     DAILY TASK COMPLETIONS
     ------------------------------------------------------- */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_task_completions(
      id BIGSERIAL PRIMARY KEY,

      telegram_id BIGINT
        NOT NULL,

      task_key TEXT
        NOT NULL,

      day DATE
        NOT NULL,

      reward NUMERIC(30,8)
        NOT NULL,

      created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

      UNIQUE(
        telegram_id,
        task_key,
        day
      )
    );
  `);


  /* -------------------------------------------------------
     AD SESSIONS
     ------------------------------------------------------- */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ad_sessions(
      id UUID PRIMARY KEY,

      telegram_id BIGINT
        NOT NULL,

      day DATE,

      status TEXT
        NOT NULL
        DEFAULT 'started',

      started_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

      completed_at TIMESTAMPTZ,

      claimed_at TIMESTAMPTZ,

      provider_ref TEXT,

      metadata JSONB
        NOT NULL
        DEFAULT '{}'::jsonb
    );
  `);


  await pool.query(`
    ALTER TABLE ad_sessions
      ADD COLUMN IF NOT EXISTS day DATE;
  `);


  await pool.query(`
    UPDATE ad_sessions
    SET day =
      COALESCE(
        started_at::date,
        CURRENT_DATE
      )
    WHERE day IS NULL;
  `);


  await pool.query(`
    ALTER TABLE ad_sessions
      ALTER COLUMN day
      SET NOT NULL;
  `);


  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_ads_user_day
    ON ad_sessions(
      telegram_id,
      day
    );
  `);


  /* -------------------------------------------------------
     REFERRAL MILESTONES
     ------------------------------------------------------- */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS referral_milestones(
      telegram_id BIGINT
        NOT NULL,

      milestone INTEGER
        NOT NULL,

      reward NUMERIC(30,8)
        NOT NULL,

      claimed_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

      PRIMARY KEY(
        telegram_id,
        milestone
      )
    );
  `);


  /* -------------------------------------------------------
     CAMPAIGNS
     ------------------------------------------------------- */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS campaigns(
      id BIGSERIAL PRIMARY KEY,

      owner_id BIGINT
        NOT NULL,

      type TEXT
        NOT NULL,

      title TEXT
        NOT NULL,

      target_url TEXT
        NOT NULL,

      description TEXT
        NOT NULL
        DEFAULT '',

      target_count INTEGER
        NOT NULL
        CHECK(
          target_count > 0
        ),

      completed_count INTEGER
        NOT NULL
        DEFAULT 0,

      reward_per_user NUMERIC(30,8)
        NOT NULL
        DEFAULT 0,

      payment_method TEXT
        NOT NULL
        CHECK(
          payment_method
          IN(
            'MAI',
            'GRAM'
          )
        ),

      payment_amount NUMERIC(30,8)
        NOT NULL,

      payment_status TEXT
        NOT NULL
        DEFAULT 'pending',

      status TEXT
        NOT NULL
        DEFAULT 'pending',

      verification_type TEXT
        NOT NULL
        DEFAULT 'manual',

      chat_id TEXT,

      created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

      approved_at TIMESTAMPTZ
    );
  `);


  /* -------------------------------------------------------
     CAMPAIGN COMPLETIONS
     ------------------------------------------------------- */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS campaign_completions(
      campaign_id BIGINT
        NOT NULL,

      telegram_id BIGINT
        NOT NULL,

      rewarded NUMERIC(30,8)
        NOT NULL
        DEFAULT 0,

      completed_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

      PRIMARY KEY(
        campaign_id,
        telegram_id
      )
    );
  `);


  /* -------------------------------------------------------
     WITHDRAWALS
     ------------------------------------------------------- */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS withdrawals(
      id UUID PRIMARY KEY,

      telegram_id BIGINT
        NOT NULL,

      amount NUMERIC(30,8)
        NOT NULL,

      fee NUMERIC(30,8)
        NOT NULL,

      receive_amount NUMERIC(30,8)
        NOT NULL,

      wallet_address TEXT
        NOT NULL,

      status TEXT
        NOT NULL
        DEFAULT 'pending',

      idempotency_key TEXT
        NOT NULL,

      risk_flags JSONB
        NOT NULL
        DEFAULT '[]'::jsonb,

      tx_hash TEXT,

      created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

      updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

      UNIQUE(
        telegram_id,
        idempotency_key
      )
    );
  `);


  /* -------------------------------------------------------
     DEVICE ACCOUNTS
     ------------------------------------------------------- */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS device_accounts(
      device_hash TEXT
        NOT NULL,

      telegram_id BIGINT
        NOT NULL,

      first_seen TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

      last_seen TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

      PRIMARY KEY(
        device_hash,
        telegram_id
      )
    );
  `);


  /* -------------------------------------------------------
     SECURITY LOGS
     ------------------------------------------------------- */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS security_logs(
      id BIGSERIAL PRIMARY KEY,

      telegram_id BIGINT,

      action TEXT
        NOT NULL,

      severity TEXT
        NOT NULL
        DEFAULT 'info',

      ip_hash TEXT,

      device_hash TEXT,

      user_agent_hash TEXT,

      metadata JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

      created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()
    );
  `);


  console.log(
    'MAI Network database schema ready'
  );
}
/* =========================================================
   TELEGRAM INIT DATA
   ========================================================= */

function parseInitData(initData) {
  if (
    !initData ||
    typeof initData !== 'string' ||
    initData.length > 10000
  ) {
    throw new Error(
      'Invalid Telegram initData'
    );
  }

  const params =
    new URLSearchParams(
      initData
    );

  const receivedHash =
    params.get('hash');

  const authDate =
    Number(
      params.get(
        'auth_date'
      )
    );

  if (
    !receivedHash ||
    !Number.isFinite(
      authDate
    )
  ) {
    throw new Error(
      'Telegram authorization missing'
    );
  }

  const age =
    Math.floor(
      Date.now() /
      1000
    ) -
    authDate;

  if (
    age < -60 ||
    age > 86400
  ) {
    throw new Error(
      'Telegram authorization expired'
    );
  }

  const pairs = [];

  for (
    const [key, value]
    of params.entries()
  ) {
    if (
      key !== 'hash'
    ) {
      pairs.push(
        `${key}=${value}`
      );
    }
  }

  pairs.sort();

  const secret =
    crypto
      .createHmac(
        'sha256',
        'WebAppData'
      )
      .update(
        BOT_TOKEN
      )
      .digest();

  const calculated =
    crypto
      .createHmac(
        'sha256',
        secret
      )
      .update(
        pairs.join('\n')
      )
      .digest('hex');

  const a =
    Buffer.from(
      calculated,
      'hex'
    );

  const b =
    Buffer.from(
      receivedHash,
      'hex'
    );

  if (
    a.length !== b.length ||
    !crypto.timingSafeEqual(
      a,
      b
    )
  ) {
    throw new Error(
      'Telegram signature verification failed'
    );
  }

  const telegramUser =
    JSON.parse(
      params.get(
        'user'
      ) || '{}'
    );

  if (
    !telegramUser.id
  ) {
    throw new Error(
      'Telegram user missing'
    );
  }

  return {
    id:
      String(
        telegramUser.id
      ),

    username:
      telegramUser.username ||
      '',

    firstName:
      telegramUser.first_name ||
      'User',

    photoUrl:
      telegramUser.photo_url ||
      null,

    startParam:
      params.get(
        'start_param'
      ) || ''
  };
}


/* =========================================================
   SECURITY LOG
   ========================================================= */

async function logSecurity(
  req,
  action,
  severity = 'info',
  metadata = {}
) {
  try {
    await pool.query(
      `
      INSERT INTO security_logs(
        telegram_id,
        action,
        severity,
        ip_hash,
        device_hash,
        user_agent_hash,
        metadata
      )
      VALUES(
        $1,$2,$3,$4,$5,$6,$7
      )
      `,
      [
        req.auth?.id ||
          null,

        action,

        severity,

        hash(
          req.ip
        ).slice(
          0,
          32
        ),

        req.deviceHash ||
          null,

        hash(
          req.get(
            'user-agent'
          )
        ).slice(
          0,
          32
        ),

        metadata
      ]
    );

  } catch (
    error
  ) {
    console.error(
      'Security log failed:',
      error.message
    );
  }
}


/* =========================================================
   AUTHENTICATION
   ========================================================= */

async function authenticate(
  req,
  res,
  next
) {
  try {
    let auth;

    const initData =
      req.get(
        'X-Telegram-Init-Data'
      ) ||
      req.body?.initData;


    if (
      initData
    ) {
      if (
        !BOT_TOKEN
      ) {
        throw new Error(
          'BOT_TOKEN is not configured'
        );
      }

      auth =
        parseInitData(
          initData
        );

    } else if (
      ALLOW_DEV_AUTH &&
      req.get(
        'X-Dev-User'
      )
    ) {
      const id =
        String(
          req.get(
            'X-Dev-User'
          )
        );

      if (
        !/^\d+$/.test(
          id
        )
      ) {
        throw new Error(
          'Bad dev user'
        );
      }

      auth = {
        id,
        username:
          'dev_user',

        firstName:
          'MAI Tester',

        photoUrl:
          null,

        startParam:
          ''
      };

    } else {
      throw new Error(
        'Open MAI Network inside Telegram'
      );
    }


    req.auth =
      auth;


    const rawDevice =
      req.get(
        'X-MAI-Device-ID'
      ) || '';

    req.deviceHash =
      rawDevice
        ? hash(
            rawDevice
          ).slice(
            0,
            48
          )
        : null;


    const referralMatch =
      String(
        auth.startParam ||
        ''
      ).match(
        /^r_(\d+)$/
      );


    const referredBy =
      referralMatch &&
      referralMatch[1] !==
        auth.id
        ? referralMatch[1]
        : null;


    await pool.query(
      `
      INSERT INTO users(
        telegram_id,
        username,
        first_name,
        photo_url,
        balance,
        referred_by
      )
      VALUES(
        $1,$2,$3,$4,$5,$6
      )

      ON CONFLICT(
        telegram_id
      )
      DO UPDATE SET

        username =
          EXCLUDED.username,

        first_name =
          EXCLUDED.first_name,

        photo_url =
          COALESCE(
            EXCLUDED.photo_url,
            users.photo_url
          ),

        updated_at =
          NOW()
      `,
      [
        auth.id,
        auth.username,
        auth.firstName,
        auth.photoUrl,
        cfg.initialBalance,
        referredBy
      ]
    );


    if (
      req.deviceHash
    ) {
      await pool.query(
        `
        INSERT INTO device_accounts(
          device_hash,
          telegram_id
        )
        VALUES(
          $1,$2
        )

        ON CONFLICT(
          device_hash,
          telegram_id
        )
        DO UPDATE SET

          last_seen =
            NOW()
        `,
        [
          req.deviceHash,
          auth.id
        ]
      );
    }


    next();

  } catch (
    error
  ) {
    return res
      .status(401)
      .json({
        success:
          false,

        message:
          error.message
      });
  }
}


/* =========================================================
   RISK CHECK
   ========================================================= */

async function riskFor(
  req
) {
  const flags = [];


  if (
    req.deviceHash
  ) {
    const result =
      await pool.query(
        `
        SELECT
          COUNT(*)::int AS c
        FROM device_accounts
        WHERE device_hash=$1
        `,
        [
          req.deviceHash
        ]
      );


    if (
      result.rows[0].c >
      cfg.maxAccountsDevice
    ) {
      flags.push(
        'multi_account_device'
      );
    }
  }


  const ipHash =
    hash(
      req.ip
    ).slice(
      0,
      32
    );


  const ipResult =
    await pool.query(
      `
      SELECT
        COUNT(
          DISTINCT telegram_id
        )::int AS c

      FROM security_logs

      WHERE
        ip_hash=$1

        AND created_at >=
          NOW() -
          INTERVAL '1 day'
      `,
      [
        ipHash
      ]
    );


  if (
    ipResult.rows[0].c >
    cfg.maxAccountsIpDay
  ) {
    flags.push(
      'many_accounts_ip'
    );
  }


  return flags;
}


/* =========================================================
   TELEGRAM BOT API
   ========================================================= */

async function telegram(
  method,
  body
) {
  if (
    !BOT_TOKEN
  ) {
    throw new Error(
      'BOT_TOKEN is missing'
    );
  }


  const response =
    await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
      {
        method:
          'POST',

        headers: {
          'content-type':
            'application/json'
        },

        body:
          JSON.stringify(
            body
          )
      }
    );


  const data =
    await response.json();


  if (
    !data.ok
  ) {
    throw new Error(
      data.description ||
      'Telegram API error'
    );
  }


  return data.result;
}


/* =========================================================
   REFERRAL QUALIFICATION
   ========================================================= */

async function qualifyReferral(
  client,
  userId
) {
  const result =
    await client.query(
      `
      SELECT
        referred_by,
        referral_qualified

      FROM users

      WHERE telegram_id=$1

      FOR UPDATE
      `,
      [
        userId
      ]
    );


  const user =
    result.rows[0];


  if (
    !user ||
    !user.referred_by ||
    user.referral_qualified
  ) {
    return;
  }


  await client.query(
    `
    UPDATE users

    SET
      referral_qualified=TRUE,
      balance=balance+$2,
      updated_at=NOW()

    WHERE telegram_id=$1
    `,
    [
      userId,
      cfg.referredReward
    ]
  );


  await client.query(
    `
    UPDATE users

    SET
      balance=balance+$2,
      updated_at=NOW()

    WHERE telegram_id=$1
    `,
    [
      user.referred_by,
      cfg.referrerReward
    ]
  );


  await client.query(
    `
    INSERT INTO transactions(
      telegram_id,
      type,
      amount,
      reference
    )
    VALUES
      (
        $1,
        'referral_welcome',
        $2,
        $3
      ),
      (
        $3,
        'referral_reward',
        $4,
        $1
      )
    `,
    [
      userId,
      cfg.referredReward,
      String(
        user.referred_by
      ),
      cfg.referrerReward
    ]
  );
}


/* =========================================================
   FARM STATE
   Uses CURRENT total holding
   ========================================================= */

function farmState(
  row,
  holding
) {
  const currentRate =
    safeNumber(
      holding?.totalDaily ??
      cfg.freeDaily
    );


  const started =
    row.farm_started_at
      ? new Date(
          row.farm_started_at
        ).getTime()
      : null;


  if (
    !started
  ) {
    return {
      active:
        false,

      ready:
        false,

      remaining:
        cfg.farmSeconds,

      pending:
        0,

      rateDaily:
        currentRate,

      rateSecond:
        currentRate /
        86400
    };
  }


  const elapsed =
    Math.max(
      0,

      (
        Date.now() -
        started
      ) /
      1000
    );


  const progress =
    Math.min(
      1,

      elapsed /
      cfg.farmSeconds
    );


  return {
    active:
      true,

    ready:
      elapsed >=
      cfg.farmSeconds,

    remaining:
      Math.max(
        0,

        Math.ceil(
          cfg.farmSeconds -
          elapsed
        )
      ),

    pending:
      currentRate *
      progress,

    rateDaily:
      currentRate,

    rateSecond:
      currentRate /
      86400,

    startedAt:
      row.farm_started_at
  };
}


/* =========================================================
   BUILD USER
   IMPORTANT:
   in-game + wallet = total holding
   ========================================================= */

async function buildUser(
  userId
) {
  const userResult =
    await pool.query(
      `
      SELECT *
      FROM users
      WHERE telegram_id=$1
      `,
      [
        userId
      ]
    );


  const user =
    userResult.rows[0];


  if (
    !user
  ) {
    throw new Error(
      'User not found'
    );
  }


  const holding =
    await getUserHoldingSnapshot(
      user
    );


  const referrals =
    (
      await pool.query(
        `
        SELECT

          COUNT(*)
          FILTER(
            WHERE referral_qualified
          )::int
          AS successful,

          COUNT(*)
          FILTER(
            WHERE NOT referral_qualified
          )::int
          AS pending

        FROM users

        WHERE referred_by=$1
        `,
        [
          userId
        ]
      )
    ).rows[0];


  const farm =
    farmState(
      user,
      holding
    );


  return {
    telegramId:
      String(
        user.telegram_id
      ),

    username:
      user.username,

    firstName:
      user.first_name,

    photoUrl:
      user.photo_url,


    /* ---------------------------------------------
       IN-GAME BALANCE ONLY
       --------------------------------------------- */

    balance:
      safeNumber(
        user.balance
      ),


    lockedBalance:
      safeNumber(
        user.locked_balance
      ),


    /* ---------------------------------------------
       WALLET HOLDING
       --------------------------------------------- */

    walletHolding:
      holding.wallet,


    /* ---------------------------------------------
       TOTAL = GAME + WALLET
       --------------------------------------------- */

    totalHolding:
      holding.total,


    /* ---------------------------------------------
       DYNAMIC LEVEL
       --------------------------------------------- */

    level:
      holding.level,


    levelMiningSpeed:
      holding.levelSpeed,


    miningSpeed:
      holding.totalDaily,


    freeMiningSpeed:
      cfg.freeDaily,


    maxLevel:
      cfg.maxLevel,


    holdingStep:
      cfg.holdingStep,


    walletAddress:
      user.wallet_address,


    walletConnectedAt:
      user.wallet_connected_at,


    referralLink:
      referralLink(
        user.telegram_id
      ),


    referrals: {
      successful:
        referrals.successful ||
        0,

      pending:
        referrals.pending ||
        0
    },


    farm,


    dailyBonusClaimed:
      String(
        user.daily_bonus_date ||
        ''
      ) ===
      utcDay()
  };
}


/* =========================================================
   TASK OVERVIEW
   ========================================================= */

async function taskOverview(
  userId
) {
  const day =
    utcDay();


  const doneRows =
    (
      await pool.query(
        `
        SELECT
          task_key

        FROM daily_task_completions

        WHERE
          telegram_id=$1
          AND day=$2
        `,
        [
          userId,
          day
        ]
      )
    ).rows;


  const done =
    doneRows.map(
      row =>
        row.task_key
    );


  const adCount =
    (
      await pool.query(
        `
        SELECT
          COUNT(*)::int AS c

        FROM ad_sessions

        WHERE
          telegram_id=$1
          AND day=$2
          AND claimed_at IS NOT NULL
        `,
        [
          userId,
          day
        ]
      )
    ).rows[0].c;


  return {
    day,

    ads: {
      limit:
        cfg.adDailyLimit,

      completed:
        adCount,

      remaining:
        Math.max(
          0,
          cfg.adDailyLimit -
          adCount
        ),

      reward:
        cfg.adReward,

      cooldown:
        cfg.adCooldown
    },


    joins:
      Object
        .values(tasks)
        .map(
          task => ({
            ...task,

            reward:
              cfg.taskReward,

            completed:
              done.includes(
                task.key
              )
          })
        ),


    hasIncomplete:
      adCount <
        cfg.adDailyLimit ||

      Object
        .keys(tasks)
        .some(
          key =>
            !done.includes(
              key
            )
        )
  };
}


/* =========================================================
   HEALTH
   ========================================================= */

app.get(
  '/health',
  (
    req,
    res
  ) => {
    res.json({
      ok:
        true,

      name:
        'MAI Network API',

      version:
        '4.0.0',

      token:
        MAI_JETTON_MASTER,

      levelMode:
        'in-game-plus-wallet'
    });
  }
);


/* =========================================================
   BOOTSTRAP
   ========================================================= */

app.get(
  '/api/bootstrap',

  authenticate,

  async (
    req,
    res,
    next
  ) => {
    try {
      const risk =
        await riskFor(
          req
        );


      if (
        risk.length
      ) {
        await logSecurity(
          req,

          'bootstrap_risk',

          cfg.devicePolicy ===
            'hard'
            ? 'warn'
            : 'info',

          {
            risk
          }
        );
      }


      res.json({
        success:
          true,

        user:
          await buildUser(
            req.auth.id
          ),

        tasks:
          await taskOverview(
            req.auth.id
          ),

        security: {
          policy:
            cfg.devicePolicy,

          riskFlags:
            risk
        }
      });

    } catch (
      error
    ) {
      next(
        error
      );
    }
  }
);


/* =========================================================
   WALLET MAI BALANCE API
   ========================================================= */

app.get(
  '/api/wallet/mai-balance',

  authenticate,

  rateLimit(
    30,
    60000
  ),

  async (
    req,
    res,
    next
  ) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            balance,
            wallet_address

          FROM users

          WHERE telegram_id=$1
          `,
          [
            req.auth.id
          ]
        );


      const user =
        result.rows[0];


      if (
        !user
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              'User not found'
          });
      }


      const holding =
        await getUserHoldingSnapshot(
          user
        );


      return res.json({
        success:
          true,

        walletAddress:
          user.wallet_address,

        jettonMaster:
          MAI_JETTON_MASTER,

        inGameBalance:
          holding.inGame,

        walletBalance:
          holding.wallet,

        totalHolding:
          holding.total,

        level:
          holding.level,

        miningSpeed:
          holding.totalDaily,

        levelMiningSpeed:
          holding.levelSpeed
      });

    } catch (
      error
    ) {
      next(
        error
      );
    }
  }
);


/* =========================================================
   FARM START
   ========================================================= */

app.post(
  '/api/farm/start',

  authenticate,

  rateLimit(
    10,
    60000
  ),

  async (
    req,
    res,
    next
  ) => {
    const client =
      await pool.connect();

    try {
      await client.query(
        'BEGIN'
      );


      const result =
        await client.query(
          `
          SELECT *
          FROM users
          WHERE telegram_id=$1
          FOR UPDATE
          `,
          [
            req.auth.id
          ]
        );


      const user =
        result.rows[0];


      if (
        !user
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res
          .status(404)
          .json({
            success:
              false,

            message:
              'User not found'
          });
      }


      if (
        user.farm_started_at
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res
          .status(409)
          .json({
            success:
              false,

            message:
              'Farming is already active'
          });
      }


      const holding =
        await getUserHoldingSnapshot(
          user,
          client
        );


      const rate =
        holding.totalDaily;


      await client.query(
        `
        UPDATE users

        SET
          farm_started_at=NOW(),
          farm_rate_daily=$2,
          updated_at=NOW()

        WHERE telegram_id=$1
        `,
        [
          req.auth.id,
          rate
        ]
      );


      await client.query(
        'COMMIT'
      );


      res.json({
        success:
          true,

        level:
          holding.level,

        totalHolding:
          holding.total,

        rateDaily:
          rate,

        user:
          await buildUser(
            req.auth.id
          )
      });

    } catch (
      error
    ) {
      try {
        await client.query(
          'ROLLBACK'
        );
      } catch {}

      next(
        error
      );

    } finally {
      client.release();
    }
  }
);


/* =========================================================
   FARM CLAIM
   Dynamic current level at claim time
   ========================================================= */

app.post(
  '/api/farm/claim',

  authenticate,

  rateLimit(
    8,
    60000
  ),

  async (
    req,
    res,
    next
  ) => {
    const client =
      await pool.connect();

    try {
      await client.query(
        'BEGIN'
      );


      const result =
        await client.query(
          `
          SELECT *
          FROM users
          WHERE telegram_id=$1
          FOR UPDATE
          `,
          [
            req.auth.id
          ]
        );


      const user =
        result.rows[0];


      if (
        !user
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res
          .status(404)
          .json({
            success:
              false,

            message:
              'User not found'
          });
      }


      const holding =
        await getUserHoldingSnapshot(
          user,
          client
        );


      const state =
        farmState(
          user,
          holding
        );


      if (
        !state.active ||
        !state.ready
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res
          .status(409)
          .json({
            success:
              false,

            message:
              `Farming not ready. ${state.remaining}s remaining`
          });
      }


      /*
       * Reward is calculated from the CURRENT
       * in-game + wallet holding.
       *
       * Example:
       * total 5000 MAI => LVL 5
       * sell 1000 => total 4000 => LVL 4
       * claim uses LVL 4 rate.
       */

      const reward =
        holding.totalDaily;


      const afterGameBalance =
        safeNumber(
          user.balance
        ) +
        reward;


      /*
       * Reward becomes in-game MAI,
       * so total holding may increase
       * after claim.
       */

      let walletAfter =
        holding.wallet;


      const totalAfter =
        afterGameBalance +
        walletAfter;


      const nextRate =
        totalDailyFor(
          totalAfter
        );


      await client.query(
        `
        UPDATE users

        SET
          balance =
            balance + $2,

          farm_started_at =
            NOW(),

          farm_rate_daily =
            $3,

          updated_at =
            NOW()

        WHERE telegram_id=$1
        `,
        [
          req.auth.id,
          reward,
          nextRate
        ]
      );


      await client.query(
        `
        INSERT INTO transactions(
          telegram_id,
          type,
          amount,
          reference,
          metadata
        )

        VALUES(
          $1,
          'farm_claim',
          $2,
          $3,
          $4
        )
        `,
        [
          req.auth.id,

          reward,

          utcDay(),

          {
            level:
              holding.level,

            inGame:
              holding.inGame,

            wallet:
              holding.wallet,

            total:
              holding.total,

            rateDaily:
              holding.totalDaily
          }
        ]
      );


      await qualifyReferral(
        client,
        req.auth.id
      );


      await client.query(
        'COMMIT'
      );


      res.json({
        success:
          true,

        reward,

        previousLevel:
          holding.level,

        previousTotalHolding:
          holding.total,

        user:
          await buildUser(
            req.auth.id
          )
      });

    } catch (
      error
    ) {
      try {
        await client.query(
          'ROLLBACK'
        );
      } catch {}

      next(
        error
      );

    } finally {
      client.release();
    }
  }
);


/* =========================================================
   DAILY BONUS
   ========================================================= */

app.post(
  '/api/daily-bonus',

  authenticate,

  rateLimit(
    10,
    60000
  ),

  async (
    req,
    res,
    next
  ) => {
    const client =
      await pool.connect();

    try {
      await client.query(
        'BEGIN'
      );


      const day =
        utcDay();


      const update =
        await client.query(
          `
          UPDATE users

          SET
            balance =
              balance + $2,

            daily_bonus_date =
              $3,

            updated_at =
              NOW()

          WHERE
            telegram_id=$1

            AND (
              daily_bonus_date
              IS NULL

              OR
              daily_bonus_date
              <> $3
            )

          RETURNING
            telegram_id
          `,
          [
            req.auth.id,
            cfg.dailyBonus,
            day
          ]
        );


      if (
        !update.rowCount
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res
          .status(409)
          .json({
            success:
              false,

            message:
              'Daily bonus already claimed today'
          });
      }


      await client.query(
        `
        INSERT INTO transactions(
          telegram_id,
          type,
          amount,
          reference
        )

        VALUES(
          $1,
          'daily_bonus',
          $2,
          $3
        )
        `,
        [
          req.auth.id,
          cfg.dailyBonus,
          day
        ]
      );


      await qualifyReferral(
        client,
        req.auth.id
      );


      await client.query(
        'COMMIT'
      );


      res.json({
        success:
          true,

        reward:
          cfg.dailyBonus,

        user:
          await buildUser(
            req.auth.id
          )
      });

    } catch (
      error
    ) {
      try {
        await client.query(
          'ROLLBACK'
        );
      } catch {}

      next(
        error
      );

    } finally {
      client.release();
    }
  }
);
/* =========================================================
   TASKS GET
   ========================================================= */

app.get(
  '/api/tasks',

  authenticate,

  async (
    req,
    res,
    next
  ) => {
    try {
      res.json({
        success:
          true,

        tasks:
          await taskOverview(
            req.auth.id
          )
      });

    } catch (
      error
    ) {
      next(
        error
      );
    }
  }
);


/* =========================================================
   TASK VERIFY
   ========================================================= */

app.post(
  '/api/tasks/verify/:key',

  authenticate,

  rateLimit(
    20,
    60000
  ),

  async (
    req,
    res,
    next
  ) => {
    try {
      const task =
        tasks[
          req.params.key
        ];


      if (
        !task
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              'Unknown task'
          });
      }


      const member =
        await telegram(
          'getChatMember',
          {
            chat_id:
              task.chatId,

            user_id:
              req.auth.id
          }
        );


      const ok =
        [
          'creator',
          'administrator',
          'member'
        ].includes(
          member.status
        ) ||

        (
          member.status ===
            'restricted' &&
          member.is_member
        );


      if (
        !ok
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            message:
              'Join the channel/group first, then check again.'
          });
      }


      const client =
        await pool.connect();


      try {
        await client.query(
          'BEGIN'
        );


        const day =
          utcDay();


        const inserted =
          await client.query(
            `
            INSERT INTO daily_task_completions(
              telegram_id,
              task_key,
              day,
              reward
            )
            VALUES(
              $1,$2,$3,$4
            )

            ON CONFLICT
            DO NOTHING

            RETURNING id
            `,
            [
              req.auth.id,
              task.key,
              day,
              cfg.taskReward
            ]
          );


        if (
          inserted.rowCount
        ) {
          await client.query(
            `
            UPDATE users

            SET
              balance =
                balance + $2,

              updated_at =
                NOW()

            WHERE telegram_id=$1
            `,
            [
              req.auth.id,
              cfg.taskReward
            ]
          );


          await client.query(
            `
            INSERT INTO transactions(
              telegram_id,
              type,
              amount,
              reference
            )
            VALUES(
              $1,
              'daily_task',
              $2,
              $3
            )
            `,
            [
              req.auth.id,
              cfg.taskReward,
              task.key
            ]
          );


          await qualifyReferral(
            client,
            req.auth.id
          );
        }


        await client.query(
          'COMMIT'
        );


        res.json({
          success:
            true,

          rewarded:
            !!inserted.rowCount,

          tasks:
            await taskOverview(
              req.auth.id
            ),

          user:
            await buildUser(
              req.auth.id
            )
        });

      } catch (
        error
      ) {
        try {
          await client.query(
            'ROLLBACK'
          );
        } catch {}

        throw error;

      } finally {
        client.release();
      }

    } catch (
      error
    ) {
      next(
        error
      );
    }
  }
);


/* =========================================================
   ADS START
   ========================================================= */

app.post(
  '/api/ads/start',

  authenticate,

  rateLimit(
    30,
    60000
  ),

  async (
    req,
    res,
    next
  ) => {
    try {
      const day =
        utcDay();


      const used =
        (
          await pool.query(
            `
            SELECT
              COUNT(*)::int AS c

            FROM ad_sessions

            WHERE
              telegram_id=$1

              AND day=$2

              AND claimed_at
              IS NOT NULL
            `,
            [
              req.auth.id,
              day
            ]
          )
        ).rows[0].c;


      if (
        used >=
        cfg.adDailyLimit
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            message:
              'Daily ad limit reached'
          });
      }


      const last =
        (
          await pool.query(
            `
            SELECT
              COALESCE(
                completed_at,
                started_at
              ) AS t

            FROM ad_sessions

            WHERE
              telegram_id=$1

            ORDER BY
              started_at DESC

            LIMIT 1
            `,
            [
              req.auth.id
            ]
          )
        ).rows[0];


      if (
        last
      ) {
        const wait =
          cfg.adCooldown -
          (
            Date.now() -
            new Date(
              last.t
            ).getTime()
          ) /
          1000;


        if (
          wait > 0
        ) {
          return res
            .status(429)
            .json({
              success:
                false,

              message:
                `Please wait ${Math.ceil(wait)}s`,

              cooldown:
                Math.ceil(wait)
            });
        }
      }


      const id =
        crypto.randomUUID();


      await pool.query(
        `
        INSERT INTO ad_sessions(
          id,
          telegram_id,
          day
        )
        VALUES(
          $1,$2,$3
        )
        `,
        [
          id,
          req.auth.id,
          day
        ]
      );


      let url = '';


      if (
        cfg.adProviderMode ===
        'external'
      ) {
        if (
          !cfg.adProviderUrl
        ) {
          return res
            .status(503)
            .json({
              success:
                false,

              message:
                'Ad provider is not configured'
            });
        }


        const adUrl =
          new URL(
            cfg.adProviderUrl
          );


        adUrl.searchParams.set(
          'session_id',
          id
        );


        adUrl.searchParams.set(
          'user_id',
          req.auth.id
        );


        url =
          adUrl.toString();

      } else if (
        cfg.adProviderMode ===
          'demo' &&
        ALLOW_DEV_AUTH
      ) {
        url =
          `${CLIENT_ORIGIN.split(',')[0]}/?demo_ad=${id}`;
      }


      res.json({
        success:
          true,

        sessionId:
          id,

        url
      });

    } catch (
      error
    ) {
      next(
        error
      );
    }
  }
);


/* =========================================================
   ADS WEBHOOK
   ========================================================= */

app.post(
  '/webhooks/ads',

  async (
    req,
    res,
    next
  ) => {
    try {
      const signature =
        req.get(
          'x-ad-signature'
        ) || '';


      const raw =
        `${req.body.sessionId}:` +
        `${req.body.status}:` +
        `${req.body.providerRef || ''}`;


      const expected =
        crypto
          .createHmac(
            'sha256',
            cfg.adWebhookSecret
          )
          .update(raw)
          .digest('hex');


      if (
        !cfg.adWebhookSecret ||
        signature.length !==
          expected.length ||
        !crypto.timingSafeEqual(
          Buffer.from(
            signature
          ),
          Buffer.from(
            expected
          )
        )
      ) {
        return res
          .status(401)
          .json({
            success:
              false
          });
      }


      if (
        req.body.status ===
        'completed'
      ) {
        await pool.query(
          `
          UPDATE ad_sessions

          SET
            status='completed',

            completed_at=NOW(),

            provider_ref=$2

          WHERE
            id=$1

            AND status='started'
          `,
          [
            req.body.sessionId,
            req.body.providerRef ||
              null
          ]
        );
      }


      res.json({
        success:
          true
      });

    } catch (
      error
    ) {
      next(
        error
      );
    }
  }
);


/* =========================================================
   DEMO AD COMPLETE
   ========================================================= */

app.post(
  '/api/ads/demo-complete/:id',

  authenticate,

  async (
    req,
    res,
    next
  ) => {
    try {
      if (
        !(
          cfg.adProviderMode ===
            'demo' &&
          ALLOW_DEV_AUTH
        )
      ) {
        return res
          .status(404)
          .end();
      }


      await pool.query(
        `
        UPDATE ad_sessions

        SET
          status='completed',

          completed_at=NOW()

        WHERE
          id=$1

          AND telegram_id=$2
        `,
        [
          req.params.id,
          req.auth.id
        ]
      );


      res.json({
        success:
          true
      });

    } catch (
      error
    ) {
      next(
        error
      );
    }
  }
);


/* =========================================================
   AD STATUS
   ========================================================= */

app.get(
  '/api/ads/status/:id',

  authenticate,

  async (
    req,
    res,
    next
  ) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            status,
            claimed_at

          FROM ad_sessions

          WHERE
            id=$1

            AND telegram_id=$2
          `,
          [
            req.params.id,
            req.auth.id
          ]
        );


      if (
        !result.rowCount
      ) {
        return res
          .status(404)
          .json({
            success:
              false
          });
      }


      res.json({
        success:
          true,

        ...result.rows[0]
      });

    } catch (
      error
    ) {
      next(
        error
      );
    }
  }
);


/* =========================================================
   AD CLAIM
   ========================================================= */

app.post(
  '/api/ads/claim/:id',

  authenticate,

  async (
    req,
    res,
    next
  ) => {
    const client =
      await pool.connect();

    try {
      await client.query(
        'BEGIN'
      );


      const result =
        await client.query(
          `
          SELECT *

          FROM ad_sessions

          WHERE
            id=$1

            AND telegram_id=$2

          FOR UPDATE
          `,
          [
            req.params.id,
            req.auth.id
          ]
        );


      const ad =
        result.rows[0];


      if (
        !ad ||
        ad.status !==
          'completed' ||
        ad.claimed_at
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res
          .status(409)
          .json({
            success:
              false,

            message:
              'Ad is not verified as completed'
          });
      }


      const used =
        (
          await client.query(
            `
            SELECT
              COUNT(*)::int AS c

            FROM ad_sessions

            WHERE
              telegram_id=$1

              AND day=$2

              AND claimed_at
              IS NOT NULL
            `,
            [
              req.auth.id,
              ad.day
            ]
          )
        ).rows[0].c;


      if (
        used >=
        cfg.adDailyLimit
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res
          .status(409)
          .json({
            success:
              false,

            message:
              'Daily ad limit reached'
          });
      }


      await client.query(
        `
        UPDATE ad_sessions

        SET
          claimed_at=NOW(),

          status='claimed'

        WHERE id=$1
        `,
        [
          ad.id
        ]
      );


      await client.query(
        `
        UPDATE users

        SET
          balance =
            balance + $2,

          updated_at =
            NOW()

        WHERE telegram_id=$1
        `,
        [
          req.auth.id,
          cfg.adReward
        ]
      );


      await client.query(
        `
        INSERT INTO transactions(
          telegram_id,
          type,
          amount,
          reference
        )
        VALUES(
          $1,
          'ad_reward',
          $2,
          $3
        )
        `,
        [
          req.auth.id,
          cfg.adReward,
          ad.id
        ]
      );


      await qualifyReferral(
        client,
        req.auth.id
      );


      await client.query(
        'COMMIT'
      );


      res.json({
        success:
          true,

        reward:
          cfg.adReward,

        tasks:
          await taskOverview(
            req.auth.id
          ),

        user:
          await buildUser(
            req.auth.id
          )
      });

    } catch (
      error
    ) {
      try {
        await client.query(
          'ROLLBACK'
        );
      } catch {}

      next(
        error
      );

    } finally {
      client.release();
    }
  }
);


/* =========================================================
   REFERRALS GET
   ========================================================= */

app.get(
  '/api/referrals',

  authenticate,

  async (
    req,
    res,
    next
  ) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            telegram_id,
            first_name,
            username,
            photo_url,
            referral_qualified,
            created_at

          FROM users

          WHERE
            referred_by=$1

          ORDER BY
            created_at DESC

          LIMIT 100
          `,
          [
            req.auth.id
          ]
        );


      const success =
        result.rows.filter(
          row =>
            row.referral_qualified
        ).length;


      const claimed =
        (
          await pool.query(
            `
            SELECT
              milestone

            FROM referral_milestones

            WHERE
              telegram_id=$1
            `,
            [
              req.auth.id
            ]
          )
        ).rows.map(
          row =>
            row.milestone
        );


      const milestones =
        milestoneConfig()
          .map(
            item => ({
              ...item,

              claimed:
                claimed.includes(
                  item.count
                ),

              unlocked:
                success >=
                item.count
            })
          );


      const earned =
        safeNumber(
          (
            await pool.query(
              `
              SELECT
                COALESCE(
                  SUM(amount),
                  0
                ) AS s

              FROM transactions

              WHERE
                telegram_id=$1

                AND type IN(
                  'referral_reward',
                  'referral_milestone'
                )
              `,
              [
                req.auth.id
              ]
            )
          ).rows[0].s
        );


      res.json({
        success:
          true,

        link:
          referralLink(
            req.auth.id
          ),

        successful:
          success,

        pending:
          result.rows.length -
          success,

        totalEarned:
          earned,

        milestones,

        items:
          result.rows
      });

    } catch (
      error
    ) {
      next(
        error
      );
    }
  }
);


/* =========================================================
   REFERRAL MILESTONE CLAIM
   ========================================================= */

app.post(
  '/api/referrals/milestones/:count',

  authenticate,

  async (
    req,
    res,
    next
  ) => {
    try {
      const count =
        Number(
          req.params.count
        );


      const conf =
        milestoneConfig()
          .find(
            item =>
              item.count ===
              count
          );


      if (
        !conf
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              'Unknown milestone'
          });
      }


      const client =
        await pool.connect();


      try {
        await client.query(
          'BEGIN'
        );


        const success =
          (
            await client.query(
              `
              SELECT
                COUNT(*)::int AS c

              FROM users

              WHERE
                referred_by=$1

                AND referral_qualified=TRUE
              `,
              [
                req.auth.id
              ]
            )
          ).rows[0].c;


        if (
          success <
          count
        ) {
          await client.query(
            'ROLLBACK'
          );

          return res
            .status(409)
            .json({
              success:
                false,

              message:
                'Milestone not reached'
            });
        }


        const inserted =
          await client.query(
            `
            INSERT INTO referral_milestones(
              telegram_id,
              milestone,
              reward
            )
            VALUES(
              $1,$2,$3
            )

            ON CONFLICT
            DO NOTHING

            RETURNING milestone
            `,
            [
              req.auth.id,
              count,
              conf.reward
            ]
          );


        if (
          !inserted.rowCount
        ) {
          await client.query(
            'ROLLBACK'
          );

          return res
            .status(409)
            .json({
              success:
                false,

              message:
                'Already claimed'
            });
        }


        await client.query(
          `
          UPDATE users

          SET
            balance =
              balance + $2,

            updated_at =
              NOW()

          WHERE telegram_id=$1
          `,
          [
            req.auth.id,
            conf.reward
          ]
        );


        await client.query(
          `
          INSERT INTO transactions(
            telegram_id,
            type,
            amount,
            reference
          )
          VALUES(
            $1,
            'referral_milestone',
            $2,
            $3
          )
          `,
          [
            req.auth.id,
            conf.reward,
            String(count)
          ]
        );


        await client.query(
          'COMMIT'
        );


        res.json({
          success:
            true,

          reward:
            conf.reward,

          user:
            await buildUser(
              req.auth.id
            )
        });

      } catch (
        error
      ) {
        try {
          await client.query(
            'ROLLBACK'
          );
        } catch {}

        throw error;

      } finally {
        client.release();
      }

    } catch (
      error
    ) {
      next(
        error
      );
    }
  }
);


/* =========================================================
   EXCLUSIVE CAMPAIGNS
   ========================================================= */

app.get(
  '/api/campaigns/exclusive',

  authenticate,

  async (
    req,
    res,
    next
  ) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            id,
            type,
            title,
            target_url,
            description,
            target_count,
            completed_count,
            reward_per_user,
            verification_type,
            chat_id

          FROM campaigns

          WHERE
            status='approved'

            AND payment_status='paid'

            AND completed_count <
              target_count

          ORDER BY
            approved_at DESC,
            id DESC

          LIMIT 100
          `
        );


      res.json({
        success:
          true,

        items:
          result.rows
      });

    } catch (
      error
    ) {
      next(
        error
      );
    }
  }
);


/* =========================================================
   CAMPAIGN QUOTE
   ========================================================= */

app.post(
  '/api/campaigns/quote',

  authenticate,

  (
    req,
    res
  ) => {
    const target =
      Math.max(
        1,

        Math.min(
          100000,

          Number(
            req.body.targetCount ||
            1
          )
        )
      );


    res.json({
      success:
        true,

      targetCount:
        target,

      MAI:
        target *
        cfg.promoteMaiPerSlot,

      GRAM:
        target *
        cfg.promoteGramPerSlot
    });
  }
);


/* =========================================================
   CREATE CAMPAIGN
   ========================================================= */

app.post(
  '/api/campaigns',

  authenticate,

  rateLimit(
    10,
    60000
  ),

  async (
    req,
    res,
    next
  ) => {
    try {
      const {
        type,
        title,
        targetUrl,
        description = '',
        targetCount,
        paymentMethod,
        verificationType =
          'manual',
        chatId =
          null,
        rewardPerUser =
          0
      } = req.body;


      const allowedTypes = [
        'Channel',
        'Group',
        'Bot',
        'Website',
        'Link',
        'Gift'
      ];


      if (
        !allowedTypes.includes(
          type
        ) ||
        !title ||
        !/^https?:\/\//i.test(
          targetUrl || ''
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              'Invalid campaign details'
          });
      }


      const count =
        Math.max(
          1,

          Math.min(
            100000,

            Number(
              targetCount ||
              1
            )
          )
        );


      const method =
        paymentMethod ===
          'GRAM'
          ? 'GRAM'
          : 'MAI';


      const amount =
        count *
        (
          method === 'MAI'
            ? cfg.promoteMaiPerSlot
            : cfg.promoteGramPerSlot
        );


      const client =
        await pool.connect();


      try {
        await client.query(
          'BEGIN'
        );


        if (
          method ===
          'MAI'
        ) {
          const deducted =
            await client.query(
              `
              UPDATE users

              SET
                balance =
                  balance - $2,

                updated_at =
                  NOW()

              WHERE
                telegram_id=$1

                AND balance >= $2

              RETURNING balance
              `,
              [
                req.auth.id,
                amount
              ]
            );


          if (
            !deducted.rowCount
          ) {
            await client.query(
              'ROLLBACK'
            );

            return res
              .status(409)
              .json({
                success:
                  false,

                message:
                  'Not enough MAI balance'
              });
          }
        }


        const inserted =
          await client.query(
            `
            INSERT INTO campaigns(
              owner_id,
              type,
              title,
              target_url,
              description,
              target_count,
              reward_per_user,
              payment_method,
              payment_amount,
              payment_status,
              verification_type,
              chat_id
            )
            VALUES(
              $1,$2,$3,$4,$5,$6,
              $7,$8,$9,$10,$11,$12
            )

            RETURNING *
            `,
            [
              req.auth.id,

              type,

              title,

              targetUrl,

              String(
                description
              ).slice(
                0,
                500
              ),

              count,

              Math.max(
                0,
                Number(
                  rewardPerUser ||
                  0
                )
              ),

              method,

              amount,

              method === 'MAI'
                ? 'paid'
                : 'pending',

              verificationType,

              chatId
            ]
          );


        if (
          method ===
          'MAI'
        ) {
          await client.query(
            `
            INSERT INTO transactions(
              telegram_id,
              type,
              amount,
              reference
            )
            VALUES(
              $1,
              'promotion_payment',
              $2,
              $3
            )
            `,
            [
              req.auth.id,
              -amount,
              String(
                inserted.rows[0].id
              )
            ]
          );
        }


        await client.query(
          'COMMIT'
        );


        res.json({
          success:
            true,

          campaign:
            inserted.rows[0]
        });

      } catch (
        error
      ) {
        try {
          await client.query(
            'ROLLBACK'
          );
        } catch {}

        throw error;

      } finally {
        client.release();
      }

    } catch (
      error
    ) {
      next(
        error
      );
    }
  }
);


/* =========================================================
   COMPLETE CAMPAIGN
   ========================================================= */

app.post(
  '/api/campaigns/:id/complete',

  authenticate,

  async (
    req,
    res,
    next
  ) => {
    try {
      const client =
        await pool.connect();


      try {
        await client.query(
          'BEGIN'
        );


        const result =
          await client.query(
            `
            SELECT *

            FROM campaigns

            WHERE id=$1

            FOR UPDATE
            `,
            [
              req.params.id
            ]
          );


        const campaign =
          result.rows[0];


        if (
          !campaign ||
          campaign.status !==
            'approved' ||
          campaign.payment_status !==
            'paid' ||
          campaign.completed_count >=
            campaign.target_count
        ) {
          await client.query(
            'ROLLBACK'
          );

          return res
            .status(409)
            .json({
              success:
                false,

              message:
                'Campaign unavailable'
            });
        }


        if (
          String(
            campaign.owner_id
          ) ===
          String(
            req.auth.id
          )
        ) {
          await client.query(
            'ROLLBACK'
          );

          return res
            .status(409)
            .json({
              success:
                false,

              message:
                'Campaign owner cannot claim own campaign'
            });
        }


        if (
          campaign.verification_type ===
            'telegram_member' &&
          campaign.chat_id
        ) {
          const member =
            await telegram(
              'getChatMember',
              {
                chat_id:
                  campaign.chat_id,

                user_id:
                  req.auth.id
              }
            );


          const ok =
            [
              'creator',
              'administrator',
              'member'
            ].includes(
              member.status
            ) ||

            (
              member.status ===
                'restricted' &&
              member.is_member
            );


          if (
            !ok
          ) {
            await client.query(
              'ROLLBACK'
            );

            return res
              .status(409)
              .json({
                success:
                  false,

                message:
                  'Membership not verified'
              });
          }

        } else if (
          campaign.verification_type !==
          'manual'
        ) {
          await client.query(
            'ROLLBACK'
          );

          return res
            .status(409)
            .json({
              success:
                false,

              message:
                'This campaign requires provider verification'
            });
        }


        const inserted =
          await client.query(
            `
            INSERT INTO campaign_completions(
              campaign_id,
              telegram_id,
              rewarded
            )
            VALUES(
              $1,$2,$3
            )

            ON CONFLICT
            DO NOTHING

            RETURNING campaign_id
            `,
            [
              campaign.id,
              req.auth.id,
              campaign.reward_per_user
            ]
          );


        if (
          !inserted.rowCount
        ) {
          await client.query(
            'ROLLBACK'
          );

          return res
            .status(409)
            .json({
              success:
                false,

              message:
                'Already completed'
            });
        }


        await client.query(
          `
          UPDATE campaigns

          SET
            completed_count =
              completed_count + 1

          WHERE id=$1
          `,
          [
            campaign.id
          ]
        );


        if (
          safeNumber(
            campaign.reward_per_user
          ) > 0
        ) {
          await client.query(
            `
            UPDATE users

            SET
              balance =
                balance + $2,

              updated_at =
                NOW()

            WHERE telegram_id=$1
            `,
            [
              req.auth.id,
              campaign.reward_per_user
            ]
          );


          await client.query(
            `
            INSERT INTO transactions(
              telegram_id,
              type,
              amount,
              reference
            )
            VALUES(
              $1,
              'exclusive_reward',
              $2,
              $3
            )
            `,
            [
              req.auth.id,
              campaign.reward_per_user,
              String(
                campaign.id
              )
            ]
          );
        }


        await client.query(
          'COMMIT'
        );


        res.json({
          success:
            true,

          reward:
            safeNumber(
              campaign.reward_per_user
            ),

          user:
            await buildUser(
              req.auth.id
            )
        });

      } catch (
        error
      ) {
        try {
          await client.query(
            'ROLLBACK'
          );
        } catch {}

        throw error;

      } finally {
        client.release();
      }

    } catch (
      error
    ) {
      next(
        error
      );
    }
  }
);
/* =========================================================
   WALLET BIND
   ========================================================= */

app.post(
  '/api/wallet/bind',

  authenticate,

  rateLimit(
    10,
    60000
  ),

  async (
    req,
    res,
    next
  ) => {
    try {
      const address =
        String(
          req.body.address ||
          ''
        ).trim();


      if (
        address.length < 20 ||
        address.length > 150
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              'Invalid wallet address'
          });
      }


      const other =
        await pool.query(
          `
          SELECT
            telegram_id

          FROM users

          WHERE
            wallet_address=$1

            AND telegram_id<>$2
          `,
          [
            address,
            req.auth.id
          ]
        );


      if (
        other.rowCount
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            message:
              'This wallet is already connected to another account'
          });
      }


      await pool.query(
        `
        UPDATE users

        SET
          wallet_address=$2,

          wallet_connected_at=
            CASE

              WHEN
                wallet_address
                IS DISTINCT
                FROM $2

              THEN
                NOW()

              ELSE
                wallet_connected_at

            END,

          updated_at=
            NOW()

        WHERE telegram_id=$1
        `,
        [
          req.auth.id,
          address
        ]
      );


      await logSecurity(
        req,

        'wallet_bound',

        'info',

        {
          addressTail:
            address.slice(
              -6
            )
        }
      );


      res.json({
        success:
          true,

        user:
          await buildUser(
            req.auth.id
          )
      });

    } catch (
      error
    ) {
      next(
        error
      );
    }
  }
);


/* =========================================================
   WALLET DISCONNECT
   ========================================================= */

app.post(
  '/api/wallet/disconnect',

  authenticate,

  async (
    req,
    res,
    next
  ) => {
    try {
      await pool.query(
        `
        UPDATE users

        SET
          wallet_address=NULL,

          wallet_connected_at=NOW(),

          updated_at=NOW()

        WHERE telegram_id=$1
        `,
        [
          req.auth.id
        ]
      );


      await logSecurity(
        req,

        'wallet_disconnected',

        'warn'
      );


      res.json({
        success:
          true,

        user:
          await buildUser(
            req.auth.id
          )
      });

    } catch (
      error
    ) {
      next(
        error
      );
    }
  }
);


/* =========================================================
   WITHDRAWALS GET
   ========================================================= */

app.get(
  '/api/withdrawals',

  authenticate,

  async (
    req,
    res,
    next
  ) => {
    try {
      const result =
        await pool.query(
          `
          SELECT *
          FROM withdrawals
          WHERE telegram_id=$1
          ORDER BY created_at DESC
          LIMIT 100
          `,
          [
            req.auth.id
          ]
        );


      res.json({
        success:
          true,

        minWithdrawal:
          cfg.minWithdrawal,

        items:
          result.rows
      });

    } catch (
      error
    ) {
      next(
        error
      );
    }
  }
);


/* =========================================================
   CREATE WITHDRAWAL
   ========================================================= */

app.post(
  '/api/withdrawals',

  authenticate,

  rateLimit(
    8,
    60000
  ),

  async (
    req,
    res,
    next
  ) => {
    try {
      const amount =
        Number(
          req.body.amount
        );


      const key =
        String(
          req.get(
            'X-Idempotency-Key'
          ) || ''
        );


      if (
        !key ||
        key.length < 8
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              'Missing idempotency key'
          });
      }


      if (
        !Number.isFinite(
          amount
        ) ||
        amount <
          cfg.minWithdrawal ||
        amount >
          cfg.withdrawMax
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              `Withdrawal must be between ${cfg.minWithdrawal} and ${cfg.withdrawMax} MAI`
          });
      }


      const risk =
        await riskFor(
          req
        );


      if (
        risk.length
      ) {
        await logSecurity(
          req,

          'withdrawal_risk',

          'warn',

          {
            risk
          }
        );
      }


      if (
        cfg.devicePolicy ===
          'hard' &&
        cfg.blockWithdrawOnRisk &&
        risk.length
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              'Withdrawal requires security review',

            riskFlags:
              risk
          });
      }


      const client =
        await pool.connect();


      try {
        await client.query(
          'BEGIN'
        );


        const user =
          (
            await client.query(
              `
              SELECT *
              FROM users
              WHERE telegram_id=$1
              FOR UPDATE
              `,
              [
                req.auth.id
              ]
            )
          ).rows[0];


        if (
          !user.wallet_address
        ) {
          await client.query(
            'ROLLBACK'
          );

          return res
            .status(409)
            .json({
              success:
                false,

              message:
                'Connect a wallet first'
            });
        }


        if (
          user.wallet_connected_at &&
          (
            Date.now() -
            new Date(
              user.wallet_connected_at
            ).getTime()
          ) /
            1000 <
            cfg.walletLock
        ) {
          await client.query(
            'ROLLBACK'
          );

          return res
            .status(409)
            .json({
              success:
                false,

              message:
                'Wallet security lock is active after a wallet change'
            });
        }


        const last =
          (
            await client.query(
              `
              SELECT
                created_at

              FROM withdrawals

              WHERE telegram_id=$1

              ORDER BY created_at DESC

              LIMIT 1
              `,
              [
                req.auth.id
              ]
            )
          ).rows[0];


        if (
          last &&
          (
            Date.now() -
            new Date(
              last.created_at
            ).getTime()
          ) /
            1000 <
            cfg.withdrawCooldown
        ) {
          await client.query(
            'ROLLBACK'
          );

          return res
            .status(429)
            .json({
              success:
                false,

              message:
                'Please wait before another withdrawal'
            });
        }


        const today =
          (
            await client.query(
              `
              SELECT
                COUNT(*)::int AS c

              FROM withdrawals

              WHERE
                telegram_id=$1

                AND created_at::date=
                  CURRENT_DATE
              `,
              [
                req.auth.id
              ]
            )
          ).rows[0].c;


        if (
          today >=
          cfg.withdrawDailyCount
        ) {
          await client.query(
            'ROLLBACK'
          );

          return res
            .status(409)
            .json({
              success:
                false,

              message:
                'Daily withdrawal request limit reached'
            });
        }


        if (
          safeNumber(
            user.balance
          ) <
          amount
        ) {
          await client.query(
            'ROLLBACK'
          );

          return res
            .status(409)
            .json({
              success:
                false,

              message:
                'Insufficient in-game balance'
            });
        }


        const fee =
          computeFee(
            amount
          );


        const receive =
          Math.max(
            0,
            amount -
            fee
          );


        const id =
          crypto.randomUUID();


        const status =
          amount >=
            cfg.manualReview ||
          risk.length
            ? 'security_check'
            : 'pending';


        await client.query(
          `
          UPDATE users

          SET
            balance=
              balance-$2,

            locked_balance=
              locked_balance+$2,

            updated_at=
              NOW()

          WHERE telegram_id=$1
          `,
          [
            req.auth.id,
            amount
          ]
        );


        await client.query(
          `
          INSERT INTO withdrawals(
            id,
            telegram_id,
            amount,
            fee,
            receive_amount,
            wallet_address,
            status,
            idempotency_key,
            risk_flags
          )
          VALUES(
            $1,$2,$3,$4,$5,
            $6,$7,$8,$9
          )
          `,
          [
            id,
            req.auth.id,
            amount,
            fee,
            receive,
            user.wallet_address,
            status,
            key,
            JSON.stringify(
              risk
            )
          ]
        );


        await client.query(
          'COMMIT'
        );


        res.json({
          success:
            true,

          withdrawal: {
            id,
            amount,
            fee,

            receiveAmount:
              receive,

            status,

            walletAddress:
              user.wallet_address
          },

          user:
            await buildUser(
              req.auth.id
            )
        });

      } catch (
        error
      ) {
        try {
          await client.query(
            'ROLLBACK'
          );
        } catch {}


        if (
          error.code ===
          '23505'
        ) {
          const existing =
            await pool.query(
              `
              SELECT *
              FROM withdrawals
              WHERE
                telegram_id=$1
                AND idempotency_key=$2
              `,
              [
                req.auth.id,
                key
              ]
            );


          return res.json({
            success:
              true,

            replayed:
              true,

            withdrawal:
              existing.rows[0]
          });
        }


        throw error;

      } finally {
        client.release();
      }

    } catch (
      error
    ) {
      next(
        error
      );
    }
  }
);


/* =========================================================
   TRANSACTIONS
   ========================================================= */

app.get(
  '/api/transactions',

  authenticate,

  async (
    req,
    res,
    next
  ) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            id,
            type,
            amount,
            reference,
            metadata,
            created_at

          FROM transactions

          WHERE telegram_id=$1

          ORDER BY created_at DESC

          LIMIT 100
          `,
          [
            req.auth.id
          ]
        );


      res.json({
        success:
          true,

        items:
          result.rows
      });

    } catch (
      error
    ) {
      next(
        error
      );
    }
  }
);


/* =========================================================
   ADMIN WITHDRAWALS
   ========================================================= */

app.get(
  '/admin/withdrawals',

  admin,

  async (
    req,
    res,
    next
  ) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            w.*,
            u.first_name,
            u.username

          FROM withdrawals w

          JOIN users u
            ON u.telegram_id=
              w.telegram_id

          WHERE
            w.status IN(
              'pending',
              'security_check',
              'approved',
              'processing'
            )

          ORDER BY
            w.created_at
          `
        );


      res.json({
        success:
          true,

        items:
          result.rows
      });

    } catch (
      error
    ) {
      next(
        error
      );
    }
  }
);


/* =========================================================
   ADMIN APPROVE WITHDRAWAL
   ========================================================= */

app.post(
  '/admin/withdrawals/:id/approve',

  admin,

  async (
    req,
    res,
    next
  ) => {
    try {
      const result =
        await pool.query(
          `
          UPDATE withdrawals

          SET
            status='approved',

            updated_at=NOW()

          WHERE
            id=$1

            AND status IN(
              'pending',
              'security_check'
            )

          RETURNING *
          `,
          [
            req.params.id
          ]
        );


      res.json({
        success:
          !!result.rowCount,

        item:
          result.rows[0]
      });

    } catch (
      error
    ) {
      next(
        error
      );
    }
  }
);


/* =========================================================
   ADMIN REJECT WITHDRAWAL
   ========================================================= */

app.post(
  '/admin/withdrawals/:id/reject',

  admin,

  async (
    req,
    res,
    next
  ) => {
    const client =
      await pool.connect();

    try {
      await client.query(
        'BEGIN'
      );


      const result =
        await client.query(
          `
          SELECT *

          FROM withdrawals

          WHERE id=$1

          FOR UPDATE
          `,
          [
            req.params.id
          ]
        );


      const withdrawal =
        result.rows[0];


      if (
        !withdrawal ||
        [
          'completed',
          'rejected'
        ].includes(
          withdrawal.status
        )
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res
          .status(409)
          .json({
            success:
              false,

            message:
              'Cannot reject'
          });
      }


      await client.query(
        `
        UPDATE withdrawals

        SET
          status='rejected',

          updated_at=NOW()

        WHERE id=$1
        `,
        [
          withdrawal.id
        ]
      );


      await client.query(
        `
        UPDATE users

        SET
          balance=
            balance+$2,

          locked_balance=
            locked_balance-$2,

          updated_at=
            NOW()

        WHERE telegram_id=$1
        `,
        [
          withdrawal.telegram_id,
          withdrawal.amount
        ]
      );


      await client.query(
        'COMMIT'
      );


      res.json({
        success:
          true
      });

    } catch (
      error
    ) {
      try {
        await client.query(
          'ROLLBACK'
        );
      } catch {}

      next(
        error
      );

    } finally {
      client.release();
    }
  }
);


/* =========================================================
   ADMIN COMPLETE WITHDRAWAL
   ========================================================= */

app.post(
  '/admin/withdrawals/:id/complete',

  admin,

  async (
    req,
    res,
    next
  ) => {
    const txHash =
      String(
        req.body.txHash ||
        ''
      ).trim();


    if (
      !txHash
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            'txHash required'
        });
    }


    const client =
      await pool.connect();


    try {
      await client.query(
        'BEGIN'
      );


      const result =
        await client.query(
          `
          SELECT *

          FROM withdrawals

          WHERE id=$1

          FOR UPDATE
          `,
          [
            req.params.id
          ]
        );


      const withdrawal =
        result.rows[0];


      if (
        !withdrawal ||
        ![
          'approved',
          'processing'
        ].includes(
          withdrawal.status
        )
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res
          .status(409)
          .json({
            success:
              false,

            message:
              'Withdrawal is not approved'
          });
      }


      await client.query(
        `
        UPDATE withdrawals

        SET
          status='completed',

          tx_hash=$2,

          updated_at=NOW()

        WHERE id=$1
        `,
        [
          withdrawal.id,
          txHash
        ]
      );


      await client.query(
        `
        UPDATE users

        SET
          locked_balance=
            locked_balance-$2,

          updated_at=
            NOW()

        WHERE telegram_id=$1
        `,
        [
          withdrawal.telegram_id,
          withdrawal.amount
        ]
      );


      await client.query(
        `
        INSERT INTO transactions(
          telegram_id,
          type,
          amount,
          reference,
          metadata
        )
        VALUES(
          $1,
          'withdrawal',
          $2,
          $3,
          $4
        )
        `,
        [
          withdrawal.telegram_id,

          -safeNumber(
            withdrawal.amount
          ),

          withdrawal.id,

          {
            txHash
          }
        ]
      );


      await client.query(
        'COMMIT'
      );


      res.json({
        success:
          true
      });

    } catch (
      error
    ) {
      try {
        await client.query(
          'ROLLBACK'
        );
      } catch {}

      next(
        error
      );

    } finally {
      client.release();
    }
  }
);


/* =========================================================
   ADMIN CAMPAIGN APPROVE
   ========================================================= */

app.post(
  '/admin/campaigns/:id/approve',

  admin,

  async (
    req,
    res,
    next
  ) => {
    try {
      const result =
        await pool.query(
          `
          UPDATE campaigns

          SET
            status='approved',

            payment_status=
              CASE

                WHEN
                  payment_method='GRAM'

                THEN
                  COALESCE(
                    $2,
                    payment_status
                  )

                ELSE
                  payment_status

              END,

            approved_at=NOW()

          WHERE id=$1

          RETURNING *
          `,
          [
            req.params.id,
            req.body.paymentStatus ||
              null
          ]
        );


      res.json({
        success:
          !!result.rowCount,

        item:
          result.rows[0]
      });

    } catch (
      error
    ) {
      next(
        error
      );
    }
  }
);


/* =========================================================
   ADMIN SECURITY CONFIG
   ========================================================= */

app.get(
  '/admin/security/config',

  admin,

  (
    req,
    res
  ) => {
    res.json({
      success:
        true,

      config: {
        devicePolicy:
          cfg.devicePolicy,

        maxAccountsPerDevice:
          cfg.maxAccountsDevice,

        maxAccountsPerIpDay:
          cfg.maxAccountsIpDay,

        blockWithdrawOnRisk:
          cfg.blockWithdrawOnRisk
      }
    });
  }
);


/* =========================================================
   NOT FOUND
   ========================================================= */

app.use(
  (
    req,
    res,
    next
  ) => {
    if (
      res.headersSent
    ) {
      return next();
    }

    res
      .status(404)
      .json({
        success:
          false,

        message:
          'Route not found'
      });
  }
);


/* =========================================================
   ERROR HANDLER
   ========================================================= */

app.use(
  (
    err,
    req,
    res,
    next
  ) => {
    console.error(
      err
    );


    if (
      res.headersSent
    ) {
      return next(
        err
      );
    }


    res
      .status(500)
      .json({
        success:
          false,

        message:
          err.message ||
          'Server error'
      });
  }
);


/* =========================================================
   START SERVER
   ========================================================= */

initDb()

  .then(
    () => {
      app.listen(
        PORT,
        () => {
          console.log(
            `MAI Network API running on ${PORT}`
          );

          console.log(
            `MAI Jetton: ${MAI_JETTON_MASTER}`
          );

          console.log(
            'Level mode: in-game + TON wallet holding'
          );
        }
      );
    }
  )

  .catch(
    error => {
      console.error(
        'MAI Network startup failed:',
        error
      );

      process.exit(1);
    }
  );