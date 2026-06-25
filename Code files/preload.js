// preload.js - COMPLETE WITH BACKUP/RESTORE
const { contextBridge, ipcRenderer } = require('electron');

// Validate that ipcRenderer methods exist
const validateIPCMethods = () => {
  const requiredMethods = ['invoke', 'send', 'on'];
  for (const method of requiredMethods) {
    if (typeof ipcRenderer[method] !== 'function') {
      console.error(`ipcRenderer.${method} is not a function`);
      return false;
    }
  }
  return true;
};

// Safe IPC call wrapper
const safeInvoke = async (channel, ...args) => {
  try {
    if (!validateIPCMethods()) {
      throw new Error('IPC methods not available');
    }
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`IPC timeout for channel: ${channel}`)), 30000);
    });
    
    const resultPromise = ipcRenderer.invoke(channel, ...args);
    const result = await Promise.race([resultPromise, timeoutPromise]);
    
    return result;
  } catch (error) {
    console.error(`IPC error (${channel}):`, error);
    
    // Return structured error for UI handling
    return {
      success: false,
      error: error.message,
      channel: channel,
      timestamp: new Date().toISOString()
    };
  }
};

const safeSend = (channel, ...args) => {
  try {
    if (!validateIPCMethods()) {
      console.error('Cannot send, IPC methods not available');
      return false;
    }
    ipcRenderer.send(channel, ...args);
    return true;
  } catch (error) {
    console.error(`Send error (${channel}):`, error);
    return false;
  }
};

