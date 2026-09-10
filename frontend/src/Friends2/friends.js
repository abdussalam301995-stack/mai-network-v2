import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './friends.css';

const DEFAULT_BOT_USERNAME = 'maitoken_bot';

function getTelegramWebApp() {
  if (
    typeof window !== 'undefined' &&
    window.Telegram &&
    window.Telegram.WebApp
  ) {
    return window.Telegram.WebApp;
  }

  return null;
}

function getUserTelegramId(user) {
  return (
    user?.telegramId ??
    user?.telegram_id ??
    user?.telegramUserId ??
    user?.id ??
    ''
  );
}

function getUserName(user) {
  return (
    user?.firstName ||
    user?.first_name ||
    user?.username ||
    user?.name ||
    'MAI User'
  );
}

export default function Friends({
  user,
  initData = '',
  apiUrl = ''
}) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');

  const telegramId = getUserTelegramId(user);

  const botUsername =
    process.env.REACT_APP_BOT_USERNAME || DEFAULT_BOT_USERNAME;

  const cleanApiUrl = String(apiUrl || '').replace(/\/+$/, '');

  const inviteLink = useMemo(() => {
    if (!telegramId) {
      return `https://t.me/${botUsername}`;
    }

    return `https://t.me/${botUsername}?start=r_${telegramId}`;
  }, [botUsername, telegramId]);

  const loadFriends = useCallback(async () => {
    if (!user) {
      setFriends([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    /*
     * First use referral data already attached to the user.
     */
    if (Array.isArray(user.referrals)) {
      setFriends(user.referrals);
    } else if (Array.isArray(user.friends)) {
      setFriends(user.friends);
    }

    /*
     * Then try the backend referral endpoint.
     * If the endpoint is not available, the page will still work.
     */
    if (!cleanApiUrl || !initData) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${cleanApiUrl}/api/referrals`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': initData
          }
        }
      );

      if (response.ok) {
        const data = await response.json();

        if (Array.isArray(data?.friends)) {
          setFriends(data.friends);
        } else if (Array.isArray(data?.referrals)) {
          setFriends(data.referrals);
        }
      }
    } catch (err) {
      /*
       * Referral endpoint is optional.
       * Do not break the Friends page if it fails.
       */
    } finally {
      setLoading(false);
    }
  }, [user, initData, cleanApiUrl]);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  const referralCount = useMemo(() => {
    if (friends.length > 0) {
      return friends.length;
    }

    return Number(
      user?.referralCount ??
      user?.referralsCount ??
      user?.friendCount ??
      0
    );
  }, [friends, user]);

  const referralReward = useMemo(() => {
    return Number(
      user?.referralReward ??
      user?.referralRewards ??
      user?.referralEarnings ??
      0
    );
  }, [user]);

  const copyInviteLink = async () => {
    setError('');

    try {
      if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        await navigator.clipboard.writeText(inviteLink);
      } else {
        const textArea = document.createElement('textarea');

        textArea.value = inviteLink;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      setCopied(true);

      const webApp = getTelegramWebApp();

      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('success');
      }

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch (err) {
      setError('Unable to copy invite link.');
    }
  };

  const shareInvite = async () => {
    setError('');
    setSharing(true);

    const shareText =
      'Join MAI Network and start mining MAI with me 🚀';

    try {
      const webApp = getTelegramWebApp();

      /*
       * Telegram share
       */
      if (webApp?.openTelegramLink) {
        const shareUrl =
          'https://t.me/share/url' +
          `?url=${encodeURIComponent(inviteLink)}` +
          `&text=${encodeURIComponent(shareText)}`;

        webApp.openTelegramLink(shareUrl);
        return;
      }

      /*
       * Browser share
       */
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function'
      ) {
        await navigator.share({
          title: 'MAI Network',
          text: shareText,
          url: inviteLink
        });

        return;
      }

      /*
       * Final fallback: copy the link
       */
      await copyInviteLink();
    } catch (err) {
      /*
       * User cancelled the share dialog.
       * No error is necessary.
       */
    } finally {
      setSharing(false);
    }
  };

  const displayName = getUserName(user);

  return (
    <section className="friends-page">

      {/* =========================
          HEADER
      ========================== */}
      <div className="friends-heading">
        <span className="friends-eyebrow">
          GROW TOGETHER
        </span>

        <h2>
          Invite Friends
        </h2>

        <p>
          Invite friends to MAI Network and earn
          referral rewards together.
        </p>
      </div>


      {/* =========================
          HERO
      ========================== */}
      <div className="friends-hero glass-card">

        <div className="friends-hero-icon">
          <span>👥</span>
        </div>

        <div className="friends-hero-content">
          <span className="hero-small">
            YOUR REFERRAL NETWORK
          </span>

          <strong>
            Invite. Grow. Earn.
          </strong>

          <p>
            Share your personal invite link with friends.
          </p>
        </div>

      </div>


      {/* =========================
          STATS
      ========================== */}
      <div className="friends-stats">

        <div className="friend-stat glass-card">

          <div className="friend-stat-icon">
            👤
          </div>

          <div>
            <span>
              FRIENDS
            </span>

            <strong>
              {referralCount}
            </strong>
          </div>

        </div>


        <div className="friend-stat glass-card">

          <div className="friend-stat-icon">
            💰
          </div>

          <div>
            <span>
              REFERRAL REWARD
            </span>

            <strong>
              {referralReward.toFixed(4)}
            </strong>
          </div>

        </div>

      </div>


      {/* =========================
          INVITE CARD
      ========================== */}
      <div className="glass-card invite-card">

        <div className="invite-card-header">

          <div>
            <span className="card-eyebrow">
              PERSONAL INVITE LINK
            </span>

            <h3>
              Invite your friends
            </h3>
          </div>

          <div className="invite-badge">
            + REWARD
          </div>

        </div>


        <div className="invite-link-box">
          <span>
            {inviteLink}
          </span>
        </div>


        <div className="invite-buttons">

          <button
            type="button"
            className="gold-btn invite-copy-btn"
            onClick={copyInviteLink}
          >
            {copied
              ? '✓ COPIED'
              : 'COPY INVITE LINK'}
          </button>


          <button
            type="button"
            className="share-btn"
            onClick={shareInvite}
            disabled={sharing}
          >
            {sharing
              ? 'SHARING...'
              : '↗ SHARE'}
          </button>

        </div>


        <div className="invite-note">

          <span>
            🔐
          </span>

          <p>
            Referral rewards are verified and issued
            by the server when a genuinely new
            Telegram user joins.
          </p>

        </div>

      </div>


      {/* =========================
          FRIENDS LIST
      ========================== */}
      <div className="friends-list-card glass-card">

        <div className="friends-list-header">

          <div>
            <span className="card-eyebrow">
              YOUR NETWORK
            </span>

            <h3>
              Friends
            </h3>
          </div>

          <span className="friend-count">
            {referralCount}
          </span>

        </div>


        {loading ? (

          <div className="friends-loading">

            <div className="friends-spinner" />

            <span>
              Loading friends...
            </span>

          </div>

        ) : friends.length > 0 ? (

          <div className="friends-list">

            {friends.map((friend, index) => {

              const name =
                friend?.firstName ||
                friend?.first_name ||
                friend?.username ||
                friend?.name ||
                `Friend ${index + 1}`;

              const id =
                friend?.telegramId ??
                friend?.telegram_id ??
                friend?.id ??
                '';

              const reward = Number(
                friend?.reward ??
                friend?.referralReward ??
                0
              );

              return (
                <div
                  className="friend-row"
                  key={String(id || index)}
                >

                  <div className="friend-avatar">
                    {String(name)
                      .charAt(0)
                      .toUpperCase()}
                  </div>


                  <div className="friend-info">

                    <strong>
                      {name}
                    </strong>

                    {id ? (
                      <span>
                        Telegram ID · {id}
                      </span>
                    ) : null}

                  </div>


                  <div className="friend-reward">
                    {reward > 0
                      ? `+${reward.toFixed(4)}`
                      : 'ACTIVE'}
                  </div>

                </div>
              );
            })}

          </div>

        ) : (

          <div className="friends-empty">

            <div className="empty-icon">
              👥
            </div>

            <h4>
              No friends yet
            </h4>

            <p>
              Your invited friends will appear here
              after they join MAI Network.
            </p>

            <button
              type="button"
              className="gold-btn empty-invite-btn"
              onClick={shareInvite}
              disabled={sharing}
            >
              {sharing
                ? 'SHARING...'
                : 'INVITE YOUR FIRST FRIEND'}
            </button>

          </div>

        )}

      </div>


      {/* =========================
          HOW IT WORKS
      ========================== */}
      <div className="glass-card how-card">

        <div className="how-header">

          <span className="card-eyebrow">
            HOW IT WORKS
          </span>

          <h3>
            Build your network
          </h3>

        </div>


        <div className="how-steps">

          <div className="how-step">

            <div className="step-number">
              1
            </div>

            <div>
              <strong>
                Share your link
              </strong>

              <p>
                Send your personal invite link
                to friends.
              </p>
            </div>

          </div>


          <div className="how-step">

            <div className="step-number">
              2
            </div>

            <div>
              <strong>
                Friend joins
              </strong>

              <p>
                Your friend opens MAI Network
                through your link.
              </p>
            </div>

          </div>


          <div className="how-step">

            <div className="step-number">
              3
            </div>

            <div>
              <strong>
                Earn rewards
              </strong>

              <p>
                Eligible referral rewards are
                verified by the server.
              </p>
            </div>

          </div>

        </div>

      </div>


      {/* =========================
          ERROR
      ========================== */}
      {error ? (
        <button
          type="button"
          className="friends-error"
          onClick={() => setError('')}
        >
          {error} ×
        </button>
      ) : null}


      {/* =========================
          CURRENT USER
      ========================== */}
      <div className="friends-footer">

        <span>
          INVITING AS
        </span>

        <strong>
          {displayName}
        </strong>

        {telegramId ? (
          <small>
            #{telegramId}
          </small>
        ) : null}

      </div>

    </section>
  );
}