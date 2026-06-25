const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const isDev = require('electron-is-dev');

// Import database module
const dbModule = require('./database');

let mainWindow;
let db;

// Enhanced file checking with better error handling
function findIndexHtml() {
  const possiblePaths = [
    // Development path
    path.join(__dirname, 'build', 'index.html'),

    // Production paths (after packaging)
    path.join(process.resourcesPath, 'app.asar.unpacked', 'build', 'index.html'),
    path.join(process.resourcesPath, 'build', 'index.html'),
    path.join(app.getAppPath(), 'build', 'index.html'),

    // Fallback: Look in any subdirectory
    path.join(__dirname, '..', 'build', 'index.html'),
    path.join(process.resourcesPath, '..', 'build', 'index.html')
  ];

  for (const filePath of possiblePaths) {
    if (fsSync.existsSync(filePath)) {
      console.log('✅ Found index.html at:', filePath);
      return filePath;
    }
  }

  console.log('❌ index.html not found in any location. Tried:');
  possiblePaths.forEach(p => console.log('  -', p));
  return null;
}

// Get correct icon path for ALL scenarios
function getIconPath() {
  const possibleIconPaths = [
    // Production - packed in resources
    path.join(process.resourcesPath, 'assets', 'icon.ico'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'assets', 'icon.ico'),

    // Development - in project root
    path.join(__dirname, 'assets', 'icon.ico'),
    path.join(__dirname, '..', 'assets', 'icon.ico'),

    // Fallback - use any .ico file in assets
    ...(() => {
      const assetsDir = path.join(__dirname, 'assets');
      if (fsSync.existsSync(assetsDir)) {
        const files = fsSync.readdirSync(assetsDir);
        const icoFiles = files.filter(f => f.endsWith('.ico'));
        return icoFiles.map(f => path.join(assetsDir, f));
      }
      return [];
    })()
  ];

  for (const iconPath of possibleIconPaths) {
    if (fsSync.existsSync(iconPath)) {
      console.log('✅ Using icon at:', iconPath);
      return iconPath;
    }
  }

  console.log('⚠️  No custom icon found, using default Electron icon');
  return null;
}

function createWindow() {
  console.log('🚀 Creating window...');

  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: !isDev,
      allowRunningInsecureContent: isDev,
      devTools: isDev
    },
    icon: iconPath,
    title: 'Stock Control System - JFI CONSOLIDATED (PVT) LTD',
    show: false,
    backgroundColor: '#f0f0f0',
    frame: true,
    hasShadow: true,
    center: true,
    resizable: true,
    movable: true,
    minimizable: true,
    maximizable: true,
    fullscreenable: true
  });

  // 🎯 FIX 4: Menu visibility - always show in production
  if (!isDev) {
    mainWindow.setMenuBarVisibility(true);
    mainWindow.setAutoHideMenuBar(true); // ALT to show
  }

  let loadUrl;
  if (isDev) {
    loadUrl = 'http://localhost:3000';
    console.log('🔧 Development mode: Loading from localhost');
  } else {
    const indexPath = findIndexHtml();
    if (!indexPath) {
      dialog.showErrorBox(
        'Missing Application Files',
        'Critical application files not found. Please reinstall the application.'
      );
      app.quit();
      return;
    }
    loadUrl = `file://${indexPath}`;
    console.log('📦 Production mode: Loading from file system');
  }

  console.log('📂 Loading:', loadUrl);

  mainWindow.once('ready-to-show', () => {
    console.log('✅ Window ready to show');
    mainWindow.show();

    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ Page loaded successfully');
    const appVersion = app.getVersion();
    mainWindow.setTitle(`Stock Control System - JFI CONSOLIDATED (PVT) LTD `);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('❌ Failed to load page:', errorCode, errorDescription);

    if (!isDev) {
      const indexPath = findIndexHtml();
      if (indexPath) {
        console.log('🔄 Trying alternative load method (loadFile)...');
        mainWindow.loadFile(indexPath).catch(err => {
          console.error('Alternative load failed:', err);
          showFatalError('Application Load Error',
            'The application failed to load. Please try reinstalling.\n\n' +
            `Error: ${err.message}`
          );
        });
      } else {
        showFatalError('File Not Found',
          'Application files are missing or corrupted.\n' +
          'Please reinstall the application.'
        );
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    console.log('📝 Window closed');
  });

  const loadApp = () => {
    if (isDev) {
      mainWindow.loadURL(loadUrl).catch(err => {
        console.error('Failed to load dev server:', err);
        setTimeout(() => {
          console.log('🔄 Retrying dev server connection...');
          loadApp();
        }, 2000);
      });
    } else {
      const indexPath = findIndexHtml();
      if (indexPath) {
        mainWindow.loadFile(indexPath).catch(err => {
          console.error('Failed to load file:', err);
          showFatalError('Load Error',
            'Cannot load application files.\n' +
            `Path: ${indexPath}\n` +
            `Error: ${err.message}`
          );
        });
      }
    }
  };

  loadApp();
  createApplicationMenu();
}

function showFatalError(title, message) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: title,
      message: message,
      buttons: ['OK']
    }).then(() => {
      app.quit();
    });
  } else {
    dialog.showErrorBox(title, message);
    app.quit();
  }
}

