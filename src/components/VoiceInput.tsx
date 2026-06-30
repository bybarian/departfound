import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Calendar, DollarSign, Tag, FileText, Check, AlertTriangle, Lightbulb } from 'lucide-react';
import { ExpenseCategory, ExpenseRecord } from '../types';
import { parseSpeechText } from '../utils/textParser';

interface VoiceInputProps {
  onAddRecord: (record: Omit<ExpenseRecord, 'id'>) => void;
  currentYear: string;
  onAutoFillForm?: (record: { date: string; category: ExpenseCategory; amount: number | ''; remark: string }) => void;
}

export default function VoiceInput({ onAddRecord, currentYear, onAutoFillForm }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSupported, setIsSupported] = useState(true);

  // Voice Mode configuration persist
  const [voiceMode, setVoiceMode] = useState<'preview' | 'fill-form' | 'direct-add'>(() => {
    return (localStorage.getItem('tech_fund_voice_mode') as 'preview' | 'fill-form' | 'direct-add') || 'preview';
  });

  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'info'>('success');

  // Editable parsed preview fields
  const [parsedDate, setParsedDate] = useState('');
  const [parsedDropdownCategory, setParsedDropdownCategory] = useState<'會議餐點' | '電腦周邊' | '文具用品' | '其他'>('會議餐點');
  const [parsedCustomCategory, setParsedCustomCategory] = useState('');
  const parsedCategory = parsedDropdownCategory === '其他' ? (parsedCustomCategory.trim() || '其他') : parsedDropdownCategory;
  const [parsedAmount, setParsedAmount] = useState<number | ''>('');
  const [parsedRemark, setParsedRemark] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const updateParsedCategoryStates = (categoryVal: string) => {
    const isStandard = ['會議餐點', '電腦周邊', '文具用品'].includes(categoryVal);
    if (isStandard) {
      setParsedDropdownCategory(categoryVal as any);
      setParsedCustomCategory('');
    } else {
      setParsedDropdownCategory('其他');
      setParsedCustomCategory(categoryVal);
    }
  };

  const recognitionRef = useRef<any>(null);
  const voiceModeRef = useRef(voiceMode);

  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  const showToastNotification = (msg: string, type: 'success' | 'info' = 'success') => {
    setToastMsg(msg);
    setToastType(type);
    const timer = setTimeout(() => {
      setToastMsg('');
    }, 5000);
    return () => clearTimeout(timer);
  };

  const handleSetMode = (mode: 'preview' | 'fill-form' | 'direct-add') => {
    setVoiceMode(mode);
    localStorage.setItem('tech_fund_voice_mode', mode);
  };

  useEffect(() => {
    // Check Web Speech API support
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'zh-TW'; // Taiwan Chinese Speech Output

    rec.onstart = () => {
      setIsRecording(true);
      setErrorMsg('');
      setTranscript('');
      setToastMsg('');
    };

    rec.onerror = (event: any) => {
      console.error('Speech recognition error', event);
      if (event.error === 'not-allowed') {
        setErrorMsg('無法存取麥克風。請確認已授予麥克風權限且您的系統麥克風未靜音。');
      } else {
        setErrorMsg(`語音辨識出錯：${event.error}`);
      }
      setIsRecording(false);
    };

    rec.onend = () => {
      setIsRecording(false);
    };

    rec.onresult = (event: any) => {
      const resultText = event.results[0][0].transcript;
      setTranscript(resultText);
      handleProcessSpeech(resultText);
    };

    recognitionRef.current = rec;
  }, [currentYear]);

  const handleToggleRecord = () => {
    if (!isSupported) return;

    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      setErrorMsg('');
      setShowPreview(false);
      try {
        recognitionRef.current?.start();
      } catch (e: any) {
        console.error(e);
        setErrorMsg('無法啟動語音辨識機制。');
      }
    }
  };

  const handleProcessSpeech = (text: string) => {
    if (!text) return;
    const parsed = parseSpeechText(text, currentYear);
    
    const parsedDateVal = parsed.date;
    const parsedCategoryVal = parsed.category || '會議餐點';
    const parsedAmountVal = parsed.amount !== null ? parsed.amount : 0;
    const parsedRemarkVal = parsed.remark || `${parsedCategoryVal}報銷`;

    const currentMode = voiceModeRef.current;

    // Direct actions based on Voice Fill Mode
    if (currentMode === 'direct-add') {
      if (!parsedDateVal || !parsedAmountVal || parsedAmountVal <= 0) {
        // Fallback to preview if critical info is missing
        setParsedDate(parsedDateVal);
        updateParsedCategoryStates(parsedCategoryVal);
        setParsedAmount(parsedAmountVal || '');
        setParsedRemark(parsedRemarkVal);
        setShowPreview(true);
        showToastNotification('解析資料不完全（缺少日期或金額），已自動為您開啟預覽確認面板。', 'info');
        return;
      }
      
      onAddRecord({
        date: parsedDateVal,
        category: parsedCategoryVal,
        amount: parsedAmountVal,
        remark: parsedRemarkVal,
      });

      // Clear states & Notify
      setTranscript('');
      showToastNotification(`【語音自動直接新增成功！】\n日期：${parsedDateVal}\n類別：${parsedCategoryVal}\n金額：$${parsedAmountVal.toLocaleString()} 元\n備註：${parsedRemarkVal}`);
    } else if (currentMode === 'fill-form') {
      if (onAutoFillForm) {
        onAutoFillForm({
          date: parsedDateVal,
          category: parsedCategoryVal,
          amount: parsedAmountVal || '',
          remark: parsedRemarkVal,
        });

        // Clear states & Notify
        setTranscript('');
        showToastNotification('【語音填入成功】已將語音解析的欄位自動填入下方的「手動新增消費紀錄」！');
      } else {
        // Fallback to preview if parent callback is missing
        setParsedDate(parsedDateVal);
        updateParsedCategoryStates(parsedCategoryVal);
        setParsedAmount(parsedAmountVal || '');
        setParsedRemark(parsedRemarkVal);
        setShowPreview(true);
      }
    } else {
      // Classic preview mode
      setParsedDate(parsedDateVal);
      updateParsedCategoryStates(parsedCategoryVal);
      setParsedAmount(parsedAmountVal || '');
      setParsedRemark(parsedRemarkVal);
      setShowPreview(true);
    }
  };

  const handleConfirmAdd = () => {
    if (!parsedDate) {
      alert('請填寫日期！');
      return;
    }
    if (parsedAmount === '' || parsedAmount <= 0) {
      alert('請填寫有效的金額！');
      return;
    }

    onAddRecord({
      date: parsedDate,
      category: parsedCategory,
      amount: Number(parsedAmount),
      remark: parsedRemark || `${parsedCategory}報銷`,
    });

    // Reset preview
    setShowPreview(false);
    setTranscript('');
  };

  return (
    <div id="voice-input-card" className="geo-card">
      <div className="geo-card-header">
        <h2 className="geo-card-title">語音快速輸入區</h2>
        <span className="text-[10px] text-emerald-200 font-bold tracking-wider font-mono">SPEECH TO TEXT</span>
      </div>

      <div className="p-5 space-y-4">
        {!isSupported ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 flex gap-2.5">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">未支援語音辨識功能</p>
              <p className="mt-1 leading-relaxed">您的瀏覽器或執行環境不支援 Web Speech API。請使用 Google Chrome、Microsoft Edge 或 Safari 瀏覽器以獲得完整體驗。</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-6 bg-slate-50 border border-slate-200 rounded">
              {/* Mic Animation Button */}
              <button
                type="button"
                id="btn-voice-mic-trigger"
                onClick={handleToggleRecord}
                className={`relative flex items-center justify-center w-14 h-14 rounded-full transition-all duration-300 shadow-sm cursor-pointer ${
                  isRecording
                    ? 'bg-rose-500 text-white hover:bg-rose-600 ring-4 ring-rose-100 animate-pulse'
                    : 'bg-[#008236] text-white hover:bg-[#006428]'
                }`}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                {isRecording && (
                  <span className="absolute -inset-2 rounded-full border-2 border-rose-400 opacity-75 animate-ping" />
                )}
              </button>
              
              <p id="mic-status-text" className="text-xs font-semibold text-slate-700 mt-3.5">
                {isRecording ? '正在傾聽中，請說話...' : '點擊按鈕開始語音辨識'}
              </p>
  
              <div className="mt-4 px-4 max-w-md text-center">
                <div className="text-slate-500 font-medium text-xs leading-relaxed flex items-center justify-center gap-1.5 flex-wrap">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500 fill-amber-100 shrink-0" />
                  <span>例句：「5月31號消費3000元，會議餐點」</span>
                </div>
              </div>

              {/* Segmented Voice Mode Selection Control */}
              <div className="w-full max-w-xs border-t border-slate-200 pt-4 mt-4 px-4">
                <span className="block text-[10px] font-bold text-slate-500 mb-2 text-center uppercase tracking-wider">
                  語音填入模式設定
                </span>
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded border border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleSetMode('preview')}
                    className={`py-1 text-[10.5px] font-bold rounded transition-all cursor-pointer ${
                      voiceMode === 'preview'
                        ? 'bg-[#008236] text-white shadow-xs'
                        : 'text-slate-600 hover:text-[#008236]'
                    }`}
                    title="解析後彈出確認框，可進行微調後手動送出"
                  >
                    彈出預覽
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetMode('fill-form')}
                    className={`py-1 text-[10.5px] font-bold rounded transition-all cursor-pointer ${
                      voiceMode === 'fill-form'
                        ? 'bg-[#008236] text-white shadow-xs'
                        : 'text-slate-600 hover:text-[#008236]'
                    }`}
                    title="直接將語音解析結果填入下方手動表單，不自動送出"
                  >
                    填入表單
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetMode('direct-add')}
                    className={`py-1 text-[10.5px] font-bold rounded transition-all cursor-pointer ${
                      voiceMode === 'direct-add'
                        ? 'bg-[#008236] text-white shadow-xs'
                        : 'text-slate-600 hover:text-[#008236]'
                    }`}
                    title="解析完成且語意完整時，直接自動新增至消費紀錄表中"
                  >
                    直接新增
                  </button>
                </div>
              </div>
            </div>

            {/* Transient Action Status Indicator (Toast) */}
            {toastMsg && (
              <div className={`p-3.5 rounded border text-xs leading-relaxed flex flex-col gap-1.5 shadow-sm transition-all duration-300 ${
                toastType === 'success' 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                  : 'bg-blue-50 text-blue-800 border-blue-200'
              }`}>
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <div className={`w-1.5 h-1.5 rounded-full ${toastType === 'success' ? '#008236' : 'bg-blue-600'} animate-ping`} />
                  <span>語音處理狀態回報</span>
                </div>
                <p className="whitespace-pre-line font-medium pl-3 text-slate-700">{toastMsg}</p>
              </div>
            )}
  
            {/* Transcript Display */}
            {transcript && (
              <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-xs text-emerald-900">
                <p className="font-semibold mb-1">辨識結果：</p>
                <blockquote className="italic font-mono">「 {transcript} 」</blockquote>
              </div>
            )}
  
            {errorMsg && (
              <div className="bg-rose-50 border border-rose-100 rounded p-3 text-xs text-rose-700 flex gap-1.5 items-center">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
  
            {/* Verification / Manual Correction Form */}
            {showPreview && (
              <div id="voice-preview-container" className="bg-slate-50 border border-slate-200 rounded p-4 mt-4 space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    請確認並修正語音解析資訊
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-[#008236] px-2 py-0.5 rounded font-bold font-mono tracking-wider">AUTO PARSED</span>
                </div>
  
                <div className="grid grid-cols-2 gap-3">
                  {/* Date */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1 uppercase tracking-wider">
                      <Calendar className="w-3 h-3" />
                      消費日期
                    </label>
                    <input
                      type="date"
                      value={parsedDate}
                      onChange={(e) => setParsedDate(e.target.value)}
                      className="geo-input"
                    />
                  </div>
  
                  {/* Amount */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1 uppercase tracking-wider">
                      <DollarSign className="w-3 h-3" />
                      消費金額 (元)
                    </label>
                    <input
                      type="number"
                      value={parsedAmount}
                      onChange={(e) => setParsedAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="geo-input font-mono"
                      placeholder="請輸入整數"
                    />
                  </div>
  
                  {/* Category */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1 uppercase tracking-wider">
                      <Tag className="w-3 h-3" />
                      消費類別
                    </label>
                    <select
                      value={parsedDropdownCategory}
                      onChange={(e) => setParsedDropdownCategory(e.target.value as any)}
                      className="geo-input"
                    >
                      <option value="會議餐點">會議餐點 (約每人500)</option>
                      <option value="電腦周邊">電腦周邊 (預設1人)</option>
                      <option value="文具用品">文具用品 (預設1-3人)</option>
                      <option value="其他">其他 (自行指定)</option>
                    </select>

                    {parsedDropdownCategory === '其他' && (
                      <div className="mt-2 animate-fade-in">
                        <input
                          type="text"
                          value={parsedCustomCategory}
                          onChange={(e) => setParsedCustomCategory(e.target.value)}
                          placeholder="請輸入自訂消費項目名稱"
                          className="geo-input text-xs"
                          required
                        />
                      </div>
                    )}
                  </div>
  
                  {/* Remark */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1 uppercase tracking-wider">
                      <FileText className="w-3 h-3" />
                      備註
                    </label>
                    <input
                      type="text"
                      value={parsedRemark}
                      onChange={(e) => setParsedRemark(e.target.value)}
                      className="geo-input"
                      placeholder="如：科內午餐、滑鼠..."
                    />
                  </div>
                </div>
  
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPreview(false)}
                    className="geo-btn-outline"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    id="btn-voice-preview-confirm"
                    onClick={handleConfirmAdd}
                    className="geo-btn-primary flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    新增消費紀錄
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
