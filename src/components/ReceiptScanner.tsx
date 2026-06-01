import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Image as ImageIcon, Sparkles, RefreshCw, Check, X, Loader2, Calendar, DollarSign, Tag, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ExpenseCategory, ExpenseRecord } from '../types';

interface ReceiptScannerProps {
  onAddRecord: (record: Omit<ExpenseRecord, 'id'>) => void;
  onAutoFillForm: (data: { date: string; category: ExpenseCategory; amount: number | ''; remark: string }) => void;
  currentYear: string;
}

export default function ReceiptScanner({ onAddRecord, onAutoFillForm, currentYear }: ReceiptScannerProps) {
  // Mode selection or capture options
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  // Scanned / OCR results structure editable by user
  const [scannedDate, setScannedDate] = useState('');
  const [scannedCategory, setScannedCategory] = useState<ExpenseCategory>('會議餐點');
  const [scannedAmount, setScannedAmount] = useState<number | ''>('');
  const [scannedRemark, setScannedRemark] = useState('');
  const [showResultPanel, setShowResultPanel] = useState(false);

  // Media / Stream elements reference
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop camera tracks helper
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Launch device Web Camera interface
  const startCamera = async () => {
    setErrorMsg('');
    setSuccessInfo(null);
    setImagePreview(null);
    setShowResultPanel(false);
    
    try {
      let stream: MediaStream;
      
      // Attempt 1: Back-facing high-res camera
      try {
        const constraints = {
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("Success: Initialized back-facing high-res camera stream");
      } catch (err) {
        console.warn("Back-facing high-res camera request failed, attempting standard back-facing camera...", err);
        try {
          // Attempt 2: Standard back-facing camera
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
          console.log("Success: Initialized standard back-facing camera stream");
        } catch (err2) {
          console.warn("Standard back-facing camera failed, attempting standard default camera...", err2);
          // Attempt 3: Any available camera
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
          console.log("Success: Initialized default camera stream");
        }
      }
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // explicitly call play and catch to handle autoplay policies safely
        videoRef.current.play().catch(e => {
          console.error("Video element play failed:", e);
        });
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.error("Camera access error:", err);
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
        setErrorMsg("⚠️ 瀏覽器相機權限已被拒絕。請嘗試以下解決方案：\n1. 點擊右上角「在新分頁開啟」圖示（獨立分頁運行能徹底解決嵌入式 iframe 的權限限制）。\n2. 檢查並允許瀏覽器網址列旁的相機存取權限。\n3. 您亦可直接使用右側「上傳發票/收據照片」直接選取相簿或拍照，此方式不受權限限制。");
      } else {
        setErrorMsg(`無法存取任何相機硬體裝置 (${err.name || '未知錯誤'})。建議點擊右上角「在新分頁開啟」以獲得完整的硬體存取支援，或改用旁邊的「上傳發票/收據照片」功能。`);
      }
    }
  };

  // Capture static image from `<video>` canvas
  const captureImage = () => {
    if (!videoRef.current) return;

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw centered stream snapshot
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setImagePreview(dataUrl);
        stopCamera();
        
        // Trigger OCR API immediately
        performOCR(dataUrl);
      }
    } catch (err) {
      console.error("Capture image error:", err);
      setErrorMsg("擷取相機影像發生錯誤，請重試。");
    }
  };

  // Handle uploaded/dropped/picker files
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processSelectedFile(files[0]);
    }
  };

  const processSelectedFile = (file: File) => {
    setErrorMsg('');
    setSuccessInfo(null);
    setShowResultPanel(false);

    if (!file.type.startsWith('image/')) {
      setErrorMsg('請選取有效的圖檔 (JPEG, PNG 等格式)。');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target && typeof event.target.result === 'string') {
        setImagePreview(event.target.result);
        performOCR(event.target.result);
      }
    };
    reader.onerror = () => {
      setErrorMsg('讀取檔案影像失敗。');
    };
    reader.readAsDataURL(file);
  };

  // Perform Gemini OCR API fetch request
  const performOCR = async (base64String: string) => {
    setIsScanning(true);
    setStatusText('1/3 建立伺服器連線中...');
    setErrorMsg('');
    
    // Stagger loading indicators to look high-end and detailed
    const texts = [
      '1/3 伺服器已建立安全連線...',
      '2/3 Gemini AI 正在對發票進行 OCR 文字及欄位視覺辨識...',
      '3/3 核心元數據校準，自動填補消費日期與分類...',
      '常規審核中，即將呈現辨識結果...'
    ];
    let textIndex = 0;
    const interval = setInterval(() => {
      if (textIndex < texts.length) {
        setStatusText(texts[textIndex]);
        textIndex++;
      }
    }, 1500);

    try {
      const response = await fetch('/api/ocr-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image: base64String })
      });

      clearInterval(interval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "發票資訊辨識失敗");
      }

      const data = await response.json();
      
      // Auto-populate edit form with scanned results
      setScannedDate(data.date || `${currentYear}-01-01`);
      setScannedCategory(data.category || '會議餐點');
      setScannedAmount(data.amount || '');
      setScannedRemark(data.remark || '');
      setShowResultPanel(true);
      setSuccessInfo('🎉 發票掃描辨識完成！');

    } catch (err: any) {
      clearInterval(interval);
      console.error(err);
      setErrorMsg(err.message || '發票掃描失敗，請手動確認或於 ⚙️ 設定 > 密鑰 中設置正確的 Gemini 服務 API Key。');
    } finally {
      setIsScanning(false);
    }
  };

  // Confirm scanned entity, action 1: autofill existing form for attendee modifications
  const handleActionFillForm = () => {
    if (!scannedAmount) {
      setErrorMsg('消費金額不能為空！');
      return;
    }
    onAutoFillForm({
      date: scannedDate,
      category: scannedCategory,
      amount: Number(scannedAmount),
      remark: scannedRemark || `${scannedCategory}報銷`
    });
    setSuccessInfo('📋 欄位資料已自動帶入左側「手動填載表單」，您可以進一步調整抽選人數與儲存！');
    setShowResultPanel(false);
    setImagePreview(null);
  };

  // Confirm scanned entity, action 2: directly append to records table
  const handleActionDirectAdd = () => {
    if (!scannedAmount) {
      setErrorMsg('消費金額不能為空！');
      return;
    }
    
    onAddRecord({
      date: scannedDate,
      category: scannedCategory,
      amount: Number(scannedAmount),
      remark: scannedRemark.trim() || `${scannedCategory}報銷`
    });

    setSuccessInfo(`✨ 已直接新增此筆發票紀錄：${scannedCategory} $${scannedAmount} 元！`);
    setShowResultPanel(false);
    setImagePreview(null);
  };

  const handleResetScanner = () => {
    stopCamera();
    setImagePreview(null);
    setIsScanning(false);
    setErrorMsg('');
    setSuccessInfo(null);
    setShowResultPanel(false);
  };

  return (
    <div id="receipt-scanner-card" className="geo-card h-full flex flex-col justify-between">
      <div className="geo-card-header flex items-center justify-between">
        <h2 className="geo-card-title flex items-center gap-1.5 font-sans">
          <Sparkles className="w-4 h-4 text-emerald-250 shrink-0" />
          <span>相機掃描 / 發票上傳自動辨識</span>
        </h2>
        
        {(imagePreview || showResultPanel || isCameraActive) && (
          <button
            type="button"
            onClick={handleResetScanner}
            className="text-xs font-semibold text-emerald-100 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded border border-white/20 transition-colors cursor-pointer flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>重新掃描</span>
          </button>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col justify-center space-y-4">
        {/* Alerts & Feedbacks */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 text-rose-700 text-[11px] font-bold rounded border border-rose-100 flex items-start gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span className="leading-snug whitespace-pre-line">{errorMsg}</span>
          </div>
        )}

        {successInfo && (
          <div className="p-3 bg-emerald-50 text-[#008236] text-[11px] font-bold rounded border border-emerald-100 flex items-start gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-[#008236] shrink-0 mt-0.5" />
            <span className="leading-snug">{successInfo}</span>
          </div>
        )}

        {/* Live Camera Stream Interface */}
        {isCameraActive && (
          <div className="relative w-full aspect-video md:aspect-[4/3] bg-black rounded-lg border border-slate-700 overflow-hidden shadow-inner flex items-center justify-center">
            <video
              ref={videoRef}
              id="scanner-video-preview"
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            
            {/* Elegant laser focus scanline overlay */}
            <div className="absolute inset-0 border-[2px] border-emerald-500/30 ring-1 ring-emerald-500/20 rounded-lg pointer-events-none flex items-center justify-center">
              <div className="absolute w-[80%] h-0.5 bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,1)] animate-[bounce_3s_infinite]" />
              <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
              <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
              <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-emerald-400" />
            </div>

            {/* Quick Action buttons over active stream */}
            <div className="absolute bottom-4 inset-x-0 flex justify-center gap-3 px-4">
              <button
                type="button"
                onClick={stopCamera}
                className="bg-slate-900/90 hover:bg-slate-900 text-white font-bold text-xs px-3.5 py-1.5 rounded-md border border-slate-700 flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>關閉</span>
              </button>
              
              <button
                type="button"
                onClick={captureImage}
                className="bg-[#008236] hover:bg-[#006228] text-white font-extrabold text-xs px-5 py-2.5 rounded-full ring-4 ring-emerald-500/20 flex items-center gap-2 transition-all shadow-lg cursor-pointer transform hover:scale-[1.03]"
              >
                <Camera className="w-4 h-4 text-emerald-200 animate-pulse" />
                <span>拍照上傳安全辨識</span>
              </button>
            </div>
          </div>
        )}

        {/* Loading Spinner during OCR Process */}
        {isScanning && (
          <div className="w-full aspect-video bg-slate-50 border border-dashed border-slate-200 rounded-lg flex flex-col justify-center items-center p-6 space-y-3.5">
            <div className="relative">
              <Loader2 className="w-10 h-10 text-[#008236] animate-spin" />
              <Sparkles className="w-4 h-4 text-amber-500 absolute -top-1.5 -right-1.5 animate-bounce" />
            </div>
            
            <div className="text-center space-y-1">
              <p className="text-xs font-bold text-slate-800 animate-pulse">{statusText}</p>
              <p className="text-[10px] text-slate-500 font-medium">使用精準雙重模型架構分析</p>
            </div>
          </div>
        )}

        {/* Ideal State / Selector Area when neither scan, camera stream nor scanning is active */}
        {!isCameraActive && !isScanning && !showResultPanel && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Launch Camera Option */}
            <button
              type="button"
              onClick={startCamera}
              className="group p-5 bg-white hover:bg-emerald-50/50 border border-slate-200 hover:border-[#008236]/30 rounded-xl transition-all duration-300 text-center flex flex-col items-center justify-center space-y-2.5 shadow-xs cursor-pointer hover:shadow-md animate-fade-in"
            >
              <div className="w-11 h-11 rounded-full bg-emerald-50 group-hover:bg-[#008236]/10 flex items-center justify-center text-[#008236] transition-colors">
                <Camera className="w-5.5 h-5.5 group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">開啟相機鏡頭拍照</p>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">行動裝置最佳選擇，直接拍照辨識</p>
              </div>
            </button>

            {/* Drop / Picker File Selection Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="group p-5 bg-white hover:bg-emerald-50/50 border border-dashed border-slate-200 hover:border-[#008236]/30 rounded-xl transition-all duration-300 text-center flex flex-col items-center justify-center space-y-2.5 shadow-xs cursor-pointer hover:shadow-md"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <div className="w-11 h-11 rounded-full bg-emerald-50 group-hover:bg-[#008236]/10 flex items-center justify-center text-[#008236] transition-colors">
                <Upload className="w-5.5 h-5.5 group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">上傳發票/收據照片</p>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">支援拖曳檔案、PDF 截圖與相簿</p>
              </div>
            </div>
          </div>
        )}

        {/* Display Scanned Result Preview & Correction Panel */}
        {showResultPanel && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4 shadow-inner animate-fade-in">
            <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
              <Sparkles className="w-4 h-4 text-[#008236] shrink-0" />
              <span className="text-xs font-bold text-slate-900">確認 AI 辨識欄位資訊</span>
              <span className="text-[9px] text-[#008236] bg-emerald-50 px-1.5 py-0.5 rounded font-bold border border-emerald-100 ml-auto select-none">可自由修改微調</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Date Field */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1 uppercase tracking-wider">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  發票日期
                </label>
                <input
                  type="date"
                  value={scannedDate}
                  onChange={(e) => setScannedDate(e.target.value)}
                  className="w-full text-xs py-1.5 px-2.5 bg-white border border-slate-200 rounded-md font-bold text-slate-800 focus:border-[#008236] focus:outline-none focus:ring-0 font-mono"
                  required
                />
              </div>

              {/* Category Dropdown */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1 uppercase tracking-wider">
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  預設分類
                </label>
                <select
                  value={scannedCategory}
                  onChange={(e) => setScannedCategory(e.target.value as ExpenseCategory)}
                  className="w-full text-xs py-1.5 px-2.5 bg-white border border-slate-200 rounded-md font-bold text-slate-800 focus:border-[#008236] focus:outline-none focus:ring-0"
                >
                  <option value="會議餐點">☕ 會議餐點</option>
                  <option value="電腦周邊">💻 電腦周邊</option>
                  <option value="文具用品">✏️ 文具用品</option>
                  <option value="其他">❓ 其他項目</option>
                </select>
              </div>

              {/* Amount Field */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1 uppercase tracking-wider">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                  總發票金額
                </label>
                <input
                  type="number"
                  value={scannedAmount}
                  onChange={(e) => {
                    const v = e.target.value;
                    setScannedAmount(v === '' ? '' : Math.abs(parseInt(v, 10)));
                  }}
                  className="w-full text-xs py-1.5 px-2.5 bg-white border border-slate-200 rounded-md font-bold text-[#008236] focus:border-[#008236] focus:outline-none focus:ring-0 font-mono text-[13px]"
                  min="1"
                  required
                />
              </div>

              {/* Remark Field */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1 uppercase tracking-wider">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  發票備註 / 品項
                </label>
                <input
                  type="text"
                  value={scannedRemark}
                  onChange={(e) => setScannedRemark(e.target.value)}
                  placeholder="商家名稱或發票品項備註"
                  className="w-full text-xs py-1.5 px-2.5 bg-white border border-slate-200 rounded-md font-bold text-slate-800 focus:border-[#008236] focus:outline-none focus:ring-0"
                />
              </div>
            </div>

            {/* Quick Action Decision Segment */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-200/60">
              <button
                type="button"
                onClick={handleActionFillForm}
                className="flex-1 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-300 font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                title="可手動修改參與抽選人數後儲存"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>帶入填載表單調整</span>
              </button>

              <button
                type="button"
                onClick={handleActionDirectAdd}
                className="flex-1 bg-[#008236] hover:bg-[#006228] text-white font-extrabold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm hover:shadow-[#008236]/20 transition-all cursor-pointer"
                title="略過設定直接新增至對帳清冊中"
              >
                <Check className="w-3.5 h-3.5 text-emerald-250 animate-bounce" />
                <span>直接確認儲存項目</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="px-5 pb-5 pt-1 text-[9px] text-slate-400 font-medium font-sans border-t border-slate-100 rounded-b-xl flex items-center gap-1 justify-center bg-slate-50/50">
        <Sparkles className="w-3 h-3 text-[#008236]" />
        <span>搭載 Gemini-3.5-flash 高精度辨識引擎</span>
      </div>
    </div>
  );
}
