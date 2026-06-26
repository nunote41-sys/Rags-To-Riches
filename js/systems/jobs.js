// js/systems/jobs.js – Job System Manager (FIXED)

import {
  G, fmt, clamp, rand, hasItem, hasSkill, saveGame
} from '../core/state.js';

import { fastForward } from './time.js';
import { applyWorkFatigue } from './vitals.js';

import { vendorJob } from '../content/jobs/vendor.js';
import { officeJob } from '../content/jobs/office.js';
import { deliveryJob } from '../content/jobs/delivery.js';

let _showToast = (msg, type) => console.warn('[jobs] toast:', msg, type);
let _addLog = (msg) => console.warn('[jobs] log:', msg);
let _renderAll = () => console.warn('[jobs] render called');

export function setJobsUI(toastFn, logFn, renderFn) {
  _showToast = toastFn; _addLog = logFn; _renderAll = renderFn;
}

const jobRegistry = {};

export function registerJob(jobDef) {
  jobRegistry[jobDef.id] = jobDef;
}

registerJob(vendorJob);
registerJob(officeJob);
registerJob(deliveryJob);

export function getAllJobs() { return Object.values(jobRegistry); }
export function getJob(id) { return jobRegistry[id]; }

// ------------------------------------------------------------------
// APPLY FOR A JOB

export function applyJob(id) {
  const job = jobRegistry[id];
  if (!job) return false;

  // 1. Credit score check
  if (G.creditScore < (job.requirements.minCredit || 0)) {
    _showToast(`❌ Denied! Credit score too low (Requires ${job.requirements.minCredit}).`, 'error');
    return false;
  }

  // 2. Criminal record check
  if (job.requirements.noRecord && G.criminalRecord && G.criminalRecord.length > 0) {
    _showToast('❌ Denied! Background check failed due to criminal record.', 'error');
    return false;
  }

  // 3. Skill requirement check
  if (job.requirements.skill && !hasSkill(job.requirements.skill)) {
    _showToast(`❌ Denied! Requires skill: ${job.requirements.skill}`, 'error');
    return false;
  }

  // 4. Item requirement check
  if (job.requirements.item && !hasItem(job.requirements.item)) {
    _showToast(`❌ Denied! Requires item: ${job.requirements.item}`, 'error');
    return false;
  }

  // Quit previous job
  if (G.job) {
    _addLog('💼 Left position as ' + G.job.name);
  }

  // Assign job
  G.job = {
    id: job.id,
    name: job.name,
    icon: job.icon,
    wage: job.wage,
    shiftPay: job.shiftPay,
    taxRate: job.taxRate,
    shiftHours: job.shiftHours || job.duration || 8,
    duration: job.duration || 4,
    requiredShifts: job.shiftsReq || 0,
    flexible: job.flexible
  };
  G.jobShiftsThisWeek = 0;
  G.jobWorkedToday = false;

  _showToast(`🎉 Hired! You are now a ${job.name}.`, 'success');
  _addLog(`💼 Started new job: ${job.name}.`);
  _renderAll();
  saveGame();
  return true;
}

// ------------------------------------------------------------------
// WORK A SHIFT

