const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/washing_machine.db');

let db;

const initDatabase = () => {
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('資料庫連接失敗:', err.message);
    } else {
      console.log('✅ 已連接到SQLite資料庫');
      createTables();
    }
  });
};

const createTables = () => {
  // 用戶表
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      dorm_number VARCHAR(10) NOT NULL,
      bed_number VARCHAR(5) NOT NULL,
      line_user_id VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 洗衣機表
  db.run(`
    CREATE TABLE IF NOT EXISTS machines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_code VARCHAR(20) UNIQUE NOT NULL,
      machine_type VARCHAR(10) CHECK(machine_type IN ('washer', 'dryer')) NOT NULL,
      location VARCHAR(100) NOT NULL,
      region VARCHAR(50) NOT NULL,
      status VARCHAR(15) CHECK(status IN ('available', 'locked', 'in_use', 'maintenance')) DEFAULT 'available',
      controller_id VARCHAR(100),
      is_online INTEGER DEFAULT 0,
      last_ping DATETIME,
      current_user_id INTEGER,
      start_time DATETIME,
      end_time DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (current_user_id) REFERENCES users(id)
    )
  `);

  // 檢查並添加用戶表新欄位（如果表已存在但缺少這些欄位）
  db.all("PRAGMA table_info(users)", [], (err, columns) => {
    if (err) return;
    
    const columnNames = columns.map(col => col.name);
    
    // 添加 dorm_number 欄位如果不存在
    if (!columnNames.includes('dorm_number')) {
      db.run("ALTER TABLE users ADD COLUMN dorm_number VARCHAR(10)", (err) => {
        if (err) console.error('Error adding dorm_number column:', err);
        else console.log('✅ Added dorm_number column to users table');
      });
    }
    
    // 添加 bed_number 欄位如果不存在
    if (!columnNames.includes('bed_number')) {
      db.run("ALTER TABLE users ADD COLUMN bed_number VARCHAR(5)", (err) => {
        if (err) console.error('Error adding bed_number column:', err);
        else console.log('✅ Added bed_number column to users table');
      });
    }
  });

  // 檢查並添加機器表新欄位（如果表已存在但缺少這些欄位）
  db.all("PRAGMA table_info(machines)", [], (err, columns) => {
    if (err) return;
    
    const columnNames = columns.map(col => col.name);
    
    // 添加 region 欄位如果不存在
    if (!columnNames.includes('region')) {
      db.run("ALTER TABLE machines ADD COLUMN region VARCHAR(50) DEFAULT '未知區域'", (err) => {
        if (err && !err.message.includes('duplicate column')) {
          console.error('Error adding region column:', err);
        } else if (!err) {
          console.log('✅ Added region column to machines table');
        }
      });
    }
    
    // 添加 controller_id 欄位如果不存在
    if (!columnNames.includes('controller_id')) {
      db.run("ALTER TABLE machines ADD COLUMN controller_id VARCHAR(100)", (err) => {
        if (err && !err.message.includes('duplicate column')) {
          console.error('Error adding controller_id column:', err);
        } else if (!err) {
          console.log('✅ Added controller_id column to machines table');
        }
      });
    }
    
    // 添加 is_online 欄位如果不存在
    if (!columnNames.includes('is_online')) {
      db.run("ALTER TABLE machines ADD COLUMN is_online INTEGER DEFAULT 0", (err) => {
        if (err && !err.message.includes('duplicate column')) {
          console.error('Error adding is_online column:', err);
        } else if (!err) {
          console.log('✅ Added is_online column to machines table');
        }
      });
    }
    
    // 添加 last_ping 欄位如果不存在
    if (!columnNames.includes('last_ping')) {
      db.run("ALTER TABLE machines ADD COLUMN last_ping DATETIME", (err) => {
        if (err && !err.message.includes('duplicate column')) {
          console.error('Error adding last_ping column:', err);
        } else if (!err) {
          console.log('✅ Added last_ping column to machines table');
        }
      });
    }
  });

  // 預約表
  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      machine_id INTEGER NOT NULL,
      booking_date DATE NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      access_code VARCHAR(10),
      status VARCHAR(15) CHECK(status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
      payment_status VARCHAR(10) CHECK(payment_status IN ('unpaid', 'paid', 'refunded')) DEFAULT 'unpaid',
      payment_amount DECIMAL(10,2),
      payment_method VARCHAR(50),
      payment_transaction_id VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (machine_id) REFERENCES machines(id)
    )
  `);

  // 檢查並添加 access_code 欄位（如果表已存在但缺少此欄位）
  db.all("PRAGMA table_info(bookings)", [], (err, columns) => {
    if (err) return;
    
    const hasAccessCode = columns.some(col => col.name === 'access_code');
    if (!hasAccessCode) {
      db.run("ALTER TABLE bookings ADD COLUMN access_code VARCHAR(10)");
      console.log('✅ 已添加 access_code 欄位到 bookings 表');
    }
  });

  // 週預約限制表 - 修改為洗烘各兩次
  db.run(`
    CREATE TABLE IF NOT EXISTS weekly_booking_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      week_start DATE NOT NULL,
      washing_count INTEGER DEFAULT 0,
      drying_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, week_start)
    )
  `);

  // 檢查並添加週預約限制表新欄位
  db.all("PRAGMA table_info(weekly_booking_limits)", [], (err, columns) => {
    if (err) return;
    
    const columnNames = columns.map(col => col.name);
    
    // 添加 washing_count 和 drying_count 欄位如果不存在
    if (!columnNames.includes('washing_count')) {
      db.run("ALTER TABLE weekly_booking_limits ADD COLUMN washing_count INTEGER DEFAULT 0", (err) => {
        if (err) console.error('Error adding washing_count column:', err);
        else console.log('✅ Added washing_count column to weekly_booking_limits table');
      });
    }
    
    if (!columnNames.includes('drying_count')) {
      db.run("ALTER TABLE weekly_booking_limits ADD COLUMN drying_count INTEGER DEFAULT 0", (err) => {
        if (err) console.error('Error adding drying_count column:', err);
        else console.log('✅ Added drying_count column to weekly_booking_limits table');
      });
    }
  });

  // 通知表
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      booking_id INTEGER,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      status VARCHAR(10) CHECK(status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
      sent_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (booking_id) REFERENCES bookings(id)
    )
  `);

  console.log('✅ 資料庫表格建立完成');
  // 移除自動插入初始機器數據，改由管理員手動添加
  console.log('ℹ️  請透過管理介面添加洗衣機設備');
};

