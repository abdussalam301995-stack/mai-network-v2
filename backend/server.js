require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();

app.set('trust proxy', 1);

const PORT = Number(process.env.PORT || 5000);

const BOT_TOKEN = process.env.BOT_TOKEN || '';

/*
 * BOT_USERNAME should be:
 * mai_accesstoken_bot
 *
 * This code automatically removes @ if someone accidentally
 * enters @mai_accesstoken_bot in Render Environment Variables.
 */
const BOT_USERNAME = String(
  process.env.BOT_USERNAME || 'maitoken_bot'
).replace(/^@+/, '').trim();

const WEBAPP_URL = (
  process.env.WEBAPP_URL ||
  process.env.CLIENT_ORIGIN ||
  'http://localhost:3000'
).replace(/\/$/, '');

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';

const API_NAME = 'MAI Network API';
const WELCOME_IMAGE_PATH = '/mai-welcome.jpg';

if (!BOT_TOKEN) {
  console.warn(
    'WARNING: BOT_TOKEN is missing. Telegram authentication and bot features will fail.'
  );
}

/* =========================================================
   CORS
========================================================= */

const allowedOrigins = CLIENT_ORIGIN
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    }
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('CORS blocked'));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'X-Telegram-Init-Data'
    ]
  })
);

app.use(express.json({ limit: '32kb' }));

/* =========================================================
   LIGHTWEIGHT RATE LIMITER
========================================================= */

const buckets = new Map();

function rateLimit({
  windowMs = 60_000,
  max = 60
} = {}) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();

    let bucket = buckets.get(key);

    if (!bucket || now - bucket.start >= windowMs) {
      bucket = {
        start: now,
        count: 0
      };

      buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > max) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.'
      });
    }

    next();
  };
}

app.use(
  rateLimit({
    windowMs: 60_000,
    max: 120
  })
);

/* =========================================================
   DATABASE
========================================================= */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl:
    process.env.DATABASE_SSL === 'false'
      ? false
      : {
          rejectUnauthorized: false
        },

  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000
});

/* =========================================================
   MAI CONFIGURATION
========================================================= */

const CONFIG = {
  initialBalance: Number(
    process.env.INITIAL_BALANCE || 10
  ),

  claimReward: Number(
    process.env.CLAIM_REWARD || 1.6667
  ),

  claimCooldownSeconds: Number(
    process.env.CLAIM_COOLDOWN_SECONDS ||
      8 * 3600
  ),

  adReward: Number(
    process.env.AD_REWARD || 2
  ),

  adDailyLimit: Number(
    process.env.AD_DAILY_LIMIT || 20
  ),

  adWatchSeconds: Number(
    process.env.AD_WATCH_SECONDS || 10
  ),

  referralReward: Number(
    process.env.REFERRAL_REWARD || 5
  ),

  maxMiningOfflineSeconds: Number(
    process.env.MAX_MINING_OFFLINE_SECONDS ||
      24 * 3600
  ),

  taskReward: Number(
    process.env.TASK_REWARD || 2
  )
};

/* =========================================================
   TASKS
========================================================= */

const TASKS = {
  news: {
    key: 'news',
    title: 'Join MAI News',
    reward: CONFIG.taskReward,
    chatId:
      process.env.NEWS_CHAT_ID ||
      '@MAI_News_Official',
    link:
      'https://t.me/MAI_News_Official'
  },

  payout: {
    key: 'payout',
    title: 'Join MAI Pay Out',
    reward: CONFIG.taskReward,
    chatId:
      process.env.PAYOUT_CHAT_ID ||
      '@MAI_Payout_Proof',
    link:
      'https://t.me/MAI_Payout_Proof'
  },

  chat: {
    key: 'chat',
    title: 'Join MAI Chat Group',
    reward: CONFIG.taskReward,
    chatId:
      process.env.COMMUNITY_CHAT_ID ||
      '@MAICommunityChat',
    link:
      'https://t.me/MAICommunityChat'
  }
};

/* =========================================================
   DATABASE INITIALIZATION
========================================================= */

