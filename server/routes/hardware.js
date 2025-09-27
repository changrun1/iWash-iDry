// 硬體控制器相關路由
const express = require('express');
const router = express.Router();
const { getDB } = require('../config/database');

// 硬體狀態報告端點 - 註冊和更新機器
router.post('/status-report', async (req, res) => {
    try {
        const { api_key, region, controller_id, machines } = req.body;
        
        // 驗證 API 密鑰
        if (api_key !== process.env.HARDWARE_API_KEY) {
            return res.status(401).json({ message: 'Invalid API key' });
        }
        
        if (!machines || !Array.isArray(machines)) {
            return res.status(400).json({ message: 'Invalid machines data' });
        }
        
        const db = getDB();
        const registered_machines = [];
        const updated_machines = [];
        
        // 開始事務
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                machines.forEach((machine, index) => {
                    const {
                        machine_code,
                        machine_type,
                        location,
                        region: machine_region,
                        status,
                        remaining_time,
                        access_code,
                        reservation_id,
                        user_id,
                        last_update
                    } = machine;
                    
                    // 檢查機器是否已存在
                    db.get(
                        `SELECT id FROM machines WHERE machine_code = ?`,
                        [machine_code],
                        (err, row) => {
                            if (err) {
                                console.error('Database error:', err);
                                return;
                            }
                            
                            if (!row) {
                                const machineTypeForDb = machine_type === 'washing' ? 'washer' : (machine_type === 'drying' ? 'dryer' : machine_type);
                                
                                // 新機器，需要註冊
                                db.run(
                                    `INSERT INTO machines (
                                        machine_code, 
                                        machine_type, 
                                        location, 
                                        region,
                                        status, 
                                        controller_id,
                                        is_online,
                                        last_ping,
                                        created_at, 
                                        updated_at
                                    ) VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'), datetime('now'))`,
                                    [machine_code, machineTypeForDb, location, machine_region || region, status, controller_id],
                                    function(err) {
                                        if (err) {
                                            console.error('Insert error:', err);
                                        } else {
                                            registered_machines.push({
                                                machine_code,
                                                machine_id: this.lastID,
                                                action: 'registered'
                                            });
                                        }
                                    }
                                );
                            } else {
                                // 更新現有機器狀態
                                db.run(
                                    `UPDATE machines SET 
                                        status = ?, 
                                        location = ?,
                                        region = ?,
                                        controller_id = ?,
                                        is_online = 1,
                                        last_ping = datetime('now'),
                                        updated_at = datetime('now')
                                    WHERE machine_code = ?`,
                                    [status, location, machine_region || region, controller_id, machine_code],
                                    function(err) {
                                        if (err) {
                                            console.error('Update error:', err);
                                        } else {
                                            updated_machines.push({
                                                machine_code,
                                                machine_id: row.id,
                                                action: 'updated'
                                            });
                                        }
                                    }
                                );
                            }
                            
                            // 如果是最後一個機器，提交事務
                            if (index === machines.length - 1) {
                                setTimeout(() => {
                                    db.run('COMMIT', (err) => {
                                        if (err) {
                                            console.error('Commit error:', err);
                                            reject(err);
                                        } else {
                                            resolve();
                                        }
                                    });
                                }, 100); // 給數據庫操作一些時間
                            }
                        }
                    );
                });
            });
        });
        
        // 回傳結果
        const response = {
            success: true,
            region,
            controller_id,
            registered_machines: registered_machines.length > 0 ? registered_machines : undefined,
            updated_machines: updated_machines.length > 0 ? updated_machines : undefined,
            total_machines: machines.length,
            timestamp: new Date().toISOString()
        };
        
        console.log(`📡 硬體報告 - 區域: ${region}, 註冊: ${registered_machines.length}, 更新: ${updated_machines.length}`);
        
        res.json(response);
        
    } catch (error) {
        console.error('Hardware status report error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 獲取硬體控制器指令
router.get('/commands/:region', async (req, res) => {
    try {
        const { region } = req.params;
        const api_key = req.headers['x-api-key'];
        
        // 驗證 API 密鑰
        if (api_key !== process.env.HARDWARE_API_KEY) {
            return res.status(401).json({ message: 'Invalid API key' });
        }
        
        // 這裡可以實現指令隊列邏輯
        // 目前返回空指令列表
        const commands = [];
        
        res.json({
            region,
            commands,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Get commands error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 獲取所有在線的機器（供前端使用）
router.get('/online-machines', async (req, res) => {
    try {
        const db = getDB();
        
        // 獲取所有在線的機器
        db.all(
            `SELECT 
                id,
                machine_code,
                machine_type,
                location,
                region,
                status,
                controller_id,
                last_ping,
                created_at,
                updated_at
            FROM machines 
            WHERE is_online = 1 
            AND datetime(last_ping) > datetime('now', '-30 seconds')
            ORDER BY region, machine_code`,
            [],
            (err, machines) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ message: 'Database error' });
                }
                
                // 按區域分組
                const regions = {};
                machines.forEach(machine => {
                    if (!regions[machine.region]) {
                        regions[machine.region] = [];
                    }
                    regions[machine.region].push(machine);
                });
                
                res.json({
                    success: true,
                    total_machines: machines.length,
                    regions,
                    machines,
                    timestamp: new Date().toISOString()
                });
            }
        );
        
    } catch (error) {
        console.error('Get online machines error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 設置機器為離線狀態（定期清理任務）
router.post('/cleanup-offline', async (req, res) => {
    try {
        const db = getDB();
        
        // 將超過 1 分鐘沒有心跳的機器設為離線
        db.run(
            `UPDATE machines SET 
                is_online = 0,
                updated_at = datetime('now')
            WHERE datetime(last_ping) < datetime('now', '-60 seconds')`,
            function(err) {
                if (err) {
                    console.error('Cleanup error:', err);
                    return res.status(500).json({ message: 'Database error' });
                }
                
                console.log(`🧹 清理離線機器: ${this.changes} 台機器設為離線`);
                
                res.json({
                    success: true,
                    offline_machines: this.changes,
                    timestamp: new Date().toISOString()
                });
            }
        );
        
    } catch (error) {
        console.error('Cleanup offline error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
