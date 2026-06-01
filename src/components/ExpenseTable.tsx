import { ExpenseRecord } from '../types';
import { Edit2, Trash2, UserCheck, Receipt, Coffee, Laptop, Pencil, HelpCircle } from 'lucide-react';

const getCategoryIcon = (category: string) => {
  switch (category) {
    case '會議餐點':
      return <Coffee className="w-3.5 h-3.5 mr-1" />;
    case '電腦周邊':
      return <Laptop className="w-3.5 h-3.5 mr-1" />;
    case '文具用品':
      return <Pencil className="w-3.5 h-3.5 mr-1" />;
    default:
      return <HelpCircle className="w-3.5 h-3.5 mr-1" />;
  }
};

interface ExpenseTableProps {
  records: ExpenseRecord[];
  onEdit: (record: ExpenseRecord) => void;
  onDelete: (id: string) => void;
  onGenerateAttendees: (record: ExpenseRecord) => void;
}

export default function ExpenseTable({
  records,
  onEdit,
  onDelete,
  onGenerateAttendees,
}: ExpenseTableProps) {
  // Compute grand totals
  const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);

  // Group by category to display small breakdowns
  const categoryCounts = records.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + r.amount;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div id="first-table-card" className="geo-card">
      <div className="geo-card-header flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-white/15 text-white rounded">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <h3 className="geo-card-title">第一個表格：消費紀錄表</h3>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-emerald-100 font-bold uppercase tracking-wider mr-1.5">累計報銷總額:</span>
          <span className="text-sm font-bold font-mono text-emerald-200">
            ${totalAmount.toLocaleString()} 元
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="geo-table" id="expense-records-table">
          <thead>
            <tr>
              <th className="py-3 px-4">消費日期</th>
              <th className="py-3 px-4">消費類別</th>
              <th className="py-3 px-4 text-right">金額 (元)</th>
              <th className="py-3 px-4">備註</th>
              <th className="py-3 px-4 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
            {records.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400 font-sans">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <p className="text-xs font-semibold text-slate-500">目前沒有任何消費紀錄。</p>
                    <p className="text-[10px] text-slate-400">可以使用手動表單或語音輸入，來新增您的第一筆報支資料！</p>
                  </div>
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                  {/* Date */}
                  <td className="py-3.5 px-4 font-mono font-medium whitespace-nowrap text-slate-800">
                    {record.date}
                  </td>
                  {/* Category Badge */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className={`geo-badge flex items-center justify-center w-fit ${
                        record.category === '會議餐點'
                          ? 'geo-badge-success'
                          : record.category === '電腦周邊'
                          ? 'geo-badge-info'
                          : record.category === '文具用品'
                          ? 'geo-badge-info'
                          : 'geo-badge-slate'
                      }`}
                    >
                      {getCategoryIcon(record.category)}
                      <span>{record.category}</span>
                    </span>
                  </td>
                  {/* Amount */}
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-950">
                    ${record.amount.toLocaleString()}
                  </td>
                  {/* Remark */}
                  <td className="py-3.5 px-4 max-w-[200px] truncate text-slate-500" title={record.remark}>
                    {record.remark}
                  </td>
                  {/* Action Commands */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => onGenerateAttendees(record)}
                        className="geo-btn-outline px-2 py-1 text-[10px] flex items-center gap-1"
                        title="為此筆消費重新亂數抽選參與人員"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>人員抽選</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(record)}
                        className="p-1 rounded text-slate-400 hover:text-[#008236] hover:bg-slate-100 transition-colors cursor-pointer"
                        title="編輯此消費項目"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(record.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="刪除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {records.length > 0 && (
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap gap-x-4 gap-y-2 items-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
          <span className="text-slate-700">分類統計：</span>
          {Object.entries(categoryCounts).map(([cat, val]) => (
            <span key={cat} className="font-mono">
              {cat}: <strong className="text-slate-800">${val.toLocaleString()}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