async function initDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is required. Use a PostgreSQL database.'
    );
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id BIGINT PRIMARY KEY,
      username TEXT NOT NULL DEFAULT 'User',
      first_name TEXT NOT NULL DEFAULT 'User',
      balance NUMERIC(30, 8) NOT NULL DEFAULT 0,
      last_mining_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_claim_at TIMESTAMPTZ,
      wallet_address TEXT,
      referred_by BIGINT REFERENCES users(telegram_id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id BIGSERIAL PRIMARY KEY,
      telegram_id BIGINT NOT NULL
        REFERENCES users(telegram_id)
        ON DELETE CASCADE,
      type TEXT NOT NULL,
      amount NUMERIC(30, 8) NOT NULL,
      reference TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_user_time
      ON transactions(telegram_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS task_completions (
      id BIGSERIAL PRIMARY KEY,
      telegram_id BIGINT NOT NULL
        REFERENCES users(telegram_id)
        ON DELETE CASCADE,
      task_key TEXT NOT NULL,
      reward NUMERIC(30, 8) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(telegram_id, task_key)
    );

    CREATE TABLE IF NOT EXISTS ad_sessions (
      id UUID PRIMARY KEY,
      telegram_id BIGINT NOT NULL
        REFERENCES users(telegram_id)
        ON DELETE CASCADE,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      opened_at TIMESTAMPTZ,
      claimed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_ad_sessions_user_time
      ON ad_sessions(telegram_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS campaigns (
      id BIGSERIAL PRIMARY KEY,
      telegram_id BIGINT NOT NULL
        REFERENCES users(telegram_id)
        ON DELETE CASCADE,
      category TEXT NOT NULL
        CHECK (category IN ('Channel', 'Bot')),
      target_url TEXT NOT NULL,
      completions INTEGER NOT NULL,
      payment_method TEXT NOT NULL
        CHECK (payment_method IN ('MAI', 'GRAM')),
      payment_amount NUMERIC(30, 8) NOT NULL,
      burned_amount NUMERIC(30, 8) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS security_logs (
      id BIGSERIAL PRIMARY KEY,
      telegram_id BIGINT,
      action TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

/* =========================================================
   TELEGRAM INIT DATA VERIFICATION
========================================================= */

function parseInitData(initData) {
  if (
    !initData ||
    typeof initData !== 'string' ||
    initData.length > 4096
  ) {
    throw new Error('Invalid Telegram initData');
  }

  const params = new URLSearchParams(initData);

  const hash = params.get('hash');

  const authDate = Number(
    params.get('auth_date')
  );

  if (
    !hash ||
    !/^[a-f0-9]{64}$/i.test(hash)
  ) {
    throw new Error('Missing Telegram hash');
  }

  if (!Number.isFinite(authDate)) {
    throw new Error('Invalid auth_date');
  }

  const age =
    Math.floor(Date.now() / 1000) -
    authDate;

  if (age < -60 || age > 86400) {
    throw new Error(
      'Telegram authorization expired'
    );
  }

  const pairs = [];

  for (const [key, value] of params.entries()) {
    if (key !== 'hash') {
      pairs.push(`${key}=${value}`);
    }
  }

  pairs.sort();

  const dataCheckString =
    pairs.join('\n');

  if (!BOT_TOKEN) {
    throw new Error(
      'BOT_TOKEN is not configured'
    );
  }

  const secretKey = crypto
    .createHmac(
      'sha256',
      'WebAppData'
    )
    .update(BOT_TOKEN)
    .digest();

  const calculatedHash = crypto
    .createHmac(
      'sha256',
      secretKey
    )
    .update(dataCheckString)
    .digest('hex');

  const a = Buffer.from(
    calculatedHash,
    'hex'
  );

  const b = Buffer.from(
    hash,
    'hex'
  );

  if (
    a.length !== b.length ||
    !crypto.timingSafeEqual(a, b)
  ) {
    throw new Error(
      'Telegram signature verification failed'
    );
  }

  const rawUser = params.get('user');

  if (!rawUser) {
    throw new Error(
      'Telegram user missing'
    );
  }

  let user;

  try {
    user = JSON.parse(rawUser);
  } catch {
    throw new Error(
      'Invalid Telegram user data'
    );
  }

  if (!user.id) {
    throw new Error(
      'Telegram user id missing'
    );
  }

  return {
    telegramId: String(user.id),
    username:
      user.username || 'User',
    firstName:
      user.first_name || 'User',
    startParam:
      params.get('start_param') || ''
  };
}

/* =========================================================
   USER / MINING
========================================================= */

function getLevel(balance) {
  const n = Number(balance);

  return Math.max(
    0,
    Math.min(
      500,
      Math.floor(n / 1000)
    )
  );
}

function getMiningSpeed(balance) {
  const level = getLevel(balance);

  return (
    5 +
    (level > 0
      ? 10 + (level - 1) * 2
      : 0)
  );
}

function buildReferralLink(telegramId) {
  return `https://t.me/${BOT_USERNAME}?start=r_${telegramId}`;
}

function publicUser(row) {
  const balance = Number(row.balance);

  const miningSpeed =
    getMiningSpeed(balance);

  return {
    telegramId:
      String(row.telegram_id),

    username:
      row.username,

    firstName:
      row.first_name,

    balance,

    level:
      getLevel(balance),

    miningSpeed,

    miningPerSecond:
      miningSpeed / 86400,

    lastMiningAt:
      row.last_mining_at,

    lastClaimAt:
      row.last_claim_at,

    walletAddress:
      row.wallet_address || null,

    referralLink:
      buildReferralLink(
        row.telegram_id
      )
  };
}

/* =========================================================
   SECURITY LOGGING
========================================================= */

async function logSecurity(
  telegramId,
  action,
  req,
  metadata = {}
) {
  try {
    await pool.query(
      `
      INSERT INTO security_logs(
        telegram_id,
        action,
        ip,
        user_agent,
        metadata
      )
      VALUES($1,$2,$3,$4,$5)
      `,
      [
        telegramId || null,
        action,
        req.ip || null,
        req.get('user-agent') || null,
        metadata
      ]
    );
  } catch (_) {
    // Security logging must never break the main request.
  }
}

/* =========================================================
   TELEGRAM API
========================================================= */

async function telegramApi(
  method,
  body
) {
  if (!BOT_TOKEN) {
    throw new Error(
      'BOT_TOKEN is not configured'
    );
  }

  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/json'
      },
      body: JSON.stringify(body)
    }
  );

  const data =
    await response.json();

  if (!data.ok) {
    throw new Error(
      data.description ||
        'Telegram API error'
    );
  }

  return data.result;
}

/* =========================================================
   TELEGRAM AUTH MIDDLEWARE
========================================================= */

async function authenticate(
  req,
  res,
  next
) {
  try {
    const initData =
      req.get(
        'X-Telegram-Init-Data'
      ) ||
      req.body?.initData;

    const auth =
      parseInitData(initData);

    req.telegram = auth;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message:
        error.message ||
        'Unauthorized'
    });
  }
}

/* =========================================================
   MINING ACCRUAL
========================================================= */

async function accrueMining(
  client,
  telegramId
) {
  const result =
    await client.query(
      `
      SELECT *
      FROM users
      WHERE telegram_id = $1
      FOR UPDATE
      `,
      [telegramId]
    );

  if (!result.rows.length) {
    throw new Error(
      'User not found'
    );
  }

  const user =
    result.rows[0];

  const balance =
    Number(user.balance);

  const now =
    Date.now();

  const last =
    new Date(
      user.last_mining_at
    ).getTime();

  let elapsed = Math.max(
    0,
    Math.floor(
      (now - last) / 1000
    )
  );

  elapsed = Math.min(
    elapsed,
    CONFIG.maxMiningOfflineSeconds
  );

  if (elapsed <= 0) {
    return user;
  }

  const speed =
    getMiningSpeed(balance);

  const reward =
    (speed / 86400) *
    elapsed;

  const updated =
    await client.query(
      `
      UPDATE users
      SET
        balance = balance + $2,
        last_mining_at = NOW(),
        updated_at = NOW()
      WHERE telegram_id = $1
      RETURNING *
      `,
      [
        telegramId,
        reward
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
      'mining',
      $2,
      $3,
      $4
    )
    `,
    [
      telegramId,
      reward,
      `mine_${Date.now()}`,
      JSON.stringify({
        elapsed,
        speed
      })
    ]
  );

  return updated.rows[0];
}

/* =========================================================
   HEALTH
========================================================= */

app.get(
  '/health',
  async (req, res) => {
    try {
      await pool.query(
        'SELECT 1'
      );

      res.json({
        success: true,
        name: API_NAME,
        database: 'ok',
        botUsername:
          BOT_USERNAME
      });
    } catch {
      res.status(503).json({
        success: false,
        database: 'error'
      });
    }
  }
);

/* =========================================================
   AUTH
========================================================= */

app.post(
  '/api/auth',
  rateLimit({
    windowMs: 60_000,
    max: 20
  }),
  async (req, res) => {
    let client;

    try {
      const auth =
        parseInitData(
          req.body?.initData
        );

      client =
        await pool.connect();

      await client.query(
        'BEGIN'
      );

      const existing =
        await client.query(
          `
          SELECT *
          FROM users
          WHERE telegram_id = $1
          FOR UPDATE
          `,
          [auth.telegramId]
        );

      if (!existing.rows.length) {
        let referrer = null;

        if (
          auth.startParam.startsWith(
            'r_'
          )
        ) {
          const candidate =
            auth.startParam.slice(
              2
            );

          if (
            /^\d+$/.test(
              candidate
            ) &&
            candidate !==
              auth.telegramId
          ) {
            const r =
              await client.query(
                `
                SELECT telegram_id
                FROM users
                WHERE telegram_id = $1
                `,
                [candidate]
              );

            if (r.rows.length) {
              referrer =
                candidate;
            }
          }
        }

        const inserted =
          await client.query(
            `
            INSERT INTO users(
              telegram_id,
              username,
              first_name,
              balance,
              last_mining_at,
              referred_by
            )
            VALUES(
              $1,
              $2,
              $3,
              $4,
              NOW(),
              $5
            )
            RETURNING *
            `,
            [
              auth.telegramId,
              auth.username,
              auth.firstName,
              CONFIG.initialBalance,
              referrer
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
            'welcome',
            $2,
            $3,
            $4
          )
          `,
          [
            auth.telegramId,
            CONFIG.initialBalance,
            `welcome_${auth.telegramId}`,
            JSON.stringify({
              source:
                'registration'
            })
          ]
        );

        if (referrer) {
          await client.query(
            `
            UPDATE users
            SET
              balance =
                balance + $2,
              updated_at =
                NOW()
            WHERE telegram_id = $1
            `,
            [
              referrer,
              CONFIG.referralReward
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
              'referral',
              $2,
              $3,
              $4
            )
            `,
            [
              referrer,
              CONFIG.referralReward,
              `ref_${auth.telegramId}`,
              JSON.stringify({
                referredUser:
                  auth.telegramId
              })
            ]
          );
        }

        await client.query(
          'COMMIT'
        );

        return res.json({
          success: true,
          user:
            publicUser(
              inserted.rows[0]
            ),
          newUser: true
        });
      }

      const updated =
        await client.query(
          `
          UPDATE users
          SET
            username = $2,
            first_name = $3,
            updated_at = NOW()
          WHERE telegram_id = $1
          RETURNING *
          `,
          [
            auth.telegramId,
            auth.username,
            auth.firstName
          ]
        );

      await client.query(
        'COMMIT'
      );

      return res.json({
        success: true,
        user:
          publicUser(
            updated.rows[0]
          ),
        newUser: false
      });
    } catch (error) {
      if (client) {
        await client
          .query('ROLLBACK')
          .catch(() => {});
      }

      console.error(
        '/api/auth',
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          'Authentication failed'
      });
    } finally {
      client?.release();
    }
  }
);

/* =========================================================
   STATE
========================================================= */

app.get(
  '/api/state',
  authenticate,
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      await client.query(
        'BEGIN'
      );

      const user =
        await accrueMining(
          client,
          req.telegram.telegramId
        );

      await client.query(
        'COMMIT'
      );

      res.json({
        success: true,
        user:
          publicUser(user)
      });
    } catch (error) {
      await client
        .query('ROLLBACK')
        .catch(() => {});

      res.status(400).json({
        success: false,
        message:
          error.message
      });
    } finally {
      client.release();
    }
  }
);

/* =========================================================
   CLAIM
========================================================= */

app.post(
  '/api/claim',
  authenticate,
  rateLimit({
    windowMs: 60_000,
    max: 5
  }),
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      await client.query(
        'BEGIN'
      );

      const user =
        await accrueMining(
          client,
          req.telegram.telegramId
        );

      const now =
        Date.now();

      if (user.last_claim_at) {
        const elapsed =
          Math.floor(
            (
              now -
              new Date(
                user.last_claim_at
              ).getTime()
            ) / 1000
          );

        if (
          elapsed <
          CONFIG.claimCooldownSeconds
        ) {
          await client.query(
            'ROLLBACK'
          );

          return res.status(429).json({
            success: false,
            message:
              'Claim is on cooldown.',
            remaining:
              CONFIG.claimCooldownSeconds -
              elapsed
          });
        }
      }

      const updated =
        await client.query(
          `
          UPDATE users
          SET
            balance =
              balance + $2,
            last_claim_at =
              NOW(),
            updated_at =
              NOW()
          WHERE telegram_id = $1
          RETURNING *
          `,
          [
            req.telegram.telegramId,
            CONFIG.claimReward
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
          'claim',
          $2,
          $3
        )
        `,
        [
          req.telegram.telegramId,
          CONFIG.claimReward,
          `claim_${Date.now()}`
        ]
      );

      await client.query(
        'COMMIT'
      );

      await logSecurity(
        req.telegram.telegramId,
        'claim',
        req
      );

      res.json({
        success: true,
        user:
          publicUser(
            updated.rows[0]
          ),
        reward:
          CONFIG.claimReward
      });
    } catch (error) {
      await client
        .query('ROLLBACK')
        .catch(() => {});

      res.status(400).json({
        success: false,
        message:
          error.message
      });
    } finally {
      client.release();
    }
  }
);

