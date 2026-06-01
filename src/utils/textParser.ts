/**
 * Utility for parsing text/speech into structured expense fields.
 * Handles dates, numeric conversions (Chinese and Arabic), and categories.
 */

import { ExpenseCategory } from '../types';

const CHINESE_DIGITS: Record<string, number> = {
  '零': 0, '一': 1, '二': 2, '兩': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9
};

const CHINESE_UNITS: Record<string, number> = {
  '十': 10,
  '百': 100,
  '千': 1000,
  '萬': 10000
};

/**
 * Converts a Chinese numeral string to an Arabic number.
 * Supports patterns like "三千", "五百", "一萬二" (12000), "三千五" (3500), "3千" (3000), "3000".
 */
export function convertChineseToNumber(str: string): number {
  str = str.trim();
  if (!str) return 0;

  // If it's purely Arabic numbers, parse it directly
  if (/^\d+$/.test(str)) {
    return parseInt(str, 10);
  }

  // Handle mixed cases such as "3千" or "1萬2"
  let sanitized = str;
  // Replace digit + unit (e.g., "3千" -> "三千") to standardize, or simply multiply
  // Let's parse with a custom state machine!
  let total = 0;
  let tempVal = 0;
  let hasUnit = false;

  // Check for the "一萬二" or "三千五" shorthand where the last unit is omitted but implied
  // "一萬二" should mean 12000 (10000 + 2000)
  // "三千五" should mean 3500 (3000 + 500)
  // "一百五" should mean 150 (100 + 50)
  // "十五" should mean 15 (10 + 5)
  
  // Let's break down the string into segments by "萬"
  if (str.includes('萬')) {
    const parts = str.split('萬');
    const wanPart = parts[0] ? convertChineseToNumber(parts[0]) : 1;
    let restPartStr = parts[1] || '';
    let restPart = 0;
    if (restPartStr) {
      // Shorthand rule: if restPartStr is a single digit (e.g. "二" in "一萬二"), its unit is Wan / 10 = 千 (1000)
      if (restPartStr.length === 1 && CHINESE_DIGITS[restPartStr[0]] !== undefined) {
        restPart = CHINESE_DIGITS[restPartStr[0]] * 1000;
      } else {
        restPart = convertChineseToNumber(restPartStr);
      }
    }
    return wanPart * 10000 + restPart;
  }

  // Break down by "千"
  if (str.includes('千')) {
    const parts = str.split('千');
    const qianPart = parts[0] ? convertChineseToNumber(parts[0]) : 1;
    let restPartStr = parts[1] || '';
    let restPart = 0;
    if (restPartStr) {
      if (restPartStr.length === 1 && CHINESE_DIGITS[restPartStr[0]] !== undefined) {
        restPart = CHINESE_DIGITS[restPartStr[0]] * 100;
      } else {
        restPart = convertChineseToNumber(restPartStr);
      }
    }
    return qianPart * 1000 + restPart;
  }

  // Break down by "百"
  if (str.includes('百')) {
    const parts = str.split('百');
    const baiPart = parts[0] ? convertChineseToNumber(parts[0]) : 1;
    let restPartStr = parts[1] || '';
    let restPart = 0;
    if (restPartStr) {
      if (restPartStr.length === 1 && CHINESE_DIGITS[restPartStr[0]] !== undefined) {
        restPart = CHINESE_DIGITS[restPartStr[0]] * 10;
      } else {
        restPart = convertChineseToNumber(restPartStr);
      }
    }
    return baiPart * 100 + restPart;
  }

  // Break down by "十"
  if (str.includes('十')) {
    const parts = str.split('十');
    // "十" prefix shorthand: "十五" -> tenPart = 1, rest = 5
    const tenPart = parts[0] ? convertChineseToNumber(parts[0]) : 1;
    const restPart = parts[1] ? convertChineseToNumber(parts[1]) : 0;
    return tenPart * 10 + restPart;
  }

  // Pure digits without units (like "二五" -> 25, or single "五" -> 5)
  let numVal = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (CHINESE_DIGITS[ch] !== undefined) {
      if (str.length > 1) {
        // e.g. "三五" = 35 or "一二" = 12
        numVal = numVal * 10 + CHINESE_DIGITS[ch];
      } else {
        numVal = CHINESE_DIGITS[ch];
      }
    } else if (/\d/.test(ch)) {
      numVal = numVal * 10 + parseInt(ch, 10);
    }
  }

  return numVal;
}

/**
 * Parses full speech transcription.
 * Target: "5月31號消費3000元，會議餐點" or "五月三十一日，會議餐點，三千元"
 */
