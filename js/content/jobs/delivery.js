import { G, fmt, clamp } from '../../core/state.js';

export const deliveryJob = {
  id: 'delivery',
  name: 'Delivery Driver',
  wage: 180,
  shiftPay: 35,
  taxRate: 0,
  energyCost: 25,
  flexible: true,
  duration: 3,
  physical: true,
  shiftsReq: 0,
  requirements: { skill: null, item: 'phone' },
  reqSkills: [],
  reqItems: ['phone'],
  reqLevel: 1,
  icon: '🛵',
  desc: 'Deliver food. Pay varies by time – peak hours earn more.',

  work(job, basePay) {
    const h = G.hour;
    let multiplier = 1.0;
    if ((h >= 11 && h < 14) || (h >= 17 && h < 21)) multiplier = 1.4;
    else if (h >= 21 || h < 6) multiplier = 0.8;

    const gross = Math.floor(basePay * multiplier);
    const net = gross;
    const xp = 4;
    return {
      net: net,            // ← key
      xp: xp,
      message: '🛵 Delivery shift finished! +' + fmt(net) + ' (' + Math.round(multiplier * 100) + '% time bonus)',
    };
  }
};