/* =========================================================
   TASKS
========================================================= */

app.get(
  '/api/tasks',
  authenticate,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT task_key
          FROM task_completions
          WHERE telegram_id = $1
          `,
          [req.telegram.telegramId]
        );

      const completed =
        new Set(
          result.rows.map(
            (row) =>
              row.task_key
          )
        );

      res.json({
        success: true,
        tasks:
          Object.values(TASKS).map(
            (task) => ({
              key: task.key,
              title: task.title,
              reward: task.reward,
              link: task.link,
              completed:
                completed.has(
                  task.key
                )
            })
          )
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message
      });
    }
  }
);

app.post(
  '/api/tasks/:taskKey/verify',
  authenticate,
  rateLimit({
    windowMs: 60_000,
    max: 15
  }),
  async (req, res) => {
    const task =
      TASKS[
        req.params.taskKey
      ];

    if (!task) {
      return res.status(404).json({
        success: false,
        message:
          'Task not found'
      });
    }

    const client =
      await pool.connect();

    try {
      await client.query(
        'BEGIN'
      );

      const already =
        await client.query(
          `
          SELECT 1
          FROM task_completions
          WHERE
            telegram_id = $1
            AND task_key = $2
          `,
          [
            req.telegram.telegramId,
            task.key
          ]
        );

      if (already.rows.length) {
        await client.query(
          'ROLLBACK'
        );

        return res.json({
          success: true,
          completed: true,
          reward: 0,
          message:
            'Task already claimed.'
        });
      }

      let member;

      try {
        member =
          await telegramApi(
            'getChatMember',
            {
              chat_id:
                task.chatId,
              user_id:
                Number(
                  req.telegram.telegramId
                )
            }
          );
      } catch (error) {
        await client.query(
          'ROLLBACK'
        );

        await logSecurity(
          req.telegram.telegramId,
          'task_verification_error',
          req,
          {
            task: task.key,
            error:
              error.message
          }
        );

        return res.status(503).json({
          success: false,
          message:
            'Telegram verification is unavailable. Make sure the MAI bot is an admin/member of the target chat and try again.'
        });
      }

      const validStatuses = [
        'creator',
        'administrator',
        'member'
      ];

      if (
        !validStatuses.includes(
          member.status
        )
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.json({
          success: false,
          verified: false,
          message:
            'You have not joined this task yet.'
        });
      }

      const inserted =
        await client.query(
          `
          INSERT INTO task_completions(
            telegram_id,
            task_key,
            reward
          )
          VALUES($1,$2,$3)
          ON CONFLICT DO NOTHING
          RETURNING id
          `,
          [
            req.telegram.telegramId,
            task.key,
            task.reward
          ]
        );

      if (!inserted.rows.length) {
        await client.query(
          'ROLLBACK'
        );

        return res.json({
          success: true,
          completed: true,
          reward: 0,
          message:
            'Task already claimed.'
        });
      }

      await accrueMining(
        client,
        req.telegram.telegramId
      );

      const updated =
        await client.query(
          `
          UPDATE users
          SET
            balance =
              balance + $2,
            updated_at =
              NOW()
          WHERE telegram_id = $1
          RETURNING *
          `,
          [
            req.telegram.telegramId,
            task.reward
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
          'task',
          $2,
          $3,
          $4
        )
        `,
        [
          req.telegram.telegramId,
          task.reward,
          `task_${task.key}_${Date.now()}`,
          JSON.stringify({
            task: task.key
          })
        ]
      );

      await client.query(
        'COMMIT'
      );

      await logSecurity(
        req.telegram.telegramId,
        'task_completed',
        req,
        {
          task: task.key
        }
      );

      res.json({
        success: true,
        verified: true,
        reward:
          task.reward,
        user:
          publicUser(
            updated.rows[0]
          )
      });
    } catch (error) {
      await client
        .query('ROLLBACK')
        .catch(() => {});

      res.status(400).json({
        success: false,
        message:
          error.message
      });
    } finally {
      client.release();
    }
  }
);

