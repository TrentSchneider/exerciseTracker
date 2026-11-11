import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NumberField, WeightField } from './components/Fields';
import { Timer } from './components/Timer';

function BoundedField() {
  const [value, setValue] = useState(7);
  return (
    <>
      <NumberField label="Effort" value={value} min={1} max={10} onChange={setValue} />
      <output aria-label="Saved effort">{value}</output>
      <button onClick={() => setValue(4)}>Set externally</button>
    </>
  );
}

describe('numeric inputs', () => {
  it('allows clearing and out-of-range drafts while keeping saved values valid', async () => {
    const user = userEvent.setup();
    render(<BoundedField />);
    const input = screen.getByLabelText('Effort');
    const saved = screen.getByLabelText('Saved effort');

    await user.clear(input);
    expect(input).toHaveValue(null);
    expect(saved).toHaveTextContent('7');
    await user.type(input, '99');
    expect(input).toHaveValue(99);
    expect(saved).toHaveTextContent('9');
    await user.clear(input);
    await user.type(input, '10');
    expect(input).toHaveValue(10);
    expect(saved).toHaveTextContent('10');
    await user.tab();
    expect(input).toHaveValue(10);

    await user.clear(input);
    await user.type(input, '99');
    await user.tab();
    expect(input).toHaveValue(10);
    expect(saved).toHaveTextContent('10');

    await user.clear(input);
    await user.tab();
    expect(input).toHaveValue(10);
    await user.click(screen.getByRole('button', { name: 'Set externally' }));
    expect(input).toHaveValue(4);
  });

  it('allows typing a value whose first digit is below the minimum', async () => {
    const user = userEvent.setup();
    render(<Timer label="Rest" seconds={60} />);
    const input = screen.getByLabelText('Duration in seconds');
    await user.clear(input);
    expect(input).toHaveValue(null);
    await user.type(input, '1');
    expect(input).toHaveValue(1);
    expect(screen.getByText('1:00')).toBeInTheDocument();
    await user.type(input, '5');
    expect(input).toHaveValue(15);
    expect(screen.getByText('0:15')).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, '2');
    await user.tab();
    expect(input).toHaveValue(5);
    expect(screen.getByText('0:05')).toBeInTheDocument();
  });

  it('does not replace an in-progress draft with a delayed parent update', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<NumberField label="Reps" value={8} onChange={onChange} />);
    const input = screen.getByLabelText('Reps');
    await user.clear(input);
    await user.type(input, '12');
    rerender(<NumberField label="Reps" value={1} onChange={onChange} />);
    expect(input).toHaveValue(12);
    rerender(<NumberField label="Reps" value={12} onChange={onChange} />);
    expect(input).toHaveValue(12);
  });

  it('restores a cleared weight on blur and accepts decimal entry', async () => {
    const user = userEvent.setup();
    function WeightEditor() {
      const [kg, setKg] = useState(20);
      return <WeightField label="Weight" kg={kg} units="kg" onChange={setKg} />;
    }
    render(<WeightEditor />);
    const input = screen.getByLabelText('Weight (kg)');
    await user.clear(input);
    expect(input).toHaveValue(null);
    await user.tab();
    expect(input).toHaveValue(20);
    await user.clear(input);
    await user.type(input, '12.5');
    expect(input).toHaveValue(12.5);
  });
});
