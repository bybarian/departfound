import { useState } from 'react';
import { AttendeeDetail, Person } from '../types';
import { Users2, Shuffle, Plus, AlertCircle, Sparkles, Check, HelpCircle, Coffee, Laptop, Pencil } from 'lucide-react';

const getCategoryIcon = (category: string) => {
  switch (category) {
    case '會議餐點':
      return <Coffee className="w-3.5 h-3.5 text-[#008236] inline-block mr-1" />;
    case '電腦周邊':
      return <Laptop className="w-3.5 h-3.5 text-blue-600 inline-block mr-1" />;
    case '文具用品':
      return <Pencil className="w-3.5 h-3.5 text-indigo-600 inline-block mr-1" />;
    default:
      return <HelpCircle className="w-3.5 h-3.5 text-slate-500 inline-block mr-1" />;
  }
};

interface AttendeeTableProps {
  details: AttendeeDetail[];
  candidates: Person[];
  onRerollRow: (id: string, customCount?: number) => void;
  onUpdateRowAttendees: (id: string, attendees: string[]) => void;
  mealUnitCost: number;
  onMealUnitCostChange: (val: number) => void;
}

export default function AttendeeTable({
  details,
  candidates,
  onRerollRow,
  onUpdateRowAttendees,
  mealUnitCost,
  onMealUnitCostChange,
}: AttendeeTableProps) {
  // Store which row currently has the "Add Member" dropdown open
  const [activeDropdownRow, setActiveDropdownRow] = useState<string | null>(null);

  // Active candidates list
  const activeCandidates = candidates.filter((p) => p.isActive).map((p) => p.name);

  const handleRemovePerson = (rowId: string, currentAttendees: string[], personToRemove: string) => {
    const updated = currentAttendees.filter((name) => name !== personToRemove);
    onUpdateRowAttendees(rowId, updated);
  };

  const handleAddPerson = (rowId: string, currentAttendees: string[], personToAdd: string) => {
    if (currentAttendees.includes(personToAdd)) return;
    const updated = [...currentAttendees, personToAdd];
    onUpdateRowAttendees(rowId, updated);
    setActiveDropdownRow(null); // Close dropdown
  };

  const handleCountInputChange = (rowId: string, customCount: number) => {
    if (customCount <= 0) return;
    // When personnel count changes, we trigger a reroll of that row with the new designated count
    onRerollRow(rowId, customCount);
  };

  return (
    <div id="second-table-card" className="geo-card">
      {/* Header and Estimation Rule Configurations */}
      <div className="geo-card-header flex-wrap gap-4">
        <div className="flex items-center gap-2 pointer-events-none">
          <div className="p-1 bg-white/15 text-white rounded">
            <Users2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="geo-card-title">
              第二個表格：依金額自動產生參與人員明細表
            </h3>
          </div>
        </div>
      </div>

      {/* Estimation Settings Panel */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-600 flex items-center gap-1 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            餐點預算基底設定：
          </span>
          <div className="flex items-center gap-1.5 font-sans">
            <label className="text-xs text-slate-500">會議餐點每人約</label>
            <input
              type="number"
              value={mealUnitCost}
              onChange={(e) => onMealUnitCostChange(Math.max(10, parseInt(e.target.value, 10)) || 500)}
              className="geo-input w-20 py-1"
              min="50"
              step="50"
            />
            <span className="text-xs text-slate-500">元</span>
          </div>
        </div>
        <div className="text-[10px] text-slate-400 font-medium">
          人數公式：<code className="font-mono bg-white px-1 py-0.5 rounded text-amber-700 border border-slate-150">Math.round(金額 / 預估單價)</code>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="geo-table" id="attendees-table">
          <thead>
            <tr>
              <th className="py-3 px-4">日期</th>
              <th className="py-3 px-4 font-normal">類別</th>
              <th className="py-3 px-4 text-right">總金額</th>
              <th className="py-3 px-4 w-[45%]">參與人員</th>
              <th className="py-3 px-4 text-center">人數</th>
              <th className="py-3 px-4 text-right">每人平均金額 (元)</th>
              <th className="py-3 px-4 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
            {details.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                  <p className="text-xs font-semibold text-slate-500">此處將與第一個表格同步，並隨機分組抽選人員。</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    若第一個表格已有項目，請點點看「人員抽選」或手動新增消費。
                  </p>
                </td>
              </tr>
            ) : (
              details.map((row) => {
                const availableToAdd = activeCandidates.filter((name) => !row.attendees.includes(name));
                const averageValue = row.attendees.length > 0 ? Math.round(row.amount / row.attendees.length) : 0;

                return (
                  <tr key={row.id} className="hover:bg-slate-50/35 transition-colors">
                    {/* Date */}
                    <td className="py-4 px-4 font-mono text-slate-800 whitespace-nowrap">
                      {row.date}
                    </td>

                    {/* Category */}
                    <td className="py-4 px-4 whitespace-nowrap text-slate-600 font-medium font-sans">
                      <span className="inline-flex items-center">
                        {getCategoryIcon(row.category)}
                        <span>{row.category}</span>
                      </span>
                    </td>

                    {/* Total Amount */}
                    <td className="py-4 px-4 text-right font-mono font-bold text-slate-900">
                      ${row.amount.toLocaleString()}
                    </td>

                    {/* Attendee Badges List (Fully Editable) */}
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1.5 items-center relative">
                        {row.attendees.map((name) => (
                          <span
                            key={name}
                            className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10.5px] border border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-100 transition-all group shrink-0"
                          >
                            <span className="font-medium">{name}</span>
                            <button
                              type="button"
                              onClick={() => handleRemovePerson(row.id, row.attendees, name)}
                              className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-slate-400 group-hover:text-rose-500 font-bold hover:bg-slate-200/50 cursor-pointer"
                              title="移除此人"
                            >
                              ×
                            </button>
                          </span>
                        ))}

                        {/* Add Name Badge button */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveDropdownRow(activeDropdownRow === row.id ? null : row.id)
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-dashed border-slate-300 text-[10px] text-slate-500 hover:border-[#008236] hover:text-[#008236] hover:bg-emerald-50/50 transition-colors cursor-pointer shrink-0"
                          >
                            <Plus className="w-3 h-3" />
                            <span>加人</span>
                          </button>

                          {/* Inline Dropdown for Adding Members */}
                          {activeDropdownRow === row.id && (
                            <div className="absolute left-0 top-full mt-1.5 bg-white border border-slate-200 shadow-lg rounded p-2 z-30 w-44 max-h-48 overflow-y-auto">
                              <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 pb-1 mb-1 border-b border-slate-100">
                                <span>選擇人員加入</span>
                                <button
                                  type="button"
                                  onClick={() => setActiveDropdownRow(null)}
                                  className="hover:text-slate-600 font-mono font-bold"
                                >
                                  ×
                                </button>
                              </div>
                              {availableToAdd.length === 0 ? (
                                <div className="text-[10px] text-slate-400 text-center py-2">
                                  無其他候選名單成員
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 gap-1">
                                  {availableToAdd.map((name) => (
                                    <button
                                      key={name}
                                      type="button"
                                      onClick={() => handleAddPerson(row.id, row.attendees, name)}
                                      className="text-left text-[11px] px-2 py-1 hover:bg-slate-50 rounded text-slate-700 transition-colors w-full cursor-pointer truncate"
                                    >
                                      {name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Attendee Count Control */}
                    <td className="py-4 px-4 text-center">
                      <div className="inline-flex items-center justify-center gap-1.5">
                        <input
                          type="number"
                          value={row.attendees.length}
                          onChange={(e) =>
                            handleCountInputChange(row.id, parseInt(e.target.value, 10) || 1)
                          }
                          className="w-12 text-center text-xs py-1 border border-slate-200 rounded font-bold font-mono focus:border-[#008236] focus:outline-none"
                          min="1"
                          max={activeCandidates.length}
                          title="修改人數會自動重新抽取對應人數"
                        />
                        <span className="text-[10px] text-slate-450 shrink-0 font-medium">人</span>
                      </div>
                    </td>

                    {/* Average Cost */}
                    <td className="py-4 px-4 text-right font-mono">
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-slate-950">${averageValue.toLocaleString()}</span>
                        {row.category === '會議餐點' && averageValue > mealUnitCost && (
                          <span className="text-[9px] text-rose-600 flex items-center gap-0.5 mt-0.5 font-sans font-medium">
                            <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                            超額 ${mealUnitCost}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Row Commands */}
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onRerollRow(row.id, row.attendees.length)}
                        className="geo-btn-outline px-2 py-1 text-[10px] flex items-center gap-1"
                        title="依目前人數，隨機重新抽選另一組名單"
                      >
                        <Shuffle className="w-3 h-3" />
                        <span>重新抽選</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