/* =========================================================
   ADS
========================================================= */

app.post(
  '/api/ads/start',
  authenticate,
  rateLimit({
    windowMs: 60_000,
    max: 10
  }),
  async (req, res) => {
    try {
      const count =
        await pool.query(
          `
          SELECT COUNT(*)::int AS count
          FROM ad_sessions
          WHERE
            telegram_id = $1
            AND claimed_at IS NOT NULL
            AND created_at >= date_trunc(
              'day',
              NOW()
            )
          `,
          [
            req.telegram.telegramId
          ]
        );

      if (
        count.rows[0].count >=
        CONFIG.adDailyLimit
      ) {
        return res.status(429).json({
          success: false,
          message:
            'Daily ad limit reached.'
        });
      }

      const id =
        crypto.randomUUID();

      await pool.query(
        `
        INSERT INTO ad_sessions(
          id,
          telegram_id
        )
        VALUES($1,$2)
        `,
        [
          id,
          req.telegram.telegramId
        ]
      );

      res.json({
        success: true,
        sessionId: id,
        watchSeconds:
          CONFIG.adWatchSeconds,
        startedAt:
          new Date().toISOString()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message:
          error.message
      });
    }
  }
);

app.post(
  '/api/ads/open',
  authenticate,
  rateLimit({
    windowMs: 60_000,
    max: 20
  }),
  async (req, res) => {
    const {
      sessionId
    } = req.body || {};

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message:
          'sessionId is required'
      });
    }

    try {
      const result =
        await pool.query(
          `
          UPDATE ad_sessions
          SET
            opened_at =
              COALESCE(
                opened_at,
                NOW()
              )
          WHERE
            id = $1
            AND telegram_id = $2
            AND claimed_at IS NULL
          RETURNING id
          `,
          [
            sessionId,
            req.telegram.telegramId
          ]
        );

      if (!result.rows.length) {
        return res.status(404).json({
          success: false,
          message:
            'Ad session not found.'
        });
      }

      res.json({
        success: true
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message:
          error.message
      });
    }
  }
);

