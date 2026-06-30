import React, { useState, useEffect } from 'react';
import { Calendar, Tag, DollarSign, FileText, Plus, Check, X, Users, Sparkles } from 'lucide-react';
import { AttendeeDetail, ExpenseCategory, ExpenseRecord, Person } from '../types';
import { estimateAttendeeCount } from '../utils/attendeeReroll';

interface ExpenseFormProps {
  onAddRecord: (record: Omit<ExpenseRecord, 'id'>, customAttendeeCount?: number) => void;
  onUpdateRecord: (id: string, updatedFields: Omit<ExpenseRecord, 'id'>, customAttendeeCount?: number) => void;
  editTarget: ExpenseRecord | null;
  onCancelEdit: () => void;
  currentYear: string;
  autoFillData?: { date: string; category: ExpenseCategory; amount: number | ''; remark: string } | null;
  onClearAutoFill?: () => void;
  people: Person[];
  details: AttendeeDetail[];
  mealUnitCost: number;
}

export default function ExpenseForm({
  onAddRecord,
  onUpdateRecord,
  editTarget,
  onCancelEdit,
  currentYear,
  autoFillData,
  onClearAutoFill,
  people,
  details,
  mealUnitCost,
}: ExpenseFormProps) {
  const [date, setDate] = useState('');
  const [dropdownCategory, setDropdownCategory] = useState<'會議餐點' | '電腦周邊' | '文具用品' | '其他'>('會議餐點');
  const [customCategory, setCustomCategory] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [remark, setRemark] = useState('');
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const category = dropdownCategory === '其他' ? (customCategory.trim() || '其他') : dropdownCategory;

  // Settle custom attendee count modes
  const [useAutoCount, setUseAutoCount] = useState(true);
  const [customCount, setCustomCount] = useState<number | ''>('');

  const activeCandidatesCount = people.filter(p => p.isActive).length;
  const estimatedCount = estimateAttendeeCount(category, amount === '' ? 0 : Number(amount), mealUnitCost);
  const displayedCount = useAutoCount
    ? Math.max(1, Math.min(estimatedCount, activeCandidatesCount || 1))
    : (customCount === '' ? 1 : Math.max(1, Math.min(Number(customCount), activeCandidatesCount || 1)));

  // Synchronize state when editTarget changes
  useEffect(() => {
    setErrorMsg('');
    if (editTarget) {
      setDate(editTarget.date);
      const isStandard = ['會議餐點', '電腦周邊', '文具用品'].includes(editTarget.category);
      if (isStandard) {
        setDropdownCategory(editTarget.category as any);
        setCustomCategory('');
      } else {
        setDropdownCategory('其他');
        setCustomCategory(editTarget.category);
      }
      setAmount(editTarget.amount);
      setRemark(editTarget.remark);

      const dtl = details.find(d => d.id === editTarget.id);
      if (dtl) {
        setCustomCount(dtl.attendees.length);
        const est = estimateAttendeeCount(editTarget.category, editTarget.amount, mealUnitCost);
        if (dtl.attendees.length === est) {
          setUseAutoCount(true);
        } else {
          setUseAutoCount(false);
        }
      } else {
        setUseAutoCount(true);
        setCustomCount('');
      }
    } else {
      // Set to current date as standard
      const today = new Date();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      setDate(`${currentYear || '2026'}-${mm}-${dd}`);
      setDropdownCategory('會議餐點');
      setCustomCategory('');
      setAmount('');
      setRemark('');
      setUseAutoCount(true);
      setCustomCount('');
    }
  }, [editTarget, currentYear, details, mealUnitCost]);

  // Synchronize state when autoFillData is populated via voice
  useEffect(() => {
    setErrorMsg('');
    if (autoFillData) {
      setDate(autoFillData.date);
      const isStandard = ['會議餐點', '電腦周邊', '文具用品'].includes(autoFillData.category);
      if (isStandard) {
        setDropdownCategory(autoFillData.category as any);
        setCustomCategory('');
      } else {
        setDropdownCategory('其他');
        setCustomCategory(autoFillData.category);
      }
      setAmount(autoFillData.amount);
      setRemark(autoFillData.remark);
      
      // Auto estimate count or keep old
      setUseAutoCount(true);
      setCustomCount('');

      // Flash a brilliant Cathay Green highlight on the card
      setIsHighlighted(true);
      const timer = setTimeout(() => {
        setIsHighlighted(false);
      }, 2500);

      if (onClearAutoFill) {
        onClearAutoFill();
      }
      return () => clearTimeout(timer);
    }
  }, [autoFillData, onClearAutoFill]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      setErrorMsg('請填寫消費日期！');
      return;
    }
    if (dropdownCategory === '其他' && !customCategory.trim()) {
      setErrorMsg('請輸入自訂消費項目名稱！');
      return;
    }
    if (amount === '' || amount <= 0) {
      setErrorMsg('請填寫消費金額！');
      return;
    }

    setErrorMsg('');

    const payload = {
      date,
      category,
      amount: Number(amount),
      remark: remark.trim() || `${category}報銷`,
    };

    const finalAttendeeCount = useAutoCount ? undefined : Number(displayedCount);

    if (editTarget) {
      onUpdateRecord(editTarget.id, payload, finalAttendeeCount);
    } else {
      onAddRecord(payload, finalAttendeeCount);
    }

    // Reset inputs
    setDropdownCategory('會議餐點');
    setCustomCategory('');
    setAmount('');
    setRemark('');
    setUseAutoCount(true);
    setCustomCount('');
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setDate(`${currentYear || '2026'}-${mm}-${dd}`);
  };

  return (
    <div 
      id="expense-form-card" 
      className={`geo-card h-full transition-all duration-700 ${
        isHighlighted 
          ? 'ring-4 ring-[#008236] border-transparent shadow-lg shadow-emerald-100 scale-[1.015]' 
          : ''
      }`}
    >
      <div className="geo-card-header">
        <h2 className="geo-card-title">
          {editTarget ? '編輯消費紀錄' : '手動新增消費紀錄'}
        </h2>
        {editTarget && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="text-xs font-semibold text-emerald-100 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded border border-white/20 transition-colors cursor-pointer"
            title="取消編輯"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} id="manual-expense-form" className="p-5 space-y-4">
        {/* Date Selection */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1 uppercase tracking-wider">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            消費日期
          </label>
          <input
            type="date"
            id="input-expense-date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="geo-input"
            required
          />
        </div>

        {/* Category Dropdown */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1 uppercase tracking-wider">
            <Tag className="w-3.5 h-3.5 text-slate-400" />
            消費類別
          </label>
          <select
            id="select-expense-category"
            value={dropdownCategory}
            onChange={(e) => setDropdownCategory(e.target.value as any)}
            className="geo-input bg-white"
          >
            <option value="會議餐點">☕ 會議餐點 (預估每人 $500)</option>
            <option value="電腦周邊">💻 電腦周邊 (預設 1 人)</option>
            <option value="文具用品">✏️ 文具用品 (預設 1-3 人)</option>
            <option value="其他">❓ 其他 (手動指定)</option>
          </select>
        </div>

        {/* Custom Category Input */}
        {dropdownCategory === '其他' && (
          <div className="animate-fade-in">
            <label className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1 uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-[#008236]" />
              請輸入自訂消費項目名稱
            </label>
            <input
              type="text"
              id="input-custom-category"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="例如：高鐵車票、計程車費、印刷費..."
              className="geo-input"
              required
            />
          </div>
        )}

        {/* Amount Input */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1 uppercase tracking-wider">
            <DollarSign className="w-3.5 h-3.5 text-slate-400" />
            消費金額 (元)
          </label>
          <input
            type="number"
            id="input-expense-amount"
            value={amount}
            onChange={(e) => {
              const val = e.target.value;
              setAmount(val === '' ? '' : Math.abs(parseInt(val, 10)));
            }}
            placeholder="請輸入消費整數金額"
            className="geo-input font-mono"
            min="1"
            required
          />
        </div>

        {/* Custom Attendee Selection Box */}
        <div className="bg-slate-50/75 p-3 rounded-lg border border-slate-200/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1 uppercase tracking-wider">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              參與抽選人數
            </label>
            
            {/* Toggle Segmented Buttons */}
            <div className="flex items-center bg-slate-200/70 rounded p-0.5 border border-slate-200 text-[10px]">
              <button
                type="button"
                onClick={() => setUseAutoCount(true)}
                className={`px-2 py-0.5 font-bold rounded transition-all cursor-pointer ${
                  useAutoCount
                    ? 'bg-[#008236] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#008236]'
                }`}
              >
                自動估算
              </button>
              <button
                type="button"
                onClick={() => {
                  setUseAutoCount(false);
                  if (customCount === '') {
                    setCustomCount(displayedCount);
                  }
                }}
                className={`px-2 py-0.5 font-bold rounded transition-all cursor-pointer ${
                  !useAutoCount
                    ? 'bg-[#008236] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#008236]'
                }`}
              >
                手動自訂
              </button>
            </div>
          </div>

          {useAutoCount ? (
            <div className="flex items-center justify-between text-xs font-sans px-1">
              <span className="text-slate-500 font-medium">依消費公式自動估算：</span>
              <span className="font-bold text-[#008236] bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-100 font-mono text-[12px]">
                {displayedCount} 人
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3 justify-between px-1">
              <span className="text-xs text-slate-500 font-medium">手動指定人數：</span>
              <div className="flex items-center gap-1.5 font-sans">
                <button
                  type="button"
                  onClick={() => setCustomCount(prev => Math.max(1, (typeof prev === 'number' ? prev : 1) - 1))}
                  className="w-6.5 h-6.5 flex items-center justify-center border border-slate-200 rounded bg-white hover:bg-slate-50 font-bold text-slate-650 cursor-pointer transition-colors text-xs"
                >
                  -
                </button>
                <input
                  type="number"
                  value={customCount}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setCustomCount('');
                    } else {
                      const num = parseInt(val, 10);
                      setCustomCount(isNaN(num) ? 1 : Math.max(1, Math.min(num, activeCandidatesCount)));
                    }
                  }}
                  className="w-12 text-center text-xs py-0.5 border border-slate-200 rounded font-bold font-mono focus:border-[#008236] focus:outline-none"
                  min="1"
                  max={activeCandidatesCount}
                />
                <button
                  type="button"
                  onClick={() => setCustomCount(prev => Math.min(activeCandidatesCount, (typeof prev === 'number' ? prev : 1) + 1))}
                  className="w-6.5 h-6.5 flex items-center justify-center border border-slate-200 rounded bg-white hover:bg-slate-50 font-bold text-slate-650 cursor-pointer transition-colors text-xs"
                >
                  +
                </button>
                <span className="text-xs text-slate-500 font-medium ml-0.5">人</span>
              </div>
            </div>
          )}
          
          <p className="text-[9px] leading-normal text-slate-400 font-sans font-medium px-1">
            {useAutoCount 
              ? `💡 說明：會議餐點每人基底約 $${mealUnitCost}，電腦周邊為 1 人，文具 2 人。`
              : `⚠️ 限制：抽選範圍包含作用中名單成員共計 ${activeCandidatesCount} 人。`
            }
          </p>
        </div>

        {/* Remark/Description */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1 uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            備註
          </label>
          <input
            type="text"
            id="input-expense-remark"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="如：科內午餐、藍牙滑鼠..."
            className="geo-input"
          />
        </div>

        {errorMsg && (
          <div className="p-2.5 bg-rose-50 text-rose-700 text-[11px] font-bold rounded border border-rose-100 flex items-center gap-1.5 animate-pulse">
            <div className="w-1.5 h-1.5 rounded-full bg-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {editTarget && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="geo-btn-outline flex-1"
            >
              取消
            </button>
          )}
          <button
            type="submit"
            id="btn-expense-submit"
            className="geo-btn-primary flex-1 flex items-center justify-center gap-1.5"
          >
            {editTarget ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editTarget ? '儲存修改' : '新增消費紀錄'}
          </button>
        </div>
      </form>
    </div>
  );
}
