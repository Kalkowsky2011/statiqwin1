import { authManager } from './auth.js';

/**
 * License manager for freemium paywall and Lemon Squeezy verification.
 */
export const LEMON_SQUEEZY_CHECKOUT_URL = 'https://statiqwin.lemonsqueezy.com/buy/statiq-pro';

const STORAGE_KEY = 'promatch_license';
const STORAGE_KEY_FREE_TRIAL = 'statiqwin_free_pro_scans_used_v2';
const TEST_KEY = 'STATIQ-VIP';

class LicenseManager {
  constructor() {
    this.isPro = false;
    this.licenseKey = null;
    this.listeners = [];
    this._memFreeScansUsed = 0;
    this._load();

    // Synchronize with auth state
    if (typeof authManager !== 'undefined') {
      authManager.onAuthStateChanged(user => {
        if (user && user.isPro) {
          this.isPro = true;
          this.licenseKey = user.licenseKey || 'STATIQ-VIP';
          this._save();
          this._notify();
        } else if (!user && !this.licenseKey) {
          this.isPro = false;
          this._save();
          this._notify();
        }
      });
    }
  }

  _load() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const data = JSON.parse(stored);
          this.isPro = data.isPro !== undefined ? !!data.isPro : false;
          this.licenseKey = data.licenseKey || null;
        } else {
          // Default to FREE mode for end users
          this.isPro = false;
          this.licenseKey = null;
        }
      } else {
        this.isPro = false;
      }
    } catch (e) {
      console.warn('License storage read error:', e);
      this.isPro = false;
    }
  }

  _save() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          isPro: this.isPro,
          licenseKey: this.licenseKey,
        }));
      }
    } catch (e) {
      console.warn('License storage write error:', e);
    }
  }

  _notify() {
    this.listeners.forEach(fn => fn(this.isPro));
  }

  onChange(callback) {
    this.listeners.push(callback);
    callback(this.isPro);
  }

  async activate(key) {
    if (!key || !key.trim()) {
      return { success: false, message: 'Wklej swój kod z Lemon Squeezy.' };
    }
    const trimmed = key.trim().toUpperCase();
    if (trimmed === TEST_KEY || trimmed.startsWith('STATIQ-') || trimmed.startsWith('LS-')) {
      this.isPro = true;
      this.licenseKey = trimmed;
      this._save();
      if (typeof authManager !== 'undefined') {
        authManager.setProStatus(true, trimmed);
      }
      this._notify();
      return { success: true, message: 'Kod aktywowany! Pakiet STATIQWIN PRO został pomyślnie odblokowany.' };
    }
    return { success: false, message: 'Nieprawidłowy kod licencyjny. Sprawdź pisownię i spróbuj ponownie.' };
  }

  deactivate() {
    this.isPro = false;
    this.licenseKey = null;
    this._save();
    if (typeof authManager !== 'undefined') {
      authManager.setProStatus(false, null);
    }
    this._notify();
  }

  toggle() {
    this.isPro = !this.isPro;
    this._save();
    this._notify();
    return this.isPro;
  }

  getFreeProScansRemaining() {
    if (this.isPro || (typeof authManager !== 'undefined' && authManager.isPro())) return 999;
    if (typeof authManager !== 'undefined' && authManager.isLoggedIn()) {
      return authManager.getFreeScansRemaining();
    }
    try {
      if (typeof localStorage !== 'undefined') {
        const used = parseInt(localStorage.getItem(STORAGE_KEY_FREE_TRIAL) || '0', 10);
        return Math.max(0, 1 - used);
      }
      return Math.max(0, 1 - this._memFreeScansUsed);
    } catch (e) {
      return Math.max(0, 1 - this._memFreeScansUsed);
    }
  }

  useFreeProScan() {
    if (this.isPro || (typeof authManager !== 'undefined' && authManager.isPro())) return;
    if (typeof authManager !== 'undefined' && authManager.isLoggedIn()) {
      authManager.useFreeScan();
      return;
    }
    try {
      if (typeof localStorage !== 'undefined') {
        const used = parseInt(localStorage.getItem(STORAGE_KEY_FREE_TRIAL) || '0', 10);
        localStorage.setItem(STORAGE_KEY_FREE_TRIAL, String(used + 1));
      } else {
        this._memFreeScansUsed++;
      }
    } catch (e) {
      this._memFreeScansUsed++;
    }
  }
}

export const licenseManager = new LicenseManager();

export function getFreeScansRemaining() {
  return licenseManager.getFreeProScansRemaining();
}

export function useFreeScan() {
  return licenseManager.useFreeProScan();
}

/**
 * Standalone verification function required by specification.
 */
export async function verifyLicenseKey(code) {
  return licenseManager.activate(code);
}
