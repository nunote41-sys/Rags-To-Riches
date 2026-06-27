export const officeJob = {
  id: 'office',
  name: 'Office Clerk',
  wage: 400,
  shiftPay: 60,
  taxRate: 0.20,
  energyCost: 12,
  duration: 8,
  physical: false,
  flexible: false,
  shiftsReq: 4,
  requirements: {
    skill: 'budgeting',
    item: 'suit',
  },
  reqSkills: ['budgeting'],      // must have 'budgeting' skill
  reqItems: ['suit'],            // must own a suit
  reqLevel: 2,                  // higher level for corporate job
  icon: '🖥️',
  desc: '9-to-5 corporate job. 20% tax. Need suit + budgeting skill. 4 shifts/week required.',
};