// Utility function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Enhanced backup/restore functions
async function backupDatabase() {
  try {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `stock-backup-${new Date().toISOString().split('T')[0]}.db`,
      filters: [
        { name: 'Database Files', extensions: ['db'] },
        { name: 'Compressed Files', extensions: ['gz'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      title: 'Save Database Backup',
      message: 'Choose location to save database backup',
      properties: ['createDirectory', 'showOverwriteConfirmation']
    });

    if (filePath) {
      const progressDialog = new BrowserWindow({
        parent: mainWindow,
        modal: true,
        show: false,
        width: 400,
        height: 200,
        resizable: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });

      await progressDialog.loadURL(`data:text/html;charset=utf-8,
        <html>
          <body style="padding: 20px; font-family: Arial, sans-serif;">
            <h3>Creating Backup...</h3>
            <div id="progress" style="margin: 20px 0; padding: 10px; background: #f0f0f0; border-radius: 5px;">
              Initializing...
            </div>
            <div id="details" style="font-size: 12px; color: #666;"></div>
          </body>
        </html>
      `);

      progressDialog.show();

      try {
        progressDialog.webContents.executeJavaScript(`
          document.getElementById('progress').innerHTML = 'Creating backup file...';
        `);

        const result = await dbModule.createBackup({
          backupName: `manual-${Date.now()}`,
          compress: filePath.endsWith('.gz'),
          type: 'manual'
        });

        if (result.success) {
          await fs.copyFile(result.backup.path, filePath);

          progressDialog.webContents.executeJavaScript(`
            document.getElementById('progress').innerHTML = '<span style="color: green;">✓ Backup created successfully!</span>';
            document.getElementById('details').innerHTML = 'File: ${path.basename(filePath)}<br>Size: ${formatBytes(result.backup.size)}';
          `);

          await new Promise(resolve => setTimeout(resolve, 1500));
          progressDialog.close();

          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Backup Successful',
            message: `Database backup created successfully!\n\n` +
              `File: ${path.basename(filePath)}\n` +
              `Size: ${formatBytes(result.backup.size)}\n` +
              `Location: ${filePath}`,
            buttons: ['OK', 'Open Folder'],
            defaultId: 0,
            cancelId: 0
          }).then(({ response }) => {
            if (response === 1) {
              shell.showItemInFolder(filePath);
            }
          });
        } else {
          throw new Error(result.error || 'Backup creation failed');
        }
      } catch (error) {
        progressDialog.close();
        throw error;
      }
    }
  } catch (error) {
    console.error('Backup failed:', error);
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Backup Failed',
      message: `Failed to create database backup:\n\n${error.message}`,
      buttons: ['OK']
    });
  }
}