app.post(
  '/api/ads/claim',
  authenticate,
  rateLimit({
    windowMs: 60_000,
    max: 10
  }),
  async (req, res) => {
    const {
      sessionId
    } = req.body || {};

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message:
          'sessionId is required'
      });
    }

    const client =
      await pool.connect();

    try {
      await client.query(
        'BEGIN'
      );

      const sessionResult =
        await client.query(
          `
          SELECT *
          FROM ad_sessions
          WHERE
            id = $1
            AND telegram_id = $2
            AND claimed_at IS NULL
          FOR UPDATE
          `,
          [
            sessionId,
            req.telegram.telegramId
          ]
        );

      if (
        !sessionResult.rows.length
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(404).json({
          success: false,
          message:
            'Invalid or already claimed ad session.'
        });
      }

      const session =
        sessionResult.rows[0];

      if (!session.opened_at) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(400).json({
          success: false,
          message:
            'Open the sponsored link first.'
        });
      }

      const elapsed =
        Math.floor(
          (
            Date.now() -
            new Date(
              session.started_at
            ).getTime()
          ) / 1000
        );

      if (
        elapsed <
        CONFIG.adWatchSeconds
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(400).json({
          success: false,
          message:
            `Please wait ${
              CONFIG.adWatchSeconds -
              elapsed
            }s.`
        });
      }

      const count =
        await client.query(
          `
          SELECT COUNT(*)::int AS count
          FROM ad_sessions
          WHERE
            telegram_id = $1
            AND claimed_at IS NOT NULL
            AND created_at >= date_trunc(
              'day',
              NOW()
            )
          `,
          [
            req.telegram.telegramId
          ]
        );

      if (
        count.rows[0].count >=
        CONFIG.adDailyLimit
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(429).json({
          success: false,
          message:
            'Daily ad limit reached.'
        });
      }

      await accrueMining(
        client,
        req.telegram.telegramId
      );

      const updated =
        await client.query(
          `
          UPDATE users
          SET
            balance =
              balance + $2,
            updated_at =
              NOW()
          WHERE telegram_id = $1
          RETURNING *
          `,
          [
            req.telegram.telegramId,
            CONFIG.adReward
          ]
        );

      await client.query(
        `
        UPDATE ad_sessions
        SET claimed_at = NOW()
        WHERE id = $1
        `,
        [sessionId]
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
          'ad',
          $2,
          $3,
          $4
        )
        `,
        [
          req.telegram.telegramId,
          CONFIG.adReward,
          `ad_${sessionId}`,
          JSON.stringify({
            sessionId
          })
        ]
      );

      await client.query(
        'COMMIT'
      );

      res.json({
        success: true,
        reward:
          CONFIG.adReward,
        user:
          publicUser(
            updated.rows[0]
          )
      });
    } catch (error) {
      await client
        .query('ROLLBACK')
        .catch(() => {});

      res.status(400).json({
        success: false,
        message:
          error.message
      });
    } finally {
      client.release();
    }
  }
);

/* =========================================================
   WALLET
========================================================= */

app.post(
  '/api/wallet',
  authenticate,
  rateLimit({
    windowMs: 60_000,
    max: 10
  }),
  async (req, res) => {
    const address =
      String(
        req.body?.address || ''
      ).trim();

    if (
      address &&
      (
        address.length < 40 ||
        address.length > 100
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid TON wallet address format.'
      });
    }

    try {
      const result =
        await pool.query(
          `
          UPDATE users
          SET
            wallet_address = $2,
            updated_at = NOW()
          WHERE telegram_id = $1
          RETURNING *
          `,
          [
            req.telegram.telegramId,
            address || null
          ]
        );

      res.json({
        success: true,
        user:
          publicUser(
            result.rows[0]
          )
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message:
          error.message
      });
    }
  }
);

/* =========================================================
   TRANSACTIONS
========================================================= */

app.get(
  '/api/transactions',
  authenticate,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            type,
            amount,
            reference,
            created_at
          FROM transactions
          WHERE telegram_id = $1
          ORDER BY created_at DESC
          LIMIT 50
          `,
          [
            req.telegram.telegramId
          ]
        );

      res.json({
        success: true,
        transactions:
          result.rows.map(
            (row) => ({
              type: row.type,
              amount:
                Number(
                  row.amount
                ),
              reference:
                row.reference,
              createdAt:
                row.created_at
            })
          )
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message
      });
    }
  }
);

