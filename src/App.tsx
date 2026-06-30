import { useState, useEffect } from 'react';
import { Person, ExpenseRecord, AttendeeDetail, ExpenseCategory } from './types';
import PersonSetting from './components/PersonSetting';
import VoiceInput from './components/VoiceInput';
import ReceiptScanner from './components/ReceiptScanner';
import ExpenseForm from './components/ExpenseForm';
import ExpenseTable from './components/ExpenseTable';
import AttendeeTable from './components/AttendeeTable';
import ExportSection from './components/ExportSection';
import ConfirmModal from './components/ConfirmModal';
import PdfExportModal from './components/PdfExportModal';
import { estimateAttendeeCount, drawAttendees } from './utils/attendeeReroll';
import { ShieldCheck, ServerCrash, Sparkles, Wand2, CalendarDays, Printer, DollarSign, LogIn, LogOut, Loader2, Camera, Mic } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { doc, getDoc, getDocs, setDoc, deleteDoc, collection } from 'firebase/firestore';

const SEED_PEOPLE_LIST: string[] = [
  '鍾睿元', '李宥霆', '吳妍萱', '張昱', '陳健驊',
  '吳永隆', '姚鍾太', '戴志宏', '王孝嘉', '王保仁',
  '葉建均', '黃政昱', '王仁哲', '王昱仁', '江玟儀',
  '李佩庭'
];

