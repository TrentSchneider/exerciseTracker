import { Link } from 'react-router-dom';
import { useApp } from '../AppContext';
import { Icon, type IconName } from '../components/Icon';

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'toolbox',
    title: 'Made for your equipment',
    text: 'Add the gear you own and get workouts built around it.',
  },
  {
    icon: 'chart',
    title: 'Progress that makes sense',
    text: 'Track reps, weight, effort, and timed exercises, with recommendations informed by your workout history.',
  },
  {
    icon: 'heart',
    title: 'Train with recovery in mind',
    text: 'See muscle recovery at a glance and use it to shape your next workout.',
  },
];

const STEPS = [
  { title: 'Set up your gear', text: 'Tell the app what equipment you have.' },
  { title: 'Choose your workout', text: 'Build your own, plan a routine, or get a suggestion based on your goals and available time.' },
  { title: 'Log and improve', text: 'Record each set, review your history, and use your progress to guide what comes next.' },
];

export function LandingPage() {
  const app = useApp();

  return (
    <section className="landing stack">
      <header className="landing-hero">
        <p className="landing-eyebrow">A workout tracker that adapts to you</p>
        <h1>Your training, your equipment, your progress.</h1>
        <p className="landing-lede">
          Build workouts that fit your goals and gear. Track every set, see how your muscles recover,
          and get recommendations that adapt as you train—all from one simple tracker.
        </p>
        <div className="row wrap landing-actions">
          <Link className="button primary" to={app.active ? '/workout' : '/workouts'}>
            {app.active ? 'Resume workout' : 'Start a workout'}
          </Link>
          <Link className="button" to="/build">Build a custom workout</Link>
          <Link className="button landing-setup" to="/equipment">Set up your equipment</Link>
        </div>
      </header>

      <section className="landing-section" aria-labelledby="landing-benefits">
        <div className="landing-section-heading">
          <p className="landing-eyebrow">Built around your training</p>
          <h2 id="landing-benefits">A better fit for every workout</h2>
        </div>
        <div className="landing-features">
          {FEATURES.map((feature) => (
            <article className="card landing-feature" key={feature.title}>
              <span className="landing-icon" aria-hidden="true"><Icon name={feature.icon} size={28} /></span>
              <div className="landing-feature-copy">
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section" aria-labelledby="landing-how">
        <div className="landing-section-heading">
          <p className="landing-eyebrow">Simple to get started</p>
          <h2 id="landing-how">How it works</h2>
        </div>
        <ol className="landing-steps">
          {STEPS.map((step, index) => (
            <li className="card landing-step" key={step.title}>
              <span className="landing-step-number" aria-hidden="true">{index + 1}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <aside className="landing-privacy" aria-label="Privacy">
        <Icon name="lock" size={16} />
        <p>
          <strong>Your workouts stay on this device.</strong> Data is saved in your browser, and you
          can export a backup whenever you like. There’s no account or cloud sync, so keep a backup
          if you use multiple devices or clear browser data.
        </p>
        <Link to="/settings">Back up your data</Link>
      </aside>
    </section>
  );
}
