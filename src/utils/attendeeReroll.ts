import { Person, ExpenseCategory } from '../types';

/**
 * Estimates the attendee count based on category and amount, and configurable rules.
 */
export function estimateAttendeeCount(
  category: ExpenseCategory,
  amount: number,
  mealUnitCost: number = 500,
  stationeryDefault: number = 2,
  pcDefault: number = 1,
  othersDefault: number = 1
): number {
  if (amount <= 0) return 1;

  switch (category) {
    case '會議餐點':
      return Math.max(1, Math.round(amount / mealUnitCost));
    case '電腦周邊':
      return pcDefault;
    case '文具用品':
      return stationeryDefault;
    case '其他':
      return othersDefault;
    default:
      return 1;
  }
}

/**
 * Draws non-repetitive individuals from a list of candidates based on business requirements.
 * Prioritizes required individuals (isRequired = true).
 * @returns { string[] } List of drawn names.
 */
export function drawAttendees(
  candidates: Person[],
  requestedCount: number,
  onWarning?: (msg: string) => void
): string[] {
  // 1. Filter out only active candidate pool
  const activePool = candidates.filter(p => p.isActive);
  
  if (activePool.length === 0) {
    if (onWarning) onWarning('候選人員名單是空的，無法抽選！請先在設定區勾選可抽籤的人員。');
    return [];
  }

  // Adjust count if pool is too small
  let actualCount = requestedCount;
  if (activePool.length < requestedCount) {
    if (onWarning) {
      onWarning(`候選名單人數不足！需求 ${requestedCount} 人，但作用中的候選人僅有 ${activePool.length} 人。已為您抽選全部可用人員。`);
    }
    actualCount = activePool.length;
  }

  // 2. Identify required active people
  const requiredActive = activePool.filter(p => p.isRequired);
  const normalActive = activePool.filter(p => !p.isRequired);

  // Shuffle both lists separately using Fisher-Yates shuffle
  const shuffle = <T>(array: T[]): T[] => {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const shuffledRequired = shuffle(requiredActive);
  const shuffledNormal = shuffle(normalActive);

  const selected: string[] = [];

  // Add required people first (up to actualCount)
  for (const person of shuffledRequired) {
    if (selected.length < actualCount) {
      selected.push(person.name);
    } else {
      break;
    }
  }

  // Fill in the rest from normal active candidates
  for (const person of shuffledNormal) {
    if (selected.length < actualCount) {
      selected.push(person.name);
    } else {
      break;
    }
  }

  // Shuffle the final selected list to make layout look natural (instead of required ones always at the front)
  return shuffle(selected);
}
