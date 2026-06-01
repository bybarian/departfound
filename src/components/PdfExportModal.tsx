import React, { useState, useEffect } from 'react';
import { X, Printer, FileText, Settings, Calendar, CheckSquare, Sparkles } from 'lucide-react';
import { ExpenseRecord, AttendeeDetail } from '../types';

interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: ExpenseRecord[];
  details: AttendeeDetail[];
  currentYear: string;
}

export default function PdfExportModal({
  isOpen,
  onClose,
  records,
  details,
  currentYear,
}: PdfExportModalProps) {
  // Configurable template fields
  const [docTitle, setDocTitle] = useState('科基金費用報支單');
  const [department, setDepartment] = useState('急診醫學科');
  const [reporter, setReporter] = useState('鍾睿元');
  const [reporterEmpId, setReporterEmpId] = useState('334318');
  const [checker, setChecker] = useState('');
  const [reportDate, setReportDate] = useState('2024.12.18');
  const [includeRemarks, setIncludeRemarks] = useState(false);
  const [exportMode, setExportMode] = useState<'both' | 'records' | 'attendees'>('both');

  // Conference Types Checked States
  const [morningConf, setMorningConf] = useState(false);
  const [deptMealConf, setDeptMealConf] = useState(true);
  const [caseDiscussConf, setCaseDiscussConf] = useState(false);
  const [caseStudyConf, setCaseStudyConf] = useState(false);
  const [teachingConf, setTeachingConf] = useState(true);
  const [otherConf, setOtherConf] = useState(true);

  // Date range filtering states
  const [filterByDate, setFilterByDate] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Auto-detect a reasonable report date and full range from the latest transaction if available
  useEffect(() => {
    if (records.length > 0) {
      // Sort to get the latest date for reportDate
      const sortedDates = [...records]
        .map(r => r.date)
        .filter(Boolean)
        .sort((a, b) => b.localeCompare(a));
      
      if (sortedDates.length > 0) {
        const latest = sortedDates[0]; // e.g. "2024-12-18" or "2024/12/18"
        setReportDate(latest.replace(/-/g, '.'));
      }

      // Auto-detect full date range
      const dates = records.map(r => r.date).filter(Boolean);
      if (dates.length > 0) {
        const sorted = [...dates].sort();
        setStartDate(sorted[0]);
        setEndDate(sorted[sorted.length - 1]);
      }
    }
  }, [records]);

  if (!isOpen) return null;

  const filteredRecords = filterByDate
    ? records.filter(r => r.date >= startDate && r.date <= endDate)
    : records;

  const filteredDetails = filterByDate
    ? details.filter(d => d.date >= startDate && d.date <= endDate)
    : details;

  const totalAmount = filteredRecords.reduce((sum, r) => sum + r.amount, 0);

  // Chronologically sorted records & details
  const sortedRecords = [...filteredRecords].sort((a, b) => a.date.localeCompare(b.date));
  const sortedDetails = [...filteredDetails].sort((a, b) => a.date.localeCompare(b.date));

  // Extract short date format "MM/DD"
  const getShortDate = (dateStr: string) => {
    if (!dateStr) return '';
    const cleanDate = dateStr.replace(/\//g, '-');
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
    }
    if (parts.length === 2) {
      return `${parseInt(parts[0], 10)}/${parseInt(parts[1], 10)}`;
    }
    return dateStr;
  };

  const displayPeriod = filterByDate && startDate && endDate
    ? `${startDate.replace(/-/g, '/')} ~ ${endDate.replace(/-/g, '/')}`
    : reportDate;

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  const handlePrint = () => {
    try {
      window.print();
    } catch (e) {
      console.error("列印出錯，通常由於外嵌視窗 (iframe) 安全限制:", e);
      alert("因瀏覽器安全限制，請點擊左側控制面板的「在新分頁中開啟」，即可正常列印！");
    }
  };

  return (
    <div id="pdf-export-overlay" className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      {/* Container Card */}
      <div 
        id="pdf-setting-container"
        className="relative w-full max-w-md md:max-w-6xl bg-slate-100 rounded-xl shadow-2xl border border-slate-300 md:border-slate-350 overflow-hidden transform transition-all flex flex-col md:flex-row h-[85vh] md:h-[92vh]"
      >
        {/* Left config control panel */}
        <div className="w-full md:w-80 bg-white md:border-r border-slate-200 p-4 sm:p-5 flex flex-col justify-between overflow-y-auto flex-1 md:flex-none md:shrink-0 min-h-0 select-none">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-emerald-800">
                <FileText className="w-5 h-5 text-[#008236]" />
                <h3 className="text-xs font-bold uppercase tracking-widest font-sans">
                  費用報支單排版
                </h3>
              </div>
              <button 
                type="button" 
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Editable form fields */}
            <div className="space-y-3.5">
              <div className="bg-emerald-50/70 p-3 rounded-lg border border-emerald-100/85">
                <label className="block text-[10px] font-bold text-[#008236] uppercase tracking-wider mb-2">
                  🖨️ 選擇匯出格式
                </label>
                <div className="space-y-2 text-xs text-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                    <input
                      type="radio"
                      name="exportMode"
                      value="both"
                      checked={exportMode === 'both'}
                      onChange={() => setExportMode('both')}
                      className="text-[#008236] focus:ring-[#008236] border-slate-300 w-3.5 h-3.5"
                    />
                    <span>1+2 兩表合併匯出</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="exportMode"
                      value="records"
                      checked={exportMode === 'records'}
                      onChange={() => setExportMode('records')}
                      className="text-[#008236] focus:ring-[#008236] border-slate-300 w-3.5 h-3.5"
                    />
                    <span>僅匯出「消費紀錄表」</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="exportMode"
                      value="attendees"
                      checked={exportMode === 'attendees'}
                      onChange={() => setExportMode('attendees')}
                      className="text-[#008236] focus:ring-[#008236] border-slate-300 w-3.5 h-3.5"
                    />
                    <span>僅匯出「與會人員表」</span>
                  </label>
                </div>
              </div>

              {/* Date Filter Selection Block */}
              <div className="bg-emerald-50/40 p-3 rounded-lg border border-emerald-100/70 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#008236] select-none">
                  <input
                    type="checkbox"
                    checked={filterByDate}
                    onChange={(e) => setFilterByDate(e.target.checked)}
                    className="rounded text-[#008236] focus:ring-[#008236] border-slate-300 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>📅 篩選特定報支日期範圍</span>
                </label>
                {filterByDate && (
                  <div className="space-y-1.5 animate-fade-in text-[11px] text-slate-700">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="block text-[9px] font-bold text-slate-400 mb-0.5 uppercase tracking-wider">起始日期</span>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full text-[11px] py-1 px-1.5 bg-white border border-slate-200 rounded font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#008236] font-mono"
                        />
                      </div>
                      <div>
                        <span className="block text-[9px] font-bold text-slate-400 mb-0.5 uppercase tracking-wider">結束日期</span>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full text-[11px] py-1 px-1.5 bg-white border border-slate-200 rounded font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#008236] font-mono"
                        />
                      </div>
                    </div>
                    <div className="text-[10px] text-[#008236] font-bold bg-white/60 p-1 px-2 rounded border border-emerald-200 text-center mt-1">
                      數據與 A4 報單已即時同步
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  項目報支大標題
                </label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="geo-input text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  使用單位 (科室)
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="geo-input text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  報支單據日期 (YYYY.MM.DD)
                </label>
                <input
                  type="text"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="geo-input text-xs"
                  placeholder="2024.12.18"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    製單付款人
                  </label>
                  <input
                    type="text"
                    value={reporter}
                    onChange={(e) => setReporter(e.target.value)}
                    className="geo-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    付款人編號
                  </label>
                  <input
                    type="text"
                    value={reporterEmpId}
                    onChange={(e) => setReporterEmpId(e.target.value)}
                    className="geo-input text-xs font-mono"
                    placeholder="334318"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  主管核決職稱/姓名 (選填)
                </label>
                <input
                  type="text"
                  value={checker}
                  onChange={(e) => setChecker(e.target.value)}
                  className="geo-input text-xs"
                  placeholder="無 (留白手寫蓋章)"
                />
              </div>

              {/* Conference types interactive block */}
              <div className="pt-2 border-t border-slate-100">
                <span className="block text-[10px] font-bold text-[#008236] uppercase tracking-wider mb-2">
                  附件：會議類型設定
                </span>
                <div className="grid grid-cols-2 gap-1.5 text-xs text-slate-700">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={morningConf}
                      onChange={(e) => setMorningConf(e.target.checked)}
                      className="rounded text-[#008236] focus:ring-[#008236] border-slate-300 w-3.5 h-3.5"
                    />
                    <span>晨會</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deptMealConf}
                      onChange={(e) => setDeptMealConf(e.target.checked)}
                      className="rounded text-[#008236] focus:ring-[#008236] border-slate-300 w-3.5 h-3.5"
                    />
                    <span>科內餐會</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={caseDiscussConf}
                      onChange={(e) => setCaseDiscussConf(e.target.checked)}
                      className="rounded text-[#008236] focus:ring-[#008236] border-slate-300 w-3.5 h-3.5"
                    />
                    <span>病例討論會</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={caseStudyConf}
                      onChange={(e) => setCaseStudyConf(e.target.checked)}
                      className="rounded text-[#008236] focus:ring-[#008236] border-slate-300 w-3.5 h-3.5"
                    />
                    <span>個案討論會</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={teachingConf}
                      onChange={(e) => setTeachingConf(e.target.checked)}
                      className="rounded text-[#008236] focus:ring-[#008236] border-slate-300 w-3.5 h-3.5"
                    />
                    <span>教學活動</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={otherConf}
                      onChange={(e) => setOtherConf(e.target.checked)}
                      className="rounded text-[#008236] focus:ring-[#008236] border-slate-300 w-3.5 h-3.5"
                    />
                    <span>其他</span>
                  </label>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeRemarks}
                    onChange={(e) => setIncludeRemarks(e.target.checked)}
                    className="rounded text-[#008236] focus:ring-[#008236] border-slate-300 w-4 h-4"
                  />
                  <span>將消費備記得入「摘要」欄</span>
                </label>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-6 border-t border-slate-200 space-y-3">
            {isInIframe && (
              <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-3 text-xs leading-relaxed space-y-2 select-text">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <span>⚠️ 預覽內嵌框架限制說明</span>
                </div>
                <p className="text-slate-700 font-medium leading-normal text-[11px]">
                  因目前本系統套在開發預覽嵌入頁（iFrame）中，瀏覽器安全規範會<b>強制阻擋列印與下載</b>。請點擊下方按鈕、在獨立新視窗中即可完美列印並下載儲存 A4 PDF！
                </p>
                <a 
                  href={typeof window !== 'undefined' ? window.location.href : '#'} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-1.5 px-3 rounded-lg inline-flex items-center justify-center gap-1 border-none shadow-sm cursor-pointer hover:shadow transition-all text-[11px] text-center"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-200 animate-pulse" />
                  <span>在新分頁中打開此系統</span>
                </a>
              </div>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="w-full bg-[#008236] hover:bg-[#006a2c] text-white font-bold py-2.5 px-4 rounded-lg inline-flex items-center justify-center gap-2 shadow-md cursor-pointer transition-colors text-xs"
            >
              <Printer className="w-4 h-4 text-emerald-250" />
              <span>列印 / 另存 A4 報支 PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 px-4 rounded-lg inline-flex items-center justify-center border border-slate-300 cursor-pointer transition-colors text-xs"
            >
              <span>關閉</span>
            </button>
          </div>
        </div>

        {/* Right pane: Beautiful simulated document preview */}
        <div className="hidden md:flex flex-1 bg-slate-600/10 p-6 md:p-8 overflow-y-auto flex-col justify-start items-center">
          <div className="w-full max-w-[210mm] flex items-center justify-between mb-4 select-none">
            <span className="text-slate-500 text-xs font-semibold flex items-center gap-1.5 bg-slate-200/50 py-1 px-3 rounded-md">
              <Sparkles className="w-3.5 h-3.5 text-[#008236]" />
              <span>A4 標準頁面精美模擬 (依附件格式調整)</span>
            </span>
            <button 
              type="button" 
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-900 text-white p-2 rounded-full shadow-lg transition-colors cursor-pointer hidden md:flex items-center justify-center"
              title="關閉預覽"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Miniature paper canvas mimicking realistic black-white physical A4 */}
          <div 
            id="print-preview-paper" 
            className="w-[210mm] min-h-[297mm] bg-white p-12 shadow-2xl border border-slate-300 rounded font-sans text-slate-900 flex flex-col justify-between"
          >
            {/* Primary Table section */}
            <div>
              {(exportMode === 'both' || exportMode === 'records') && (
                <>
                  {/* Document Header */}
                  <div className="text-center space-y-3 mb-4">
                    <h1 className="text-2xl font-bold tracking-widest text-slate-900 font-sans">
                      {docTitle || '科基金費用報支單'}
                    </h1>
                    
                    {/* Metarow: Usage Unit & Date */}
                    <div className="flex justify-between items-center text-sm font-semibold px-1 text-slate-800 font-sans">
                      <div>使用單位：{department}</div>
                      <div>日期：{reportDate}</div>
                    </div>
                  </div>

                  {/* Table 1: Consumption records */}
                  <table className="w-full text-sm text-left border-collapse border-t border-b border-l border-r border-slate-900">
                    <thead>
                      <tr className="bg-slate-900 text-white font-bold text-center border-b border-slate-900">
                        <th className="px-3 py-2 border-r border-slate-900 w-52 font-medium">項目</th>
                        <th className="px-3 py-2 border-r border-slate-900 font-medium">摘要</th>
                        <th className="px-3 py-2 border-r border-slate-900 w-36 text-right font-medium">金 額</th>
                        <th className="px-3 py-2 w-48 font-medium">付款人(姓名+員工編號)</th>
                      </tr>
                    </thead>
                    <tbody className="text-center">
                      {sortedRecords.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-10 text-center text-slate-400">
                            目前尚無任何消費報支。
                          </td>
                        </tr>
                      ) : (
                        sortedRecords.map((r) => (
                          <tr key={r.id} className="border-b border-slate-900">
                            {/* 項目 column formatted as Category(MM/DD) */}
                            <td className="px-3 py-2.5 border-r border-slate-900 text-left font-sans text-slate-900 font-semibold pl-4">
                              {r.category}({getShortDate(r.date)})
                            </td>
                            {/* 摘要 Column */}
                            <td className="px-3 py-2.5 border-r border-slate-900 text-left text-slate-700 text-xs">
                              {includeRemarks ? r.remark : ''}
                            </td>
                            {/* 金額 Column - raw formatted number */}
                            <td className="px-3 py-2.5 border-r border-slate-900 text-right font-mono font-bold text-slate-900 pr-4">
                              {r.amount.toLocaleString()}
                            </td>
                            {/* 付款人 Column formatted as Name(EmpId) */}
                            <td className="px-3 py-2.5 text-slate-900 font-semibold">
                              {reporter}{reporterEmpId ? `(${reporterEmpId})` : ''}
                            </td>
                          </tr>
                        ))
                      )}

                      {/* Total Amount Row */}
                      <tr className="font-bold border-b border-slate-900 bg-slate-50/50">
                        <td colSpan={2} className="px-3 py-3 border-r border-slate-900 text-center tracking-[1.5em] text-slate-950 text-sm pl-[1.5em]">
                          總 計
                        </td>
                        <td className="px-3 py-3 border-r border-slate-900 text-right font-mono font-extrabold text-slate-950 pr-4 text-sm">
                          {totalAmount.toLocaleString()}
                        </td>
                        <td className="px-3 py-3"></td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Signatures horizontal split below Table */}
                  <div className="flex justify-between items-center text-sm font-semibold mt-4 px-1 text-slate-905">
                    <div>科室主管：<span className="text-slate-700">{checker}</span></div>
                    <div>製單：{reporter}</div>
                  </div>
                </>
              )}

              {(exportMode === 'both' || exportMode === 'attendees') && (
                <>
                  {/* Attachment Divider Title */}
                  <div 
                    id="pdf-attachment-section-header" 
                    className={`text-center font-bold tracking-[1.5em] text-sm text-slate-900 ${exportMode === 'attendees' ? 'mb-4 mt-2' : 'my-4'} pl-[1.5em] select-none`}
                  >
                    附 件：與 會 人 員 明 細 表
                  </div>

              {/* Attachment Bordered Box with Table 2 */}
              <div id="pdf-attachment-card" className="border border-slate-900 p-4 space-y-2.5 rounded-xs mt-3">
                {/* Conference Type Row Headers with Checkboxes */}
                <div className="text-xs leading-relaxed text-slate-900 font-sans font-semibold border-b border-slate-200 pb-2">
                  會議類型：
                  <span className="mr-3">{morningConf ? '■' : '□'}晨會</span>
                  <span className="mr-3">{deptMealConf ? '■' : '□'}科內餐會</span>
                  <span className="mr-3">{caseDiscussConf ? '■' : '□'}病例討論會</span>
                  <span className="mr-3">{caseStudyConf ? '■' : '□'}個案討論會</span>
                  <span className="mr-3">{teachingConf ? '■' : '□'}教學活動</span>
                  <span>{otherConf ? '■' : '□'}其他</span>
                </div>

                {/* Date Header Row inside attachment */}
                <div className="text-xs font-bold font-sans text-slate-800 flex items-center gap-1 border-b border-dashed border-slate-200 pb-1.5">
                  <span>申報對帳期間：</span>
                  <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-650">{displayPeriod}</span>
                </div>

                {/* Second Table: Attendee List */}
                <div className="overflow-x-auto select-all">
                  <table className="w-full text-xs text-left border-collapse border-t border-b border-l border-r border-slate-900">
                    <thead>
                      <tr className="bg-slate-900 text-white font-bold text-center border-b border-slate-900">
                        <th className="px-2 py-2 border-r border-slate-900 w-16">日期</th>
                        <th className="px-2 py-2 border-r border-slate-900 w-24 font-medium">報支項目</th>
                        <th className="px-3 py-2 border-r border-slate-900 text-left font-medium">參與人員名冊</th>
                        <th className="px-2 py-2 border-r border-slate-900 w-12">人數</th>
                        <th className="px-2 py-2 border-r border-slate-900 w-20 text-right pr-2">平均</th>
                        <th className="px-2 py-2 w-24 text-right pr-2">金額總計</th>
                      </tr>
                    </thead>
                    <tbody className="text-center text-slate-800">
                      {sortedDetails.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                            目前尚無任何與會細項紀錄。
                          </td>
                        </tr>
                      ) : (
                        sortedDetails.map((detail) => (
                          <tr key={detail.id} className="border-b border-slate-900">
                            <td className="px-2 py-2 border-r border-slate-900 font-mono text-[11px]">
                              {getShortDate(detail.date)}
                            </td>
                            <td className="px-2 py-2 border-r border-slate-900 font-semibold text-[11px]">
                              {detail.category}
                            </td>
                            <td className="px-3 py-2 border-r border-slate-900 text-left text-slate-900 font-sans leading-relaxed">
                              {detail.attendees.join('、')}
                            </td>
                            <td className="px-2 py-2 border-r border-slate-900 font-mono font-bold text-[11px]">
                              {detail.count}人
                            </td>
                            <td className="px-2 py-2 border-r border-slate-900 text-right pr-2 font-mono text-[11px]">
                              ${detail.average.toLocaleString()}
                            </td>
                            <td className="px-2 py-2 text-right pr-2 font-mono font-bold text-[11px]">
                              ${detail.amount.toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                      
                      {/* Total accumulation row */}
                      <tr className="font-bold border-b border-slate-900 bg-slate-50/50">
                        <td colSpan={3} className="px-3 py-2.5 border-r border-slate-900 text-center tracking-[1em] text-slate-950 pl-[1em] text-xs">
                          與 會 人 員 及 金 額 總 計
                        </td>
                        <td className="px-2 py-2.5 border-r border-slate-900 font-mono text-[11px] text-slate-950">
                          {sortedDetails.reduce((sum, d) => sum + d.count, 0)} 人次
                        </td>
                        <td className="px-2 py-2.5 border-r border-slate-900"></td>
                        <td className="px-2 py-2.5 text-right pr-2 font-mono font-extrabold text-slate-950">
                          ${totalAmount.toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
                </>
              )}
            </div>

            {/* Document Verification Code */}
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-sans font-medium italic select-none mt-2 w-full">
              <span>powered by byabrian 2026 copyrights resevered</span>
              <span>智慧人員防錯不重複系統申報存檔備查 · AI-Powered Allocation Verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* 
        ====================================================================================
        PURE HIGH-FIDELITY PRINT OUT BLOCK (TRIGGERED ONLY ON WINDOW.PRINT()) 
        Strictly conforms to standard A4 format based on user's attachment.
        ====================================================================================
      */}
      <div id="print-area" className="hidden print:block bg-white text-black p-4 font-sans w-[100%] leading-normal select-text">
        {(exportMode === 'both' || exportMode === 'records') && (
          <>
            {/* Main Document Header */}
            <div className="text-center space-y-4 mb-3">
              <h1 className="text-[22px] font-extrabold tracking-widest text-black text-center">
                {docTitle || '科基金費用報支單'}
              </h1>
              
              {/* Metadata Unit & Date info */}
              <div className="flex justify-between items-center text-[12px] font-extrabold px-1 text-black">
                <div>使用單位：{department}</div>
                <div>日期：{reportDate}</div>
              </div>
            </div>

            {/* Consumption records Grid Table */}
            <table className="w-full text-[12px] text-left border-collapse border-t border-b border-l border-r border-black mb-4">
              <thead>
                <tr className="bg-black text-white font-extrabold text-center border-b border-black">
                  <th className="px-3 py-2 border-r border-black w-52 font-bold text-center">項目</th>
                  <th className="px-3 py-2 border-r border-black font-bold text-center">摘要</th>
                  <th className="px-3 py-2 border-r border-black w-36 text-right pr-4 font-bold">金 額</th>
                  <th className="px-3 py-2 w-48 font-bold text-center">付款人(姓名+員工編號)</th>
                </tr>
              </thead>
              <tbody className="text-center">
                {sortedRecords.map((r) => (
                  <tr key={r.id} className="border-b border-black">
                    <td className="px-3 py-2.5 border-r border-black text-left font-bold text-black pl-4">
                      {r.category}({getShortDate(r.date)})
                    </td>
                    <td className="px-3 py-2.5 border-r border-black text-left text-black">
                      {includeRemarks ? r.remark : ''}
                    </td>
                    <td className="px-3 py-2.5 border-r border-black text-right font-mono font-bold pr-4 text-black">
                      {r.amount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-black font-bold">
                      {reporter}{reporterEmpId ? `(${reporterEmpId})` : ''}
                    </td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="font-extrabold border-b border-black bg-gray-50">
                  <td colSpan={2} className="px-3 py-3 border-r border-black text-center tracking-[1.5em] text-black font-bold pl-[1.5em]">
                    總　　計
                  </td>
                  <td className="px-3 py-3 border-r border-black text-right font-mono font-extrabold text-black pr-4">
                    {totalAmount.toLocaleString()}
                  </td>
                  <td className="px-3 py-3"></td>
                </tr>
              </tbody>
            </table>

            {/* Supervisors/Reporter Signatures below Table */}
            <div className="flex justify-between items-center text-[12px] font-extrabold px-1 text-black mb-6">
              <div>科室主管： {checker}</div>
              <div>製單：{reporter}</div>
            </div>
          </>
        )}

        {/* Attachment Page Break Spacer for print */}
        {exportMode === 'both' && (
          <div className="page-break-before" style={{ pageBreakBefore: 'always' }}></div>
        )}

        {(exportMode === 'both' || exportMode === 'attendees') && (
          <>
            {/* Attachment Centered Big Label */}
            <div className={`text-center font-extrabold tracking-[1.25em] text-[14px] text-black ${exportMode === 'attendees' ? 'mb-4 mt-2' : 'my-4'} pl-[1.25em]`}>
              附 件：與 會 人 員 明 細 表
            </div>

            {/* Attachment Bordered Core Container */}
            <div className="border border-black p-4 space-y-2.5 rounded-sm">
              {/* Conference types checkbox indicators */}
              <div className="text-[11px] leading-relaxed text-black font-bold border-b border-black pb-2">
                會議類型：
                <span className="mr-3">{morningConf ? '■' : '□'}晨會</span>
                <span className="mr-3">{deptMealConf ? '■' : '□'}科內餐會</span>
                <span className="mr-3">{caseDiscussConf ? '■' : '□'}病例討論會</span>
                <span className="mr-3">{caseStudyConf ? '■' : '□'}個案討論會</span>
                <span className="mr-3">{teachingConf ? '■' : '□'}教學活動</span>
                <span>{otherConf ? '■' : '□'}其他</span>
              </div>

              {/* Date Range Row */}
              <div className="text-[11px] font-bold text-black border-b border-dashed border-gray-300 pb-1.5">
                申報對帳期間：{displayPeriod}
              </div>

              {/* Printable High-Fidelity Attendee table */}
              <table className="w-full text-[11px] text-left border-collapse border-t border-b border-l border-r border-black">
                <thead>
                  <tr className="bg-black text-white font-bold text-center border-b border-black">
                    <th className="px-2 py-2 border-r border-black w-14 font-bold text-center">日期</th>
                    <th className="px-2 py-2 border-r border-black w-24 font-bold text-center">報支項目</th>
                    <th className="px-3 py-2 border-r border-black font-bold text-left pl-3">與會人員名單</th>
                    <th className="px-2 py-2 border-r border-black w-12 font-bold text-center">人數</th>
                    <th className="px-2 py-2 border-r border-black w-20 text-right pr-2 font-bold">平均金額</th>
                    <th className="px-2 py-2 w-24 text-right pr-2 font-bold">細項總計</th>
                  </tr>
                </thead>
                <tbody className="text-center">
                  {sortedDetails.map((detail) => (
                    <tr key={detail.id} className="border-b border-black">
                      <td className="px-2 py-1.8 border-r border-black text-center font-mono">
                        {getShortDate(detail.date)}
                      </td>
                      <td className="px-2 py-1.8 border-r border-black text-center font-bold">
                        {detail.category}
                      </td>
                      <td className="px-3 py-1.8 border-r border-black text-left pl-3 font-medium text-black leading-relaxed">
                        {detail.attendees.join('、')}
                      </td>
                      <td className="px-2 py-1.8 border-r border-black text-center font-mono font-bold">
                        {detail.count}人
                      </td>
                      <td className="px-2 py-1.8 border-r border-black text-right pr-2 font-mono">
                        ${detail.average.toLocaleString()}
                      </td>
                      <td className="px-2 py-1.8 text-right pr-2 font-mono font-bold">
                        ${detail.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {/* Grand summary row in printable block */}
                  <tr className="font-extrabold border-b border-black bg-gray-50">
                    <td colSpan={3} className="px-3 py-2.5 border-r border-black text-center tracking-[1em] text-black font-bold pl-[1em]">
                      與 會 人 員 及 金 額 總 計
                    </td>
                    <td className="px-2 py-2.5 border-r border-black text-center font-mono">
                      {sortedDetails.reduce((sum, d) => sum + d.count, 0)} 人次
                    </td>
                    <td className="px-2 py-2.5 border-r border-black"></td>
                    <td className="px-2 py-2.5 text-right pr-2 font-mono font-extrabold">
                      ${totalAmount.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Verification Footer Text */}
        <div className="flex justify-between items-center text-[9px] text-gray-500 italic mt-8 pt-2 border-t border-gray-100 w-full font-sans">
          <span>powered by byabrian 2026 copyrights resevered</span>
          <span>智慧人員不重複抽選防錯機制申報存卷審驗 · Document System ID: CF-AUTO-STAMP-2026</span>
        </div>
      </div>
    </div>
  );
}
