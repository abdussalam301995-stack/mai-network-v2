import React, {
  useEffect,
  useState
} from 'react';

import './HeroCoin.css';

const LOGO = '/mai-main-logo.png';

export default function HeroCoin({
  balance = 0,
  miningRate = 0.00005787,
  onMine,
  pulse = false
}) {
  const [burst, setBurst] =
    useState(false);

  /* =======================================================
     MINE ACTION
  ======================================================= */

  const handleMine = () => {
    if (burst) {
      return;
    }

    setBurst(true);

    if (
      typeof onMine === 'function'
    ) {
      onMine();
    }

    window.setTimeout(
      () => {
        setBurst(false);
      },
      700
    );
  };

  /* =======================================================
     EXTERNAL PULSE
  ======================================================= */

  useEffect(() => {
    if (!pulse) {
      return undefined;
    }

    setBurst(true);

    const timer =
      window.setTimeout(
        () => {
          setBurst(false);
        },
        500
      );

    return () =>
      window.clearTimeout(timer);

  }, [pulse]);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <section className="hero-coin">

      {/* =================================================
          ENERGY / LIGHT
      ================================================= */}

      <div className="hero-beam" />

      <div className="hero-energy energy-a" />
      <div className="hero-energy energy-b" />

      <div className="hero-aura aura-one" />
      <div className="hero-aura aura-two" />

      {/* =================================================
          ORBIT RINGS
      ================================================= */}

      <div className="hero-orbit orbit-one" />
      <div className="hero-orbit orbit-two" />
      <div className="hero-orbit orbit-three" />

      {/* =================================================
          PARTICLES
      ================================================= */}

      <div className="coin-particles">

        {Array.from({
          length: 20
        }).map(
          (_, index) => (
            <i
              key={index}
              style={{
                '--particle-index':
                  index
              }}
            />
          )
        )}

      </div>

      {/* =================================================
          MAIN COIN
      ================================================= */}

      <button
        type="button"
        aria-label="Mine MAI"
        className={
          `hero-coin-button ${
            burst ? 'burst' : ''
          }`
        }
        onClick={handleMine}
      >

        <span className="coin-depth" />

        <span className="coin-outer-ring" />

        <span className="coin-body">

          <img
            src={LOGO}
            alt="MAI"
          />

          <span className="coin-glass" />

        </span>

        <span className="coin-highlight" />

      </button>

      {/* =================================================
          BURST EFFECT
      ================================================= */}

      {burst && (
        <>

          <span
            className="coin-shock shock-one"
          />

          <span
            className="coin-shock shock-two"
          />

          <span
            className="coin-shock shock-three"
          />

          <div className="reward-pop">
            +MAI
          </div>

        </>
      )}

      {/* =================================================
          PLATFORM
      ================================================= */}

      <div className="coin-platform">

        <div
          className="platform-ring p-one"
        />

        <div
          className="platform-ring p-two"
        />

        <div
          className="platform-ring p-three"
        />

        <div className="platform-center">
          <span />
        </div>

      </div>

      {/* =================================================
          BALANCE
      ================================================= */}

      <div className="coin-balance">

        <span>
          MAI BALANCE
        </span>

        <strong>

          {Number(
            balance
          ).toFixed(4)}

          <small>
            MAI
          </small>

        </strong>

      </div>

      {/* =================================================
          MINING RATE
      ================================================= */}

      <div className="coin-rate">

        <span>
          ⚡
        </span>

        <div>

          <small>
            AUTO MINING
          </small>

          <strong>
            +
            {Number(
              miningRate
            ).toFixed(8)}
            {' '}MAI / SEC
          </strong>

        </div>

      </div>

    </section>
  );
}