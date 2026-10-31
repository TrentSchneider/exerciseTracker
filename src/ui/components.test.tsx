import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timer } from './components/Timer';
import { LineChart } from './components/LineChart';
import { BodyDiagram } from './components/BodyDiagram';
import { ExerciseGuide } from './components/ExerciseGuide';
import { EXERCISE_PHOTO_IDS } from '../data/exerciseImages';
import { SEED_EXERCISES } from '../data/seed';
import { MUSCLES, type MuscleId } from '../types';

describe('Timer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('counts down from the recommended time and calls onDone', () => {
    const done = vi.fn();
    render(<Timer label="Rest" seconds={60} onDone={done} />);
    expect(screen.getByText('1:00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(screen.getByText('0:50')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(50_000); });
    expect(done).toHaveBeenCalledTimes(1);
    expect(screen.getByText('0:00')).toBeInTheDocument();
  });

  it('can be adjusted manually with +/- buttons and the number field', () => {
    render(<Timer label="Rest" seconds={60} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add 15 seconds' }));
    expect(screen.getByText('1:15')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Subtract 15 seconds' }));
    fireEvent.click(screen.getByRole('button', { name: 'Subtract 15 seconds' }));
    expect(screen.getByText('0:45')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Duration in seconds'), { target: { value: '90' } });
    expect(screen.getByText('1:30')).toBeInTheDocument();
  });

  it('pauses, resumes, resets and skips', () => {
    const skip = vi.fn();
    render(<Timer label="Plank" seconds={30} onSkip={skip} skipLabel="Skip rest" />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => { vi.advanceTimersByTime(5_000); });
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(screen.getByText('0:25')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByText('0:30')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Skip rest' }));
    expect(skip).toHaveBeenCalled();
  });

  it('auto-starts when requested', () => {
    render(<Timer label="Rest" seconds={20} autoStart />);
    act(() => { vi.advanceTimersByTime(3_000); });
    expect(screen.getByText('0:17')).toBeInTheDocument();
  });

  it('adjusting while running moves the end time', () => {
    render(<Timer label="Rest" seconds={30} autoStart />);
    act(() => { vi.advanceTimersByTime(5_000); });
    fireEvent.click(screen.getByRole('button', { name: 'Add 15 seconds' }));
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(screen.getByText('0:39')).toBeInTheDocument();
  });
});

describe('LineChart', () => {
  it('shows an empty state', () => {
    render(<LineChart points={[]} yLabel="Weight" />);
    expect(screen.getByText(/No data yet/)).toBeInTheDocument();
  });
  it('renders one marker per data point', () => {
    render(<LineChart points={[{ x: 1e12, y: 10 }, { x: 1e12 + 8.64e7, y: 12 }, { x: 1e12 + 1.7e8, y: 15 }]} yLabel="Weight" />);
    expect(screen.getByRole('img', { name: /Weight over time, 3 data points/ })).toBeInTheDocument();
    expect(document.querySelectorAll('circle')).toHaveLength(3);
  });
  it('handles a single point', () => {
    render(<LineChart points={[{ x: 1e12, y: 10 }]} yLabel="Weight" />);
    expect(document.querySelectorAll('circle')).toHaveLength(1);
  });
});

describe('BodyDiagram', () => {
  const fatigue = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<MuscleId, number>;

  it('shows front and back views covering every muscle', () => {
    render(<BodyDiagram fatigue={fatigue} selected={null} onSelect={() => {}} />);
    expect(screen.getByRole('group', { name: 'Front muscle diagram' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Back muscle diagram' })).toBeInTheDocument();
    for (const m of MUSCLES) expect(document.querySelector(`[data-muscle="${m}"]`)).not.toBeNull();
  });

  it('colours muscles from dark blue to red by fatigue', () => {
    render(<BodyDiagram fatigue={{ ...fatigue, chest: 100 }} selected={null} onSelect={() => {}} />);
    const chest = document.querySelector('[data-muscle="chest"]')!;
    const quads = document.querySelector('[data-muscle="quads"]')!;
    const rgb = (el: Element) => el.getAttribute('fill')!.match(/\d+/g)!.map(Number);
    expect(rgb(chest)[0]).toBeGreaterThan(rgb(chest)[2]);
    expect(rgb(quads)[2]).toBeGreaterThan(rgb(quads)[0]);
  });

  it('reports clicks and keyboard activation', async () => {
    const onSelect = vi.fn();
    render(<BodyDiagram fatigue={fatigue} selected={null} onSelect={onSelect} />);
    await userEvent.click(document.querySelector('[data-muscle="abs"]')!);
    expect(onSelect).toHaveBeenCalledWith('abs');
    fireEvent.keyDown(document.querySelector('[data-muscle="lats"]')!, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('lats');
  });
});

describe('ExerciseGuide visuals', () => {
  const ex = (id: string) => SEED_EXERCISES.find((e) => e.id === id)!;
  it('shows photos when available, and falls back to the drawn figure on error', () => {
    const { container } = render(<ExerciseGuide ex={ex('bench_press')} />);
    const imgs = container.querySelectorAll('img.photo');
    expect(imgs).toHaveLength(2);
    expect(imgs[0].getAttribute('src')).toContain('exercise-images/bench_press/0.jpg');
    fireEvent.error(imgs[0]);
    expect(container.querySelectorAll('img.photo')).toHaveLength(0);
    expect(container.querySelectorAll('svg.stick')).toHaveLength(2);
  });
  it('uses drawn figures for exercises without photos and labels primary/secondary muscles', () => {
    const { container } = render(<ExerciseGuide ex={{ ...ex('plank'), id: 'custom_x', custom: true }} />);
    expect(container.querySelectorAll('svg.stick')).toHaveLength(2);
    expect(screen.getByText(/Primary:/)).toBeInTheDocument();
  });
  it('highlights primary and secondary muscles with different colours', () => {
    const { container } = render(<ExerciseGuide ex={ex('bench_press')} />);
    const fills = new Set([...container.querySelectorAll('path[data-muscle]')].map((p) => p.getAttribute('fill')));
    expect(fills).toContain('var(--muscle-primary)');
    expect(fills).toContain('var(--muscle-secondary)');
  });
  it('every listed photo id is a real exercise with both image files', () => {
    const files = Object.keys(import.meta.glob('/public/exercise-images/*/*.jpg'));
    for (const id of EXERCISE_PHOTO_IDS) {
      expect(SEED_EXERCISES.some((e) => e.id === id)).toBe(true);
      expect(files).toContain(`/public/exercise-images/${id}/0.jpg`);
      expect(files).toContain(`/public/exercise-images/${id}/1.jpg`);
    }
  });
});