export function workShift() {
  if (!G.job) {
    _showToast('You do not have a job!', 'error');
    return { success: false, message: 'No job' };
  }

  const job = jobRegistry[G.job.id];
  if (!job) {
    _showToast('Job schema corrupted.', 'error');
    return { success: false, message: 'Schema missing' };
  }

  // Jail check
  if (G.jailDays && G.jailDays > 0) {
    _showToast('❌ You cannot work while incarcerated!', 'error');
    return { success: false, message: 'Imprisoned' };
  }

  // Fatigue check
  if (G.fatigue < 20) {
    _showToast('❌ Too exhausted to work! Rest first.', 'error');
    return { success: false, message: 'Exhausted' };
  }

  // Office time gate
  if (job.id === 'office') {
    const h = G.hour, m = G.minute;
    if (h < 8 || (h === 8 && m < 30) || h > 9 || (h === 9 && m > 0)) {
      _showToast('Office shift only available 8:30 – 9:00 AM.', 'warn');
      return { success: false, message: 'Wrong time' };
    }
  }

  // Daily limit for non‑flexible jobs
  if (!job.flexible && G.jobWorkedToday) {
    _showToast('⚠️ Already worked your scheduled shift for today!', 'warn');
    return { success: false, message: 'Shift done today' };
  }

  const duration = job.duration || 4;
  const isPhysical = job.physical || false;

  // --- PAYOUT CALCULATION ---
  let result = { net: 0, xp: 0, message: '' };

  // If the job has a custom `work` function, use it.
  // Pass both the job definition and its shiftPay, as the custom functions expect.
  if (typeof job.work === 'function') {
    result = job.work(job, job.shiftPay);   // ✅ FIX: pass both arguments
  } else {
    // Default fallback
    const gross = job.shiftPay || job.wage;
    const tax = Math.floor(gross * job.taxRate);
    const net = gross - tax;
    result = { net, xp: job.xpReward || 10 };
  }

  // Safety: ensure net is a number
  if (typeof result.net !== 'number' || isNaN(result.net)) result.net = 0;

  // Fast‑forward time
  fastForward(duration);

  // Apply fatigue (respect debug toggle)
  if (!G.debugNoStatsConsume) {
    applyWorkFatigue(duration, isPhysical);
  }

  // Apply money and XP
  G.cash += result.net;
  G.xp += (result.xp || 0);
  G.jobWorkedToday = true;
  G.jobShiftsThisWeek++;

  _showToast(`💼 Shift completed! Net pay: ${fmt(result.net)}`, 'success');
  _addLog(`💼 Worked shift as ${job.name}: Net ${fmt(result.net)}, +${result.xp || 0} XP.`);

  checkLevelUp();
  _renderAll();
  saveGame();

  return { success: true, payout: result.net };
}

// ------------------------------------------------------------------
// FIRE / WEEKLY CHECKS (unchanged)
export function fireJob(reason) {
  if (!G.job) return;
  _showToast('🚨 FIRED! ' + reason, 'error');
  _addLog('🚨 Fired from job (' + G.job.name + '). Reason: ' + reason);
  G.job = null;
  G.jobShiftsThisWeek = 0;
  G.jobWorkedToday = false;
  G.morale = clamp(G.morale - 25, 0, 100);
  _renderAll();
  saveGame();
}

export function checkCorporateFiring() {
  if (!G.job) return;
  const job = jobRegistry[G.job.id];
  if (!job || job.flexible) return;
  if (G.jobShiftsThisWeek < G.job.requiredShifts) {
    fireJob('You only worked ' + G.jobShiftsThisWeek + '/' + G.job.requiredShifts + ' required shifts.');
    G.creditScore = clamp(G.creditScore - 20, 200, 850);
  }
}

export function resetWeeklyShifts() { G.jobShiftsThisWeek = 0; }

// ------------------------------------------------------------------
// LEVEL UP
function checkLevelUp() {
  while (G.xp >= G.xpNext) {
    G.xp -= G.xpNext;
    G.level++;
    G.xpNext = Math.floor(G.xpNext * 1.5);
    _showToast('⭐ Level Up! Now Level ' + G.level + '!', 'success');
    _addLog('⭐ Level up! Level ' + G.level);
    if (G.level === 3) { G.cash += 200; _showToast('🎁 Level 3 bonus: +$200!', 'success'); }
    if (G.level === 5) { G.bank += 500; _showToast('🎁 Level 5 bonus: +$500 to bank!', 'success'); }
    if (G.level === 10) { G.creditScore = clamp(G.creditScore + 30, 200, 850); _showToast('🎁 Level 10 bonus: Credit Score boosted!', 'success'); }
  }
}