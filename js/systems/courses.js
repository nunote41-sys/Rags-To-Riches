// js/systems/courses.js – Course System Manager
// Handles course registry, completion, XP, skill unlocks, and demo cash rewards.

import {
  G,
  fmt,
  clamp,
  hasSkill,
  saveGame,
} from '../core/state.js';

// Import course definitions
import { tradingCourses } from '../content/courses/trading.js';
import { lifeCourses } from '../content/courses/life.js';

// UI callbacks (injected from ui.js)
let _showToast = (msg, type) => console.warn('[courses] toast:', msg, type);
let _addLog = (msg) => console.warn('[courses] log:', msg);
let _renderAll = () => console.warn('[courses] render called');

export function setCoursesUI(toastFn, logFn, renderFn) {
  _showToast = toastFn;
  _addLog = logFn;
  _renderAll = renderFn;
}

// ------------------------------------------------------------------
// COURSE REGISTRY

const courseRegistry = {};
const categoryRegistry = {};

/**
 * Register a course definition.
 * @param {object} course - { id, title, desc, icon, xpReward, category, skillUnlock, url }
 */
export function registerCourse(course) {
  courseRegistry[course.id] = course;
  // Track category
  if (course.category) {
    if (!categoryRegistry[course.category]) categoryRegistry[course.category] = [];
    categoryRegistry[course.category].push(course.id);
  }
}

// Register all courses
tradingCourses.forEach(c => registerCourse(c));
lifeCourses.forEach(c => registerCourse(c));

// ------------------------------------------------------------------
// GETTERS

export function getCourse(id) {
  return courseRegistry[id] || null;
}

export function getAllCourses() {
  return Object.values(courseRegistry);
}

export function getCoursesByCategory(category) {
  const ids = categoryRegistry[category] || [];
  return ids.map(id => courseRegistry[id]).filter(Boolean);
}

export function getCategories() {
  return Object.keys(categoryRegistry);
}

export function getCompletedCourses() {
  return G.coursesCompleted || [];
}

export function getSkills() {
  return G.skills || [];
}

export function getDemoCash() {
  return G.demoCash || 0;
}

// ------------------------------------------------------------------
// COMPLETE COURSE – MAIN FUNCTION

/**
 * Mark a course as completed.
 * @param {string} courseId - the course ID to complete
 * @returns {object} { success, message, xpGained, skillUnlocked, demoCashEarned }
 */
export function completeCourse(courseId) {
  const course = getCourse(courseId);
  if (!course) {
    _showToast('Course not found.', 'error');
    return { success: false, message: 'Unknown course' };
  }

  // Check if already completed
  if (G.coursesCompleted && G.coursesCompleted.includes(courseId)) {
    _showToast('Already completed this course!', 'warn');
    return { success: false, message: 'Already completed' };
  }

  // Ensure arrays exist
  if (!G.coursesCompleted) G.coursesCompleted = [];
  if (!G.skills) G.skills = [];
  if (!G.demoCash) G.demoCash = 0;

  // Apply rewards
  const xpGained = course.xpReward || 20;
  const demoCashEarned = xpGained * 10; // $10 per XP

  G.coursesCompleted.push(courseId);
  G.xp += xpGained;
  G.demoCash += demoCashEarned;

  // Unlock skill if this course provides one
  let skillUnlocked = null;
  if (course.skillUnlock) {
    if (!G.skills.includes(course.skillUnlock)) {
      G.skills.push(course.skillUnlock);
      skillUnlocked = course.skillUnlock;
    }
  }

  // Check for level up
  checkLevelUp();

  // Log and notify
  const skillMsg = skillUnlocked ? ` 🎯 Skill unlocked: ${course.skillUnlock}!` : '';
  _showToast(`🎓 Course completed! +${xpGained} XP, +${fmt(demoCashEarned)} demo cash.${skillMsg}`, 'success');
  _addLog(`🎓 Completed: ${course.title} (+${xpGained} XP, +${fmt(demoCashEarned)} demo cash)${skillMsg}`);

  _renderAll();
  saveGame();
  return {
    success: true,
    message: 'Course completed',
    xpGained,
    demoCashEarned,
    skillUnlocked,
  };
}

