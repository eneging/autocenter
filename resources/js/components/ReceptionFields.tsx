import { AlertTriangle, Check, Fuel, X } from 'lucide-react';
import React from 'react';
import type { ReceptionChecklist, ReceptionOptions } from '../lib/taller';

type Props = {
  options: ReceptionOptions;
  checklist: ReceptionChecklist;
  mileage: string;
  onMileageChange: (value: string) => void;
  fuelLevel: string;
  onFuelLevelChange: (value: string) => void;
  onToggleExterior: (item: string) => void;
  onToggleTool: (item: string) => void;
  onSetLevel: (item: string, value: string) => void;
  onToggleDamage: (zone: string) => void;
  onSetDamageNote: (zone: string, note: string) => void;
};

/**
 * Revisión de recepción del vehículo, pensada para usarse desde el celular en el taller:
 * botones grandes en vez de checkboxes chicos, para tocar con el dedo sin tener que apuntar con precisión.
 */
export function ReceptionFields({
  options,
  checklist,
  mileage,
  onMileageChange,
  fuelLevel,
  onFuelLevelChange,
  onToggleExterior,
  onToggleTool,
  onSetLevel,
  onToggleDamage,
  onSetDamageNote,
}: Props) {
  return (
    <>
      <div className="span-2 reception-top-row">
        <label>
          Kilometraje
          <input type="number" min={0} value={mileage} onChange={(event) => onMileageChange(event.target.value)} inputMode="numeric" placeholder="Ej. 45000" />
        </label>
        <div>
          <span className="reception-field-label">
            <Fuel size={14} /> Nivel de combustible
          </span>
          <div className="fuel-picker">
            {options.fuel_levels.map((level) => (
              <button key={level} type="button" className={`fuel-picker-option ${fuelLevel === level ? 'is-active' : ''}`} onClick={() => onFuelLevelChange(fuelLevel === level ? '' : level)}>
                {level}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ChecklistSection title="Exterior y accesorios" items={options.exterior_items} state={checklist.exterior} onToggle={onToggleExterior} />
      <ChecklistSection title="Herramientas y documentos" items={options.tool_items} state={checklist.tools} onToggle={onToggleTool} />

      <div className="span-2 reception-checklist-group">
        <p className="reception-checklist-title">Niveles y estado técnico</p>
        <div className="reception-levels-grid">
          {options.level_items.map((item) => (
            <div key={item} className="level-picker">
              <span className="reception-field-label">{item}</span>
              <div className="level-picker-options">
                {options.level_options.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`level-picker-option level-${value.toLowerCase()} ${checklist.levels[item] === value ? 'is-active' : ''}`}
                    onClick={() => onSetLevel(item, value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="span-2 reception-checklist-group">
        <p className="reception-checklist-title">Daños visibles</p>
        <div className="reception-damage-list">
          {options.damage_zones.map((zone) => {
            const damage = checklist.damages[zone] ?? { has_damage: false, note: '' };
            return (
              <div className={`damage-card ${damage.has_damage ? 'has-damage' : ''}`} key={zone}>
                <div className="damage-card-head">
                  <strong>{zone}</strong>
                  <div className="toggle-group toggle-group-compact">
                    <button type="button" className={`toggle-option ${!damage.has_damage ? 'is-active' : ''}`} onClick={() => damage.has_damage && onToggleDamage(zone)}>
                      <Check size={14} /> Sin daños
                    </button>
                    <button type="button" className={`toggle-option ${damage.has_damage ? 'is-active' : ''}`} onClick={() => !damage.has_damage && onToggleDamage(zone)}>
                      <AlertTriangle size={14} /> Con daños
                    </button>
                  </div>
                </div>
                {damage.has_damage && (
                  <input
                    className="damage-note-input"
                    placeholder="Describe el daño (rayón, abolladura...)"
                    value={damage.note}
                    onChange={(event) => onSetDamageNote(zone, event.target.value)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function ChecklistSection({ title, items, state, onToggle }: { title: string; items: string[]; state: Record<string, boolean>; onToggle: (item: string) => void }) {
  return (
    <div className="span-2 reception-checklist-group">
      <p className="reception-checklist-title">{title}</p>
      <div className="chip-toggle-grid">
        {items.map((item) => {
          const ok = state[item] ?? true;
          return (
            <button key={item} type="button" className={`chip-toggle ${ok ? 'is-ok' : 'is-bad'}`} onClick={() => onToggle(item)}>
              {ok ? <Check size={16} /> : <X size={16} />} {item}
            </button>
          );
        })}
      </div>
    </div>
  );
}