/* =========================================================
   REFERRAL NETWORK
========================================================= */

app.get(
  '/api/referrals',
  authenticate,
  async (req, res) => {
    try {
      const userId =
        req.telegram.telegramId;

      const friendsResult =
        await pool.query(
          `
          SELECT
            u.telegram_id,
            u.username,
            u.first_name,
            u.created_at,
            COALESCE(
              (
                SELECT SUM(t.amount)
                FROM transactions t
                WHERE
                  t.telegram_id = $1
                  AND t.type = 'referral'
                  AND t.metadata->>'referredUser'
                    = u.telegram_id::text
              ),
              0
            ) AS reward
          FROM users u
          WHERE u.referred_by = $1
          ORDER BY u.created_at DESC
          `,
          [userId]
        );

      const totalFriends =
        friendsResult.rows.length;

      const totalEarnings =
        friendsResult.rows.reduce(
          (
            total,
            friend
          ) =>
            total +
            Number(
              friend.reward || 0
            ),
          0
        );

      res.json({
        success: true,

        totalFriends,

        totalEarnings,

        rewardPerFriend:
          CONFIG.referralReward,

        inviteLink:
          buildReferralLink(
            userId
          ),

        friends:
          friendsResult.rows.map(
            (friend) => ({
              telegramId:
                String(
                  friend.telegram_id
                ),

              username:
                friend.username,

              firstName:
                friend.first_name,

              reward:
                Number(
                  friend.reward || 0
                ),

              createdAt:
                friend.created_at
            })
          )
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message
      });
    }
  }
);

