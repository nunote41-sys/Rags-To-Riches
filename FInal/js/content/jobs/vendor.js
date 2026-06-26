// js/content/jobs/vendor.js – Street Vendor Job
import { G, fmt, clamp, rand, hasItem, hasSkill, saveGame } from '../../core/state.js';

let _showToast = (msg, type) => console.warn('[vendor] toast:', msg, type);
let _addLog = (msg) => console.warn('[vendor] log:', msg);

export function setVendorUI(toastFn, logFn) {
  _showToast = toastFn;
  _addLog = logFn;
}

export const vendorJob = {
  id: 'vendor',
  name: 'Street Vendor',
  wage: 50,
  shiftPay: 12,
  taxRate: 0,
  energyCost: 35,
  flexible: true,
  duration: 4,
  physical: true,
  shiftsReq: 0,
  requirements: { skill: null, item: null },
  reqSkills: [],
  reqItems: [],
  reqLevel: 1,
  icon: '🥤',
  desc: 'Sell snacks on the street. Flexible, but pay varies by time of day.',
  location: 'Residential Suburbs',

  work(job, basePay) {
    const h = G.hour;
    // Block work between midnight and 6 AM
    if (h >= 0 && h < 6) {
      _showToast('❌ Street markets are closed at night (00:00–06:00).', 'warn');
      return { success: false, message: 'Closed at night' };
    }

    let multiplier = 1.0;
    if (h >= 11 && h < 15) multiplier = 1.5;
    else if (h >= 17 && h < 20) multiplier = 1.2;
    else if (h >= 6 && h < 9) multiplier = 0.7;
    else if (h >= 20 || h >= 0) multiplier = 0.5;

    if (G.hygiene < 30) multiplier -= 0.2;

    let gross = Math.max(0, Math.floor(basePay * multiplier));
    let net = gross;
    let xp = 3 + (multiplier >= 1.2 ? 1 : 0);

    if (hasSkill('negotiation')) {
      const extra = Math.floor(net * 0.2);
      net += extra;
      xp += 1;
    }

    if (Math.random() < 0.1) {
      const tax = Math.floor(rand(1, 5));
      net = Math.max(0, net - tax);
      _addLog('🛑 Paid $' + tax + ' protection to local thugs.');
    }

    return {
      net: net,            // ← this is what jobs.js reads
      xp: xp,
      message: '💼 Shift finished! +' + fmt(net) + ' (' + Math.round(multiplier * 100) + '% time bonus)',
    };
  }
}; // <--- Fixed: Added the closing semicolon and brace for vendorJob