// Expose APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // ==================== NAVIGATION ====================
  navigateTo: (module) => safeSend('navigate-to', module),
  
  onNavigate: (callback) => {
    try {
      ipcRenderer.on('navigate-to', (event, module) => callback(module));
    } catch (error) {
      console.error('Failed to setup navigation listener:', error);
    }
  },

  // ==================== DATABASE QUERIES ====================
  executeQuery: (sql, params) => safeInvoke('execute-query', sql, params || []),
  
  getData: (sql, params) => safeInvoke('get-data', sql, params || []),
  
  getAllData: (sql, params) => safeInvoke('get-all-data', sql, params || []),

  // ==================== BACKUP & RESTORE ====================
  // Create new backup
  createBackup: (options = {}) => safeInvoke('create-backup', options),
  
  // Restore from backup
  restoreBackup: (backupFile, options = {}) => 
    safeInvoke('restore-backup', backupFile, options),
  
  // List available backups
  listBackups: () => safeInvoke('list-backups'),
  
  // Get backup configuration
  getBackupConfig: () => safeInvoke('get-backup-config'),
  
  // Set backup configuration
  setBackupConfig: (config) => safeInvoke('set-backup-config', config),
  
  // Cleanup old backups
  cleanupOldBackups: (maxBackups = 30, retentionDays = 30) => 
    safeInvoke('cleanup-old-backups', maxBackups, retentionDays),
  
  // Schedule auto-backup
  scheduleAutoBackup: (intervalHours = 24) => 
    safeInvoke('schedule-auto-backup', intervalHours),
  
  // Stop auto-backup
  stopAutoBackup: () => safeInvoke('stop-auto-backup'),
  
  // Get auto-backup status
  getAutoBackupStatus: () => {
    try {
      const status = localStorage.getItem('autoBackupStatus');
      return status ? JSON.parse(status) : { enabled: false };
    } catch (error) {
      console.error('Failed to get auto-backup status:', error);
      return { enabled: false, error: error.message };
    }
  },

  // ==================== DATABASE MANAGEMENT ====================
  // Test database connection
  testConnection: () => safeInvoke('test-connection'),
  
  // Check database health
  checkDatabaseHealth: () => safeInvoke('check-database-health'),
  
  // Run database maintenance
  runDatabaseMaintenance: () => safeInvoke('run-database-maintenance'),
  
  // Export database to SQL
  exportDatabase: (outputPath) => safeInvoke('export-database', outputPath),
  
  // Import database from SQL
  importDatabase: (filePath) => safeInvoke('import-database', filePath),
  
  // Initialize database (reconnect)
  initializeDatabase: () => safeInvoke('initialize-database'),
  
  // Reopen database connection
  reopenDatabase: () => safeInvoke('reopen-database'),

  // ==================== FILE OPERATIONS ====================
  // Legacy backup/restore (for compatibility)
  backupDatabase: () => safeInvoke('backup-database'),
  
  // Legacy restore (for compatibility)
  restoreDatabase: (filePath) => safeInvoke('restore-database', filePath),
  
  // Select file dialog
  showOpenDialog: (options) => safeInvoke('show-open-dialog', options),
  
  // Save file dialog
  showSaveDialog: (options) => safeInvoke('show-save-dialog', options),
  
  // Show item in folder
  showItemInFolder: (path) => safeInvoke('show-item-in-folder', path),

  // ==================== APP INFO & UTILITIES ====================
  getAppInfo: () => safeInvoke('get-app-info'),
  
  getAppVersion: async () => {
    try {
      const info = await safeInvoke('get-app-info');
      return info?.version || '2.0.0';
    } catch (error) {
      return '2.0.0';
    }
  },
  
  // Platform info
  getPlatform: () => process.platform,
  
  // Is development mode
  isDev: () => {
    try {
      return process.env.NODE_ENV === 'development';
    } catch {
      return false;
    }
  },

  // ==================== DIALOGS & UI ====================
  showMessageBox: (options) => safeInvoke('show-message-box', options),
  
  showErrorBox: (title, content) => safeInvoke('show-error-box', title, content),
  
  showAbout: () => safeSend('show-about'),
  
  showSettings: () => safeSend('show-settings'),
  
  showBackupRestore: () => safeSend('show-backup-restore'),

  // ==================== APPLICATION CONTROL ====================
  relaunch: () => safeSend('relaunch-app'),
  
  quit: () => safeSend('quit-app'),
  
  reload: () => safeSend('reload-app'),
  
  toggleDevTools: () => safeSend('toggle-dev-tools'),

  // ==================== EVENT LISTENERS ====================
  // Database events
  onDatabaseReady: (callback) => {
    try {
      ipcRenderer.on('database-ready', (event, data) => callback(data));
    } catch (error) {
      console.error('Failed to setup database-ready listener:', error);
    }
  },
  
  onBackupProgress: (callback) => {
    try {
      ipcRenderer.on('backup-progress', (event, progress) => callback(progress));
    } catch (error) {
      console.error('Failed to setup backup-progress listener:', error);
    }
  },
  
  onRestoreProgress: (callback) => {
    try {
      ipcRenderer.on('restore-progress', (event, progress) => callback(progress));
    } catch (error) {
      console.error('Failed to setup restore-progress listener:', error);
    }
  },

  // ==================== UTILITY FUNCTIONS ====================
  // Format bytes for display
  formatBytes: (bytes, decimals = 2) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  },
  
  // Format date
  formatDate: (dateString, format = 'medium') => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      
      if (format === 'short') {
        return date.toLocaleDateString();
      } else if (format === 'time') {
        return date.toLocaleTimeString();
      } else {
        return date.toLocaleString();
      }
    } catch (error) {
      return dateString;
    }
  },
  
  // Generate unique ID
  generateId: () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },
  
  // Store auto-backup status
  storeAutoBackupStatus: (status) => {
    try {
      localStorage.setItem('autoBackupStatus', JSON.stringify(status));
      return true;
    } catch (error) {
      console.error('Failed to store auto-backup status:', error);
      return false;
    }
  },
  
  // Clear local cache
  clearLocalCache: () => {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('cached_') || 
            key.includes('backup') || 
            key.includes('database')) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });
      
      console.log('Local cache cleared:', keysToRemove.length, 'items removed');
      return { success: true, cleared: keysToRemove.length };
    } catch (error) {
      console.error('Failed to clear cache:', error);
      return { success: false, error: error.message };
    }
  },

  // ==================== HEALTH CHECK ====================
  // Check if all APIs are available
  checkAPIHealth: () => {
    const api = window.electronAPI;
    const checks = {
      navigation: typeof api.navigateTo === 'function',
      database: typeof api.executeQuery === 'function',
      backup: typeof api.createBackup === 'function',
      restore: typeof api.restoreBackup === 'function',
      ipcAvailable: validateIPCMethods()
    };
    
    const allHealthy = Object.values(checks).every(Boolean);
    
    return {
      healthy: allHealthy,
      checks: checks,
      timestamp: new Date().toISOString()
    };
  },

  // ==================== ERROR HANDLING ====================
  // Global error handler
  onError: (callback) => {
    try {
      ipcRenderer.on('global-error', (event, error) => callback(error));
    } catch (error) {
      console.error('Failed to setup error listener:', error);
    }
  },
  
  // Send error to main process
  sendError: (error, context = '') => {
    try {
      const errorData = {
        message: error.message,
        stack: error.stack,
        context: context,
        timestamp: new Date().toISOString(),
        url: window.location.href
      };
      safeSend('renderer-error', errorData);
    } catch (sendError) {
      console.error('Failed to send error:', sendError);
    }
  }
});

// Add global error handler
window.addEventListener('error', (event) => {
  if (window.electronAPI && window.electronAPI.sendError) {
    window.electronAPI.sendError(event.error, 'window.onerror');
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (window.electronAPI && window.electronAPI.sendError) {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    window.electronAPI.sendError(error, 'unhandledrejection');
  }
});

// Log when APIs are exposed
console.log('✅ Electron APIs exposed to renderer');