/* =========================================================
   PARTNER CAMPAIGNS
========================================================= */

const PROMOTE_TIERS = [
  {
    completions: 100,
    mai: 5000,
    gram: 0.5
  },
  {
    completions: 500,
    mai: 25000,
    gram: 2.5
  },
  {
    completions: 1000,
    mai: 50000,
    gram: 5
  },
  {
    completions: 2000,
    mai: 100000,
    gram: 10
  },
  {
    completions: 5000,
    mai: 250000,
    gram: 25
  },
  {
    completions: 10000,
    mai: 500000,
    gram: 50
  }
];

app.post(
  '/api/campaigns',
  authenticate,
  rateLimit({
    windowMs: 60_000,
    max: 5
  }),
  async (req, res) => {
    const {
      category,
      targetUrl,
      completions,
      paymentMethod
    } = req.body || {};

    const tier =
      PROMOTE_TIERS.find(
        (item) =>
          item.completions ===
          Number(completions)
      );

    if (
      !tier ||
      ![
        'Channel',
        'Bot'
      ].includes(category) ||
      ![
        'MAI',
        'GRAM'
      ].includes(paymentMethod)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid campaign data.'
      });
    }

    try {
      const url =
        new URL(targetUrl);

      if (
        ![
          'https:',
          'http:'
        ].includes(
          url.protocol
        )
      ) {
        throw new Error(
          'Invalid URL'
        );
      }
    } catch {
      return res.status(400).json({
        success: false,
        message:
          'Enter a valid campaign URL.'
      });
    }

    if (
      paymentMethod !== 'MAI'
    ) {
      return res.status(400).json({
        success: false,
        message:
          'GRAM campaigns are not enabled yet.'
      });
    }

    const client =
      await pool.connect();

    try {
      await client.query(
        'BEGIN'
      );

      const user =
        await accrueMining(
          client,
          req.telegram.telegramId
        );

      const cost =
        tier.mai;

      if (
        Number(user.balance) <
        cost
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(400).json({
          success: false,
          message:
            'Insufficient MAI balance.'
        });
      }

      const burned =
        cost * 0.20;

      const inserted =
        await client.query(
          `
          INSERT INTO campaigns(
            telegram_id,
            category,
            target_url,
            completions,
            payment_method,
            payment_amount,
            burned_amount
          )
          VALUES(
            $1,
            $2,
            $3,
            $4,
            'MAI',
            $5,
            $6
          )
          RETURNING *
          `,
          [
            req.telegram.telegramId,
            category,
            targetUrl,
            tier.completions,
            cost,
            burned
          ]
        );

      const updated =
        await client.query(
          `
          UPDATE users
          SET
            balance =
              balance - $2,
            updated_at =
              NOW()
          WHERE telegram_id = $1
          RETURNING *
          `,
          [
            req.telegram.telegramId,
            cost
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
          'campaign_payment',
          $2,
          $3,
          $4
        )
        `,
        [
          req.telegram.telegramId,
          -cost,
          `campaign_${inserted.rows[0].id}`,
          JSON.stringify({
            burned,
            category,
            completions:
              tier.completions
          })
        ]
      );

      await client.query(
        'COMMIT'
      );

      res.json({
        success: true,
        message:
          'Campaign submitted for review.',
        campaign:
          inserted.rows[0],
        user:
          publicUser(
            updated.rows[0]
          )
      });
    } catch (error) {
      await client
        .query('ROLLBACK')
        .catch(() => {});

      res.status(400).json({
        success: false,
        message:
          error.message
      });
    } finally {
      client.release();
    }
  }
);

/* =========================================================
   TELEGRAM BOT
========================================================= */

let telegramOffset = 0;
let telegramPolling = false;

function buildWebAppUrl(
  startParam = ''
) {
  const base =
    WEBAPP_URL.replace(
      /\/$/,
      ''
    );

  if (!startParam) {
    return base;
  }

  return `${base}?startapp=${encodeURIComponent(
    startParam
  )}`;
}

/*
 * IMPORTANT:
 * The Welcome image is hosted by the Frontend.
 *
 * frontend/public/mai-welcome.jpg
 *
 * becomes:
 *
 * https://mai-network-v2-frontend.onrender.com/mai-welcome.jpg
 */
function buildWelcomeImageUrl() {
  return `${WEBAPP_URL}${WELCOME_IMAGE_PATH}`;
}

async function sendBotMessage(
  chatId,
  text,
  extra = {}
) {
  return telegramApi(
    'sendMessage',
    {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...extra
    }
  );
}

/*
 * Send the beautiful MAI welcome screen:
 *
 * IMAGE
 * CAPTION
 * OPEN MINI APP BUTTON
 */
async function sendWelcomeMessage(
  chatId,
  name,
  startParam = ''
) {
  const imageUrl =
    buildWelcomeImageUrl();

  const caption =
    `👋 <b>Welcome to MAI Network, ${name}!</b>\n\n` +
    `🚀 <b>Your secure MAI mining journey starts here.</b>\n\n` +
    `⛏️ Mine MAI every day\n` +
    `🎁 Claim your mining bonus\n` +
    `👥 Invite friends and earn rewards\n` +
    `💎 Connect your TON wallet\n\n` +
    `Tap the button below to enter MAI Network.`;

  try {
    return await telegramApi(
      'sendPhoto',
      {
        chat_id: chatId,

        photo: imageUrl,

        caption,

        parse_mode: 'HTML',

        reply_markup: {
          inline_keyboard: [
            [
              {
                text:
                  '🚀 Open MAI Network',
                web_app: {
                  url:
                    buildWebAppUrl(
                      startParam
                    )
                }
              }
            ]
          ]
        }
      }
    );
  } catch (error) {
    /*
     * If Telegram cannot download the image,
     * send a text fallback so /start still works.
     */
    console.error(
      'Welcome image error:',
      error.message
    );

    return sendBotMessage(
      chatId,
      caption,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text:
                  '🚀 Open MAI Network',
                web_app: {
                  url:
                    buildWebAppUrl(
                      startParam
                    )
                }
              }
            ]
          ]
        }
      }
    );
  }
}

async function handleBotUpdate(
  update
) {
  const message =
    update?.message;

  if (
    !message?.chat?.id ||
    typeof message.text !==
      'string'
  ) {
    return;
  }

  const chatId =
    message.chat.id;

  const text =
    message.text.trim();

  const match =
    text.match(
      /^\/start(?:@\w+)?(?:\s+(.+))?$/i
    );

  const param =
    match?.[1] || '';

  const safeParam =
    /^r_\d+$/.test(param)
      ? param
      : '';

  /* ================================================
     /START
  ================================================ */

  if (match) {
    const name =
      message.from?.first_name ||
      'there';

    await sendWelcomeMessage(
      chatId,
      name,
      safeParam
    );

    return;
  }

  /* ================================================
     /APP and /MINE
  ================================================ */

  if (
    /^\/(?:app|mine)(?:@\w+)?$/i.test(
      text
    )
  ) {
    await sendBotMessage(
      chatId,
      '🚀 <b>Open MAI Network</b>',
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text:
                  '🚀 Open MAI Network',
                web_app: {
                  url:
                    buildWebAppUrl()
                }
              }
            ]
          ]
        }
      }
    );

    return;
  }

  /* ================================================
     /HELP
  ================================================ */

  if (
    /^\/help(?:@\w+)?$/i.test(
      text
    )
  ) {
    await sendBotMessage(
      chatId,
      '<b>MAI Network</b>\n\n' +
        '/start — Open the MAI Network\n' +
        '/app — Open the Mini App\n' +
        '/mine — Open the Mini App\n' +
        '/help — Show this help'
    );
  }
}

/* =========================================================
   TELEGRAM LONG POLLING
========================================================= */

async function startTelegramBot() {
  if (!BOT_TOKEN) {
    console.warn(
      'Telegram bot not started because BOT_TOKEN is missing.'
    );

    return;
  }

  try {
    /*
     * Remove webhook because this bot uses long polling.
     */
    await telegramApi(
      'deleteWebhook',
      {
        drop_pending_updates: false
      }
    );

    const me =
      await telegramApi(
        'getMe'
      );

    console.log(
      `Telegram bot @${me.username || BOT_USERNAME} is running.`
    );

    telegramPolling = true;

    while (
      telegramPolling
    ) {
      try {
        const updates =
          await telegramApi(
            'getUpdates',
            {
              offset:
                telegramOffset,
              timeout: 25,
              allowed_updates: [
                'message'
              ]
            }
          );

        for (
          const update of
            updates || []
        ) {
          telegramOffset =
            update.update_id + 1;

          try {
            await handleBotUpdate(
              update
            );
          } catch (error) {
            console.error(
              'Telegram update error:',
              error.message
            );
          }
        }
      } catch (error) {
        console.error(
          'Telegram polling error:',
          error.message
        );

        /*
         * Prevent aggressive retry loops.
         */
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              3000
            )
        );
      }
    }
  } catch (error) {
    console.error(
      'Telegram bot failed to start:',
      error.message
    );
  }
}

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
  (
    err,
    req,
    res,
    next
  ) => {
    if (
      err?.message ===
      'CORS blocked'
    ) {
      return res.status(403).json({
        success: false,
        message:
          'Origin not allowed.'
      });
    }

    console.error(err);

    res.status(500).json({
      success: false,
      message:
        'Internal server error.'
    });
  }
);

/* =========================================================
   START SERVER
========================================================= */

initDb()
  .then(() => {
    app.listen(
      PORT,
      () => {
        console.log(
          `${API_NAME} listening on ${PORT}`
        );

        console.log(
          `Bot username: @${BOT_USERNAME}`
        );

        console.log(
          `Web App: ${WEBAPP_URL}`
        );

        console.log(
          `Welcome image: ${buildWelcomeImageUrl()}`
        );

        startTelegramBot();
      }
    );
  })
  .catch(
    (error) => {
      console.error(
        'Database initialization failed:',
        error
      );

      process.exit(1);
    }
  );