async function restoreDatabase() {
  try {
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Database Backup File',
      filters: [
        { name: 'Database Files', extensions: ['db', 'gz'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile'],
      message: 'Select a database backup file to restore'
    });

    if (canceled || !filePaths || filePaths.length === 0) {
      return;
    }

    const backupPath = filePaths[0];

    try {
      await fs.access(backupPath);
      const stats = await fs.stat(backupPath);

      if (stats.size === 0) {
        throw new Error('Backup file is empty');
      }
    } catch (error) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Invalid Backup File',
        message: `Cannot read backup file:\n\n${error.message}`,
        buttons: ['OK']
      });
      return;
    }

    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: '⚠️ WARNING: Database Restore',
      message: 'DANGER: This will REPLACE ALL current data with backup data!',
      detail: `You are about to restore from:\n` +
        `• ${path.basename(backupPath)}\n` +
        `• ${formatBytes((await fs.stat(backupPath)).size)}\n\n` +
        `This action cannot be undone. All current data will be lost.\n\n` +
        `Are you absolutely sure you want to continue?`,
      buttons: ['Cancel', 'I Understand - Restore Database'],
      defaultId: 0,
      cancelId: 0
    });

    if (response !== 1) {
      return;
    }

    const progressDialog = new BrowserWindow({
      parent: mainWindow,
      modal: true,
      show: false,
      width: 400,
      height: 250,
      resizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    await progressDialog.loadURL(`data:text/html;charset=utf-8,
      <html>
        <body style="padding: 20px; font-family: Arial, sans-serif;">
          <h3>Restoring Database...</h3>
          <div id="progress" style="margin: 20px 0; padding: 10px; background: #f0f0f0; border-radius: 5px;">
            Starting restore process...
          </div>
          <div id="details" style="font-size: 12px; color: #666;">
            This may take a few moments. Do not close the application.
          </div>
          <div id="warning" style="margin-top: 15px; padding: 10px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; font-size: 12px;">
            ⚠️ Application will restart after restore completes.
          </div>
        </body>
      </html>
    `);

    progressDialog.show();

    try {
      progressDialog.webContents.executeJavaScript(`
        document.getElementById('progress').innerHTML = 'Creating emergency backup...';
      `);

      // Get the full path for restore
      progressDialog.webContents.executeJavaScript(`
        document.getElementById('progress').innerHTML = 'Restoring database...';
        document.getElementById('details').innerHTML = 'Restoring from: ${path.basename(backupPath)}';
      `);

      // Pass the full path to restoreBackup
      const result = await dbModule.restoreBackup(backupPath, {
        skipEmergencyBackup: false,
        skipConfirmation: true
      });

      if (result.success) {
        progressDialog.webContents.executeJavaScript(`
          document.getElementById('progress').innerHTML = '<span style="color: green;">✓ Restore completed successfully!</span>';
          document.getElementById('details').innerHTML = 'Database restored from: ${path.basename(backupPath)}<br>Application will restart in 3 seconds...';
        `);

        await new Promise(resolve => setTimeout(resolve, 3000));
        progressDialog.close();

        app.relaunch();
        app.exit(0);
      } else {
        throw new Error(result.error || 'Restore failed');
      }
    } catch (error) {
      progressDialog.close();

      try {
        await dbModule.reopenDatabase();
      } catch (recoverError) {
        console.error('Failed to recover database:', recoverError);
      }

      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Restore Failed',
        message: `Failed to restore database:\n\n${error.message}\n\n` +
          `The original database has been preserved.`,
        buttons: ['OK']
      });
    }
  } catch (error) {
    console.error('Restore process failed:', error);
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Restore Process Failed',
      message: `An error occurred during restore:\n\n${error.message}`,
      buttons: ['OK']
    });
  }
}

