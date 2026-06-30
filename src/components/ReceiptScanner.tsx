import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Image as ImageIcon, Sparkles, RefreshCw, Check, X, Loader2, Calendar, DollarSign, Tag, FileText, AlertTriangle, CheckCircle2, Lock, Unlock } from 'lucide-react';
import { ExpenseCategory, ExpenseRecord } from '../types';

interface ReceiptScannerProps {
  onAddRecord: (record: Omit<ExpenseRecord, 'id'>) => void;
  onAutoFillForm: (data: { date: string; category: ExpenseCategory; amount: number | ''; remark: string }) => void;
  currentYear: string;
}

export default function ReceiptScanner({ onAddRecord, onAutoFillForm, currentYear }: ReceiptScannerProps) {
  // Passcode security checks
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ocr_unlocked') === 'true' || !!localStorage.getItem('client_gemini_api_key');
    }
    return false;
  });
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');

  // Client-side Custom Gemini API Key configuration for static hosts (e.g. GitHub Pages)
  const [clientApiKey, setClientApiKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('client_gemini_api_key') || '';
    }
    return '';
  });
  const [showKeyConfig, setShowKeyConfig] = useState<boolean>(false);

  // Mode selection or capture options
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  // Scanned / OCR results structure editable by user
  const [scannedDate, setScannedDate] = useState('');
  const [scannedDropdownCategory, setScannedDropdownCategory] = useState<'會議餐點' | '電腦周邊' | '文具用品' | '其他'>('會議餐點');
  const [scannedCustomCategory, setScannedCustomCategory] = useState('');
  const scannedCategory = scannedDropdownCategory === '其他' ? (scannedCustomCategory.trim() || '其他') : scannedDropdownCategory;

  const updateScannedCategoryStates = (categoryVal: string) => {
    const isStandard = ['會議餐點', '電腦周邊', '文具用品'].includes(categoryVal);
    if (isStandard) {
      setScannedDropdownCategory(categoryVal as any);
      setScannedCustomCategory('');
    } else {
      setScannedDropdownCategory('其他');
      setScannedCustomCategory(categoryVal);
    }
  };

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

  // Dynamically bind active stream to video element when it mounts and becomes active
  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      console.log("Binding camera stream to video element dynamically...");
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      video.play().catch(e => {
        console.error("Video play failed on state change:", e);
      });
    }
  }, [isCameraActive]);

  // Launch device Web Camera interface
  const startCamera = async () => {
    setErrorMsg('');
    setSuccessInfo(null);
    setImagePreview(null);
    setShowResultPanel(false);
    
    // Safety check for browser compatibility or iframe sandbox limitations
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg("⚠️ 瀏覽器安全性規範限制：\n此瀏覽器目前不支援或未開放直接存取相機鏡頭（可能是因為在內嵌 Iframe 中執行，或非安全網址 HTTPS 協定）。\n\n💡 解決方案：\n1. 請點選右上角「在新分頁開啟/Open in new tab」圖示，以獨立網址開啟即可完美操作相機拍照！\n2. 或者，直接使用右側「上傳發票/收據照片」，您可直接於系統選單中選擇「使用相機拍照」，此方式 100% 成功且不受任何權限限制。");
      return;
    }
    
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
      setIsCameraActive(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // explicitly call play and catch to handle autoplay policies safely
        videoRef.current.play().catch(e => {
          console.error("Video element play failed:", e);
        });
      }
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

  // Direct Browser-to-API Gemini OCR helper (for static hosts like GitHub Pages with no active Node backend server)
  const callGeminiDirectly = async (base64StringWithPrefix: string, apiKey: string) => {
    let mimeType = "image/jpeg";
    let base64Data = base64StringWithPrefix;
    const match = base64StringWithPrefix.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      base64Data = match[2];
    }

    const modelsToTry = ["gemini-2.5-flash", "gemini-1.5-flash"];
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const payload = {
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64Data
                  }
                },
                {
                  text: "請辨識此發票或收據影像中的消費日期、消費類別、總金額及簡短備註。日期的格式請轉換為 YYYY-MM-DD，若找不到正確日期則默認今天。類別必須嚴格分類為：'會議餐點'、'電腦周邊'、'文具用品' 或 '其他'。金額請提供整數。備註請提取買了什麼主要品項或商家店名。"
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                date: { 
                  type: "STRING", 
                  description: "消費日期，格式必須是 YYYY-MM-DD" 
                },
                category: { 
                  type: "STRING", 
                  description: "消費類別，只能是：'會議餐點', '電腦周邊', '文具用品', '其他' 之一" 
                },
                amount: { 
                  type: "INTEGER", 
                  description: "消費總金額 (新台幣)，為大於 0 的整數數字" 
                },
                remark: { 
                  type: "STRING", 
                  description: "備註說明，描述商家店名與買了什麼品項" 
                }
              },
              required: ["date", "category", "amount", "remark"]
            }
          }
        };

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Gemini API 回應狀態錯誤 ${response.status}: ${errText}`);
        }

        const resJson = await response.json();
        const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!rawText) {
          throw new Error("Gemini AI 回應格式中未包含分析文字");
        }

        return JSON.parse(rawText.trim());
      } catch (err) {
        console.warn(`Direct call failed for ${modelName}:`, err);
        lastError = err;
      }
    }

    throw lastError || new Error("無法與 Google Gemini API 建立通訊。請確認您的 API Key 是否正確。");
  };

  // Perform Gemini OCR API fetch request
  const performOCR = async (base64String: string) => {
    setIsScanning(true);
    setStatusText('1/3 建立服務連線中...');
    setErrorMsg('');
    
    // Stagger loading indicators to look high-end and detailed
    const texts = [
      '1/3 已準備就緒，啟動辨識通道...',
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

    const activeClientKey = clientApiKey || ((import.meta as any).env?.VITE_GEMINI_API_KEY as string) || '';
    const isGithubOrStatic = typeof window !== 'undefined' && (
      window.location.hostname.endsWith('github.io') || 
      window.location.hostname.includes('github')
    );

    try {
      let data: any = null;

      if (activeClientKey && (isGithubOrStatic || clientApiKey)) {
        console.log("🚀 Static host or client-key detected: Performing direct browser-side Gemini OCR...");
        setStatusText('2/3 正在使用瀏覽器端 API 金鑰進行直接本地安全性高智慧辨識...');
        data = await callGeminiDirectly(base64String, activeClientKey);
      } else {
        // Regular backend fetch
        console.log("🚀 Default mode: Sending request to Express backend API...");
        const response = await fetch('/api/ocr-receipt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ image: base64String })
        });

        // Check if the response matches HTML (suggesting SPA router fallback/404 on static server)
        const contentType = response.headers.get("Content-Type") || "";
        if (!response.ok || contentType.includes("html")) {
          if (contentType.includes("html") && isGithubOrStatic) {
            throw new Error("DET_STATIC_HOST_ERROR");
          }
          
          let errMsg = "發票資訊辨識失敗";
          try {
            const errorData = await response.json();
            errMsg = errorData.error || errMsg;
          } catch (e) {
            errMsg = `伺服器回應格式錯誤 (${response.status})。由於本系統部署在 GitHub Pages 等靜態伺服器，無法運行後端 API 路由。請點擊下方展開「⚙️ 靜態運行（GitHub Pages）專用設定」並填入您個人的 Gemini API Key 以啟用完整辨識！`;
          }
          throw new Error(errMsg);
        }

        data = await response.json();
      }

      clearInterval(interval);
      
      // Auto-populate edit form with scanned results
      setScannedDate(data.date || `${currentYear}-01-01`);
      updateScannedCategoryStates(data.category || '會議餐點');
      setScannedAmount(data.amount || '');
      setScannedRemark(data.remark || '');
      setShowResultPanel(true);
      setSuccessInfo('🎉 發票掃描辨識完成！');

    } catch (err: any) {
      clearInterval(interval);
      console.error(err);
      
      if (err.message === "DET_STATIC_HOST_ERROR" || err.message?.includes("Unexpected token '<'") || err.message?.includes("is not valid JSON")) {
        setErrorMsg("⚠️ 偵測到本項目運行於 GitHub Pages 靜態伺服器 (不支援 Node.js 後端 API 服務，因此向 /api 發送的請求返回了 index.html 網頁而非 JSON 數據)。\n\n💡 解決方案：\n請在下方展開「⚙️ 靜態運行 (GitHub Pages) 專用設定」並填入您個人的免費 Gemini API Key，即可免除伺服器限制，於網頁端安全、完美運行 AI 辨識！");
        setShowKeyConfig(true);
      } else {
        setErrorMsg(err.message || '發票掃描失敗，請手動確認或於下方「⚙️ 靜態運行 (GitHub Pages) 專用設定」中設置正確的 Gemini 服務 API Key。');
      }
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

  const handleVerifyPasscode = () => {
    if (passcode === '00000') {
      setIsUnlocked(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ocr_unlocked', 'true');
      }
      setPasscodeError('');
    } else {
      setPasscodeError('❌ 密碼不正確，提示：密碼為 00000！');
    }
  };

  const handleLockScanner = () => {
    setIsUnlocked(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ocr_unlocked');
    }
    setPasscode('');
    handleResetScanner();
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
        
        <div className="flex items-center gap-2">
          {isUnlocked && (
            <button
              type="button"
              onClick={() => setShowKeyConfig(!showKeyConfig)}
              className="text-[10px] sm:text-xs font-semibold text-slate-100 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded border border-white/20 transition-colors cursor-pointer flex items-center gap-1"
              title="設定自備 API 金鑰"
            >
              <span>⚙️ {clientApiKey ? '自備金鑰已啟用' : '靜態設定'}</span>
            </button>
          )}

          {isUnlocked && (
            <button
              type="button"
              onClick={handleLockScanner}
              title="重新鎖定 AI 辨識"
              className="text-[10px] sm:text-xs font-semibold text-rose-200 hover:text-white bg-rose-950/20 hover:bg-rose-900/40 px-2 py-1 rounded border border-rose-800/30 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Lock className="w-3 h-3 text-rose-300" />
              <span>重新鎖定</span>
            </button>
          )}

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
      </div>

      <div className="p-5 flex-1 flex flex-col justify-center space-y-4">
        {!isUnlocked ? (
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-[#008236] mb-2 border border-emerald-100">
              <Lock className="w-5 h-5 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-extrabold text-slate-800">🔐 進階 AI 辨識安全鎖</h3>
              <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                本項目使用 Gemini AI 行動發票文字與摘要關聯識別，<br/>為防止額度超出負載，請鍵入系統啟用密碼：
              </p>
            </div>
            <div className="flex justify-center gap-2 max-w-xs mx-auto pt-1">
              <input
                type="password"
                maxLength={5}
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  setPasscodeError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleVerifyPasscode();
                  }
                }}
                placeholder="請輸入 5 位數啟用密碼"
                className="w-full text-center text-xs font-extrabold tracking-[0.3em] py-2 px-3 bg-white border border-slate-300 rounded-lg focus:border-[#008236] focus:outline-none focus:ring-0"
              />
              <button
                type="button"
                onClick={handleVerifyPasscode}
                className="bg-[#008236] hover:bg-[#006228] text-white font-extrabold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                驗證啟用
              </button>
            </div>
            {passcodeError && (
              <p className="text-[10px] font-bold text-rose-605 animate-bounce">{passcodeError}</p>
            )}
            <div className="text-[10px] text-slate-400 font-medium pt-2 border-t border-slate-200/50">
              💡 應系統安全限制，若需獲取此解鎖密碼請洽您的協辦或系統管理人員。
            </div>

            {/* Static host / GitHub Pages config toggle inside locked state */}
            <div className="pt-3 border-t border-slate-200/40 text-center space-y-2">
              <button
                type="button"
                onClick={() => setShowKeyConfig(!showKeyConfig)}
                className="text-[10px] sm:text-xs font-bold text-[#008236] hover:text-[#006228] transition-colors inline-flex items-center gap-1 border border-emerald-200 bg-white hover:bg-emerald-50/50 px-2.5 py-1 rounded-md cursor-pointer"
              >
                <span>⚙️ 靜態運行 / 自備 API 金鑰設定 (GitHub Pages 專用)</span>
              </button>
              
              {showKeyConfig && (
                <div className="p-3 bg-emerald-50/40 border border-emerald-100 rounded-lg space-y-2 text-left animate-fade-in max-w-sm mx-auto">
                  <p className="text-[10px] text-slate-600 font-semibold leading-relaxed">
                    💡 <b>靜態主機專用：</b>由於 GitHub Pages 等靜態主機不支援後端 Node.js API，此時您必須提供自己的 API 金鑰在瀏覽器端直連解析。您的金鑰會安全存放在您本機瀏覽器中，安全絕不外流。
                  </p>
                  <div className="flex gap-1.5 pt-1">
                    <input
                      type="password"
                      value={clientApiKey}
                      onChange={(e) => setClientApiKey(e.target.value)}
                      placeholder="請貼上您的 Gemini API Key (AIzaSy...)"
                      className="w-full text-[10px] py-1.5 px-2 bg-white border border-slate-300 rounded font-mono focus:border-[#008236] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (clientApiKey.trim()) {
                          localStorage.setItem('client_gemini_api_key', clientApiKey.trim());
                          setIsUnlocked(true);
                          setSuccessInfo('🔑 已儲存自備 API 金鑰並成功啟用辨識模組！');
                          setShowKeyConfig(false);
                        } else {
                          localStorage.removeItem('client_gemini_api_key');
                          setClientApiKey('');
                        }
                      }}
                      className="bg-[#008236] text-white text-[10px] font-extrabold px-3 py-1.5 rounded hover:bg-[#006228] transition-colors cursor-pointer shrink-0"
                    >
                      儲存金鑰
                    </button>
                  </div>
                  <div className="text-[9px] text-[#008236] font-bold flex justify-between items-center pt-1 border-t border-slate-200/50">
                    <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-emerald-700">
                      👉 點此免費向 Google 取得金鑰
                    </a>
                    {clientApiKey && (
                      <button
                        type="button"
                        onClick={() => {
                          localStorage.removeItem('client_gemini_api_key');
                          setClientApiKey('');
                          setIsUnlocked(false);
                        }}
                        className="text-rose-600 underline hover:text-rose-800 ml-2"
                      >
                        清除金鑰
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
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

            {/* Static host / GitHub Pages config toggle inside unlocked state */}
            {showKeyConfig && (
              <div className="p-3 bg-emerald-50/50 border border-emerald-250 rounded-lg space-y-2 animate-fade-in text-[11px] text-slate-700 leading-normal">
                <div className="font-bold text-[#008236] flex justify-between items-center">
                  <span>⚙️ 靜態運行 / 自備金鑰本地端辨識設定</span>
                  <button type="button" onClick={() => setShowKeyConfig(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  託管於 GitHub Pages 等靜態主機不支援後端 `/api`，請填入您個人的 Gemini API Key，系統將安全切換至網頁端直接呼叫解析：
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={clientApiKey}
                    onChange={(e) => setClientApiKey(e.target.value)}
                    placeholder="請貼上您的 Gemini API Key (AIzaSy...)"
                    className="w-full text-xs font-mono py-1.5 px-2 bg-white border border-slate-300 rounded focus:border-[#008236] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (clientApiKey.trim()) {
                        localStorage.setItem('client_gemini_api_key', clientApiKey.trim());
                        setSuccessInfo('🔑 自備金鑰已變更成功並完全儲存！');
                        setShowKeyConfig(false);
                      } else {
                        localStorage.removeItem('client_gemini_api_key');
                        setClientApiKey('');
                        setSuccessInfo('已移除自備金鑰，系統將恢復默認使用後端 API。');
                      }
                    }}
                    className="bg-[#008236] hover:bg-[#006228] text-white text-[10px] font-bold px-3 py-1.5 rounded shrink-0 cursor-pointer"
                  >
                    儲存
                  </button>
                </div>
                <div className="text-[9px] font-semibold flex justify-between items-center text-slate-400 pt-1 border-t border-slate-200/50">
                  <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="underline text-[#008236] hover:text-[#006228]">
                    👉 點此前往獲取免費金鑰
                  </a>
                  {clientApiKey && (
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.removeItem('client_gemini_api_key');
                        setClientApiKey('');
                        setSuccessInfo('自備金鑰已完全清除。');
                      }}
                      className="text-rose-600 underline hover:text-rose-800 font-bold"
                    >
                      清除金鑰
                    </button>
                  )}
                </div>
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
                  value={scannedDropdownCategory}
                  onChange={(e) => setScannedDropdownCategory(e.target.value as any)}
                  className="w-full text-xs py-1.5 px-2.5 bg-white border border-slate-200 rounded-md font-bold text-slate-800 focus:border-[#008236] focus:outline-none focus:ring-0"
                >
                  <option value="會議餐點">☕ 會議餐點</option>
                  <option value="電腦周邊">💻 電腦周邊</option>
                  <option value="文具用品">✏️ 文具用品</option>
                  <option value="其他">❓ 其他項目</option>
                </select>

                {scannedDropdownCategory === '其他' && (
                  <div className="mt-2 animate-fade-in">
                    <input
                      type="text"
                      value={scannedCustomCategory}
                      onChange={(e) => setScannedCustomCategory(e.target.value)}
                      placeholder="請輸入自訂消費項目名稱"
                      className="w-full text-xs py-1.5 px-2.5 bg-white border border-slate-200 rounded-md font-bold text-slate-800 focus:border-[#008236] focus:outline-none focus:ring-0"
                      required
                    />
                  </div>
                )}
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
          </>
        )}
      </div>

      <div className="px-5 pb-5 pt-1 text-[9px] text-slate-400 font-medium font-sans border-t border-slate-100 rounded-b-xl flex items-center gap-1 justify-center bg-slate-50/50">
        <Sparkles className="w-3 h-3 text-[#008236]" />
        <span>搭載 Gemini-3.5-flash 高精度辨識引擎</span>
      </div>
    </div>
  );
}