// ------------------------------------------------------------------
// LEVEL UP CHECK (reused pattern from jobs)

function checkLevelUp() {
  while (G.xp >= G.xpNext) {
    G.xp -= G.xpNext;
    G.level++;
    G.xpNext = Math.floor(G.xpNext * 1.5);
    _showToast('⭐ Level Up! Now Level ' + G.level + '!', 'success');
    _addLog('⭐ Level up! Level ' + G.level);
    // Level bonuses
    if (G.level === 3) {
      G.cash += 200;
      _showToast('🎁 Level 3 bonus: +$200!', 'success');
    }
    if (G.level === 5) {
      G.bank += 500;
      _showToast('🎁 Level 5 bonus: +$500 to bank!', 'success');
    }
    if (G.level === 10) {
      G.creditScore = clamp(G.creditScore + 20, 200, 850);
      _showToast('🎁 Level 10 bonus: +20 credit score!', 'success');
    }
    if (G.level === 15) {
      G.cash += 1000;
      _showToast('🎁 Level 15 bonus: +$1000!', 'success');
    }
    if (G.level === 20) {
      G.bank += 2000;
      _showToast('🎁 Level 20 bonus: +$2000 to bank!', 'success');
    }
  }
}

// ------------------------------------------------------------------
// RENDER COURSES (called by UI)

/**
 * Generate HTML for course listings.
 * @param {string} category - optional category filter (e.g., 'trading', 'life')
 * @returns {string} HTML string
 */
export function renderCourses(category = null) {
  let courses = getAllCourses();
  if (category) {
    courses = courses.filter(c => c.category === category);
  }

  if (!courses.length) {
    return '<div style="color:var(--muted)">No courses available in this category.</div>';
  }

  return courses.map(course => {
    const completed = G.coursesCompleted && G.coursesCompleted.includes(course.id);
    const skillUnlocked = course.skillUnlock && G.skills && G.skills.includes(course.skillUnlock);
    const demoCashReward = course.xpReward * 10;

    return `
      <div class="course-card">
        <div class="course-thumb">${course.icon}</div>
        <div class="course-info">
          <div class="course-title">${course.title}</div>
          <div class="course-desc">${course.desc}</div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:11px;font-weight:700;color:var(--gold)">
              +${course.xpReward} XP → ${fmt(demoCashReward)} Demo Cash
            </span>
            ${course.skillUnlock ? `<span style="font-size:10px;color:var(--blue);background:rgba(59,130,246,.12);padding:2px 8px;border-radius:4px">🔓 Unlocks: ${course.skillUnlock}</span>` : ''}
            ${completed ? '<span style="color:var(--green);font-size:11px;font-weight:700">✅ Completed</span>' : ''}
            ${skillUnlocked ? '<span style="color:var(--green);font-size:10px">🧠 Skill acquired</span>' : ''}
          </div>
          ${!completed ? `
            <div style="margin-top:8px;display:flex;gap:8px">
              <a href="${course.url}" target="_blank" class="btn btn-blue btn-sm" rel="noopener noreferrer">
                ▶ Watch on YouTube
              </a>
              <button class="btn btn-gold btn-sm" data-course="${course.id}">
                Mark Complete
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ------------------------------------------------------------------
// COURSE CATEGORIES (for UI tabs)

export const COURSE_CATEGORIES = {
  TRADING: 'trading',
  LIFE: 'life',
};

// ------------------------------------------------------------------
// HELPER – check if a course is completed

export function isCourseCompleted(courseId) {
  return G.coursesCompleted && G.coursesCompleted.includes(courseId);
}

// ------------------------------------------------------------------
// EXPOSE GLOBALLY for inline onclick compatibility (temporary)
window.completeCourse = completeCourse;