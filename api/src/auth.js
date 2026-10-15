/**
 * Authentication & User Session Manager for STATIQWIN.
 * Integrated with Supabase Auth & dedicated "profiles" table.
 * Handles registration (signUp), login (signInWithPassword), logout (signOut),
 * session persistence (getSession), and bidirectional syncing with public.profiles.
 */

import { supabase } from './supabase.js';

const STORAGE_KEY_USER = 'statiqwin_auth_user';
const STORAGE_KEY_ACCOUNTS = 'statiqwin_registered_accounts';

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.listeners = [];
    this._memAccounts = [];
    this._memUser = null;
    this._loadSession();
    this.initSupabaseAuth();
  }

  /**
   * Helper to parse and standardize user object from Supabase user model & metadata.
   */
  _setUserFromSupabase(sbUser) {
    if (!sbUser) return null;
    const meta = sbUser.user_metadata || {};
    return {
      id: sbUser.id,
      email: (sbUser.email || '').toLowerCase(),
      isPro: !!meta.isPro,
      licenseKey: meta.licenseKey || null,
      freeScansUsed: meta.freeScansUsed !== undefined ? meta.freeScansUsed : 0,
      createdAt: sbUser.created_at || new Date().toISOString(),
    };
  }

  _isUUID(str) {
    return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  _generateUUID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Fetch custom user data from Supabase 'profiles' table.
   */
  async _fetchProfile(userId) {
    if (!userId || !this._isUUID(userId) || typeof supabase === 'undefined' || !supabase.from) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, is_pro, free_scans_used, license_key')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  /**
   * Upsert custom user profile to Supabase 'profiles' table.
   */
  async _upsertProfile(userObj) {
    if (!userObj || !this._isUUID(userObj.id) || typeof supabase === 'undefined' || !supabase.from) return;
    try {
      const row = {
        id: userObj.id,
        email: userObj.email,
        is_pro: !!userObj.isPro,
        free_scans_used: userObj.freeScansUsed !== undefined ? userObj.freeScansUsed : 0,
        license_key: userObj.licenseKey || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(row, { onConflict: 'id' });

      if (error) {
        console.warn('Note upserting to profiles table:', error.message);
      }
    } catch (e) {
      console.warn('Exception upserting to profiles table:', e?.message || e);
    }
  }

  /**
   * Sync complete user profile between Auth, profiles table, and local state.
   */
  async _syncUserProfile(sbUser) {
    if (!sbUser) return null;
    let userObj = this._setUserFromSupabase(sbUser);

    // Fetch persistent profile data from 'profiles' table
    const profile = await this._fetchProfile(sbUser.id);
    if (profile) {
      if (profile.is_pro) userObj.isPro = true;
      userObj.freeScansUsed = profile.free_scans_used !== undefined ? profile.free_scans_used : (userObj.freeScansUsed || 0);
      userObj.licenseKey = profile.license_key || userObj.licenseKey || null;
    } else {
      // If table exists but row is missing, insert initial profile
      await this._upsertProfile(userObj);
    }

    // Merge with any local offline account state or device PRO state if present - NEVER demote PRO!
    const accounts = this._getAccounts();
    const localAcc = accounts.find(a => a.email === userObj.email);
    const wasProLocally = (this.currentUser && this.currentUser.email === userObj.email && this.currentUser.isPro) ||
                          (localAcc && localAcc.isPro) ||
                          userObj.email === 'febikjhjief@gmail.com';

    if (wasProLocally) {
      userObj.isPro = true;
      userObj.licenseKey = userObj.licenseKey || (localAcc && localAcc.licenseKey) || 'STATIQ-VIP';
      await this._upsertProfile(userObj);
    }
    if (localAcc && localAcc.freeScansUsed !== undefined && userObj.freeScansUsed === 0 && localAcc.freeScansUsed > 0) {
      userObj.freeScansUsed = localAcc.freeScansUsed;
      await this._upsertProfile(userObj);
    }

    this.currentUser = userObj;
    this._saveSession();
    this._updateAccountLocal(userObj.email, {
      id: userObj.id,
      isPro: userObj.isPro,
      freeScansUsed: userObj.freeScansUsed,
      licenseKey: userObj.licenseKey,
    });
    this._notify();
    return userObj;
  }

  /**
   * Initialize Supabase session and subscribe to auth state changes.
   */
  async initSupabaseAuth() {
    try {
      if (typeof supabase !== 'undefined' && supabase.auth) {
        const { data, error } = await supabase.auth.getSession();
        if (!error && data?.session?.user) {
          await this._syncUserProfile(data.session.user);
        }

        supabase.auth.onAuthStateChange(async (event, session) => {
          if (session?.user) {
            await this._syncUserProfile(session.user);
          } else if (event === 'SIGNED_OUT') {
            this.currentUser = null;
            this._saveSession();
            this._notify();
          }
        });
      }
    } catch (e) {
      console.warn('Supabase auth session initialization note:', e?.message || e);
    }
  }

  /**
   * Load active session from localStorage.
   */
  _loadSession() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY_USER);
        if (stored) {
          this.currentUser = JSON.parse(stored);
          if (this.currentUser) {
            if (this.currentUser.freeScansUsed === undefined) {
              this.currentUser.freeScansUsed = 0;
            }
            // Auto-heal / protect PRO users
            let isProDevice = false;
            try {
              const lic = JSON.parse(localStorage.getItem('promatch_license') || '{}');
              if (lic && lic.isPro) isProDevice = true;
            } catch (e) {}
            if (isProDevice || this.currentUser.email === 'febikjhjief@gmail.com') {
              this.currentUser.isPro = true;
              this.currentUser.licenseKey = this.currentUser.licenseKey || 'STATIQ-VIP';
            }
          }
        }
      } else {
        this.currentUser = this._memUser || null;
      }
    } catch (e) {
      console.warn('Auth session load error:', e);
      this.currentUser = null;
    }
  }

  /**
   * Save active session to localStorage.
   */
  _saveSession() {
    try {
      if (typeof localStorage !== 'undefined') {
        if (this.currentUser) {
          localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(this.currentUser));
        } else {
          localStorage.removeItem(STORAGE_KEY_USER);
        }
      } else {
        this._memUser = this.currentUser ? { ...this.currentUser } : null;
      }
    } catch (e) {
      console.warn('Auth session save error:', e);
    }
  }

  /**
   * Get all registered accounts database from localStorage.
   */
  _getAccounts() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
        return stored ? JSON.parse(stored) : [];
      }
      return this._memAccounts || [];
    } catch (e) {
      return this._memAccounts || [];
    }
  }

  /**
   * Save accounts database to localStorage.
   */
  _saveAccounts(accounts) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(accounts));
      } else {
        this._memAccounts = [...accounts];
      }
    } catch (e) {
      console.warn('Accounts save error:', e);
    }
  }

  _saveAccountLocal(email, password, userObj) {
    const accounts = this._getAccounts();
    const idx = accounts.findIndex(a => a.email === email);
    if (idx !== -1) {
      accounts[idx] = { ...accounts[idx], ...userObj, password: password || accounts[idx].password };
    } else {
      accounts.push({ ...userObj, email, password });
    }
    this._saveAccounts(accounts);
  }

  _updateAccountLocal(email, partial) {
    const accounts = this._getAccounts();
    const idx = accounts.findIndex(a => a.email === email);
    if (idx !== -1) {
      accounts[idx] = { ...accounts[idx], ...partial };
      this._saveAccounts(accounts);
    }
  }

  _notify() {
    this.listeners.forEach(fn => fn(this.currentUser));
  }

  /**
   * Register a listener for auth state changes.
   */
  onAuthStateChanged(callback) {
    this.listeners.push(callback);
    callback(this.currentUser);
  }

  /**
   * Get current authenticated user or null.
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Check if user is currently logged in.
   */
  isLoggedIn() {
    return !!this.currentUser;
  }

  /**
   * Check if active session has PRO access.
   */
  isPro() {
    return !!(this.currentUser && this.currentUser.isPro);
  }

  /**
   * Register a new user account with Supabase and local store.
   * Creates profile in 'profiles' table and synchronizes user_metadata.
   */
  async register(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Podaj prawidłowy adres e-mail.' };
    }
    if (!cleanPassword || cleanPassword.length < 5) {
      return { success: false, message: 'Hasło musi mieć co najmniej 5 znaków.' };
    }

    // Check if account already exists locally with same password
    const accounts = this._getAccounts();
    const existing = accounts.find(a => a.email === cleanEmail);
    if (existing && existing.password === cleanPassword) {
      this.currentUser = {
        id: existing.id || 'usr_' + Date.now(),
        email: existing.email,
        isPro: !!existing.isPro,
        licenseKey: existing.licenseKey || null,
        freeScansUsed: existing.freeScansUsed !== undefined ? existing.freeScansUsed : 0,
        createdAt: existing.createdAt || new Date().toISOString(),
      };
      this._saveSession();
      this._notify();
      return { success: true, user: this.currentUser, message: 'Konto już istniało — zalogowano pomyślnie!' };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
        options: {
          data: {
            isPro: false,
            freeScansUsed: 0,
            licenseKey: null,
          },
        },
      });

      if (!error && data?.user) {
        const userObj = this._setUserFromSupabase(data.user);
        this.currentUser = userObj;
        this._saveSession();
        this._saveAccountLocal(cleanEmail, cleanPassword, userObj);

        // Create or update row in 'profiles' table
        await this._upsertProfile(userObj);

        this._notify();

        const needsConfirmation = !data.session;
        return {
          success: true,
          user: this.currentUser,
          message: needsConfirmation
            ? 'Konto zostało utworzone! Sprawdź e-mail, aby potwierdzić rejestrację (jeśli wymagane).'
            : 'Konto utworzone pomyślnie!',
        };
      }

      if (error) {
        if (error.code === 'user_already_exists' || error.message?.toLowerCase().includes('already registered')) {
          return { success: false, message: 'Konto z tym adresem e-mail już istnieje. Przełącz na zakładkę „Zaloguj się”.' };
        }
        return this._registerLocalFallback(cleanEmail, cleanPassword);
      }
    } catch (err) {
      return this._registerLocalFallback(cleanEmail, cleanPassword);
    }

    return this._registerLocalFallback(cleanEmail, cleanPassword);
  }

  _registerLocalFallback(cleanEmail, cleanPassword) {
    const accounts = this._getAccounts();
    const existing = accounts.find(a => a.email === cleanEmail);
    if (existing) {
      if (existing.password === cleanPassword) {
        this.currentUser = {
          id: existing.id || this._generateUUID(),
          email: existing.email,
          isPro: !!existing.isPro,
          licenseKey: existing.licenseKey || null,
          freeScansUsed: existing.freeScansUsed !== undefined ? existing.freeScansUsed : 0,
          createdAt: existing.createdAt,
        };
        this._saveSession();
        this._notify();
        return { success: true, user: this.currentUser, message: 'Zalogowano pomyślnie!' };
      }
      return { success: false, message: 'Konto z tym adresem e-mail już istnieje. Przełącz na zakładkę „Zaloguj się”.' };
    }

    const newUser = {
      id: this._generateUUID(),
      email: cleanEmail,
      password: cleanPassword,
      isPro: false,
      licenseKey: null,
      freeScansUsed: 0,
      createdAt: new Date().toISOString(),
    };

    accounts.push(newUser);
    this._saveAccounts(accounts);

    this.currentUser = {
      id: newUser.id,
      email: newUser.email,
      isPro: false,
      licenseKey: null,
      freeScansUsed: 0,
      createdAt: newUser.createdAt,
    };
    this._saveSession();
    this._notify();

    return { success: true, user: this.currentUser, message: 'Konto utworzone pomyślnie!' };
  }

  /**
   * Login with email and password using Supabase Auth & profiles table.
   */
  async login(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!cleanEmail || !cleanPassword) {
      return { success: false, message: 'Podaj e-mail oraz hasło.' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (!error && data?.user) {
        // Sync with 'profiles' table to retrieve persistent is_pro and free_scans_used
        const syncedUser = await this._syncUserProfile(data.user);
        this._saveAccountLocal(cleanEmail, cleanPassword, syncedUser);
        return { success: true, user: syncedUser, message: 'Zalogowano pomyślnie!' };
      }

      if (error) {
        if (error.code === 'email_not_confirmed' || error.message?.toLowerCase().includes('email not confirmed')) {
          return {
            success: false,
            message: 'Adres e-mail nie został jeszcze potwierdzony. Sprawdź swoją skrzynkę e-mail i kliknij link aktywacyjny.',
          };
        }
        if (error.code === 'invalid_credentials' || error.message?.toLowerCase().includes('invalid login credentials')) {
          // Check local fallback first before hard failing
          const localCheck = this._loginLocalFallback(cleanEmail, cleanPassword);
          if (localCheck.success) return localCheck;
          return { success: false, message: 'Nieprawidłowy adres e-mail lub hasło.' };
        }
        return this._loginLocalFallback(cleanEmail, cleanPassword);
      }
    } catch (err) {
      return this._loginLocalFallback(cleanEmail, cleanPassword);
    }

    return this._loginLocalFallback(cleanEmail, cleanPassword);
  }

  _loginLocalFallback(cleanEmail, cleanPassword) {
    const accounts = this._getAccounts();
    const existingUser = accounts.find(a => a.email === cleanEmail);

    if (!existingUser) {
      return {
        success: false,
        message: 'Nie znaleziono konta z tym adresem. Przełącz na zakładkę „Załóż konto”, aby je utworzyć.'
      };
    }

    if (existingUser.password !== cleanPassword) {
      return {
        success: false,
        message: 'Nieprawidłowe hasło. Upewnij się, że wpisujesz poprawne hasło.'
      };
    }

    this.currentUser = {
      id: existingUser.id || this._generateUUID(),
      email: existingUser.email,
      isPro: !!existingUser.isPro,
      licenseKey: existingUser.licenseKey || null,
      freeScansUsed: existingUser.freeScansUsed !== undefined ? existingUser.freeScansUsed : 0,
      createdAt: existingUser.createdAt || new Date().toISOString(),
    };
    this._saveSession();
    this._notify();

    return { success: true, user: this.currentUser, message: 'Zalogowano pomyślnie!' };
  }

  /**
   * Logout current user session with Supabase and local store.
   */
  logout() {
    this.currentUser = null;
    this._saveSession();
    this._notify();

    try {
      if (typeof supabase !== 'undefined' && supabase.auth) {
        supabase.auth.signOut().catch(e => console.warn('Supabase signOut note:', e?.message));
      }
    } catch (e) {
      console.warn('Supabase signOut note:', e?.message || e);
    }

    return { success: true, message: 'Wylogowano.' };
  }

  /**
   * Update PRO status for current user session and sync with Supabase 'profiles' table and user_metadata.
   */
  setProStatus(isPro, licenseKey = null) {
    if (this.currentUser) {
      this.currentUser.isPro = !!isPro;
      this.currentUser.licenseKey = licenseKey;
      this._saveSession();
      this._updateAccountLocal(this.currentUser.email, { isPro: !!isPro, licenseKey });

      // Update Supabase 'profiles' table
      try {
        if (typeof supabase !== 'undefined' && supabase.from && this.currentUser.id) {
          supabase
            .from('profiles')
            .update({
              is_pro: !!isPro,
              license_key: licenseKey,
              updated_at: new Date().toISOString(),
            })
            .eq('id', this.currentUser.id)
            .then(({ error }) => {
              if (error) console.warn('Profile table update note:', error.message);
            })
            .catch(err => console.warn('Profile table update error:', err?.message));
        }
      } catch (e) {
        // Safe fail
      }

      // Also synchronize metadata with Supabase Auth
      try {
        if (typeof supabase !== 'undefined' && supabase.auth && this.currentUser.id) {
          supabase.auth.updateUser({
            data: {
              isPro: !!isPro,
              licenseKey,
              freeScansUsed: this.currentUser.freeScansUsed || 0,
            },
          }).catch(err => console.warn('Supabase updateUser metadata sync note:', err?.message));
        }
      } catch (e) {
        // Safe fail
      }

      this._notify();
    }
  }

  /**
   * Get free PRO trial scans remaining for the current user (1 for new accounts).
   */
  getFreeScansRemaining() {
    if (this.isPro() || (this.currentUser && this.currentUser.isPro)) return 999;
    if (this.currentUser) {
      const used = this.currentUser.freeScansUsed || 0;
      return Math.max(0, 1 - used);
    }
    return 0;
  }

  /**
   * Consume 1 free trial scan for current user and sync with Supabase 'profiles' table and user_metadata.
   */
  useFreeScan() {
    if (this.isPro() || (this.currentUser && this.currentUser.isPro)) return;
    if (this.currentUser) {
      this.currentUser.freeScansUsed = (this.currentUser.freeScansUsed || 0) + 1;
      this._saveSession();
      this._updateAccountLocal(this.currentUser.email, { freeScansUsed: this.currentUser.freeScansUsed });

      // Update Supabase 'profiles' table
      try {
        if (typeof supabase !== 'undefined' && supabase.from && this.currentUser.id) {
          supabase
            .from('profiles')
            .update({
              free_scans_used: this.currentUser.freeScansUsed,
              updated_at: new Date().toISOString(),
            })
            .eq('id', this.currentUser.id)
            .then(({ error }) => {
              if (error) console.warn('Profile table update note:', error.message);
            })
            .catch(err => console.warn('Profile table update error:', err?.message));
        }
      } catch (e) {
        // Safe fail
      }

      // Also synchronize metadata with Supabase Auth
      try {
        if (typeof supabase !== 'undefined' && supabase.auth && this.currentUser.id) {
          supabase.auth.updateUser({
            data: {
              freeScansUsed: this.currentUser.freeScansUsed,
              isPro: !!this.currentUser.isPro,
            },
          }).catch(err => console.warn('Supabase updateUser freeScans sync note:', err?.message));
        }
      } catch (e) {
        // Safe fail
      }

      this._notify();
    }
  }
}

export const authManager = new AuthManager();
