// src/services/databaseService.js - UPDATED WITH ERROR FIX
class DatabaseService {
  constructor() {
    console.log('DatabaseService constructor called');

    // Check if we're in Electron environment
    this.isElectron = typeof window !== 'undefined' &&
      window.electronAPI !== undefined;

    this.dbInitialized = false;
    this.initializationPromise = null;
    this.dbStructureChecked = false;

    console.log('Environment:', this.isElectron ? 'Electron' : 'Browser/Development');

    // Ensure electronAPI methods exist - with safe handling
    this.ensureElectronAPIMethods();
  }

  // ==================== INITIALIZATION & SETUP ====================

  async ensureInitialized() {
    if (this.dbInitialized) {
      return true;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        console.log('Initializing DatabaseService...');

        if (this.isElectron && window.electronAPI?.initializeDatabase) {
          console.log('Using Electron database');
          const result = await window.electronAPI.initializeDatabase();
          console.log('Electron database initialized:', result);
          this.dbInitialized = true;
          return result;
        } else {
          console.log('Using mock database (development mode)');
          this.dbInitialized = true;
          return { success: true, message: 'Development mode - mock database' };
        }
      } catch (error) {
        console.error('Database initialization failed:', error);
        this.dbInitialized = true; // Still mark as initialized for development
        return {
          success: false,
          message: 'Database initialization failed, using mock data',
          error: error.message
        };
      }
    })();

    return this.initializationPromise;
  }

  ensureElectronAPIMethods() {
    if (typeof window === 'undefined') return;

    // Check if window.electronAPI exists and is extensible
    if (!window.electronAPI) {
      // Create a new object if it doesn't exist
      try {
        window.electronAPI = {};
      } catch (error) {
        console.warn('Cannot create electronAPI object:', error.message);
        this.isElectron = false;
        return;
      }
    } else {
      // Check if the object is extensible
      try {
        Object.isExtensible(window.electronAPI);
      } catch (error) {
        console.warn('electronAPI object is not extensible:', error.message);
        this.isElectron = false;
        return;
      }
    }

    // Define mock methods if they don't exist (for development)
    const methods = {
      initializeDatabase: async () => ({
        success: true,
        message: 'Mock database initialized'
      }),
      executeQuery: async (sql, params) => {
        console.log('Mock executeQuery:', sql.substring(0, 100), params);
        return {
          id: Date.now(),
          changes: 1,
          lastInsertRowid: Date.now()
        };
      },
      getData: async (sql, params) => {
        console.log('Mock getData:', sql.substring(0, 100), params);

        // Return appropriate mock data based on query
        if (sql.includes('COUNT(*)')) {
          return { count: 5 };
        }
        if (sql.includes('SELECT 1')) {
          return { test: 1 };
        }
        if (sql.includes('purchase_orders') && sql.includes('WHERE')) {
          return this.getMockPODetails(1) || this.getMockPODetailsByNumber('PO-2024-001');
        }
        if (sql.includes('items') && sql.includes('WHERE')) {
          return {
            item_code: params?.[0] || 'ITM-001',
            description: 'Sample Item',
            category: 'RAW',
            unit: 'PC',
            stock_on_hand: 100
          };
        }
        return null;
      },
      getAllData: async (sql, params) => {
        console.log('Mock getAllData:', sql.substring(0, 100), params);

        if (sql.includes('item_categories')) {
          return [
            { category_id: 1, category_code: 'RAW', category_name: 'Raw Materials' },
            { category_id: 2, category_code: 'FIN', category_name: 'Finished Goods' },
            { category_id: 3, category_code: 'SPR', category_name: 'Spare Parts' }
          ];
        }
        if (sql.includes('measuring_units')) {
          return [
            { unit_id: 1, unit_code: 'PC', unit_name: 'Piece' },
            { unit_id: 2, unit_code: 'KG', unit_name: 'Kilogram' },
            { unit_id: 3, unit_code: 'M', unit_name: 'Meter' }
          ];
        }
        if (sql.includes('grn_items')) {
          return [
            {
              grn_item_id: 1,
              grn_no: params?.[0] || 'GRN-2024-001',
              item_code: 'ITM-001',
              description: 'Steel Pipe',
              unit: 'PC',
              quantity: 100,
              unit_price: 150.00,
              value: 15000.00
            }
          ];
        }
        if (sql.includes('purchase_return_items')) {
          return [
            {
              id: 1,
              prn_no: params?.[0] || 'PRN-2512-001',
              item_code: 'ITM-001',
              description: 'Steel Pipe',
              unit: 'PC',
              returned_qty: 10,
              unit_price: 150.00,
              value: 1500.00
            }
          ];
        }
        return [];
      }
    };

    // Add missing methods safely
    Object.keys(methods).forEach(method => {
      if (!window.electronAPI[method]) {
        try {
          // Use Object.defineProperty for safe assignment
          Object.defineProperty(window.electronAPI, method, {
            value: methods[method],
            writable: true,
            enumerable: true,
            configurable: true
          });
        } catch (error) {
          console.warn(`Cannot add method ${method} to electronAPI:`, error.message);
        }
      }
    });

    // Update isElectron flag
    this.isElectron = window.electronAPI !== undefined;
  }

  // ==================== CORE DATABASE METHODS ====================

  async execute(sql, params = []) {
    await this.ensureInitialized();

    try {
      console.log('Executing SQL:', sql.substring(0, 200));
      console.log('Params:', params);

      if (this.isElectron && window.electronAPI?.executeQuery) {
        const result = await window.electronAPI.executeQuery(sql, params);
        return result || { changes: 0, lastInsertRowid: 0 };
      } else {
        // Development mode
        console.log('Development mode - mock execute');
        return {
          id: Date.now(),
          changes: 1,
          lastInsertRowid: Date.now()
        };
      }
    } catch (error) {
      console.error('Execute error:', error);
      return {
        id: Date.now(),
        changes: 0,
        error: error.message,
        lastInsertRowid: 0
      };
    }
  }

  async get(sql, params = []) {
    await this.ensureInitialized();

    try {
      console.log('Getting data:', sql.substring(0, 200));
      console.log('Params:', params);

      if (this.isElectron && window.electronAPI?.getData) {
        return await window.electronAPI.getData(sql, params);
      } else {
        // Development mode - return mock data
        console.log('Development mode - mock get');
        return this.getMockGetData(sql, params);
      }
    } catch (error) {
      console.error('Get error:', error);
      return null;
    }
  }

  async all(sql, params = []) {
    await this.ensureInitialized();

    try {
      console.log('Getting all data:', sql.substring(0, 200));
      console.log('Params:', params);

      if (this.isElectron && window.electronAPI?.getAllData) {
        const result = await window.electronAPI.getAllData(sql, params);
        return Array.isArray(result) ? result : [];
      } else {
        // Development mode - return mock data
        console.log('Development mode - mock all');
        return this.getMockAllData(sql, params);
      }
    } catch (error) {
      console.error('All error:', error);
      return [];
    }
  }

  // ==================== MOCK DATA GENERATORS ====================

  getMockGetData(sql, params) {
    if (sql.includes('COUNT(*)')) {
      if (sql.includes('active_flag = 1')) {
        return { count: 25 };
      }
      if (sql.includes('grn')) {
        return { count: 10 };
      }
      if (sql.includes('purchase_orders')) {
        return { count: 8 };
      }
      return { count: 50 };
    }

    if (sql.includes('SUM(')) {
      return { total: 125000.50 };
    }

    if (sql.includes('SELECT 1')) {
      return { test: 1 };
    }

    if (sql.includes('item_code =')) {
      return {
        item_code: params[0] || 'ITM-001',
        description: 'Sample Item',
        category: 'RAW',
        unit: 'PC',
        stock_on_hand: 100,
        reorder_level: 50,
        active_flag: 1
      };
    }

    if (sql.includes('grn_no =')) {
      return {
        grn_no: params[0] || 'GRN-2024-001',
        grn_date: '2024-01-15',
        supplier_code: 'SUP001',
        supplier_name: 'Steel Works Ltd',
        total_amount: 25000.00,
        status: 'RECEIVED'
      };
    }

    if (sql.includes('po_no =') && sql.includes('purchase_orders')) {
      return {
        po_id: 1,
        po_no: params[0] || 'PO-2024-001',
        po_date: '2024-01-15',
        supplier_code: 'SUP001',
        supplier_name: 'Steel Works Ltd',
        total_amount: 25000.00,
        status: 'PENDING'
      };
    }

    if (sql.includes('supplier_code =')) {
      return {
        supplier_code: params[0] || 'SUP001',
        name: 'Steel Works Ltd',
        address1: '123 Industrial Zone',
        address2: 'Colombo 10',
        contact_person: 'Mr. Smith',
        telephone1: '011-2345678',
        active_flag: 1
      };
    }

    return null;
  }

  getMockAllData(sql, params) {
    // Items with details
    if (sql.includes('items') && sql.includes('LEFT JOIN')) {
      return [
        {
          item_code: 'ITM-001',
          description: 'Steel Pipe',
          category: 'RAW',
          sub_category: 'Steel',
          unit: 'PC',
          stock_on_hand: 125,
          reorder_level: 50,
          active_flag: 1,
          category_name: 'Raw Materials',
          unit_name: 'Piece'
        },
        {
          item_code: 'ITM-002',
          description: 'M12 Bolts',
          category: 'SPR',
          sub_category: 'Fasteners',
          unit: 'PC',
          stock_on_hand: 750,
          reorder_level: 500,
          active_flag: 1,
          category_name: 'Spare Parts',
          unit_name: 'Piece'
        },
        {
          item_code: 'ITM-003',
          description: 'Engine Oil',
          category: 'CON',
          sub_category: 'Lubricants',
          unit: 'L',
          stock_on_hand: 35,
          reorder_level: 20,
          active_flag: 1,
          category_name: 'Consumables',
          unit_name: 'Liter'
        }
      ];
    }

    // Item categories
    if (sql.includes('item_categories')) {
      return [
        { category_id: 1, category_code: 'RAW', category_name: 'Raw Materials', description: 'Raw materials' },
        { category_id: 2, category_code: 'FIN', category_name: 'Finished Goods', description: 'Completed products' },
        { category_id: 3, category_code: 'SPR', category_name: 'Spare Parts', description: 'Machine parts' },
        { category_id: 4, category_code: 'CON', category_name: 'Consumables', description: 'Supplies' },
        { category_id: 5, category_code: 'TOOL', category_name: 'Tools & Equipment', description: 'Tools' }
      ];
    }

    // Measuring units
    if (sql.includes('measuring_units')) {
      return [
        { unit_id: 1, unit_code: 'PC', unit_name: 'Piece', description: 'Individual piece' },
        { unit_id: 2, unit_code: 'KG', unit_name: 'Kilogram', description: 'Weight' },
        { unit_id: 3, unit_code: 'M', unit_name: 'Meter', description: 'Length' },
        { unit_id: 4, unit_code: 'L', unit_name: 'Liter', description: 'Volume' },
        { unit_id: 5, unit_code: 'SET', unit_name: 'Set', description: 'Set of items' }
      ];
    }

    // Suppliers
    if (sql.includes('suppliers')) {
      return [
        {
          supplier_code: 'SUP001',
          name: 'Steel Works Ltd',
          address1: '123 Industrial Zone',
          address2: 'Colombo 10',
          contact_person: 'Mr. Smith',
          telephone1: '011-2345678',
          email: 'info@steelworks.lk',
          active_flag: 1
        },
        {
          supplier_code: 'SUP002',
          name: 'Fasteners Inc',
          address1: '456 Engineering Park',
          address2: 'Pune',
          contact_person: 'Ms. Johnson',
          telephone1: '011-3456789',
          email: 'sales@fasteners.com',
          active_flag: 1
        }
      ];
    }

    // Purchase Orders
    if (sql.includes('purchase_orders')) {
      const basePOs = [
        {
          po_id: 1,
          po_no: 'PO-2024-001',
          po_date: '2024-01-15',
          supplier_code: 'SUP001',
          supplier_name: 'Steel Works Ltd',
          total_amount: 25000.00,
          status: 'PENDING'
        },
        {
          po_id: 2,
          po_no: 'PO-2024-002',
          po_date: '2024-01-20',
          supplier_code: 'SUP002',
          supplier_name: 'Fasteners Inc',
          total_amount: 15000.00,
          status: 'APPROVED'
        }
      ];

      // Filter by supplier if specified
      if (params.length > 0 && sql.includes('supplier_code = ?')) {
        return basePOs.filter(po => po.supplier_code === params[0]);
      }

      return basePOs;
    }

    // GRNs
    if (sql.includes('grn') && !sql.includes('grn_items')) {
      return [
        {
          grn_id: 1,
          grn_no: 'GRN-2024-001',
          grn_date: '2024-01-16',
          supplier_code: 'SUP001',
          supplier_name: 'Steel Works Ltd',
          total_amount: 25000.00,
          status: 'COMPLETED'
        },
        {
          grn_id: 2,
          grn_no: 'GRN-2024-002',
          grn_date: '2024-01-25',
          supplier_code: 'SUP002',
          supplier_name: 'Fasteners Inc',
          total_amount: 15000.00,
          status: 'PENDING'
        }
      ];
    }

    // GRN Items
    if (sql.includes('grn_items')) {
      return [
        {
          grn_item_id: 1,
          grn_no: params[0] || 'GRN-2024-001',
          item_code: 'ITM-001',
          description: 'Steel Pipe',
          quantity: 100,
          unit_price: 150.00,
          value: 15000.00
        },
        {
          grn_item_id: 2,
          grn_no: params[0] || 'GRN-2024-001',
          item_code: 'ITM-002',
          description: 'M12 Bolts',
          quantity: 500,
          unit_price: 10.00,
          value: 5000.00
        }
      ];
    }

    return [];
  }

  // ==================== PURCHASE ORDER METHODS ====================

  async getPODetails(poId) {
    await this.ensureInitialized();

    try {
      console.log('Getting PO details for ID:', poId);

      // SAFE QUERY: Only select columns that definitely exist
      const sql = `
        SELECT po.*, s.name as supplier_name
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_code = s.supplier_code
        WHERE po.po_id = ?
      `;

      if (this.isElectron && window.electronAPI?.getData) {
        const poDetails = await window.electronAPI.getData(sql, [poId]);

        if (poDetails) {
          // Get PO items
          const itemsSql = `
            SELECT poi.*, i.description as item_description, i.unit as item_unit
            FROM purchase_order_items poi
            LEFT JOIN items i ON poi.item_code = i.item_code
            WHERE poi.po_id = ?
            ORDER BY poi.line_no
          `;

          const items = await window.electronAPI.getAllData(itemsSql, [poId]);
          poDetails.items = Array.isArray(items) ? items : [];
        }

        return poDetails;
      } else {
        // Development mode
        return this.getMockPODetails(poId);
      }
    } catch (error) {
      console.error('Error getting PO details:', error);
      return null;
    }
  }

  async getPODetailsByNumber(poNo) {
    await this.ensureInitialized();

    try {
      console.log('Getting PO details for PO Number:', poNo);

      // SAFE QUERY: Only select columns that definitely exist
      const sql = `
        SELECT po.*, s.name as supplier_name
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_code = s.supplier_code
        WHERE po.po_no = ?
      `;

      if (this.isElectron && window.electronAPI?.getData) {
        const poDetails = await window.electronAPI.getData(sql, [poNo]);

        if (poDetails) {
          // Get PO items
          const itemsSql = `
            SELECT poi.*, i.description as item_description, i.unit as item_unit
            FROM purchase_order_items poi
            LEFT JOIN items i ON poi.item_code = i.item_code
            WHERE poi.po_no = ?
            ORDER BY poi.line_no
          `;

          const items = await window.electronAPI.getAllData(itemsSql, [poNo]);
          poDetails.items = Array.isArray(items) ? items : [];
        }

        return poDetails;
      } else {
        // Development mode
        return this.getMockPODetailsByNumber(poNo);
      }
    } catch (error) {
      console.error('Error getting PO details by number:', error);
      return null;
    }
  }

  async getPurchaseOrders() {
    return await this.all(`
      SELECT po.*, s.name as supplier_name 
      FROM purchase_orders po 
      LEFT JOIN suppliers s ON po.supplier_code = s.supplier_code 
      ORDER BY po.created_date DESC
    `);
  }

  async getPOItems(poId) {
    await this.ensureInitialized();

    try {
      console.log('Getting PO items for ID:', poId);

      const sql = `
        SELECT poi.*, i.description as item_description, i.unit as item_unit
        FROM purchase_order_items poi
        LEFT JOIN items i ON poi.item_code = i.item_code
        WHERE poi.po_id = ?
        ORDER BY poi.line_no
      `;

      return await this.all(sql, [poId]);
    } catch (error) {
      console.error('Error getting PO items:', error);
      return [];
    }
  }

  async getPOItemsByNumber(poNo) {
    await this.ensureInitialized();

    try {
      console.log('Getting PO items for PO Number:', poNo);

      const sql = `
        SELECT poi.*, i.description as item_description, i.unit as item_unit
        FROM purchase_order_items poi
        LEFT JOIN items i ON poi.item_code = i.item_code
        WHERE poi.po_no = ?
        ORDER BY poi.line_no
      `;

      return await this.all(sql, [poNo]);
    } catch (error) {
      console.error('Error getting PO items by number:', error);
      return [];
    }
  }

  async getSupplierPOs(supplierCode) {
    await this.ensureInitialized();

    try {
      console.log('Getting POs for supplier:', supplierCode);

      return await this.all(`
        SELECT po.*, s.name as supplier_name 
        FROM purchase_orders po 
        LEFT JOIN suppliers s ON po.supplier_code = s.supplier_code 
        WHERE po.supplier_code = ? AND po.status IN ('PENDING', 'APPROVED', 'PARTIAL')
        ORDER BY po.po_date DESC
      `, [supplierCode]);
    } catch (error) {
      console.error('Error getting supplier POs:', error);
      return [];
    }
  }

  async getPreviousPrice(supplierCode, itemCode) {
    await this.ensureInitialized();

    try {
      const sql = `
        SELECT unit_price 
        FROM purchase_order_items poi
        JOIN purchase_orders po ON poi.po_no = po.po_no
        WHERE po.supplier_code = ? AND poi.item_code = ?
        ORDER BY po.po_date DESC
        LIMIT 1
      `;

      const result = await this.get(sql, [supplierCode, itemCode]);
      return result ? result.unit_price : null;
    } catch (error) {
      console.error('Error getting previous price:', error);
      return null;
    }
  }

  // ==================== GRN METHODS ====================

  async getGRNDetails(grnNo) {
    await this.ensureInitialized();

    try {
      const sql = `
        SELECT g.*, s.name as supplier_name
        FROM grn g
        LEFT JOIN suppliers s ON g.supplier_code = s.supplier_code
        WHERE g.grn_no = ?
      `;

      return await this.get(sql, [grnNo]);
    } catch (error) {
      console.error('Error getting GRN details:', error);
      return null;
    }
  }

  async getGRNItems(grnNo) {
    await this.ensureInitialized();

    try {
      const sql = `
        SELECT gi.*, i.description as full_description
        FROM grn_items gi
        LEFT JOIN items i ON gi.item_code = i.item_code
        WHERE gi.grn_no = ?
        ORDER BY gi.grn_item_id
      `;

      return await this.all(sql, [grnNo]);
    } catch (error) {
      console.error('Error getting GRN items:', error);
      return [];
    }
  }

  async getGRNs() {
    return await this.all(`
      SELECT g.*, s.name as supplier_name 
      FROM grn g 
      LEFT JOIN suppliers s ON g.supplier_code = s.supplier_code 
      ORDER BY g.grn_date DESC
    `);
  }

  async saveGRN(grnData, lineItems) {
    await this.ensureInitialized();

    try {
      const totalAmount = lineItems.reduce((sum, item) => sum + parseFloat(item.value), 0);

      // Check if GRN already exists
      const existingGRN = await this.get(
        'SELECT grn_no FROM grn WHERE grn_no = ?',
        [grnData.grn_no]
      );

      if (existingGRN) {
        // Update existing GRN
        await this.execute(
          `UPDATE grn SET 
            grn_date = ?, grn_type = ?, location = ?, supplier_code = ?, supplier_name = ?,
            invoice_no = ?, receipt_date = ?, payment_mode = ?, total_amount = ?, 
            remark = ?, updated_date = CURRENT_TIMESTAMP
           WHERE grn_no = ?`,
          [
            grnData.grn_date, grnData.grn_type, grnData.location, grnData.supplier_code, grnData.supplier_name,
            grnData.invoice_no, grnData.receipt_date, grnData.payment_mode, totalAmount,
            grnData.remark || null,
            grnData.grn_no
          ]
        );

        // Delete existing items
        await this.execute('DELETE FROM grn_items WHERE grn_no = ?', [grnData.grn_no]);
      } else {
        // Insert new GRN
        await this.execute(
          `INSERT INTO grn (
            grn_no, grn_date, grn_type, location, supplier_code, supplier_name,
            invoice_no, receipt_date, payment_mode, total_amount, remark
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            grnData.grn_no, grnData.grn_date, grnData.grn_type, grnData.location,
            grnData.supplier_code, grnData.supplier_name, grnData.invoice_no,
            grnData.receipt_date, grnData.payment_mode, totalAmount, grnData.remark || null
          ]
        );
      }

      // Insert GRN items
      for (const item of lineItems) {
        await this.execute(
          `INSERT INTO grn_items (
            grn_no, po_no, item_code, description, unit, quantity, unit_price, value
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            grnData.grn_no, item.po_no || null, item.item_code, item.description,
            item.unit, item.quantity, item.unit_price, item.value
          ]
        );

        // Update stock (optional - you can comment this out if not needed)
        if (item.item_code && item.quantity) {
          await this.execute(
            `UPDATE items SET stock_on_hand = stock_on_hand + ? WHERE item_code = ?`,
            [item.quantity, item.item_code]
          );
        }
      }

      return {
        success: true,
        message: existingGRN ? 'GRN updated successfully' : 'GRN saved successfully',
        grnNo: grnData.grn_no
      };
    } catch (error) {
      console.error('Error saving GRN:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to save GRN'
      };
    }
  }

  async updateGRN(grnNo, grnData, lineItems) {
    return await this.saveGRN({ ...grnData, grn_no: grnNo }, lineItems);
  }

  async deleteGRN(grnNo) {
    await this.ensureInitialized();

    try {
      // Get items first to reverse stock (optional)
      const items = await this.all('SELECT * FROM grn_items WHERE grn_no = ?', [grnNo]);

      // Delete items
      await this.execute('DELETE FROM grn_items WHERE grn_no = ?', [grnNo]);

      // Delete GRN
      await this.execute('DELETE FROM grn WHERE grn_no = ?', [grnNo]);

      // Reverse stock (optional)
      for (const item of items) {
        if (item.item_code && item.quantity) {
          await this.execute(
            `UPDATE items SET stock_on_hand = stock_on_hand - ? WHERE item_code = ?`,
            [item.quantity, item.item_code]
          );
        }
      }

      return {
        success: true,
        message: 'GRN deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting GRN:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to delete GRN'
      };
    }
  }

  // ==================== PRN (PURCHASE RETURN) METHODS ====================

  async getGRNReturnedSummary(grnNo) {
    await this.ensureInitialized();
    try {
      const sql = `
        SELECT item_code, SUM(returned_qty) as already_returned
        FROM purchase_return_items
        WHERE grn_no = ?
        GROUP BY item_code
      `;
      return await this.all(sql, [grnNo]);
    } catch (error) {
      console.error('Error getting GRN returned summary:', error);
      return [];
    }
  }

  async savePurchaseReturn(prnData) {
    await this.ensureInitialized();
    try {
      // Step 1: Start Transaction
      await this.execute('BEGIN TRANSACTION');

      // Step 2: Validate GRN existence and items (this is mostly done in UI, but good to have here)
      const grn = await this.get('SELECT grn_no FROM grn WHERE grn_no = ?', [prnData.header.grn_no]);
      if (!grn) throw new Error(`GRN ${prnData.header.grn_no} not found`);

      // Step 3: Insert PRN Header
      const headerSql = `
        INSERT INTO purchase_returns (
          prn_no, prn_date, grn_no, supplier_code, supplier_name, reason, remark, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await this.execute(headerSql, [
        prnData.header.prn_no,
        prnData.header.prn_date,
        prnData.header.grn_no,
        prnData.header.supplier_code,
        prnData.header.supplier_name,
        prnData.header.reason,
        prnData.header.remark || null,
        prnData.header.status || 'CONFIRMED'
      ]);

      // Step 4: Process Line Items
      for (const item of prnData.items) {
        if (item.returned_qty <= 0) continue;

        // Insert PRN Item
        const itemSql = `
          INSERT INTO purchase_return_items (
            prn_no, grn_no, item_code, description, unit, returned_qty, unit_price, value
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await this.execute(itemSql, [
          prnData.header.prn_no,
          prnData.header.grn_no,
          item.item_code,
          item.description,
          item.unit,
          item.returned_qty,
          item.unit_price || 0,
          item.value || 0
        ]);

        // Step 5: Deduct Stock
        await this.execute(
          'UPDATE items SET stock_on_hand = stock_on_hand - ? WHERE item_code = ?',
          [item.returned_qty, item.item_code]
        );

        // Step 6: Insert into Stock Ledger
        const ledgerSql = `
          INSERT INTO stock_ledger (item_code, transaction_type, ref_no, qty_out, date)
          VALUES (?, 'PRN', ?, ?, ?)
        `;
        await this.execute(ledgerSql, [
          item.item_code,
          prnData.header.prn_no,
          item.returned_qty,
          prnData.header.prn_date
        ]);
      }

      // Step 7: Commit Transaction
      await this.execute('COMMIT');
      return { success: true, prnNo: prnData.header.prn_no };

    } catch (error) {
      // Step 8: Rollback on Error
      try {
        await this.execute('ROLLBACK');
      } catch (rbError) {
        console.error('Rollback failed:', rbError);
      }
      console.error('Error saving Purchase Return:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to save Purchase Return'
      };
    }
  }

  async getPurchaseReturns() {
    await this.ensureInitialized();
    try {
      const sql = `
        SELECT 
          pr.*,
          COUNT(pri.id) as item_count,
          SUM(pri.value) as total_value
        FROM purchase_returns pr
        LEFT JOIN purchase_return_items pri ON pr.prn_no = pri.prn_no
        GROUP BY pr.prn_no
        ORDER BY pr.prn_date DESC
      `;
      return await this.all(sql);
    } catch (error) {
      console.error('Error getting Purchase Returns:', error);
      return [];
    }
  }

  async getPurchaseReturn(prnNo) {
    await this.ensureInitialized();
    try {
      const headerSql = 'SELECT * FROM purchase_returns WHERE prn_no = ?';
      const itemsSql = 'SELECT * FROM purchase_return_items WHERE prn_no = ?';

      const header = await this.get(headerSql, [prnNo]);
      if (!header) throw new Error(`Purchase Return ${prnNo} not found`);

      const items = await this.all(itemsSql, [prnNo]);
      return { header, items };
    } catch (error) {
      console.error('Error getting Purchase Return details:', error);
      throw error;
    }
  }

  // ==================== ITEM MASTER METHODS ====================

  async getItemCategories() {
    return await this.all('SELECT * FROM item_categories ORDER BY category_name');
  }

  async getMeasuringUnits() {
    return await this.all('SELECT * FROM measuring_units ORDER BY unit_name');
  }

  async getItems() {
    return await this.all(`
      SELECT i.*, ic.category_name, mu.unit_name 
      FROM items i
      LEFT JOIN item_categories ic ON i.category = ic.category_code
      LEFT JOIN measuring_units mu ON i.unit = mu.unit_code
      ORDER BY i.created_date DESC
    `);
  }

  async getItem(itemCode) {
    return await this.get(`
      SELECT i.*, ic.category_name, mu.unit_name 
      FROM items i
      LEFT JOIN item_categories ic ON i.category = ic.category_code
      LEFT JOIN measuring_units mu ON i.unit = mu.unit_code
      WHERE i.item_code = ?
    `, [itemCode]);
  }

  async addItem(itemData) {
    try {
      const sql = `
        INSERT INTO items (
          item_code, description, product_description, category, sub_category,
          specifications, unit, location, reorder_level, reorder_qty, 
          stock_on_hand, active_flag
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        itemData.item_code,
        itemData.description,
        itemData.product_description || '',
        itemData.category || '',
        itemData.sub_category || '',
        itemData.specifications || '',
        itemData.unit || '',
        itemData.location || '',
        parseFloat(itemData.reorder_level) || 0,
        parseFloat(itemData.reorder_qty) || 0,
        parseFloat(itemData.stock_on_hand) || 0,
        itemData.active_flag ? 1 : 0
      ];

      const result = await this.execute(sql, params);

      return {
        success: true,
        result,
        message: `Item ${itemData.item_code} added successfully`
      };
    } catch (error) {
      console.error('Error adding item:', error);
      return {
        success: false,
        error: error.message,
        message: `Failed to add item: ${error.message}`
      };
    }
  }

  async updateItem(itemCode, itemData) {
    try {
      const sql = `
        UPDATE items SET 
          description = ?, product_description = ?, category = ?, sub_category = ?,
          specifications = ?, unit = ?, location = ?, reorder_level = ?, reorder_qty = ?,
          stock_on_hand = ?, active_flag = ?, updated_date = CURRENT_TIMESTAMP
        WHERE item_code = ?
      `;

      const params = [
        itemData.description,
        itemData.product_description || '',
        itemData.category || '',
        itemData.sub_category || '',
        itemData.specifications || '',
        itemData.unit || '',
        itemData.location || '',
        parseFloat(itemData.reorder_level) || 0,
        parseFloat(itemData.reorder_qty) || 0,
        parseFloat(itemData.stock_on_hand) || 0,
        itemData.active_flag ? 1 : 0,
        itemCode
      ];

      const result = await this.execute(sql, params);

      return {
        success: true,
        result,
        message: `Item ${itemCode} updated successfully`
      };
    } catch (error) {
      console.error('Error updating item:', error);
      return {
        success: false,
        error: error.message,
        message: `Failed to update item: ${error.message}`
      };
    }
  }

  async deleteItem(itemCode) {
    try {
      const result = await this.execute('DELETE FROM items WHERE item_code = ?', [itemCode]);

      return {
        success: true,
        result,
        message: `Item ${itemCode} deleted successfully`
      };
    } catch (error) {
      console.error('Error deleting item:', error);
      return {
        success: false,
        error: error.message,
        message: `Failed to delete item: ${error.message}`
      };
    }
  }

  async searchItems(searchTerm) {
    if (!searchTerm) return await this.getItems();

    return await this.all(`
      SELECT i.*, ic.category_name, mu.unit_name 
      FROM items i
      LEFT JOIN item_categories ic ON i.category = ic.category_code
      LEFT JOIN measuring_units mu ON i.unit = mu.unit_code
      WHERE i.item_code LIKE ? 
        OR i.description LIKE ? 
        OR i.product_description LIKE ?
        OR ic.category_name LIKE ?
      ORDER BY i.item_code
    `, [
      `%${searchTerm}%`,
      `%${searchTerm}%`,
      `%${searchTerm}%`,
      `%${searchTerm}%`
    ]);
  }

  // ==================== SUPPLIER METHODS ====================

  async getSuppliers() {
    return await this.all('SELECT * FROM suppliers WHERE active_flag = 1 ORDER BY name');
  }

  async getSupplier(supplierCode) {
    return await this.get('SELECT * FROM suppliers WHERE supplier_code = ?', [supplierCode]);
  }

  // ==================== UTILITY METHODS ====================

  async checkDatabaseHealth() {
    try {
      const connection = await this.get('SELECT 1 as test');

      return {
        success: true,
        connection: connection ? 'OK' : 'FAILED',
        mode: this.isElectron ? 'Electron' : 'Development',
        initialized: this.dbInitialized,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        mode: this.isElectron ? 'Electron' : 'Development',
        timestamp: new Date().toISOString()
      };
    }
  }

  async testConnection() {
    try {
      const result = await this.get('SELECT 1 as test');
      return {
        success: true,
        connected: !!result,
        message: result ? 'Database connection successful' : 'Database connection failed'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Connection test failed: ${error.message}`
      };
    }
  }

  // ==================== MOCK DATA FOR DEVELOPMENT ====================

  getMockPODetails(poId) {
    const mockPOs = {
      1: {
        po_id: 1,
        po_no: 'PO-2024-001',
        po_date: '2024-01-15',
        supplier_code: 'SUP001',
        supplier_name: 'Steel Works Ltd',
        total_amount: 25000.00,
        status: 'PENDING',
        items: [
          {
            line_no: 1,
            po_no: 'PO-2024-001',
            item_code: 'ITM-001',
            item_description: 'Steel Pipe',
            item_unit: 'PC',
            quantity: 100,
            unit_price: 150.00,
            line_total: 15000.00,
            pending_quantity: 100,
            received_quantity: 0
          },
          {
            line_no: 2,
            po_no: 'PO-2024-001',
            item_code: 'ITM-003',
            item_description: 'Steel Plates',
            item_unit: 'PC',
            quantity: 50,
            unit_price: 200.00,
            line_total: 10000.00,
            pending_quantity: 50,
            received_quantity: 0
          }
        ]
      },
      2: {
        po_id: 2,
        po_no: 'PO-2024-002',
        po_date: '2024-01-20',
        supplier_code: 'SUP002',
        supplier_name: 'Fasteners Inc',
        total_amount: 15000.00,
        status: 'APPROVED',
        items: [
          {
            line_no: 1,
            po_no: 'PO-2024-002',
            item_code: 'ITM-002',
            item_description: 'M12 Bolts',
            item_unit: 'PC',
            quantity: 1000,
            unit_price: 10.00,
            line_total: 10000.00,
            pending_quantity: 1000,
            received_quantity: 0
          },
          {
            line_no: 2,
            po_no: 'PO-2024-002',
            item_code: 'ITM-004',
            item_description: 'Nuts and Washers Set',
            item_unit: 'SET',
            quantity: 500,
            unit_price: 10.00,
            line_total: 5000.00,
            pending_quantity: 500,
            received_quantity: 0
          }
        ]
      }
    };

    return mockPOs[poId] || null;
  }

  getMockPODetailsByNumber(poNo) {
    const mockPOs = {
      'PO-2024-001': this.getMockPODetails(1),
      'PO-2024-002': this.getMockPODetails(2)
    };

    return mockPOs[poNo] || null;
  }

  // ==================== ERROR HANDLING ====================

  handleDatabaseError(error, context = '') {
    console.error(`Database error in ${context}:`, error);

    // Return a safe response
    return {
      success: false,
      error: error.message,
      message: `Database error in ${context}: ${error.message}`,
      developmentMode: !this.isElectron
    };
  }

  // ==================== SCHEMA FIXES ====================

  async fixDatabaseSchema() {
    if (this.dbStructureChecked) {
      return { success: true, message: 'Already checked' };
    }

    try {
      console.log('Checking database schema...');

      // Try to execute a simple query to test schema
      await this.get('SELECT 1 as test');

      this.dbStructureChecked = true;
      return {
        success: true,
        message: 'Database schema appears to be valid'
      };
    } catch (error) {
      console.warn('Database schema may need fixing:', error);
      return {
        success: false,
        message: 'Database schema may need attention',
        error: error.message
      };
    }
  }
}

// ==================== EXPORT PATTERN ====================
// Singleton instance
let databaseServiceInstance = null;

// Factory function to get/create instance
export const getDatabaseService = () => {
  if (!databaseServiceInstance) {
    databaseServiceInstance = new DatabaseService();
  }
  return databaseServiceInstance;
};

// Export the class itself
export { DatabaseService };

// Default export - returns the singleton instance
export default new DatabaseService;