// Helper functions for export/import
async function exportToSQL(outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      // 🎯 FIX 6: Check database size first
      const dbStats = await new Promise((resolve, reject) => {
        dbModule.getDatabase().get(
          "SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()",
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      const MAX_ALLOWED_SIZE = 100 * 1024 * 1024; // 100MB
      if (dbStats.size > MAX_ALLOWED_SIZE) {
        throw new Error(`Database is too large (${formatBytes(dbStats.size)}). Maximum allowed: ${formatBytes(MAX_ALLOWED_SIZE)}`);
      }

      const tables = await new Promise((resolve, reject) => {
        dbModule.getDatabase().all(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows.map(r => r.name));
          }
        );
      });

      let sqlContent = `-- Stock Control System Database Export\n`;
      sqlContent += `-- Generated: ${new Date().toISOString()}\n`;
      sqlContent += `-- Total Tables: ${tables.length}\n\n`;

      // 🎯 FIX 6: Stream data instead of loading all at once
      const writeStream = fsSync.createWriteStream(outputPath);
      writeStream.write(sqlContent);

      for (const table of tables) {
        const schema = await new Promise((resolve, reject) => {
          dbModule.getDatabase().get(
            `SELECT sql FROM sqlite_master WHERE type='table' AND name=?`,
            [table],
            (err, row) => {
              if (err) reject(err);
              else resolve(row.sql);
            }
          );
        });

        if (schema) {
          writeStream.write(`${schema};\n\n`);
        }

        // Stream rows in chunks
        const rowCount = await new Promise((resolve, reject) => {
          dbModule.getDatabase().get(
            `SELECT COUNT(*) as count FROM ${table}`,
            (err, row) => {
              if (err) reject(err);
              else resolve(row.count);
            }
          );
        });

        if (rowCount > 0) {
          writeStream.write(`-- Data for table: ${table} (${rowCount} rows)\n`);

          const CHUNK_SIZE = 1000;
          let offset = 0;
          let importedRows = 0;

          while (offset < rowCount) {
            const rows = await new Promise((resolve, reject) => {
              dbModule.getDatabase().all(
                `SELECT * FROM ${table} LIMIT ? OFFSET ?`,
                [CHUNK_SIZE, offset],
                (err, rows) => {
                  if (err) reject(err);
                  else resolve(rows);
                }
              );
            });

            for (const row of rows) {
              const columns = Object.keys(row).map(col => `"${col}"`).join(', ');
              const values = Object.values(row).map(val => {
                if (val === null) return 'NULL';
                if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                return val;
              }).join(', ');

              writeStream.write(`INSERT INTO ${table} (${columns}) VALUES (${values});\n`);
              importedRows++;
            }

            offset += CHUNK_SIZE;
          }
          writeStream.write('\n');
        }
      }

      writeStream.end();

      // Wait for stream to finish
      await new Promise(resolve => writeStream.on('finish', resolve));

      const stats = fsSync.statSync(outputPath);

      resolve({
        tables: tables.length,
        size: stats.size
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function importFromSQL(filePath) {
  return new Promise(async (resolve, reject) => {
    try {
      const sqlContent = await fs.readFile(filePath, 'utf8');
      const statements = sqlContent.split(';').filter(stmt => stmt.trim());

      let imported = 0;
      let errors = 0;

      for (const stmt of statements) {
        const trimmedStmt = stmt.trim();
        if (trimmedStmt) {
          // 🎯 FIX 7: Validate SQL for safety
          const unsafePatterns = [
            /\bDROP\s+(TABLE|DATABASE|INDEX)\b/i,
            /\bATTACH\s+DATABASE\b/i,
            /\bDETACH\s+DATABASE\b/i,
            /\bPRAGMA\b/i,
            /\bVACUUM\b/i,
            /\bBEGIN\s+TRANSACTION\b/i,
            /\bCOMMIT\b/i,
            /\bROLLBACK\b/i,
            /;\s*$/m // Multiple statements in one
          ];

          const isUnsafe = unsafePatterns.some(pattern => pattern.test(trimmedStmt));

          if (isUnsafe) {
            console.warn('Skipping potentially unsafe SQL:', trimmedStmt.substring(0, 100));
            errors++;
            continue;
          }

          try {
            await new Promise((resolve, reject) => {
              dbModule.getDatabase().run(trimmedStmt, (err) => {
                if (err) reject(err);
                else resolve();
              });
            });
            imported++;
          } catch (error) {
            console.warn('Error executing statement:', error.message);
            errors++;
          }
        }
      }

      resolve({
        statements: statements.length,
        imported: imported,
        errors: errors,
        safeStatements: imported
      });
    } catch (error) {
      reject(error);
    }
  });
}

function createApplicationMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),

    {
      label: 'File',
      submenu: [
        {
          label: 'Backup Database',
          click: () => backupDatabase(),
          accelerator: 'CmdOrCtrl+B'
        },
        {
          label: 'Restore Database',
          click: () => restoreDatabase(),
          accelerator: 'CmdOrCtrl+Shift+R'
        },
        { type: 'separator' },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) mainWindow.reload();
          }
        },
        {
          label: 'Force Reload',
          accelerator: 'Shift+CmdOrCtrl+R',
          click: () => {
            if (mainWindow) mainWindow.webContents.reloadIgnoringCache();
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle Developer Tools',
          accelerator: isDev ? 'F12' : 'CmdOrCtrl+Shift+I',
          click: () => {
            if (mainWindow) mainWindow.webContents.toggleDevTools();
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: 'Exit' }
      ]
    },

    {
      label: 'Database',
      submenu: [
        {
          label: 'Create Backup',
          click: () => backupDatabase(),
          accelerator: 'CmdOrCtrl+Shift+B' // 🎯 FIX 8: Changed accelerator
        },
        {
          label: 'Restore Backup',
          click: () => restoreDatabase(),
          accelerator: 'CmdOrCtrl+Alt+R'
        },
        { type: 'separator' },
        {
          label: 'Export to SQL',
          click: async () => {
            try {
              const { filePath } = await dialog.showSaveDialog(mainWindow, {
                defaultPath: `stock-export-${new Date().toISOString().split('T')[0]}.sql`,
                filters: [
                  { name: 'SQL Files', extensions: ['sql'] },
                  { name: 'All Files', extensions: ['*'] }
                ],
                properties: ['createDirectory']
              });

              if (filePath) {
                const progressDialog = new BrowserWindow({
                  parent: mainWindow,
                  modal: true,
                  show: false,
                  width: 400,
                  height: 150,
                  resizable: false,
                  webPreferences: {
                    nodeIntegration: true,
                    contextIsolation: false
                  }
                });

                await progressDialog.loadURL(`data:text/html;charset=utf-8,
                  <html><body style="padding: 20px; font-family: Arial;">
                    <h3>Exporting Database...</h3>
                    <div id="progress">Preparing export...</div>
                  </body></html>
                `);
                progressDialog.show();

                try {
                  const result = await exportToSQL(filePath);
                  progressDialog.close();

                  dialog.showMessageBox(mainWindow, {
                    type: 'info',
                    title: 'Export Complete',
                    message: `Database exported successfully!\n\n` +
                      `Tables: ${result.tables}\n` +
                      `File: ${path.basename(filePath)}\n` +
                      `Size: ${formatBytes(result.size)}`,
                    buttons: ['OK']
                  });
                } catch (error) {
                  progressDialog.close();
                  throw error;
                }
              }
            } catch (error) {
              dialog.showMessageBox(mainWindow, {
                type: 'error',
                title: 'Export Failed',
                message: `Failed to export database:\n\n${error.message}`,
                buttons: ['OK']
              });
            }
          }
        },
        {
          label: 'Import from SQL',
          click: async () => {
            try {
              const { filePaths } = await dialog.showOpenDialog(mainWindow, {
                title: 'Select SQL File to Import',
                filters: [
                  { name: 'SQL Files', extensions: ['sql'] },
                  { name: 'All Files', extensions: ['*'] }
                ],
                properties: ['openFile']
              });

              if (filePaths && filePaths.length > 0) {
                const { response } = await dialog.showMessageBox(mainWindow, {
                  type: 'warning',
                  title: 'Import Database',
                  message: 'This will import data from SQL file and may overwrite existing data.',
                  buttons: ['Cancel', 'Import'],
                  defaultId: 0
                });

                if (response === 1) {
                  const progressDialog = new BrowserWindow({
                    parent: mainWindow,
                    modal: true,
                    show: false,
                    width: 400,
                    height: 150,
                    resizable: false,
                    webPreferences: {
                      nodeIntegration: true,
                      contextIsolation: false
                    }
                  });

                  await progressDialog.loadURL(`data:text/html;charset=utf-8,
                    <html><body style="padding: 20px; font-family: Arial;">
                      <h3>Importing Database...</h3>
                      <div id="progress">Starting import...</div>
                    </body></html>
                  `);
                  progressDialog.show();

                  try {
                    const result = await importFromSQL(filePaths[0]);
                    progressDialog.close();

                    dialog.showMessageBox(mainWindow, {
                      type: 'info',
                      title: 'Import Complete',
                      message: `Database import completed!\n\n` +
                        `Statements: ${result.statements}\n` +
                        `Imported: ${result.imported} (safe)\n` +
                        `Skipped: ${result.errors} (unsafe)`,
                      buttons: ['OK']
                    });
                  } catch (error) {
                    progressDialog.close();
                    throw error;
                  }
                }
              }
            } catch (error) {
              dialog.showMessageBox(mainWindow, {
                type: 'error',
                title: 'Import Failed',
                message: `Failed to import database:\n\n${error.message}`,
                buttons: ['OK']
              });
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Database Maintenance',
          click: async () => {
            try {
              const progressDialog = new BrowserWindow({
                parent: mainWindow,
                modal: true,
                show: false,
                width: 400,
                height: 150,
                resizable: false,
                webPreferences: {
                  nodeIntegration: true,
                  contextIsolation: false
                }
              });

              await progressDialog.loadURL(`data:text/html;charset=utf-8,
                <html><body style="padding: 20px; font-family: Arial;">
                  <h3>Running Maintenance...</h3>
                  <div id="progress">Starting VACUUM operation...</div>
                </body></html>
              `);
              progressDialog.show();

              try {
                await new Promise((resolve, reject) => {
                  dbModule.getDatabase().run('VACUUM', (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                });

                progressDialog.webContents.executeJavaScript(`
                  document.getElementById('progress').innerHTML = 'Running ANALYZE...';
                `);

                await new Promise((resolve, reject) => {
                  dbModule.getDatabase().run('ANALYZE', (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                });

                progressDialog.close();

                dialog.showMessageBox(mainWindow, {
                  type: 'info',
                  title: 'Maintenance Complete',
                  message: 'Database maintenance completed successfully.',
                  buttons: ['OK']
                });
              } catch (error) {
                progressDialog.close();
                throw error;
              }
            } catch (error) {
              dialog.showMessageBox(mainWindow, {
                type: 'error',
                title: 'Maintenance Failed',
                message: `Failed to run database maintenance:\n\n${error.message}`,
                buttons: ['OK']
              });
            }
          }
        },
        {
          label: 'Check Database Health',
          click: async () => {
            try {
              const tables = await new Promise((resolve, reject) => {
                dbModule.getDatabase().all(
                  "SELECT name FROM sqlite_master WHERE type='table'",
                  (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                  }
                );
              });

              const tableCounts = {};
              for (const table of tables) {
                const count = await new Promise((resolve, reject) => {
                  dbModule.getDatabase().get(
                    `SELECT COUNT(*) as count FROM ${table.name}`,
                    (err, row) => {
                      if (err) resolve(0);
                      else resolve(row.count);
                    }
                  );
                });
                tableCounts[table.name] = count;
              }

              let message = '✅ Database is healthy\n\n';
              message += `Total Tables: ${tables.length}\n`;
              message += 'Table Records:\n';
              for (const [table, count] of Object.entries(tableCounts)) {
                message += `  • ${table}: ${count} records\n`;
              }

              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Database Health Check',
                message: message,
                buttons: ['OK']
              });
            } catch (error) {
              dialog.showMessageBox(mainWindow, {
                type: 'error',
                title: 'Health Check Failed',
                message: `Failed to check database health:\n\n${error.message}`,
                buttons: ['OK']
              });
            }
          }
        }
      ]
    },

    {
      label: 'Master File',
      submenu: [
        {
          label: 'Item Master',
          click: () => showModule('item-master'),
          accelerator: 'CmdOrCtrl+1'
        },
        {
          label: 'Supplier Master',
          click: () => showModule('supplier-master'),
          accelerator: 'CmdOrCtrl+2'
        }
      ]
    },

    {
      label: 'Data Capture',
      submenu: [
        {
          label: 'Purchase Order',
          click: () => showModule('purchase-order'),
          accelerator: 'CmdOrCtrl+3'
        },
        {
          label: 'GRN Entry',
          click: () => showModule('grn'),
          accelerator: 'CmdOrCtrl+4'
        },
        {
          label: 'Material Issue',
          click: () => showModule('min'),
          accelerator: 'CmdOrCtrl+5'
        },
        {
          label: 'Purchase Return (PRN)',
          click: () => showModule('prn'),
          accelerator: 'CmdOrCtrl+7'
        }
      ]
    },

    {
      label: 'Reports',
      submenu: [
        {
          label: 'View Reports',
          click: () => showModule('reports'),
          accelerator: 'CmdOrCtrl+6'
        }
      ]
    },

    {
      label: 'Help',
      submenu: [
        {
          label: 'About Stock Control System',
          click: () => showAbout(),
          accelerator: 'CmdOrCtrl+H'
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function showModule(moduleName) {
  if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
    // 🎯 FIX 9: Check if renderer is ready before sending
    if (!mainWindow.webContents.isLoading()) {
      mainWindow.webContents.send('navigate-to', moduleName);
    } else {
      // Retry after a short delay
      setTimeout(() => showModule(moduleName), 500);
    }
  }
}

function showAbout() {
  const appVersion = app.getVersion();
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'About Stock Control System',
    message: `Stock Control System \n\n` +
      `Developed by H K S Peiris for JFI CONSOLIDATED (PVT) LTD\n\n` +
      `© ${new Date().getFullYear()} - All rights reserved\n\n` +
      `Running on: ${process.platform}\n` +
      `Electron: ${process.versions.electron}\n` +
      `Node.js: ${process.version}`,
    buttons: ['OK'],
    icon: getIconPath()
  });
}

// Setup IPC Handlers
function setupIPCHandlers() {
  // Database query handler
  ipcMain.handle('execute-query', async (event, sql, params = []) => {
    return new Promise((resolve, reject) => {
      const db = dbModule.getDatabase();
      if (!db) {
        reject(new Error('Database not initialized'));
        return;
      }

      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      } else {
        db.run(sql, params, function (err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      }
    });
  });

  ipcMain.handle('get-data', async (event, sql, params = []) => {
    return new Promise((resolve, reject) => {
      const db = dbModule.getDatabase();
      if (!db) {
        reject(new Error('Database not initialized'));
        return;
      }

      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  });

  ipcMain.handle('get-all-data', async (event, sql, params = []) => {
    return new Promise((resolve, reject) => {
      const db = dbModule.getDatabase();
      if (!db) {
        reject(new Error('Database not initialized'));
        return;
      }

      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  });

  // Backup/Restore IPC handlers
  ipcMain.handle('create-backup', async (event, options = {}) => {
    try {
      const result = await dbModule.createBackup(options);
      return result;
    } catch (error) {
      console.error('Backup creation failed:', error);
      return {
        success: false,
        error: error.message,
        message: 'Backup creation failed'
      };
    }
  });

  ipcMain.handle('restore-backup', async (event, backupFile, options = {}) => {
    try {
      const result = await dbModule.restoreBackup(backupFile, options);
      return result;
    } catch (error) {
      console.error('Restore failed:', error);
      return {
        success: false,
        error: error.message,
        message: 'Restore failed'
      };
    }
  });

  ipcMain.handle('list-backups', async () => {
    try {
      const backups = await dbModule.listBackups();
      return backups;
    } catch (error) {
      console.error('Failed to list backups:', error);
      return [];
    }
  });

  ipcMain.handle('get-backup-config', async () => {
    try {
      const config = dbModule.getBackupConfig();
      return config;
    } catch (error) {
      console.error('Failed to get backup config:', error);
      return {};
    }
  });

  ipcMain.handle('set-backup-config', async (event, config) => {
    try {
      dbModule.setBackupConfig(config);
      return { success: true };
    } catch (error) {
      console.error('Failed to set backup config:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('cleanup-old-backups', async (event, maxBackups, retentionDays) => {
    try {
      const result = await dbModule.cleanupOldBackups(maxBackups, retentionDays);
      return result;
    } catch (error) {
      console.error('Backup cleanup failed:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('schedule-auto-backup', async (event, intervalHours) => {
    try {
      dbModule.startAutoBackup();
      return {
        success: true,
        message: `Auto-backup scheduled every ${intervalHours} hours`
      };
    } catch (error) {
      console.error('Failed to schedule auto-backup:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('stop-auto-backup', async () => {
    try {
      dbModule.stopAutoBackup();
      return { success: true, message: 'Auto-backup stopped' };
    } catch (error) {
      console.error('Failed to stop auto-backup:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('test-connection', async () => {
    try {
      const result = await new Promise((resolve, reject) => {
        dbModule.getDatabase().get('SELECT 1 as test', (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      return {
        success: true,
        connected: true,
        message: 'Database connection successful',
        testResult: result
      };
    } catch (error) {
      console.error('Connection test failed:', error);
      return {
        success: false,
        connected: false,
        error: error.message,
        message: 'Database connection failed'
      };
    }
  });

  ipcMain.handle('check-database-health', async () => {
    try {
      const tables = await new Promise((resolve, reject) => {
        dbModule.getDatabase().all(
          "SELECT name FROM sqlite_master WHERE type='table'",
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      let totalRecords = 0;
      for (const table of tables) {
        const count = await new Promise((resolve, reject) => {
          dbModule.getDatabase().get(
            `SELECT COUNT(*) as count FROM ${table.name}`,
            (err, row) => {
              if (err) resolve(0);
              else resolve(row.count);
            }
          );
        });
        totalRecords += count;
      }

      return {
        healthy: true,
        connection: 'Connected',
        tableCount: tables.length,
        totalRecords: totalRecords
      };
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        healthy: false,
        error: error.message,
        message: 'Database health check failed'
      };
    }
  });

  ipcMain.handle('export-database', async (event, outputPath) => {
    try {
      let exportPath = outputPath;
      if (!exportPath) {
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
          defaultPath: `stock-export-${new Date().toISOString().split('T')[0]}.sql`,
          filters: [
            { name: 'SQL Files', extensions: ['sql'] },
            { name: 'All Files', extensions: ['*'] }
          ],
          properties: ['createDirectory']
        });

        if (!filePath) {
          return { success: false, cancelled: true };
        }
        exportPath = filePath;
      }

      const exportResult = await exportToSQL(exportPath);

      return {
        success: true,
        path: exportPath,
        ...exportResult
      };
    } catch (error) {
      console.error('Export failed:', error);
      return {
        success: false,
        error: error.message,
        message: 'Database export failed'
      };
    }
  });

  ipcMain.handle('import-database', async (event, filePath) => {
    try {
      if (!filePath) {
        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
          title: 'Select SQL File to Import',
          filters: [
            { name: 'SQL Files', extensions: ['sql'] },
            { name: 'All Files', extensions: ['*'] }
          ],
          properties: ['openFile']
        });

        if (!filePaths || filePaths.length === 0) {
          return { success: false, cancelled: true };
        }
        filePath = filePaths[0];
      }

      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Import Database',
        message: 'This will import data from SQL file and may overwrite existing data.',
        buttons: ['Cancel', 'Import'],
        defaultId: 0
      });

      if (response !== 1) {
        return { success: false, cancelled: true };
      }

      const importResult = await importFromSQL(filePath);

      return {
        success: true,
        path: filePath,
        ...importResult
      };
    } catch (error) {
      console.error('Import failed:', error);
      return {
        success: false,
        error: error.message,
        message: 'Database import failed'
      };
    }
  });

  ipcMain.handle('run-database-maintenance', async () => {
    try {
      await new Promise((resolve, reject) => {
        dbModule.getDatabase().run('VACUUM', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await new Promise((resolve, reject) => {
        dbModule.getDatabase().run('ANALYZE', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      return {
        success: true,
        message: 'Database maintenance completed'
      };
    } catch (error) {
      console.error('Maintenance failed:', error);
      return {
        success: false,
        error: error.message,
        message: 'Database maintenance failed'
      };
    }
  });

  // App info handler
  ipcMain.handle('get-app-info', async () => {
    return {
      version: app.getVersion(),
      platform: process.platform,
      isDev: isDev,
      userDataPath: app.getPath('userData')
    };
  });

  console.log('✅ IPC handlers setup complete');
}

// App lifecycle
app.whenReady().then(async () => {
  console.log('='.repeat(50));
  console.log('🚀 Stock Control System Starting...');
  console.log('='.repeat(50));
  console.log('Version:', app.getVersion());
  console.log('Mode:', isDev ? 'Development' : 'Production');
  console.log('Platform:', process.platform);
  console.log('User Data Path:', app.getPath('userData'));
  console.log('App Path:', app.getAppPath());
  console.log('Resources Path:', process.resourcesPath);

  try {
    // 🎯 FIX 3: Setup IPC handlers BEFORE creating window
    setupIPCHandlers();

    // 🎯 FIX 1: Async database initialization
    console.log('🔧 Initializing database...');
    await dbModule.initializeDatabase();
    console.log('✅ Database initialized successfully');

    // 🎯 FIX 2: Start auto-backup ONLY HERE (not in initializeDatabase)
    const config = dbModule.getBackupConfig();
    if (config.autoBackup) {
      dbModule.startAutoBackup();
      console.log('✅ Auto-backup enabled');
    }

    // Create main window AFTER database is ready
    createWindow();

    console.log('✅ Application startup complete');
    console.log('='.repeat(50));
  } catch (error) {
    console.error('❌ Startup failed:', error);
    dialog.showErrorBox(
      'Application Startup Error',
      `Failed to start application:\n\n${error.message}\n\n` +
      'Please check the logs or contact support.'
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  console.log('📝 All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  console.log('🔍 App activated');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', (event) => {
  console.log('🔒 Application shutting down...');

  if (global.isQuitting) {
    return;
  }
  global.isQuitting = true;

  // Close database gracefully
  const db = dbModule.getDatabase();
  if (db) {
    console.log('Closing database connection...');
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('✅ Database closed successfully');
      }
    });
  }

  console.log('✅ Application shutdown complete');
});

app.on('quit', () => {
  console.log('👋 Application quit');
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);

  if (mainWindow && !mainWindow.isDestroyed()) {
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Unexpected Error',
      message: `An unexpected error occurred:\n\n${error.message}\n\n` +
        'The application may become unstable.',
      buttons: ['Continue', 'Quit']
    }).then(({ response }) => {
      if (response === 1) {
        app.quit();
      }
    });
  }
});