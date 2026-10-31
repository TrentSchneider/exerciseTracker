import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { Icon, type IconName } from './ui/components/Icon';
import { AppProvider, useApp } from './ui/AppContext';
import { ActiveWorkoutPage } from './ui/pages/ActiveWorkoutPage';
import { BuildPage } from './ui/pages/BuildPage';
import { EquipmentPage } from './ui/pages/EquipmentPage';
import { ExerciseDetailPage, ExercisesPage } from './ui/pages/ExercisesPage';
import { HistoryPage, SessionDetailPage } from './ui/pages/HistoryPage';
import { HomePage } from './ui/pages/HomePage';
import { LandingPage } from './ui/pages/LandingPage';
import { PlanPage } from './ui/pages/PlanPage';
import { PreviewPage } from './ui/pages/PreviewPage';
import { SettingsPage } from './ui/pages/SettingsPage';
import { SuggestPage } from './ui/pages/SuggestPage';
import { WorkoutsPage } from './ui/pages/WorkoutsPage';

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/recovery', label: 'Recovery', icon: 'heart', end: true },
  { to: '/workouts', label: 'Workouts', icon: 'dumbbell' },
  { to: '/plan', label: 'Planner', icon: 'calendar' },
  { to: '/history', label: 'History', icon: 'history' },
  { to: '/exercises', label: 'Exercises', icon: 'chart' },
  { to: '/equipment', label: 'Equipment', icon: 'toolbox' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

function Shell() {
  const app = useApp();
  if (!app.ready) return <p className="loading">Loading…</p>;
  return (
    <div className="shell">
      <nav className="nav" aria-label="Main">
        <div className="brand">Workout Tracker</div>
        {app.active && (
          <NavLink to="/workout" className="nav-link live"><Icon name="play" /><span>In progress</span></NavLink>
        )}
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="nav-link">
            <Icon name={n.icon} /><span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/recovery" element={<HomePage />} />
          <Route path="/workouts" element={<WorkoutsPage />} />
          <Route path="/suggest" element={<SuggestPage />} />
          <Route path="/build" element={<BuildPage />} />
          <Route path="/preview" element={<PreviewPage />} />
          <Route path="/workout" element={<ActiveWorkoutPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/history/:id" element={<SessionDetailPage />} />
          <Route path="/exercises" element={<ExercisesPage />} />
          <Route path="/exercises/:id" element={<ExerciseDetailPage />} />
          <Route path="/equipment" element={<EquipmentPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </main>
    </div>
  );
}

export function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </AppProvider>
  );
}
