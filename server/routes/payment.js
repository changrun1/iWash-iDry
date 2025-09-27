const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDB } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 創建付款訂單
router.post('/create-order', authMiddleware, [
  body('booking_id').isInt().withMessage('請提供有效的預約ID'),
  body('payment_method').isIn(['credit_card', 'line_pay', 'apple_pay', 'google_pay']).withMessage('請選擇有效的付款方式')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入資料有誤', 
        errors: errors.array() 
      });
    }

    const { booking_id, payment_method } = req.body;
    const db = getDB();

    // 檢查預約是否存在且屬於當前用戶
    db.get(
      'SELECT * FROM bookings WHERE id = ? AND user_id = ?',
      [booking_id, req.user.id],
      (err, booking) => {
        if (err) {
          return res.status(500).json({ message: '檢查預約失敗' });
        }

        if (!booking) {
          return res.status(404).json({ message: '預約不存在' });
        }

        if (booking.payment_status === 'paid') {
          return res.status(400).json({ message: '該預約已經付款' });
        }

        // 生成付款訂單ID（實際環境中這裡會呼叫第三方支付API）
        const payment_transaction_id = 'PAY_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        // 模擬付款處理（實際環境中這裡會整合真實的支付網關）
        const paymentResult = simulatePayment(payment_method, booking.payment_amount);

        if (paymentResult.success) {
          // 更新預約的付款狀態
          db.run(
            `UPDATE bookings 
             SET payment_status = 'paid', payment_method = ?, payment_transaction_id = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [payment_method, payment_transaction_id, booking_id],
            function(err) {
              if (err) {
                return res.status(500).json({ message: '更新付款狀態失敗' });
              }

              res.json({
                message: '付款成功',
                payment: {
                  transaction_id: payment_transaction_id,
                  amount: booking.payment_amount,
                  method: payment_method,
                  status: 'paid'
                }
              });
            }
          );
        } else {
          res.status(400).json({
            message: '付款失敗',
            error: paymentResult.error
          });
        }
      }
    );
  } catch (error) {
    res.status(500).json({ message: '創建付款訂單失敗', error: error.message });
  }
});

// 模擬付款處理（開發用）
function simulatePayment(paymentMethod, amount) {
  // 模擬付款處理邏輯
  // 實際環境中這裡會呼叫真實的支付API
  
  const random = Math.random();
  
  // 95%成功率的模擬
  if (random > 0.05) {
    return {
      success: true,
      transaction_id: 'SIM_' + Date.now()
    };
  } else {
    return {
      success: false,
      error: '付款被拒絕，請檢查您的付款方式'
    };
  }
}

// 查詢付款狀態
router.get('/status/:bookingId', authMiddleware, (req, res) => {
  const { bookingId } = req.params;
  const db = getDB();

  db.get(
    `SELECT 
      payment_status, 
      payment_method, 
      payment_transaction_id, 
      payment_amount 
    FROM bookings 
    WHERE id = ? AND user_id = ?`,
    [bookingId, req.user.id],
    (err, payment) => {
      if (err) {
        return res.status(500).json({ message: '查詢付款狀態失敗' });
      }

      if (!payment) {
        return res.status(404).json({ message: '預約不存在' });
      }

      res.json({ payment });
    }
  );
});

// 申請退款
router.post('/refund', authMiddleware, [
  body('booking_id').isInt().withMessage('請提供有效的預約ID'),
  body('reason').isLength({ min: 5 }).withMessage('請提供退款原因')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入資料有誤', 
        errors: errors.array() 
      });
    }

    const { booking_id, reason } = req.body;
    const db = getDB();

    db.get(
      'SELECT * FROM bookings WHERE id = ? AND user_id = ?',
      [booking_id, req.user.id],
      (err, booking) => {
        if (err) {
          return res.status(500).json({ message: '檢查預約失敗' });
        }

        if (!booking) {
          return res.status(404).json({ message: '預約不存在' });
        }

        if (booking.payment_status !== 'paid') {
          return res.status(400).json({ message: '該預約尚未付款，無法申請退款' });
        }

        if (booking.status === 'completed') {
          return res.status(400).json({ message: '已完成的預約無法申請退款' });
        }

        // 檢查退款政策（例如：開始時間前2小時可以全額退款）
        const startTime = new Date(booking.start_time);
        const now = new Date();
        const timeDiff = startTime.getTime() - now.getTime();
        const hoursUntilStart = timeDiff / (1000 * 60 * 60);

        if (hoursUntilStart < 2) {
          return res.status(400).json({ 
            message: '開始時間前2小時內無法申請退款' 
          });
        }

        // 模擬退款處理
        const refundResult = simulateRefund(booking.payment_transaction_id, booking.payment_amount);

        if (refundResult.success) {
          db.run(
            'UPDATE bookings SET payment_status = "refunded", status = "cancelled", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [booking_id],
            function(err) {
              if (err) {
                return res.status(500).json({ message: '更新退款狀態失敗' });
              }

              res.json({
                message: '退款申請成功',
                refund: {
                  amount: booking.payment_amount,
                  refund_id: refundResult.refund_id,
                  estimated_days: 3
                }
              });
            }
          );
        } else {
          res.status(400).json({
            message: '退款申請失敗',
            error: refundResult.error
          });
        }
      }
    );
  } catch (error) {
    res.status(500).json({ message: '申請退款失敗', error: error.message });
  }
});

// 模擬退款處理
function simulateRefund(transactionId, amount) {
  // 模擬退款處理邏輯
  return {
    success: true,
    refund_id: 'REF_' + Date.now(),
    amount: amount
  };
}

// 取得支付方式列表
router.get('/methods', authMiddleware, (req, res) => {
  const paymentMethods = [
    {
      id: 'credit_card',
      name: '信用卡',
      description: '支援Visa、MasterCard、JCB',
      icon: '💳',
      enabled: true
    },
    {
      id: 'line_pay',
      name: 'LINE Pay',
      description: '使用LINE Pay快速付款',
      icon: '💚',
      enabled: true
    },
    {
      id: 'apple_pay',
      name: 'Apple Pay',
      description: '使用Touch ID或Face ID付款',
      icon: '🍎',
      enabled: true
    },
    {
      id: 'google_pay',
      name: 'Google Pay',
      description: '使用Google Pay快速付款',
      icon: '🔵',
      enabled: true
    }
  ];

  res.json({ payment_methods: paymentMethods });
});

// 取得付款記錄
router.get('/history', authMiddleware, (req, res) => {
  const db = getDB();
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  db.all(
    `SELECT 
      b.id,
      b.payment_amount,
      b.payment_method,
      b.payment_status,
      b.payment_transaction_id,
      b.start_time,
      b.created_at,
      m.machine_code,
      m.machine_type,
      m.location
    FROM bookings b
    JOIN machines m ON b.machine_id = m.id
    WHERE b.user_id = ? 
    AND b.payment_status IN ('paid', 'refunded')
    ORDER BY b.created_at DESC
    LIMIT ? OFFSET ?`,
    [req.user.id, parseInt(limit), offset],
    (err, payments) => {
      if (err) {
        return res.status(500).json({ message: '獲取付款記錄失敗' });
      }

      res.json({
        payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: payments.length
        }
      });
    }
  );
});

module.exports = router;