export default function App() {
  const [currentYear, setCurrentYear] = useState<string>(() => {
    return localStorage.getItem('tech_fund_current_year') || '2026';
  });

  const handleCurrentYearChange = (year: string) => {
    setCurrentYear(year);
    localStorage.setItem('tech_fund_current_year', year);
  };

  // Core States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isFirestoreOffline, setIsFirestoreOffline] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [details, setDetails] = useState<AttendeeDetail[]>([]);
  const [mealUnitCost, setMealUnitCost] = useState<number>(500);
  const [editTarget, setEditTarget] = useState<ExpenseRecord | null>(null);
  const [autoFillData, setAutoFillData] = useState<{ date: string; category: ExpenseCategory; amount: number | ''; remark: string } | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [inputMethod, setInputMethod] = useState<'voice' | 'camera'>('voice');
  
  // Filtering state
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // Custom confirmation and alert state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'danger' | 'warning' | 'info';
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: () => {},
  });

  // Helper inside component to get initial records & details
  const loadDefaultRecords = (): ExpenseRecord[] => {
    return [
      { id: 'seed-rec-1', date: '2024-11-15', category: '會議餐點', amount: 825, remark: '科內餐會(11/15)' },
      { id: 'seed-rec-2', date: '2024-11-17', category: '會議餐點', amount: 340, remark: '個別討論餐飲' },
      { id: 'seed-rec-3', date: '2024-11-19', category: '會議餐點', amount: 885, remark: '晨會早餐' },
      { id: 'seed-rec-4', date: '2024-11-20', category: '會議餐點', amount: 1380, remark: '科內會議餐點' },
      { id: 'seed-rec-5', date: '2024-11-22', category: '會議餐點', amount: 2697, remark: '教學演講茶點' },
      { id: 'seed-rec-6', date: '2024-11-25', category: '會議餐點', amount: 390, remark: '科內餐敘' },
      { id: 'seed-rec-7', date: '2024-11-25', category: '會議餐點', amount: 575, remark: '小組會議餐盒' },
      { id: 'seed-rec-8', date: '2024-11-28', category: '會議餐點', amount: 1207, remark: '臨床討論餐點' },
      { id: 'seed-rec-9', date: '2024-12-04', category: '會議餐點', amount: 2662, remark: '晨會教學便當' },
      { id: 'seed-rec-10', date: '2024-12-06', category: '會議餐點', amount: 2013, remark: '月底個案餐點' },
      { id: 'seed-rec-11', date: '2024-12-09', category: '會議餐點', amount: 1978, remark: '醫療品質餐會' },
      { id: 'seed-rec-12', date: '2024-12-11', category: '會議餐點', amount: 747, remark: '教學活動點心' }
    ];
  };

  const loadDefaultDetails = (seedRecs: ExpenseRecord[], peoplePool: Person[], costBase: number): AttendeeDetail[] => {
    return seedRecs.map((r) => {
      const count = estimateAttendeeCount(r.category, r.amount, costBase);
      const drawn = drawAttendees(peoplePool, count);
      return {
        id: r.id,
        date: r.date,
        category: r.category,
        amount: r.amount,
        attendees: drawn,
        count: drawn.length,
        average: drawn.length > 0 ? Math.round(r.amount / drawn.length) : 0,
      };
    });
  };

  // Load state on mount and subscribe to Firebase Auth
  useEffect(() => {
    const loadUserDataFromFirestore = async (uid: string) => {
      try {
        // 1. Settings
        const settingsSnap = await getDoc(doc(db, 'users', uid, 'settings', 'general'));
        let fetchedCost = 500;
        if (settingsSnap.exists()) {
          fetchedCost = settingsSnap.data().mealUnitCost || 500;
          setMealUnitCost(fetchedCost);
        }

        // 2. People
        const peopleSnap = await getDocs(collection(db, 'users', uid, 'people'));
        const fetchedPeople: Person[] = [];
        peopleSnap.forEach((doc) => {
          fetchedPeople.push(doc.data() as Person);
        });

        // 3. Records
        const recordsSnap = await getDocs(collection(db, 'users', uid, 'records'));
        const fetchedRecords: ExpenseRecord[] = [];
        recordsSnap.forEach((doc) => {
          fetchedRecords.push(doc.data() as ExpenseRecord);
        });

        // 4. Details
        const detailsSnap = await getDocs(collection(db, 'users', uid, 'details'));
        const fetchedDetails: AttendeeDetail[] = [];
        detailsSnap.forEach((doc) => {
          fetchedDetails.push(doc.data() as AttendeeDetail);
        });

        // If firestore contains absolutely no user data, upload current localStorage data (if any) to cloud
        if (fetchedRecords.length === 0 && fetchedPeople.length === 0) {
          console.log('New Firebase user detected. Syncing existing local state to Cloud database...');
          
          const localPeople = localStorage.getItem('tech_fund_people_v2');
          const curPeople = localPeople ? JSON.parse(localPeople) : loadDefaultPeople();
          const localCost = localStorage.getItem('tech_fund_meal_cost');
          const curCost = localCost ? parseInt(localCost, 10) : 500;
          const localRecords = localStorage.getItem('tech_fund_records_v2');
          const curRecs = localRecords ? JSON.parse(localRecords) : loadDefaultRecords();
          const localDetails = localStorage.getItem('tech_fund_details_v2');
          const curDetails = localDetails ? JSON.parse(localDetails) : loadDefaultDetails(curRecs, curPeople, curCost);

          setPeople(curPeople);
          setMealUnitCost(curCost);
          setRecords(curRecs);
          setDetails(curDetails);

          // Write settings
          await setDoc(doc(db, 'users', uid, 'settings', 'general'), { mealUnitCost: curCost });
          // Write members
          for (const p of curPeople) {
            await setDoc(doc(db, 'users', uid, 'people', p.id), p);
          }
          // Write records
          for (const r of curRecs) {
            await setDoc(doc(db, 'users', uid, 'records', r.id), r);
          }
          // Write Details
          for (const d of curDetails) {
            await setDoc(doc(db, 'users', uid, 'details', d.id), d);
          }
        } else {
          // Returning cloud user -> set our UI states with pristine cloud data
          console.log('Existing Firebase user. Overwriting local cache with cloud data...');
          if (fetchedPeople.length > 0) {
            setPeople(fetchedPeople);
            localStorage.setItem('tech_fund_people_v2', JSON.stringify(fetchedPeople));
          }
          if (fetchedRecords.length > 0) {
            setRecords(fetchedRecords);
            localStorage.setItem('tech_fund_records_v2', JSON.stringify(fetchedRecords));
          }
          setDetails(fetchedDetails);
          localStorage.setItem('tech_fund_details_v2', JSON.stringify(fetchedDetails));
          localStorage.setItem('tech_fund_meal_cost', String(fetchedCost));
        }
        setIsFirestoreOffline(false);
      } catch (error) {
        console.warn('Firestore load failed (offline or network policy). Falling back to local offline backup:', error);
        setIsFirestoreOffline(true);

        // Offline mode fallback to standard localStorage settings
        const localPeople = localStorage.getItem('tech_fund_people_v2');
        let loadedPeople: Person[] = [];
        if (localPeople) {
          try {
            loadedPeople = JSON.parse(localPeople);
            setPeople(loadedPeople);
          } catch (e) {
            loadedPeople = loadDefaultPeople();
            setPeople(loadedPeople);
          }
        } else {
          loadedPeople = loadDefaultPeople();
          setPeople(loadedPeople);
        }

        let currentMealCost = 500;
        const localCost = localStorage.getItem('tech_fund_meal_cost');
        if (localCost) {
          currentMealCost = parseInt(localCost, 10);
          setMealUnitCost(currentMealCost);
        }

        const localRecords = localStorage.getItem('tech_fund_records_v2');
        const localDetails = localStorage.getItem('tech_fund_details_v2');

        if (localRecords && localDetails) {
          try {
            setRecords(JSON.parse(localRecords));
            setDetails(JSON.parse(localDetails));
          } catch (e) {
            const seedRecs = loadDefaultRecords();
            const seedDetails = loadDefaultDetails(seedRecs, loadedPeople, currentMealCost);
            setRecords(seedRecs);
            setDetails(seedDetails);
          }
        } else {
          const seedRecs = loadDefaultRecords();
          const seedDetails = loadDefaultDetails(seedRecs, loadedPeople, currentMealCost);
          setRecords(seedRecs);
          setDetails(seedDetails);
        }
      }
    };

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthLoading(true);
      setCurrentUser(user);
      if (user) {
        await loadUserDataFromFirestore(user.uid);
      } else {
        // Guest mode (restore / build from localStorage cache)
        const localPeople = localStorage.getItem('tech_fund_people_v2');
        let loadedPeople: Person[] = [];
        if (localPeople) {
          try {
            loadedPeople = JSON.parse(localPeople);
            setPeople(loadedPeople);
          } catch (e) {
            loadedPeople = loadDefaultPeople();
            setPeople(loadedPeople);
          }
        } else {
          loadedPeople = loadDefaultPeople();
          setPeople(loadedPeople);
        }

        let currentMealCost = 500;
        const localCost = localStorage.getItem('tech_fund_meal_cost');
        if (localCost) {
          currentMealCost = parseInt(localCost, 10);
          setMealUnitCost(currentMealCost);
        }

        const localRecords = localStorage.getItem('tech_fund_records_v2');
        const localDetails = localStorage.getItem('tech_fund_details_v2');

        if (localRecords && localDetails) {
          try {
            setRecords(JSON.parse(localRecords));
            setDetails(JSON.parse(localDetails));
          } catch (e) {
            const seedRecs = loadDefaultRecords();
            const seedDetails = loadDefaultDetails(seedRecs, loadedPeople, currentMealCost);
            setRecords(seedRecs);
            setDetails(seedDetails);
          }
        } else {
          const seedRecs = loadDefaultRecords();
          const seedDetails = loadDefaultDetails(seedRecs, loadedPeople, currentMealCost);
          setRecords(seedRecs);
          setDetails(seedDetails);
        }
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Auto-reconcile details whenever records or people pool updates
  useEffect(() => {
    if (records.length === 0 || people.length === 0) return;

    const missingRecords = records.filter(
      (r) => !details.some((d) => d.id === r.id)
    );

    if (missingRecords.length > 0) {
      const newDetails = [...details];
      missingRecords.forEach((r) => {
        const count = estimateAttendeeCount(r.category, r.amount, mealUnitCost);
        const drawn = drawAttendees(people, count);
        newDetails.push({
          id: r.id,
          date: r.date,
          category: r.category,
          amount: r.amount,
          attendees: drawn,
          count: drawn.length,
          average: drawn.length > 0 ? Math.round(r.amount / drawn.length) : 0,
        });
      });

      setDetails(newDetails);
      localStorage.setItem('tech_fund_details_v2', JSON.stringify(newDetails));

      if (currentUser) {
        missingRecords.forEach(async (r) => {
          const detailItem = newDetails.find((d) => d.id === r.id);
          if (detailItem) {
            try {
              await setDoc(doc(db, 'users', currentUser.uid, 'details', r.id), detailItem);
            } catch (error) {
              console.error('Failed to sync reconciled detail:', error);
            }
          }
        });
      }
    }
  }, [records, people, mealUnitCost, currentUser, details]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error('Google login failed:', e);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Logout failed:', e);
    }
  };

  // Helper to load seed-list defaults
  const loadDefaultPeople = (): Person[] => {
    return SEED_PEOPLE_LIST.map((name, idx) => ({
      id: `seed-${idx}`,
      name,
      isActive: idx < 12, // default 12 checked active
      isRequired: name === '鍾睿元', // default 鍾睿元 MUST be included
    }));
  };

  // LocalStorage Persister
  const savePeople = async (updatedPeople: Person[]) => {
    setPeople(updatedPeople);
    localStorage.setItem('tech_fund_people_v2', JSON.stringify(updatedPeople));

    if (currentUser && !isFirestoreOffline) {
      try {
        for (const p of updatedPeople) {
          await setDoc(doc(db, 'users', currentUser.uid, 'people', p.id), p);
        }
      } catch (error) {
        console.warn('Failed to sync people to Firestore (offline or sandbox):', error);
      }
    }
  };

  const handleResetToDefaultPeople = () => {
    setConfirmModal({
      isOpen: true,
      title: '重設人員名單',
      message: '確定要將人員名單重設回預設 of 16 位成員嗎？(這將替換您當前的自訂成員與狀態設定)',
      type: 'warning',
      confirmText: '確定重設',
      cancelText: '取消',
      onConfirm: () => {
        const defs = loadDefaultPeople();
        savePeople(defs);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleMealUnitCostChange = async (val: number) => {
    setMealUnitCost(val);
    localStorage.setItem('tech_fund_meal_cost', String(val));

    if (currentUser && !isFirestoreOffline) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'settings', 'general'), { mealUnitCost: val });
      } catch (error) {
        console.warn('Failed to sync settings to Firestore:', error);
      }
    }
  };

  // Actions: Add New Consumption Record
  const handleAddRecord = async (recordData: Omit<ExpenseRecord, 'id'>, customAttendeeCount?: number) => {
    const newId = `rec-${Date.now()}`;
    const newRecord: ExpenseRecord = {
      id: newId,
      ...recordData,
    };

    // Calculate attendee parameters for Table 2
    const targetCount = customAttendeeCount !== undefined
      ? customAttendeeCount
      : estimateAttendeeCount(
          recordData.category,
          recordData.amount,
          mealUnitCost
        );

    // Draw non-repetitive people
    const drawn = drawAttendees(people, targetCount, (warningMsg) => {
      console.warn(warningMsg);
    });

    const newAttendeeDetail: AttendeeDetail = {
      id: newId,
      date: recordData.date,
      category: recordData.category,
      amount: recordData.amount,
      attendees: drawn,
      count: drawn.length,
      average: drawn.length > 0 ? Math.round(recordData.amount / drawn.length) : 0,
    };

    // Update States & Persist
    const updatedRecords = [...records, newRecord];
    const updatedDetails = [...details, newAttendeeDetail];

    setRecords(updatedRecords);
    setDetails(updatedDetails);

    localStorage.setItem('tech_fund_records_v2', JSON.stringify(updatedRecords));
    localStorage.setItem('tech_fund_details_v2', JSON.stringify(updatedDetails));

    if (currentUser && !isFirestoreOffline) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'records', newRecord.id), newRecord);
        await setDoc(doc(db, 'users', currentUser.uid, 'details', newAttendeeDetail.id), newAttendeeDetail);
      } catch (error) {
        console.warn('Failed to sync new record to Firestore:', error);
      }
    }
  };

  // Actions: Choose record to edit
  const handleSelectEditTarget = (record: ExpenseRecord) => {
    setEditTarget(record);
    // Scroll window to form inputs
    const formElement = document.getElementById('expense-form-card');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Actions: Save edited Consumption Record
  const handleUpdateRecord = async (id: string, updatedFields: Omit<ExpenseRecord, 'id'>, customAttendeeCount?: number) => {
    // 1. Update basic record in Table 1
    const updatedRecords = records.map((r) =>
      r.id === id ? { ...r, ...updatedFields } : r
    );
    setRecords(updatedRecords);
    localStorage.setItem('tech_fund_records_v2', JSON.stringify(updatedRecords));

    // 2. Adjust Table 2 according to edits
    // If category or amount changed, or a customAttendeeCount is specified, redraw to keep it mathematically valid!
    let updatedDetail: AttendeeDetail | null = null;
    const updatedDetails = details.map((d) => {
      if (d.id === id) {
        // Did the category, amount, or customAttendeeCount change?
        const isModified = d.category !== updatedFields.category || d.amount !== updatedFields.amount || customAttendeeCount !== undefined;
        if (isModified) {
          const nextCount = customAttendeeCount !== undefined
            ? customAttendeeCount
            : estimateAttendeeCount(
                updatedFields.category,
                updatedFields.amount,
                mealUnitCost
              );
          const drawn = drawAttendees(people, nextCount);
          const res = {
            id,
            date: updatedFields.date,
            category: updatedFields.category,
            amount: updatedFields.amount,
            attendees: drawn,
            count: drawn.length,
            average: drawn.length > 0 ? Math.round(updatedFields.amount / drawn.length) : 0,
          };
          updatedDetail = res;
          return res;
        } else {
          // Just date or remark changed
          const res = {
            ...d,
            date: updatedFields.date,
          };
          updatedDetail = res as AttendeeDetail;
          return res;
        }
      }
      return d;
    });

    setDetails(updatedDetails);
    localStorage.setItem('tech_fund_details_v2', JSON.stringify(updatedDetails));

    const updatedRecord = updatedRecords.find(r => r.id === id);

    if (currentUser && updatedRecord && updatedDetail && !isFirestoreOffline) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'records', id), updatedRecord);
        await setDoc(doc(db, 'users', currentUser.uid, 'details', id), updatedDetail);
      } catch (error) {
        console.warn('Failed to sync updated record to Firestore:', error);
      }
    }

    // Exit edit mode
    setEditTarget(null);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditTarget(null);
  };

  // Actions: Delete single record from BOTH Table 1 and Table 2 (Consolidated logic)
  const handleDeleteRecord = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: '刪除消費紀錄',
      message: '確定要永久刪除此筆消費紀錄嗎？其對應的人員抽選名單也將一併移除且無法復原。',
      type: 'danger',
      confirmText: '確認刪除',
      cancelText: '取消',
      onConfirm: async () => {
        const remainingRecords = records.filter((r) => r.id !== id);
        const remainingDetails = details.filter((d) => d.id !== id);

        setRecords(remainingRecords);
        setDetails(remainingDetails);

        localStorage.setItem('tech_fund_records_v2', JSON.stringify(remainingRecords));
        localStorage.setItem('tech_fund_details_v2', JSON.stringify(remainingDetails));

        if (currentUser && !isFirestoreOffline) {
          try {
            await deleteDoc(doc(db, 'users', currentUser.uid, 'records', id));
            await deleteDoc(doc(db, 'users', currentUser.uid, 'details', id));
          } catch (error) {
            console.warn('Failed to delete record from Firestore:', error);
          }
        }

        // Reset edit target if deleted row is active target
        if (editTarget?.id === id) {
          setEditTarget(null);
        }
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Actions: Reroll participants for a specific row in Table 2
  const handleRerollRow = async (id: string, customCount?: number) => {
    // Find target record in Table 1
    const targetRecord = records.find((r) => r.id === id);
    if (!targetRecord) return;

    // Use either the custom given count or calculate from default rules
    const finalCount = customCount !== undefined && customCount > 0
      ? customCount
      : estimateAttendeeCount(targetRecord.category, targetRecord.amount, mealUnitCost);

    const drawn = drawAttendees(people, finalCount, (warningMsg) => {
      setConfirmModal({
        isOpen: true,
        title: '抽選提示訊息',
        message: warningMsg,
        type: 'info',
        confirmText: '確定',
        cancelText: '',
        onConfirm: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
      });
    });

    let updatedDetail: AttendeeDetail | null = null;
    let found = false;
    let updatedDetails = details.map((d) => {
      if (d.id === id) {
        found = true;
        const res = {
          ...d,
          attendees: drawn,
          count: drawn.length,
          average: drawn.length > 0 ? Math.round(d.amount / drawn.length) : 0,
        };
        updatedDetail = res;
        return res;
      }
      return d;
    });

    if (!found) {
      const newD: AttendeeDetail = {
        id,
        date: targetRecord.date,
        category: targetRecord.category,
        amount: targetRecord.amount,
        attendees: drawn,
        count: drawn.length,
        average: drawn.length > 0 ? Math.round(targetRecord.amount / drawn.length) : 0,
      };
      updatedDetails = [...updatedDetails, newD];
      updatedDetail = newD;
    }

    setDetails(updatedDetails);
    localStorage.setItem('tech_fund_details_v2', JSON.stringify(updatedDetails));

    if (currentUser && updatedDetail && !isFirestoreOffline) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'details', id), updatedDetail);
      } catch (error) {
        console.warn('Failed to update rerolled details in Firestore:', error);
      }
    }
  };

  // Actions: Manually add/remove single attendee names from a row card
  const handleUpdateRowAttendees = async (id: string, updatedAttendees: string[]) => {
    const targetRow = details.find((d) => d.id === id);
    if (!targetRow) return;

    let updatedDetail: AttendeeDetail | null = null;
    const nextDetails = details.map((d) => {
      if (d.id === id) {
        const res = {
          ...d,
          attendees: updatedAttendees,
          count: updatedAttendees.length,
          average: updatedAttendees.length > 0 ? Math.round(d.amount / updatedAttendees.length) : 0,
        };
        updatedDetail = res;
        return res;
      }
      return d;
    });

    setDetails(nextDetails);
    localStorage.setItem('tech_fund_details_v2', JSON.stringify(nextDetails));

    if (currentUser && updatedDetail && !isFirestoreOffline) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'details', id), updatedDetail);
      } catch (error) {
        console.warn('Failed to update attendees in Firestore:', error);
      }
    }
  };

  // Actions: Full JSON Database state import
  const handleImportState = async (importedRecords: ExpenseRecord[], importedDetails: AttendeeDetail[]) => {
    setRecords(importedRecords);
    setDetails(importedDetails);

    localStorage.setItem('tech_fund_records_v2', JSON.stringify(importedRecords));
    localStorage.setItem('tech_fund_details_v2', JSON.stringify(importedDetails));
    setEditTarget(null);

    if (currentUser && !isFirestoreOffline) {
      try {
        for (const r of importedRecords) {
          await setDoc(doc(db, 'users', currentUser.uid, 'records', r.id), r);
        }
        for (const d of importedDetails) {
          await setDoc(doc(db, 'users', currentUser.uid, 'details', d.id), d);
        }
      } catch (error) {
        console.warn('Failed to sync imported database to Firestore:', error);
      }
    }
  };

  const MONTH_LABELS: Record<string, string> = {
    all: '全部',
    '1': '1月',
    '2': '2月',
    '3': '3月',
    '4': '4月',
    '5': '5月',
    '6': '6月',
    '7': '7月',
    '8': '8月',
    '9': '9月',
    '10': '10月',
    '11': '11月',
    '12': '12月'
  };

  const filteredRecords = records.filter((r) => {
    if (selectedMonth === 'all') return true;
    const parts = r.date.split('-');
    if (parts.length >= 2) {
      const m = parseInt(parts[1], 10);
      return m === parseInt(selectedMonth, 10);
    }
    return false;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const filteredDetails = details.filter((d) => {
    if (selectedMonth === 'all') return true;
    const parts = d.date.split('-');
    if (parts.length >= 2) {
      const m = parseInt(parts[1], 10);
      return m === parseInt(selectedMonth, 10);
    }
    return false;
  }).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-emerald-100 selection:text-emerald-950 flex flex-col justify-between">
      <div>
        {/* Header Panel */}
        <header className="min-h-14 border-b bg-white border-slate-200 flex flex-col md:flex-row items-center justify-between px-4 sm:px-6 py-2.5 md:py-0 shadow-sm sticky top-0 z-50 gap-2.5">
          <div className="flex items-center justify-between w-full md:w-auto gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-[#008236] rounded-md flex items-center justify-center shadow-sm shrink-0">
                <DollarSign className="w-5 h-5 text-white" strokeWidth={3} />
              </div>
              <div>
                <h1 className="text-sm md:text-base font-bold tracking-tight text-slate-950 flex items-center gap-1.5 flex-wrap">
                  <span className="whitespace-nowrap">數位輔助科基金管理平台</span>
                  <span className="text-slate-400 font-normal text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded">v2.5</span>
                </h1>
              </div>
            </div>

            {/* Mobile-only avatar and logout to save horizontal space */}
            <div className="flex md:hidden items-center gap-1.5">
              {authLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#008236]" />
              ) : currentUser ? (
                <div className="flex items-center gap-1.5">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || ''}
                      referrerPolicy="no-referrer"
                      className="w-6 h-6 rounded-full border border-slate-200"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#008236] text-white flex items-center justify-center text-[10px] font-bold">
                      {currentUser.displayName ? currentUser.displayName[0] : 'U'}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                    title="登出雲端管理器"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleLogin}
                  className="p-1 text-slate-500 hover:text-[#008236] transition-colors"
                  title="登入同步"
                >
                  <LogIn className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
            {/* Desktop-only auth display */}
            <div className="hidden md:flex items-center gap-2">
              {authLoading ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#008236]" />
                  <span>同步中...</span>
                </span>
              ) : currentUser ? (
                <div className="flex items-center gap-2 pr-2.5 border-r border-slate-200">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || ''}
                      referrerPolicy="no-referrer"
                      className="w-6 h-6 rounded-full border border-slate-200"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#008236] text-white flex items-center justify-center text-[10px] font-bold">
                      {currentUser.displayName ? currentUser.displayName[0] : 'U'}
                    </div>
                  )}
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] font-bold text-slate-800 leading-tight">
                      {currentUser.displayName || '使用者'}
                    </span>
                    {isFirestoreOffline ? (
                      <span className="text-[8px] text-amber-600 font-semibold flex items-center gap-0.5 leading-none mt-0.5 animate-pulse" title="目前與 Firestore 伺服器連線中斷，已自動切換至本地快取安全備份模式，功能皆可正常運作">
                        ▲ 離線備份模式
                      </span>
                    ) : (
                      <span className="text-[8px] text-[#008236] font-semibold flex items-center gap-0.5 leading-none mt-0.5">
                        ● 雲端已同步
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="text-slate-400 hover:text-rose-600 transition-colors p-1 ml-1"
                    title="登出雲端管理器"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleLogin}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs cursor-pointer transition-colors"
                  title="登入 Google 雲端儲存，資料不丟失"
                >
                  <LogIn className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">登入同步</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
              <button
                type="button"
                onClick={() => setIsPdfModalOpen(true)}
                className="bg-[#008236] hover:bg-[#006a2c] text-white font-bold h-8 px-2.5 sm:px-3 rounded text-xs select-none cursor-pointer flex items-center gap-1.5 transition-all shadow-sm shadow-[#008236]/30 border border-[#006a2c] flex-1 md:flex-initial justify-center whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-250 animate-pulse shrink-0" />
                <span>匯出申報 PDF</span>
              </button>
              
              <span className="inline-flex items-center gap-1 h-8 px-2.5 bg-slate-100 rounded text-xs font-semibold text-slate-600 border border-slate-200 flex-1 md:flex-initial justify-center whitespace-nowrap">
                <CalendarDays className="w-3.5 h-3.5 text-[#008236] mr-0.5 shrink-0" />
                <span>報銷年度：</span>
                <select
                  value={currentYear}
                  onChange={(e) => handleCurrentYearChange(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer border-none p-0 pr-1 text-xs focus:ring-0 focus:outline-none"
                >
                  <option value="2026">2026 年</option>
                  <option value="2025">2025 年</option>
                </select>
              </span>
            </div>
          </div>
        </header>

        {/* Main Container / Dashboard columns */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          
          {/* Top Segment: Input Form, Voice Engine, and Receipt Scanner */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3 flex flex-col">
              {/* Input Method Navigation Toggle */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold self-start select-none w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setInputMethod('voice')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    inputMethod === 'voice'
                      ? 'bg-[#008236] text-white shadow-xs'
                      : 'text-slate-600 hover:text-[#008236]'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>語音語意辨識導入</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputMethod('camera')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-[#008236] rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    inputMethod === 'camera'
                      ? 'bg-[#008236] text-white shadow-xs'
                      : 'text-slate-600 hover:text-[#008236]'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>相機發票掃描 (AI OCR)</span>
                </button>
              </div>

              <div className="flex-1">
                {inputMethod === 'voice' ? (
                  <VoiceInput 
                    onAddRecord={handleAddRecord} 
                    currentYear={currentYear} 
                    onAutoFillForm={(data) => setAutoFillData(data)} 
                  />
                ) : (
                  <ReceiptScanner
                    onAddRecord={handleAddRecord}
                    onAutoFillForm={(data) => setAutoFillData(data)}
                    currentYear={currentYear}
                  />
                )}
              </div>
            </div>

            <ExpenseForm
              onAddRecord={handleAddRecord}
              onUpdateRecord={handleUpdateRecord}
              editTarget={editTarget}
              onCancelEdit={handleCancelEdit}
              currentYear={currentYear}
              autoFillData={autoFillData}
              onClearAutoFill={() => setAutoFillData(null)}
              people={people}
              details={details}
              mealUnitCost={mealUnitCost}
            />
          </div>

          {/* Middle Segment: Two main tables with Monthly Query Selector */}
          <section id="reconciliation-records-area" className="space-y-6">
            {/* Month Filter Bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-[#008236]" />
                  <span className="font-bold text-slate-950 text-sm md:text-base">報銷月份快速查詢</span>
                  <span className="hidden leading-none md:inline text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-mono font-medium">篩選工具</span>
                </div>
                <div className="text-xs text-slate-600 font-semibold">
                  當前查核月份：<span className="text-[#008236] font-bold bg-[#008236]/5 px-2 py-0.5 rounded-sm border border-[#008236]/15">{MONTH_LABELS[selectedMonth]}</span> (共 {filteredRecords.length} 筆項目)
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1 overflow-x-auto scrollbar-none">
                {Object.keys(MONTH_LABELS).map((m) => {
                  const isActive = selectedMonth === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSelectedMonth(m)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all select-none cursor-pointer border ${
                        isActive
                          ? 'bg-[#008236] border-[#005a24] text-white shadow-xs shadow-[#008236]/20 font-extrabold'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-350 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      {MONTH_LABELS[m]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Table 1: Expense Register */}
            <ExpenseTable
              records={filteredRecords}
              onEdit={handleSelectEditTarget}
              onDelete={handleDeleteRecord}
              onGenerateAttendees={(record) => handleRerollRow(record.id)}
            />

            {/* Table 2: Attendee Allocation Sheet */}
            <AttendeeTable
              details={filteredDetails}
              candidates={people}
              onRerollRow={handleRerollRow}
              onUpdateRowAttendees={handleUpdateRowAttendees}
              mealUnitCost={mealUnitCost}
              onMealUnitCostChange={handleMealUnitCostChange}
            />

            {/* Personnel List Config Panel moved below Table 2 */}
            <PersonSetting
              people={people}
              onChange={savePeople}
              onResetToDefault={handleResetToDefaultPeople}
            />
          </section>

          {/* Bottom Segment: Import/Export Operations */}
          <ExportSection
            records={records}
            details={details}
            onImportData={handleImportState}
            people={people}
            mealUnitCost={mealUnitCost}
            onOpenPdfPreview={() => setIsPdfModalOpen(true)}
          />
        </main>
      </div>

      {/* Styled Footer matching Geometric Balance exactly */}
      <footer className="h-8 px-6 bg-slate-900 border-t border-slate-800 text-slate-400 flex items-center justify-between text-[10px] uppercase tracking-widest mt-12 w-full">
        <span>powered by byabrian 2026 copyrights resevered</span>
        <span className="font-mono">Data Year: {currentYear} | Active Members: {people.filter(p => p.isActive).length}</span>
      </footer>

      {/* Custom Confirmation Dialog */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Interactive PDF Export Preview */}
      <PdfExportModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        records={records}
        details={details}
        currentYear={currentYear}
      />
    </div>
  );
}