export function parseSpeechText(text: string, currentYear: string = '2026'): {
  date: string;
  amount: number | null;
  category: ExpenseCategory | null;
  remark: string;
} {
  // 1. Parse Date
  let dateStr = '';
  const today = new Date();
  const yearStr = currentYear || String(today.getFullYear());
  
  // Try to find month/day formats: 5月31號, 五月三十一日, 5/31
  // Pattern A: (xx)月(xx)[日號]
  const dateRegex = /([0-9一二三四五六七八九十]+)\s*月\s*([0-9一二三四五六七八九十百]+)\s*[日號熱]?/i;
  const matchDate = text.match(dateRegex);

  // Pattern B: MM/DD or YYYY/MM/DD
  const slashRegex = /(\d{4})?[/\-.](\d{1,2})[/\-.](\d{1,2})/;
  const matchSlashShort = text.match(/[/\-.s](\d{1,2})[/\-.](\d{1,2})/);
  
  if (matchDate) {
    const monthNum = convertChineseToNumber(matchDate[1]);
    const dayNum = convertChineseToNumber(matchDate[2]);
    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      const mm = String(monthNum).padStart(2, '0');
      const dd = String(dayNum).padStart(2, '0');
      dateStr = `${yearStr}-${mm}-${dd}`;
    }
  } else if (text.match(slashRegex)) {
    const match = text.match(slashRegex)!;
    const y = match[1] || yearStr;
    const m = String(parseInt(match[2], 10)).padStart(2, '0');
    const d = String(parseInt(match[3], 10)).padStart(2, '0');
    dateStr = `${y}-${m}-${d}`;
  } else if (matchSlashShort) {
    const m = String(parseInt(matchSlashShort[1], 10)).padStart(2, '0');
    const d = String(parseInt(matchSlashShort[2], 10)).padStart(2, '0');
    dateStr = `${yearStr}-${m}-${d}`;
  } else {
    // Default to current date YYYY-MM-DD
    const cy = today.getFullYear();
    const cm = String(today.getMonth() + 1).padStart(2, '0');
    const cd = String(today.getDate()).padStart(2, '0');
    dateStr = `${yearStr || cy}-${cm}-${cd}`;
  }

  // 2. Parse Category
  let category: ExpenseCategory | null = null;
  if (/會議|餐點|飯|便當|喝|飲料|晚餐|午餐|早餐/i.test(text)) {
    category = '會議餐點';
  } else if (/電腦|鍵盤|滑鼠|螢幕|線材|硬碟|周邊|滑鼠|耳機|記憶卡/i.test(text)) {
    category = '電腦周邊';
  } else if (/文具|辦公用品|筆|筆記本|紙|夾子|尺|剪刀|用品/i.test(text)) {
    category = '文具用品';
  } else if (/其他|雜支|報銷|油資|計程車|車資/i.test(text)) {
    category = '其他';
  }

  // 3. Parse Amount
  let amount: number | null = null;
  // Look for patterns like "3000元", "三千元", "消費 3000", "金額五千", or just words around monetary units
  // Regex to extract possible price string
  // Let's extract any substring before "元" or "塊" or starting after "消費"
  const amountPatterns = [
    /消費\s*([0-9一二兩三四五六七八九十百千萬]+)\s*(?:元|塊)?/i,
    /([0-9一二兩三四五六七八九十百千萬]+)\s*(?:元|塊)/i,
    /金額\s*([0-9一二兩三四五六七八九十百千萬]+)/i,
    /([0-9一二兩三四五六七八九十百千萬]+)\s*(?:千|百|萬)元/i,
    // fallback to any number with length greater than 1 if it has 零一二...
    /([0-9一二兩三四五六七八九十百千萬]+)/i
  ];

  for (const pat of amountPatterns) {
    const m = text.match(pat);
    if (m && m[1]) {
      const parsed = convertChineseToNumber(m[1]);
      // Exclude numbers that look like dates (e.g., if it parsed "5" or "31" from 5月31日)
      // Check if the match is part of the date matched earlier
      const matchedString = m[1];
      const isDatePart = matchDate && (matchDate[0].includes(matchedString));
      if (parsed > 0 && !isDatePart) {
        amount = parsed;
        break;
      }
    }
  }

  // If no amount was extracted via patterns, match any numeric block that differs from the date
  if (amount === null) {
    const allNums = text.match(/\d+/g);
    if (allNums) {
      for (const num of allNums) {
        const val = parseInt(num, 10);
        // If it's not the year, month, or day
        if (dateStr) {
          const parts = dateStr.split('-');
          if (parts.includes(num) || parts[1] === num.padStart(2, '0') || parts[2] === num.padStart(2, '0')) {
            continue;
          }
        }
        amount = val;
        break;
      }
    }
  }

  // 4. Generate Remark (the leftover text or some summary description)
  // Clean up typical spoken phrases to leave a clean remark
  let remark = text
    .replace(dateRegex, '')
    .replace(slashRegex, '')
    .replace(/消費\s*([0-9一二兩三四五六七八九十百千萬]+)\s*(元|塊)?/gi, '')
    .replace(/([0-9一二兩三四五六七八九十百千萬]+)\s*(元|塊)/gi, '')
    .replace(/(會議餐點|電腦周邊|文具用品|其他)/g, '')
    .replace(/[，,。.\s、得錄輸入個說類似號]/g, '')
    .trim();

  // If remark is empty, provide a clean default
  if (!remark) {
    remark = `${category || '消費'}報銷`;
  }

  return {
    date: dateStr,
    amount,
    category,
    remark
  };
}