// 保留insertInitialData函數以備將來需要時使用
const insertInitialData = () => {
  // 插入初始洗衣機數據（僅在需要時手動調用）
  const machines = [
    { machine_code: 'W001', machine_type: 'washer', location: '男宿一樓', region: '男宿區' },
    { machine_code: 'W002', machine_type: 'washer', location: '男宿一樓', region: '男宿區' },
    { machine_code: 'W003', machine_type: 'washer', location: '女宿一樓', region: '女宿區' },
    { machine_code: 'W004', machine_type: 'washer', location: '女宿一樓', region: '女宿區' },
    { machine_code: 'D001', machine_type: 'dryer', location: '男宿一樓', region: '男宿區' },
    { machine_code: 'D002', machine_type: 'dryer', location: '男宿一樓', region: '男宿區' },
    { machine_code: 'D003', machine_type: 'dryer', location: '女宿一樓', region: '女宿區' },
    { machine_code: 'D004', machine_type: 'dryer', location: '女宿一樓', region: '女宿區' }
  ];

  const insertMachine = db.prepare(`
    INSERT OR IGNORE INTO machines (machine_code, machine_type, location, region) 
    VALUES (?, ?, ?, ?)
  `);

  machines.forEach(machine => {
    insertMachine.run(machine.machine_code, machine.machine_type, machine.location, machine.region);
  });

  insertMachine.finalize();
  console.log('✅ 初始洗衣機數據插入完成');
};

const getDB = () => {
  if (!db) {
    throw new Error('資料庫未初始化');
  }
  return db;
};

module.exports = {
  initDatabase,
  getDB
};
