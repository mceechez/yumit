import { useState } from 'react';
import { saveProfile, LIFE_STAGES, SUPERMARKETS, ADULT_NOTES_OPTIONS, ALLERGENS, DIETARY_PREFERENCES, INTOLERANCES } from '../services/profile';
import { Button } from '../components/ui/Button';

const TOTAL_STEPS = 4;

// ─── Step 1: Family basics ────────────────────────────────────────────────────
function StepBasics({ data, onChange }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Tell us about your household</h2>
        <p className="text-sm text-gray-500 mt-1">This personalises all the AI advice to your household.</p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Household name</label>
        <input
          type="text"
          placeholder="e.g. The Smiths"
          value={data.householdName}
          onChange={(e) => onChange({ householdName: e.target.value })}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-basket-green-500"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Primary supermarket</label>
        <select
          value={data.supermarket}
          onChange={(e) => onChange({ supermarket: e.target.value })}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-basket-green-500"
        >
          <option value="">Select your supermarket…</option>
          {SUPERMARKETS.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Weekly grocery budget</label>
        <div className="flex items-center gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-gray-400">Min</label>
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-basket-green-500">
              <span className="px-2 text-gray-400 text-sm">£</span>
              <input
                type="number"
                min="10"
                max="500"
                value={data.budgetMin}
                onChange={(e) => onChange({ budgetMin: parseInt(e.target.value) || 0 })}
                className="flex-1 py-2 pr-2 text-sm focus:outline-none"
              />
            </div>
          </div>
          <span className="text-gray-400 text-sm mt-4">to</span>
          <div className="flex-1 space-y-1">
            <label className="text-xs text-gray-400">Max</label>
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-basket-green-500">
              <span className="px-2 text-gray-400 text-sm">£</span>
              <input
                type="number"
                min="10"
                max="500"
                value={data.budgetMax}
                onChange={(e) => onChange({ budgetMax: parseInt(e.target.value) || 0 })}
                className="flex-1 py-2 pr-2 text-sm focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Member add/edit form ─────────────────────────────────────────────────────
function MemberForm({ initial, onSave, onCancel }) {
  const [name, setName]           = useState(initial?.name || '');
  const [lifeStage, setLifeStage] = useState(initial?.lifeStage || 'adult');
  const [notes, setNotes]         = useState(initial?.notes || []);

  const isAdult = lifeStage === 'adult' || lifeStage === 'senior';

  const toggleNote = (value) => {
    setNotes(prev =>
      prev.includes(value) ? prev.filter(n => n !== value) : [...prev, value]
    );
  };

  const handleSave = () => {
    onSave({
      name: name.trim(),
      lifeStage,
      notes: isAdult ? notes : [],
    });
  };

  return (
    <div className="bg-gray-200 rounded-xl p-4 space-y-4 border border-gray-300">
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Name <span className="text-gray-400 font-normal">(optional)</span></label>
        <input
          type="text"
          placeholder="e.g. Mum, Theo, Grandma…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-basket-green-500"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Life stage</label>
        <div className="grid grid-cols-5 gap-1.5">
          {Object.entries(LIFE_STAGES).map(([key, stage]) => (
            <button
              key={key}
              onClick={() => { setLifeStage(key); setNotes([]); }}
              className={`flex flex-col items-center p-2 rounded-xl border-2 transition-colors text-center ${
                lifeStage === key
                  ? 'border-basket-green-500 bg-basket-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-xl">{stage.emoji}</span>
              <span className="text-xs font-medium text-gray-700 mt-0.5 leading-tight">{stage.label}</span>
              <span className="text-xs text-gray-400 leading-tight">{stage.ageRange}</span>
            </button>
          ))}
        </div>
      </div>

      {isAdult && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Anything we should know? <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setNotes([])}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                notes.length === 0
                  ? 'bg-basket-green-600 text-white border-basket-green-600'
                  : 'border-gray-300 text-gray-600 hover:border-gray-400'
              }`}
            >
              None
            </button>
            {ADULT_NOTES_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => toggleNote(opt.value)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  notes.includes(opt.value)
                    ? 'bg-basket-green-600 text-white border-basket-green-600'
                    : 'border-gray-300 text-gray-600 hover:border-gray-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} className="flex-1">
          {initial ? 'Update' : 'Add'}
        </Button>
      </div>
    </div>
  );
}

// ─── Step 2: Family members ───────────────────────────────────────────────────
function StepMembers({ members, onAdd, onRemove }) {
  const [showForm, setShowForm] = useState(members.length === 0);

  const handleSave = (member) => {
    onAdd(member);
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Who&apos;s in your household?</h2>
        <p className="text-sm text-gray-500 mt-1">
          This helps us tailor nutrition advice and portion sizes to everyone&apos;s needs.
        </p>
      </div>

      {/* Member list */}
      {members.length > 0 && (
        <div className="space-y-2">
          {members.map((m, i) => {
            const stage = LIFE_STAGES[m.lifeStage];
            return (
              <div
                key={i}
                className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{stage?.emoji}</span>
                  <div>
                    <p className="font-medium text-gray-900">{m.name || stage?.label || 'Household member'}</p>
                    <p className="text-xs text-gray-500">
                      {stage?.label} ({stage?.ageRange})
                      {m.notes?.length ? ` · ${m.notes.join(', ')}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onRemove(i)}
                  className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add member form or button */}
      {showForm ? (
        <MemberForm
          onSave={handleSave}
          onCancel={() => members.length > 0 && setShowForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full border-2 border-dashed border-gray-300 rounded-xl py-4 text-sm text-gray-500 hover:border-basket-green-400 hover:text-basket-green-600 transition-colors"
        >
          + Add household member
        </button>
      )}

      {members.length === 0 && !showForm && (
        <p className="text-sm text-amber-600 text-center">Add at least one household member to continue.</p>
      )}
    </div>
  );
}

// ─── Step 3: Cooking habits ───────────────────────────────────────────────────
function StepCooking({ data, onChange }) {
  const cookOptions = [1, 2, 3, 4, 5];
  const dayOptions  = [
    { value: 1, label: '1 day' },
    { value: 2, label: '2 days' },
    { value: 3, label: '3 days' },
    { value: 4, label: '4 days' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">How do you cook?</h2>
        <p className="text-sm text-gray-500 mt-1">
          We&apos;ll use this to size up batch recipes and shopping quantities.
        </p>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-gray-700">
          How many times a week do you batch cook?
        </label>
        <div className="flex gap-2">
          {cookOptions.map(n => (
            <button
              key={n}
              onClick={() => onChange({ batchCooksPerWeek: n })}
              className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                data.batchCooksPerWeek === n
                  ? 'border-basket-green-500 bg-basket-green-50 text-basket-green-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-gray-700">
          How many days does each cook usually last?
        </label>
        <div className="grid grid-cols-2 gap-2">
          {dayOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => onChange({ daysPerBatch: opt.value })}
              className={`py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                data.daysPerBatch === opt.value
                  ? 'border-basket-green-500 bg-basket-green-50 text-basket-green-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ step }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            i < step ? 'bg-basket-green-500' : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

// ─── Step 4: Dietary requirements ─────────────────────────────────────────────
function StepDietary({ members, onUpdateMember }) {
  const [openMember, setOpenMember] = useState(0);

  const toggle = (memberIdx, field, value) => {
    const m = members[memberIdx];
    const current = m[field] || [];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    onUpdateMember(memberIdx, { [field]: updated });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Dietary requirements</h2>
        <p className="text-sm text-gray-500 mt-1">
          Select any allergens, dietary preferences, or intolerances for each person.
          All are optional — tap a person to expand.
        </p>
      </div>

      {members.map((m, i) => {
        const stage = LIFE_STAGES[m.lifeStage];
        const totalFlags = (m.allergens?.length || 0) + (m.dietaryPreferences?.length || 0) + (m.intolerances?.length || 0);
        const isOpen = openMember === i;
        return (
          <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpenMember(isOpen ? -1 : i)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-200 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{stage?.emoji}</span>
                <span className="font-medium text-gray-900">{m.name || stage?.label}</span>
                {totalFlags > 0 && (
                  <span className="text-xs bg-red-100 text-red-700 font-medium px-2 py-0.5 rounded-full">
                    {totalFlags} flag{totalFlags !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <span className="text-gray-400 text-sm">{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-4 border-t border-gray-200 bg-gray-200">
                {/* Allergens */}
                <div className="space-y-2 pt-3">
                  <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">
                    Allergens (NHS 14)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {ALLERGENS.map(a => {
                      const active = (m.allergens || []).includes(a.value);
                      return (
                        <button
                          key={a.value}
                          onClick={() => toggle(i, 'allergens', a.value)}
                          title={a.description}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                            active
                              ? 'bg-red-600 text-white border-red-600'
                              : 'border-gray-300 text-gray-600 hover:border-red-300 hover:bg-red-50'
                          }`}
                        >
                          <span>{a.icon}</span> {a.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dietary Preferences */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-basket-green-700 uppercase tracking-wide">
                    Dietary Preferences
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {DIETARY_PREFERENCES.map(d => {
                      const active = (m.dietaryPreferences || []).includes(d.value);
                      return (
                        <button
                          key={d.value}
                          onClick={() => toggle(i, 'dietaryPreferences', d.value)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                            active
                              ? 'bg-basket-green-600 text-white border-basket-green-600'
                              : 'border-gray-300 text-gray-600 hover:border-basket-green-300 hover:bg-basket-green-50'
                          }`}
                        >
                          <span>{d.icon}</span> {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Intolerances */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                    Intolerances
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {INTOLERANCES.map(t => {
                      const active = (m.intolerances || []).includes(t.value);
                      return (
                        <button
                          key={t.value}
                          onClick={() => toggle(i, 'intolerances', t.value)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                            active
                              ? 'bg-amber-500 text-white border-amber-500'
                              : 'border-gray-300 text-gray-600 hover:border-amber-300 hover:bg-amber-50'
                          }`}
                        >
                          <span>{t.icon}</span> {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <p className="text-xs text-gray-400 text-center">
        You can update these at any time in Settings.
      </p>
    </div>
  );
}

// ─── Main onboarding wizard ───────────────────────────────────────────────────
export function OnboardingPage({ onComplete }) {
  const [step, setStep] = useState(1);

  const [basics, setBasics] = useState({
    householdName: '',
    supermarket: '',
    budgetMin: 100,
    budgetMax: 100,
  });

  // Start with 1 adult (reasonable assumption), no name
  const [members, setMembers] = useState([
    { name: '', lifeStage: 'adult', notes: [], allergens: [], dietaryPreferences: [], intolerances: [] },
  ]);

  const [cooking, setCooking] = useState({
    batchCooksPerWeek: null,
    daysPerBatch: null,
  });

  const canAdvanceStep1 = basics.householdName.trim().length > 0 && basics.supermarket !== '';
  const canAdvanceStep2 = members.length > 0;
  const canAdvanceStep3 = cooking.batchCooksPerWeek !== null && cooking.daysPerBatch !== null;

  const handleNext = () => {
    if (step < TOTAL_STEPS) setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(s => s - 1);
  };

  const handleUpdateMember = (index, patch) => {
    setMembers(prev => prev.map((m, i) => i === index ? { ...m, ...patch } : m));
  };

  const handleFinish = () => {
    const profile = {
      householdName: basics.householdName.trim(),
      supermarket: basics.supermarket,
      budget: { min: basics.budgetMin, max: basics.budgetMax },
      members,
      batchCooksPerWeek: cooking.batchCooksPerWeek,
      daysPerBatch: cooking.daysPerBatch,
    };
    saveProfile(profile);
    onComplete();
  };

  const isNextDisabled =
    (step === 1 && !canAdvanceStep1) ||
    (step === 2 && !canAdvanceStep2) ||
    (step === 3 && !canAdvanceStep3);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5">

        {/* Header */}
        <div className="text-center">
          <span className="text-3xl">🧺</span>
          <p className="text-xs text-gray-500 mt-1">Step {step} of {TOTAL_STEPS}</p>
        </div>

        <ProgressBar step={step} />

        {/* Step content */}
        <div className="bg-gray-100 rounded-2xl border border-gray-200 p-6">
          {step === 1 && (
            <StepBasics data={basics} onChange={(patch) => setBasics(b => ({ ...b, ...patch }))} />
          )}
          {step === 2 && (
            <StepMembers
              members={members}
              onAdd={(m) => setMembers(prev => [...prev, { ...m, allergens: [], dietaryPreferences: [], intolerances: [] }])}
              onRemove={(i) => setMembers(prev => prev.filter((_, idx) => idx !== i))}
            />
          )}
          {step === 3 && (
            <StepCooking data={cooking} onChange={(patch) => setCooking(c => ({ ...c, ...patch }))} />
          )}
          {step === 4 && (
            <StepDietary members={members} onUpdateMember={handleUpdateMember} />
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {step > 1 && (
            <Button variant="outline" onClick={handleBack} className="flex-1">
              Back
            </Button>
          )}
          {step < TOTAL_STEPS ? (
            <Button onClick={handleNext} disabled={isNextDisabled} className="flex-1">
              Next
            </Button>
          ) : (
            <Button onClick={handleFinish} className="flex-1">
              Let&apos;s go!
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}

export default OnboardingPage;
