import React, {
  useEffect,
  useState
} from 'react';

import './HeroCoin.css';

export default function HeroCoin({
  balance = 0,
  miningRate = 0.00005787,
  onMine,
  pulse = false
}) {

  const [burst, setBurst] =
    useState(false);

  const handleMine = () => {

    if (burst) return;

    setBurst(true);

    if (
      typeof onMine ===
      'function'
    ) {
      onMine();
    }

    setTimeout(() => {
      setBurst(false);
    }, 650);
  };

  useEffect(() => {
    if (!pulse) return;

    setBurst(true);

    const timer =
      setTimeout(() => {
        setBurst(false);
      }, 450);

    return () =>
      clearTimeout(timer);

  }, [pulse]);

  return (
    <section className="hero-coin">

      {/* LIGHT BEAM */}

      <div className="hero-beam" />

      {/* OUTER GLOW */}

      <div className="hero-aura aura-one" />
      <div className="hero-aura aura-two" />

      {/* ORBIT */}

      <div className="hero-orbit orbit-one" />
      <div className="hero-orbit orbit-two" />
      <div className="hero-orbit orbit-three" />

      {/* PARTICLES */}

      <div className="coin-particles">

        {Array.from(
          { length: 16 }
        ).map(
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

      {/* COIN */}

      <button
        type="button"
        aria-label="Mine MAI"
        className={
          `hero-coin-button ${
            burst
              ? 'burst'
              : ''
          }`
        }
        onClick={handleMine}
      >

        <span className="coin-outer-ring" />

        <span className="coin-body">

          <span className="coin-inner-glow" />

          <span className="coin-decoration top">
            ✦
          </span>

          <strong>
            MAI
          </strong>

          <span className="coin-decoration bottom">
            ✧
          </span>

        </span>

        <span className="coin-highlight" />

      </button>

      {/* SHOCKWAVES */}

      {burst && (
        <>
          <span className="coin-shock shock-one" />
          <span className="coin-shock shock-two" />
          <span className="coin-shock shock-three" />

          <div className="reward-pop">
            +MAI
          </div>
        </>
      )}

      {/* PLATFORM */}

      <div className="coin-platform">

        <div className="platform-ring p-one" />
        <div className="platform-ring p-two" />

        <div className="platform-center">
          <span />
        </div>

      </div>

      {/* BALANCE */}

      <div className="coin-balance">

        <span>
          MAI BALANCE
        </span>

        <strong>
          {Number(balance).toFixed(4)}
          <small>
            {' '}MAI
          </small>
        </strong>

      </div>

      {/* RATE */}

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

        <i />

      </div>

    </section>
  );
}