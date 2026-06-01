import React, { useRef, useState } from 'react';
import { ExpenseRecord, AttendeeDetail, Person, ExpenseCategory } from '../types';
import { Download, Upload, FileSpreadsheet, FileJson, AlertCircle, Eye, Check, X, RefreshCw, Printer } from 'lucide-react';
import { estimateAttendeeCount, drawAttendees } from '../utils/attendeeReroll';

interface ExportSectionProps {
  records: ExpenseRecord[];
  details: AttendeeDetail[];
  onImportData: (records: ExpenseRecord[], details: AttendeeDetail[]) => void;
  people: Person[];
  mealUnitCost: number;
  onOpenPdfPreview: () => void;
}

export default function ExportSection({
  records,
  details,
  onImportData,
  people,
  mealUnitCost,
  onOpenPdfPreview,
}: ExportSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);

  // CSV Import states
  const [csvPreviewRecords, setCsvPreviewRecords] = useState<Omit<ExpenseRecord, 'id'>[] | null>(null);
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [csvParserError, setCsvParserError] = useState<string>('');

  // Helper to trigger file download
  const downloadFile = (content: string, fileName: string, contentType: string, addBOM = false) => {
    let blob: Blob;
    if (addBOM) {
      // Create UTF-8 BOM byte array
      const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
      blob = new Blob([bom, content], { type: contentType });
    } else {
      blob = new Blob([content], { type: contentType });
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export Table 1 to CSV
  const handleExportRecordsCSV = () => {
    if (records.length === 0) {
      alert('無消費數據可匯出！');
      return;
    }

    const headers = ['消費日期', '消費類別', '金額 (元)', '備註'];
    const rows = records.map((r) => [
      r.date,
      r.category,
      r.amount,
      r.remark.replace(/"/g, '""'), // escape quotes
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');
    downloadFile(csvContent, '01_科基金消費紀錄表.csv', 'text/csv;charset=utf-8;', true);
  };

  // Export Table 2 to CSV
  const handleExportAttendeesCSV = () => {
    if (details.length === 0) {
      alert('無參與人員明細可匯出！');
      return;
    }

    const headers = ['日期', '消費類別', '總金額', '參與人員', '人數', '每人平均金額'];
    const rows = details.map((r) => {
      const averageValue = r.attendees.length > 0 ? Math.round(r.amount / r.attendees.length) : 0;
      return [
         r.date,
         r.category,
         r.amount,
         r.attendees.join('、').replace(/"/g, '""'),
         r.attendees.length,
         averageValue,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');
    downloadFile(csvContent, '02_科基金參與人員明細表.csv', 'text/csv;charset=utf-8;', true);
  };

  // Export entire application state as JSON
  const handleExportJSON = () => {
    const backupObj = {
      records,
      details,
      version: '1.0',
      exportedAt: new Date().toISOString(),
    };
    const jsonStr = JSON.stringify(backupObj, null, 2);
    downloadFile(jsonStr, '科技基金所有資料備份.json', 'application/json;charset=utf-8;');
  };

  // Import entire state from JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (Array.isArray(data.records) && Array.isArray(data.details)) {
          onImportData(data.records, data.details);
          alert('資料匯入成功！');
        } else {
          alert('匯入失敗：JSON 格式不符。檔案必須包含 records 與 details 陣列。');
        }
      } catch (err) {
        console.error(err);
        alert('解析 JSON 檔案時出錯，請確認您的檔案格式是否正確。');
      }
    };
    reader.readAsText(file);
    // Reset file input so same file can be uploaded again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // RFC-4180-compliant CSV parser
  const parseCSVRaw = (text: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let currentValue = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentValue += '"';
          i++; // skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(currentValue.trim());
        currentValue = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++; // skip LF
        }
        row.push(currentValue.trim());
        if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
          lines.push(row);
        }
        row = [];
        currentValue = '';
      } else {
        currentValue += char;
      }
    }

    if (row.length > 0 || currentValue !== '') {
      row.push(currentValue.trim());
      lines.push(row);
    }

    return lines;
  };

  // Resilient category mapper
  const mapCategory = (input: string): ExpenseCategory => {
    const clean = input.trim();
    if (clean.includes('餐点') || clean.includes('餐點') || clean.includes('會') || clean.includes('會議')) {
      return '會議餐點';
    }
    if (clean.includes('電腦') || clean.includes('周邊') || clean.includes('設備') || clean.includes('周邊商品') || clean.includes('配件')) {
      return '電腦周邊';
    }
    if (clean.includes('文具') || clean.includes('辦公') || clean.includes('用品') || clean.includes('筆')) {
      return '文具用品';
    }
    return '其他';
  };

  // Resilient date cleanser
  const cleanCSVDate = (dateStr: string, currentYear: string = '2026'): string => {
    let cleaned = dateStr.trim();
    if (!cleaned) {
      const today = new Date();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      return `${currentYear}-${mm}-${dd}`;
    }

    // Replace characters like /, 年, 月, 日
    cleaned = cleaned.replace(/\//g, '-').replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, '').replace(/號/g, '');

    const parts = cleaned.split('-').map((p) => p.trim());
    if (parts.length === 3) {
      let y = parts[0];
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      if (y.length !== 4) {
        y = currentYear;
      }
      return `${y}-${m}-${d}`;
    } else if (parts.length === 2) {
      const m = parts[0].padStart(2, '0');
      const d = parts[1].padStart(2, '0');
      return `${currentYear}-${m}-${d}`;
    }

    return cleaned;
  };

  // Handle CSV Import, parsing, and opening the interactive preview
  const handleImportCSVChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    setCsvParserError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const allRows = parseCSVRaw(text);
        if (allRows.length === 0) {
          setCsvParserError('檔案為空，無可識別之內容！');
          return;
        }

        let startIdx = 0;
        let dateIdx = 0;
        let categoryIdx = 1;
        let amountIdx = 2;
        let remarkIdx = 3;

        // Smart dynamic header detection
        const firstRow = allRows[0];
        const isHeader = firstRow.some((cell) =>
          cell.includes('日') ||
          cell.includes('類') ||
          cell.includes('金') ||
          cell.includes('額') ||
          cell.includes('元') ||
          cell.includes('備') ||
          cell.includes('註') ||
          ['date', 'category', 'amount', 'remark'].some((kw) => cell.toLowerCase().includes(kw))
        );

        if (isHeader) {
          startIdx = 1;
          const dIdx = firstRow.findIndex((cell) => cell.includes('日') || cell.toLowerCase().includes('date'));
          const cIdx = firstRow.findIndex((cell) => cell.includes('類') || cell.toLowerCase().includes('category'));
          const aIdx = firstRow.findIndex((cell) => cell.includes('金') || cell.includes('元') || cell.toLowerCase().includes('amount'));
          const rIdx = firstRow.findIndex((cell) => cell.includes('備') || cell.includes('註') || cell.toLowerCase().includes('remark'));

          if (dIdx !== -1) dateIdx = dIdx;
          if (cIdx !== -1) categoryIdx = cIdx;
          if (aIdx !== -1) amountIdx = aIdx;
          if (rIdx !== -1) remarkIdx = rIdx;
        }

        const parsedList: Omit<ExpenseRecord, 'id'>[] = [];
        for (let i = startIdx; i < allRows.length; i++) {
          const row = allRows[i];
          // Skip empty rows
          if (row.length === 0 || (row.length === 1 && row[0] === '')) {
            continue;
          }

          const rawDate = row[dateIdx] || '';
          const rawCategory = row[categoryIdx] || '';
          const rawAmount = row[amountIdx] || '0';
          const rawRemark = row[remarkIdx] || '';

          const cleanDate = cleanCSVDate(rawDate);
          const cleanCategory = mapCategory(rawCategory);
          // Strip dollar signs, commas, or letters from amount
          const cleanAmount = Math.max(0, parseInt(rawAmount.replace(/[^\d.-]/g, ''), 10) || 0);
          const cleanRemark = rawRemark.trim() || `${cleanCategory}報銷`;

          parsedList.push({
            date: cleanDate,
            category: cleanCategory,
            amount: cleanAmount,
            remark: cleanRemark,
          });
        }

        if (parsedList.length === 0) {
          setCsvParserError('CSV 解析成功，但沒有偵測到任何消費紀錄列！');
        } else {
          setCsvPreviewRecords(parsedList);
        }
      } catch (err) {
        console.error(err);
        setCsvParserError('解析 CSV 時發生未知錯誤，請檢查檔案格式！');
      }
    };
    reader.readAsText(file);
  };

  // Perform CSV confirmation insertion (Append or Overwrite)
  const handleConfirmCSVImport = (append: boolean) => {
    if (!csvPreviewRecords) return;

    const baseRecords = append ? [...records] : [];
    const baseDetails = append ? [...details] : [];

    const activeCandidates = people.filter((p) => p.isActive);
    if (activeCandidates.length === 0) {
      alert('無法進行抽選匯入！因為作用中的人員名單是空的，請先在設定區點選勾選可供抽籤的人員。');
      return;
    }

    const newRecords: ExpenseRecord[] = [...baseRecords];
    const newDetails: AttendeeDetail[] = [...baseDetails];

    csvPreviewRecords.forEach((item, index) => {
      // Create safe distinctive IDs
      const id = `rec-csv-${Date.now()}-${index}`;

      // Calculate estimate count and draw non-repetitive attendees on-the-fly
      const count = estimateAttendeeCount(item.category, item.amount, mealUnitCost);
      const drawn = drawAttendees(people, count);

      newRecords.push({
        id,
        ...item,
      });

      newDetails.push({
        id,
        date: item.date,
        category: item.category,
        amount: item.amount,
        attendees: drawn,
        count: drawn.length,
        average: drawn.length > 0 ? Math.round(item.amount / drawn.length) : 0,
      });
    });

    onImportData(newRecords, newDetails);

    // Reset CSV import states cleanly
    setCsvPreviewRecords(null);
    setCsvFileName('');
    if (csvFileInputRef.current) {
      csvFileInputRef.current.value = '';
    }

    alert(`🎉 匯入成功！已匯入 ${csvPreviewRecords.length} 筆消費。系統根據每筆金額及類別，自動為您完成了對應不重複的人員抽選！`);
  };

  const handleCancelCSSImport = () => {
    setCsvPreviewRecords(null);
    setCsvFileName('');
    if (csvFileInputRef.current) {
      csvFileInputRef.current.value = '';
    }
  };

  return (
    <div id="export-actions-card" className="geo-card space-y-4">
      {/* CSV Real-time Import Preview Box */}
      {csvPreviewRecords && (
        <div id="csv-import-preview-box" className="p-5 bg-gradient-to-br from-emerald-50/70 to-teal-50/30 rounded-lg border border-emerald-100 shadow-inner space-y-4.5 animate-in fade-in-50 duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#008236] animate-ping" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest font-sans">
                CSV 匯入預覽及防錯檢視
              </h4>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-100 text-[#008236] font-bold rounded-full border border-emerald-200/50">
              來自檔案：{csvFileName}
            </span>
          </div>

          <p className="text-[11px] text-slate-650 leading-relaxed font-sans">
            系統成功讀取此 CSV 檔案。為了保障您的對帳資料，您可以自由選擇<strong>追加</strong>或<strong>覆蓋</strong>。
            一經匯入，消費紀錄會寫入 Table 1，系統亦會自動依據人員名單的啟用狀態，為每一筆項目實施隨機不重複的科基金分攤抽選（寫入 Table 2）。
          </p>

          {/* Inline mini preview table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white max-h-56 overflow-y-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                <tr className="divide-x divide-slate-200/70">
                  <th className="px-3 py-2 font-bold text-slate-500 uppercase tracking-wider w-24">消費日期</th>
                  <th className="px-3 py-2 font-bold text-slate-500 uppercase tracking-wider w-24">消費類別</th>
                  <th className="px-3 py-2 font-bold text-slate-500 tracking-wider text-right w-24">金額 (元)</th>
                  <th className="px-3 py-2 font-bold text-slate-500 uppercase tracking-wider">備註說明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {csvPreviewRecords.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 divide-x divide-slate-100/75 odd:bg-slate-50/20">
                    <td className="px-3 py-1.5 font-mono text-slate-600">{item.date}</td>
                    <td className="px-3 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold font-sans ${
                        item.category === '會議餐點'
                          ? 'bg-amber-50 text-amber-750 border border-amber-200/50'
                          : item.category === '電腦周邊'
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/50'
                          : item.category === '文具用品'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-bold font-mono text-emerald-700">
                      ${item.amount.toLocaleString()}
                    </td>
                    <td className="px-3 py-1.5 text-slate-500 font-medium truncate max-w-xs">{item.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <div className="text-[10px] font-bold text-[#008236] bg-[#008236]/5 px-2.5 py-1 rounded border border-[#008236]/20">
              📊 本次準備匯入共 <span className="font-mono text-sm underline">{csvPreviewRecords.length}</span> 筆消費
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelCSSImport}
                className="geo-btn-outline px-3.5 py-1.5 font-bold flex items-center gap-1.5 cursor-pointer text-[11px]"
              >
                <X className="w-3.5 h-3.5" />
                <span>取消匯入</span>
              </button>

              <button
                type="button"
                onClick={() => handleConfirmCSVImport(true)}
                className="bg-[#008236] hover:bg-[#006a2c] text-white font-bold px-3.5 py-1.5 rounded inline-flex items-center gap-1.5 border border-[#006a2c] shadow-xs cursor-pointer text-[11px]"
              >
                <Check className="w-3.5 h-3.5" />
                <span>➕ 追加匯入 (保留現有資料)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (window.confirm('確定要「清除現有全部紀錄」並以這份 CSV 完全蓋過嗎？(本操作不可還原)')) {
                    handleConfirmCSVImport(false);
                  }
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3.5 py-1.5 rounded inline-flex items-center gap-1.5 border border-rose-700 shadow-xs cursor-pointer text-[11px]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>🔥 完全覆蓋 (清除現有匯入)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {csvParserError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold flex items-center gap-2 animate-pulse">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{csvParserError}</span>
          <button
            type="button"
            onClick={() => setCsvParserError('')}
            className="ml-auto underline cursor-pointer hover:text-rose-900"
          >
            關閉
          </button>
        </div>
      )}

      <div className="geo-card-header flex-wrap gap-4">
        <div>
          <h3 className="geo-card-title">資料儲存與匯出/匯入全功能區</h3>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            匯出至工作試算表，或透過 CSV / JSON 將消費名單直接匯入進行自動隨機抽選
          </p>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Elegant PDF Exporter */}
            <button
              type="button"
              id="btn-export-pdf-report"
              onClick={onOpenPdfPreview}
              className="geo-btn-primary inline-flex items-center gap-1.5 cursor-pointer text-xs bg-[#008236] hover:bg-[#006a2c] text-white border-[#006a2c] shadow-xs font-bold"
            >
              <Printer className="w-4 h-4 text-emerald-200" />
              <span>🖨️ 產生與列印分攤申報 PDF</span>
            </button>

            {/* CSV Export 1 */}
            <button
              type="button"
              id="btn-export-csv-records"
              onClick={handleExportRecordsCSV}
              className="geo-btn-outline inline-flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#008236]" />
              <span>匯出消費紀錄表 (CSV)</span>
            </button>

            {/* CSV Export 2 */}
            <button
              type="button"
              id="btn-export-csv-attendees"
              onClick={handleExportAttendeesCSV}
              className="geo-btn-outline inline-flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#008236]" />
              <span>匯出人員明細表 (CSV)</span>
            </button>

            <span className="w-px h-6 bg-slate-200 hidden md:inline-block" />

            {/* CSV Import File Picker */}
            <div className="relative">
              <input
                type="file"
                id="csv-file-uploader"
                ref={csvFileInputRef}
                accept=".csv"
                onChange={handleImportCSVChange}
                className="hidden"
              />
              <button
                type="button"
                id="btn-import-csv-trigger"
                onClick={() => csvFileInputRef.current?.click()}
                className="geo-btn-primary inline-flex items-center gap-1.5 cursor-pointer text-xs bg-[#008236] hover:bg-[#006a2c] text-white border-[#006a2c]"
              >
                <Upload className="w-4 h-4 text-emerald-200" />
                <span>匯入 CSV 消費紀錄</span>
              </button>
            </div>

            {/* Export JSON */}
            <button
              type="button"
              id="btn-export-json-all"
              onClick={handleExportJSON}
              className="geo-btn-outline inline-flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <FileJson className="w-4 h-4 text-amber-500" />
              <span>備份為 JSON</span>
            </button>

            {/* Import JSON */}
            <div className="relative">
              <input
                type="file"
                id="json-file-uploader"
                ref={fileInputRef}
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
              />
              <button
                type="button"
                id="btn-import-json-trigger"
                onClick={() => fileInputRef.current?.click()}
                className="geo-btn-outline inline-flex items-center gap-1.5 cursor-pointer text-xs"
              >
                <Upload className="w-4 h-4 text-slate-500" />
                <span>從 JSON 匯入</span>
              </button>
            </div>
          </div>
        </div>

        <div className="pt-3.5 border-t border-slate-200 flex items-start gap-2.5 text-[11px] text-slate-500 font-sans">
          <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <span className="leading-relaxed">
            附註：匯出的 CSV 已自動隨附 <strong>UTF-8 BOM</strong> 標頭，雙擊即可直接在 Microsoft Excel 完美顯示繁體中文且<strong>不出現亂碼</strong>。您可以使用該 CSV 作為範本修改，再透過<strong>【匯入 CSV】</strong>鍵快速回傳。系統會自動依每筆品項的金額/類別，為其快速實施隨機不重複分攤人員的抽選配置。
          </span>
        </div>
      </div>
    </div>
  );
}
