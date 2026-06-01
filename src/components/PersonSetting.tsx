import React, { useState } from 'react';
import { Person } from '../types';
import { UserPlus, Trash2, CheckCircle2, Circle, Star, AlertCircle, RefreshCw } from 'lucide-react';

interface PersonSettingProps {
  people: Person[];
  onChange: (updatedPeople: Person[]) => void;
  onResetToDefault: () => void;
}

export default function PersonSetting({
  people,
  onChange,
  onResetToDefault,
}: PersonSettingProps) {
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const handleAddPerson = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;

    if (people.some((p) => p.name === trimmed)) {
      setError('此人員姓名已存在於名單中！');
      return;
    }

    const newPerson: Person = {
      id: String(Date.now()),
      name: trimmed,
      isActive: true,
      isRequired: false,
    };

    onChange([...people, newPerson]);
    setNewName('');
    setError('');
  };

  const handleToggleActive = (id: string) => {
    onChange(
      people.map((p) => (p.id === id ? { ...p, isActive: !p.isActive } : p))
    );
  };

  const handleToggleRequired = (id: string) => {
    onChange(
      people.map((p) => {
        if (p.id === id) {
          const nextRequired = !p.isRequired;
          // If a person is forced required, also make sure they are active
          return {
            ...p,
            isRequired: nextRequired,
            isActive: nextRequired ? true : p.isActive,
          };
        }
        return p;
      })
    );
  };

  const handleDeletePerson = (id: string) => {
    onChange(people.filter((p) => p.id !== id));
  };

  const handleSelectAll = (active: boolean) => {
    onChange(people.map((p) => ({ ...p, isActive: active })));
  };

  const activeCount = people.filter((p) => p.isActive).length;
  const requiredCount = people.filter((p) => p.isRequired && p.isActive).length;

  return (
    <div id="person-setting-card" className="geo-card">
      <div className="geo-card-header flex-wrap gap-4">
        <div>
          <h2 className="geo-card-title">
            人員名單設定區
          </h2>
          <p className="text-[10px] text-emerald-100 mt-1">
            設定可抽取成員。點選 <Star className="inline-block w-3 h-3 text-amber-500 fill-amber-500 animate-pulse" /> 設定「必包含人員」。
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            id="btn-select-all"
            onClick={() => handleSelectAll(true)}
            className="px-2.5 py-1 text-[10px] font-bold border border-white/20 bg-white/10 text-white hover:bg-white/20 rounded transition-all cursor-pointer"
          >
            全選候選
          </button>
          <button
            type="button"
            id="btn-deselect-all"
            onClick={() => handleSelectAll(false)}
            className="px-2.5 py-1 text-[10px] font-bold border border-white/20 bg-white/10 text-white hover:bg-white/20 rounded transition-all cursor-pointer"
          >
            取消全選
          </button>
          <button
            type="button"
            id="btn-reset-default-pool"
            onClick={onResetToDefault}
            className="geo-btn-primary px-2.5 py-1 text-[10px] flex items-center gap-1 cursor-pointer"
            title="重設成預設 16 人名單"
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin duration-1000" />
            重設
          </button>
        </div>
      </div>

      <div className="p-5">
        {/* Form to Add Person */}
        <form onSubmit={handleAddPerson} id="add-person-form" className="mb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                id="input-new-person-name"
                placeholder="新增人員姓名（如：王小明）"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setError('');
                }}
                className="geo-input"
              />
              {error && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-rose-50 text-rose-600 text-xs py-1 px-2 rounded border border-rose-100 flex items-center gap-1 z-10">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
            <button
              type="submit"
              id="btn-add-person-submit"
              className="geo-btn-primary flex items-center gap-1.5 shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              新增
            </button>
          </div>
        </form>


      {/* Stats Counter */}
      <div className="grid grid-cols-3 gap-2 py-2.5 px-3 bg-slate-50/70 rounded-lg text-xs font-medium text-slate-600 mb-4 border border-slate-100/50">
        <div>
          總人數：<span className="text-slate-900 font-semibold">{people.length} 人</span>
        </div>
        <div>
          已勾選候選：<span className="text-blue-600 font-semibold">{activeCount} 人</span>
        </div>
        <div>
          必包含人員：<span className="text-amber-600 font-semibold">{requiredCount} 人</span>
        </div>
      </div>

      {/* People Grid / List */}
      <div id="people-scroller" className="max-h-[290px] overflow-y-auto pr-1 border border-slate-100 rounded-lg bg-slate-50/30 p-2">
        {people.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">目前名單中無任何人員，請新增人員。</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2" id="grid-people-list">
            {people.map((person) => (
              <div
                key={person.id}
                className={`flex items-center justify-between p-2 rounded-lg border transition-all text-xs ${
                  person.isActive
                    ? 'bg-white border-blue-100 shadow-xs'
                    : 'bg-slate-50 border-slate-150 text-slate-400 opacity-65'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden shrink min-w-0">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(person.id)}
                    className="cursor-pointer text-slate-400 hover:text-blue-500 shrink-0 focus:outline-none"
                    aria-label="選擇候選狀態"
                  >
                    {person.isActive ? (
                      <CheckCircle2 className="w-4 h-4 text-blue-500 fill-blue-50" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-350" />
                    )}
                  </button>
                  <span
                    className={`font-medium truncate ${
                      person.isRequired && person.isActive ? 'text-amber-800' : 'text-slate-700'
                    }`}
                  >
                    {person.name}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleRequired(person.id)}
                    className={`p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer ${
                      person.isRequired
                        ? 'text-amber-500 hover:text-amber-650'
                        : 'text-slate-300 hover:text-amber-500'
                    }`}
                    title={person.isRequired ? '此人設定為：必包含' : '設為必包含人員'}
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        person.isRequired ? 'fill-amber-500 text-amber-500' : ''
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePerson(person.id)}
                    className="p-1 rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all cursor-pointer"
                    title="刪除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
