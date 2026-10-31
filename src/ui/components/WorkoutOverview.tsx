import { Icon } from './Icon';
import type { ReactNode } from 'react';
import { blockRest, blockTransition, blockWork, buildBlocks, setBlockRest, setBlockTransition, setBlockWork } from '../../domain/workout';
import type { Exercise, PlanItem } from '../../types';
import { SET_TYPE_LABELS } from './Fields';

function RestInput({ label, value, onChange }: { label: string; value: number; onChange?: (n: number) => void }) {
  return (
    <label className="rest-field">
      <span>{label}</span>
      <input
        type="number" inputMode="numeric" min={0} step={5} value={value} aria-label={label}
        readOnly={!onChange}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          onChange?.(Number.isNaN(v) ? 0 : Math.max(0, v));
        }}
      />
      <small>seconds</small>
    </label>
  );
}

/**
 * Full-workout overview. Superset/HIIT exercises sit in a bracket with ONE rest timer to its right
 * (rest belongs to the set/round, not to an exercise); the rest between exercises sits between cards.
 * When `onChangeItems` is omitted the rests are shown read-only.
 */
export function WorkoutOverview({ items, byId, renderItem, onChangeItems }: {
  items: PlanItem[];
  byId: Map<string, Exercise>;
  renderItem: (item: PlanItem, ex: Exercise | undefined) => ReactNode;
  onChangeItems?: (items: PlanItem[]) => void;
}) {
  const blocks = buildBlocks(items);
  return (
    <div className="overview">
      {blocks.map((block, bi) => {
        const grouped = block.length > 1 || block[0].setType === 'hiit';
        const names = block.map((i) => byId.get(i.exerciseId)?.name ?? i.exerciseId).join(' + ');
        const unit = grouped ? 'rounds' : 'sets';
        const rest = blockRest(block);
        return (
          <div key={bi}>
            <div className="block-row">
              <div className={`card ${grouped ? `block bracket ${block[0].setType}` : ''}`} data-testid={grouped ? 'bracket' : 'single'}>
                {grouped && <div className="badge">{SET_TYPE_LABELS[block[0].setType]} — {block[0].sets} rounds</div>}
                {block[0].setType === 'hiit' && (
                  <label className="work-field" data-testid="hiit-work">
                    <span>Work time for every exercise</span>
                    <input
                      type="number" inputMode="numeric" min={5} step={5} value={blockWork(block)}
                      aria-label={`HIIT work time (seconds): ${names}`} readOnly={!onChangeItems}
                      onChange={(e) => onChangeItems?.(setBlockWork(items, block, Math.max(5, parseFloat(e.target.value) || 5)))}
                    />
                    <span>seconds</span>
                  </label>
                )}
                <ul className="list">
                  {block.map((it) => <li key={it.id}>{renderItem(it, byId.get(it.exerciseId))}</li>)}
                </ul>
              </div>
              <div className="rest-col" data-testid="set-rest">
                <RestInput
                  label={`Rest between ${unit}: ${names}`}
                  value={rest}
                  onChange={onChangeItems && ((n) => onChangeItems(setBlockRest(items, block, n)))}
                />
                <p className="hint">{grouped ? 'After each round' : 'After each set'}</p>
              </div>
            </div>
            {bi < blocks.length - 1 && (
              <div className="transition" data-testid="exercise-rest">
                <Icon name="down" size={16} />
                <RestInput
                  label={`Rest before next exercise (after ${names})`}
                  value={blockTransition(block)}
                  onChange={onChangeItems && ((n) => onChangeItems(setBlockTransition(items, block, n)))}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
