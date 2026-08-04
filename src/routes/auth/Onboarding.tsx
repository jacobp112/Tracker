import { useState, type ChangeEvent } from 'react';
import { AVATARS } from '@/routes/auth/avatars';
import './auth.css';

export interface OnboardingProps {
  onFinish(v: { avatarIndex: number; displayName: string }): void;
  pending?: boolean;
}

/**
 * Avatar + display-name onboarding step (MOCKUP lines 163–195).
 * Selection ring style verbatim from MOCKUP lines 423–427.
 */
export function Onboarding(props: OnboardingProps) {
  const { onFinish, pending } = props;

  const [avatar, setAvatar] = useState(0);
  const [displayName, setDisplayName] = useState('');

  function handleNameChange(e: ChangeEvent<HTMLInputElement>) {
    setDisplayName(e.target.value);
  }

  function handleFinish() {
    onFinish({ avatarIndex: avatar, displayName: displayName.trim() || 'friend' });
  }

  return (
    <div>
      <h2 className="auth-form__headline">Make it yours</h2>
      <p className="auth-form__subhead">Pick an avatar and a name — you can always change these later.</p>

      <p className="auth-onboarding__label">Choose an avatar</p>
      <div className="auth-onboarding__avatars">
        {AVATARS.map((svg, i) => (
          <button
            key={i}
            type="button"
            disabled={pending}
            className={
              avatar === i
                ? 'auth-onboarding__avatar auth-onboarding__avatar--selected'
                : 'auth-onboarding__avatar'
            }
            onClick={() => setAvatar(i)}
          >
            {svg}
          </button>
        ))}
      </div>

      <div className="auth-field" style={{ marginBottom: 26 }}>
        <label htmlFor="onboarding-display-name">Display name</label>
        <input
          id="onboarding-display-name"
          type="text"
          placeholder="Ada Lovelace"
          value={displayName}
          disabled={pending}
          onChange={handleNameChange}
        />
      </div>

      <button type="button" className="auth-btn-cta" disabled={pending} onClick={handleFinish}>
        Finish setup
      </button>
    </div>
  );
}
