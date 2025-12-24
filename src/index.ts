import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

// Business Rules Configuration
const BUSINESS_RULES = {
  MIN_TRANSFER: 1.00,
  MAX_TRANSFER: 5000.00,
  DAILY_TRANSFER_LIMIT: 10,
  DAILY_TRANSFER_AMOUNT_LIMIT: 10000.00,
  COOLDOWN_MINUTES: 2,
  FLAG_THRESHOLD: 1000.00,
  NEW_USER_THRESHOLD: 3 // Minimum transactions before large transfers
};

// Transaction Schema Validation
interface TransferRequest {
  recipientId: string;
  amount: number;
  csrfToken?: string;
  deviceFingerprint?: string;
}

interface UserData {
  balance: number;
  txCode: string;
  username: string;
  history: Array<{timestamp: Date, amount: number}>;
  role: string;
  isVerified: boolean;
  dailyTransfers: number;
  dailyTransferAmount: number;
  lastTransferTime?: Date;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate a secure transaction ID
 */
function generateTransactionId(): string {
  return `TX-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

/**
 * Check if user is rate-limited
 */
async function checkRateLimit(uid: string): Promise<{allowed: boolean, waitSeconds?: number}> {
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) return {allowed: false};
  
  const userData = userDoc.data() as UserData;
  const now = new Date();
  
  // Check daily transfer count
  if (userData.dailyTransfers >= BUSINESS_RULES.DAILY_TRANSFER_LIMIT) {
    return {allowed: false, waitSeconds: 86400}; // 24 hours
  }
  
  // Check daily transfer amount
  if (userData.dailyTransferAmount >= BUSINESS_RULES.DAILY_TRANSFER_AMOUNT_LIMIT) {
    return {allowed: false, waitSeconds: 86400};
  }
  
  // Check cooldown between transfers
  if (userData.lastTransferTime) {
    const lastTransfer = userData.lastTransferTime.toDate();
    const diffMinutes = (now.getTime() - lastTransfer.getTime()) / (1000 * 60);
    
    if (diffMinutes < BUSINESS_RULES.COOLDOWN_MINUTES) {
      const waitSeconds = Math.ceil((BUSINESS_RULES.COOLDOWN_MINUTES - diffMinutes) * 60);
      return {allowed: false, waitSeconds};
    }
  }
  
  return {allowed: true};
}

/**
 * Check for suspicious activity patterns
 */
async function detectSuspiciousActivity(
  uid: string, 
  amount: number, 
  recipientId: string
): Promise<{suspicious: boolean, reason?: string, level?: 'low'|'medium'|'high'}> {
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) {
    return {suspicious: true, reason: 'User not found', level: 'high'};
  }
  
  const userData = userDoc.data() as UserData;
  const now = new Date();
  
  // Pattern 1: Large transfer from new account
  if (amount > BUSINESS_RULES.FLAG_THRESHOLD && userData.history.length < BUSINESS_RULES.NEW_USER_THRESHOLD) {
    return {
      suspicious: true,
      reason: 'Large transfer from new account',
      level: 'medium'
    };
  }
  
  // Pattern 2: Round number fraud (common in money laundering)
  if (amount % 1000 === 0 && amount > 1000) {
    return {
      suspicious: true,
      reason: 'Suspicious round number amount',
      level: 'low'
    };
  }
  
  // Pattern 3: Self-transfer attempt
  if (recipientId === userData.txCode) {
    return {
      suspicious: true,
      reason: 'Self-transfer attempt',
      level: 'medium'
    };
  }
  
  // Pattern 4: Multiple transfers to same recipient in short time
  const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
  const transfersToSameRecipient = await db.collection('audit_logs')
    .where('senderId', '==', uid)
    .where('recipientId', '==', recipientId)
    .where('timestamp', '>', lastHour)
    .get();
  
  if (transfersToSameRecipient.size >= 3) {
    return {
      suspicious: true,
      reason: 'Multiple transfers to same recipient in short time',
      level: 'medium'
    };
  }
  
  // Pattern 5: Unusual time (e.g., 2-5 AM)
  const hour = now.getHours();
  if (hour >= 2 && hour <= 5 && amount > 500) {
    return {
      suspicious: true,
      reason: 'Unusual transaction time',
      level: 'low'
    };
  }
  
  return {suspicious: false};
}

/**
 * Reset daily limits at midnight
 */
export const resetDailyLimits = functions.pubsub
  .schedule('0 0 * * *') // Every day at midnight
  .timeZone('UTC')
  .onRun(async () => {
    try {
      const usersSnapshot = await db.collection('users').get();
      const batch = db.batch();
      
      usersSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          dailyTransfers: 0,
          dailyTransferAmount: 0
        });
      });
      
      await batch.commit();
      console.log('Daily limits reset for all users');
      return null;
    } catch (error) {
      console.error('Error resetting daily limits:', error);
      return null;
    }
  });

// ============================================
// MAIN VALIDATION FUNCTION
// ============================================

/**
 * Validate and process a transfer request
 */
export const validateTransfer = functions.https.onCall(
  async (data: TransferRequest, context: functions.https.CallableContext) => {
    // 1. Authentication check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }
    
    const uid = context.auth.uid;
    const {recipientId, amount} = data;
    
    // 2. Input validation
    if (!recipientId || typeof recipientId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid recipient ID'
      );
    }
    
    if (typeof amount !== 'number' || isNaN(amount)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid amount'
      );
    }
    
    // 3. Business rule validation
    if (amount < BUSINESS_RULES.MIN_TRANSFER) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Minimum transfer amount is $${BUSINESS_RULES.MIN_TRANSFER}`
      );
    }
    
    if (amount > BUSINESS_RULES.MAX_TRANSFER) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Maximum transfer amount is $${BUSINESS_RULES.MAX_TRANSFER}`
      );
    }
    
    // 4. Rate limiting check
    const rateLimit = await checkRateLimit(uid);
    if (!rateLimit.allowed) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        rateLimit.waitSeconds 
          ? `Please wait ${Math.ceil(rateLimit.waitSeconds / 60)} minutes before next transfer`
          : 'Daily transfer limit exceeded'
      );
    }
    
    // 5. Find recipient
    const recipientQuery = await db.collection('users')
      .where('txCode', '==', recipientId)
      .limit(1)
      .get();
    
    if (recipientQuery.empty) {
      throw new functions.https.HttpsError(
        'not-found',
        'Recipient not found'
      );
    }
    
    const recipientDoc = recipientQuery.docs[0];
    const recipientData = recipientDoc.data() as UserData;
    
    // 6. Get sender data
    const senderRef = db.collection('users').doc(uid);
    const senderDoc = await senderRef.get();
    
    if (!senderDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Sender account not found'
      );
    }
    
    const senderData = senderDoc.data() as UserData;
    
    // 7. Balance check
    if (senderData.balance < amount) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Insufficient balance'
      );
    }
    
    // 8. Suspicious activity detection
    const suspicionCheck = await detectSuspiciousActivity(uid, amount, recipientId);
    
    if (suspicionCheck.suspicious) {
      // Log suspicious activity but don't block (for review)
      await db.collection('flagged_transactions').add({
        senderId: uid,
        recipientId: recipientDoc.id,
        amount,
        reason: suspicionCheck.reason,
        level: suspicionCheck.level,
        timestamp: new Date(),
        status: 'pending_review',
        autoApproved: suspicionCheck.level === 'low'
      });
      
      // Only block high-risk transactions
      if (suspicionCheck.level === 'high') {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Transaction flagged for security review'
        );
      }
    }
    
    // 9. Generate transaction ID
    const transactionId = generateTransactionId();
    
    return {
      validated: true,
      transactionId,
      recipientName: recipientData.username,
      recipientTxCode: recipientData.txCode,
      requiresManualReview: suspicionCheck.suspicious && suspicionCheck.level === 'medium'
    };
  }
);

// ============================================
// EXECUTE TRANSACTION FUNCTION
// ============================================

/**
 * Execute a pre-validated transaction
 */
export const executeTransaction = functions.https.onCall(
  async (data: {transactionId: string}, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Not authenticated');
    }
    
    const uid = context.auth.uid;
    const {transactionId} = data;
    
    // Note: In production, you'd fetch the validated transaction from a temporary store
    // For this example, we'll re-validate and execute
    
    // Get the transaction validation result (from previous step)
    const validationRef = db.collection('pending_transactions').doc(transactionId);
    const validationDoc = await validationRef.get();
    
    if (!validationDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Transaction not found or expired');
    }
    
    const validationData = validationDoc.data();
    
    // Verify the transaction belongs to this user
    if (validationData.senderId !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'Transaction access denied');
    }
    
    // Check if already processed
    if (validationData.status === 'completed') {
      throw new functions.https.HttpsError('failed-precondition', 'Transaction already completed');
    }
    
    if (validationData.status === 'failed') {
      throw new functions.https.HttpsError('failed-precondition', 'Transaction failed');
    }
    
    // Perform atomic transaction
    try {
      await db.runTransaction(async (transaction) => {
        const senderRef = db.collection('users').doc(validationData.senderId);
        const recipientRef = db.collection('users').doc(validationData.recipientId);
        
        const senderDoc = await transaction.get(senderRef);
        const recipientDoc = await transaction.get(recipientRef);
        
        if (!senderDoc.exists || !recipientDoc.exists) {
          throw new Error('User accounts not found');
        }
        
        const senderData = senderDoc.data() as UserData;
        const recipientData = recipientDoc.data() as UserData;
        
        // Final balance check
        if (senderData.balance < validationData.amount) {
          throw new Error('Insufficient balance');
        }
        
        const now = new Date().toISOString();
        
        // Update sender
        transaction.update(senderRef, {
          balance: admin.firestore.FieldValue.increment(-validationData.amount),
          dailyTransfers: admin.firestore.FieldValue.increment(1),
          dailyTransferAmount: admin.firestore.FieldValue.increment(validationData.amount),
          lastTransferTime: now,
          history: admin.firestore.FieldValue.arrayUnion({
            type: 'transfer',
            amount: -validationData.amount,
            timestamp: now,
            transactionId,
            recipient: validationData.recipientTxCode
          })
        });
        
        // Update recipient
        transaction.update(recipientRef, {
          balance: admin.firestore.FieldValue.increment(validationData.amount),
          history: admin.firestore.FieldValue.arrayUnion({
            type: 'receive',
            amount: validationData.amount,
            timestamp: now,
            transactionId,
            sender: validationData.senderTxCode
          })
        });
        
        // Create audit log
        const auditLogRef = db.collection('audit_logs').doc();
        transaction.set(auditLogRef, {
          transactionId,
          senderId: validationData.senderId,
          senderTxCode: validationData.senderTxCode,
          recipientId: validationData.recipientId,
          recipientTxCode: validationData.recipientTxCode,
          amount: validationData.amount,
          timestamp: now,
          status: 'completed',
          ipAddress: context.rawRequest.ip,
          userAgent: context.rawRequest.headers['user-agent']
        });
        
        // Update transaction status
        transaction.update(validationRef, {
          status: 'completed',
          executedAt: now
        });
      });
      
      return {
        success: true,
        transactionId,
        message: 'Transaction completed successfully'
      };
      
    } catch (error) {
      // Update transaction as failed
      await validationRef.update({
        status: 'failed',
        error: error.message,
        failedAt: new Date().toISOString()
      });
      
      throw new functions.https.HttpsError(
        'internal',
        'Transaction failed: ' + error.message
      );
    }
  }
);

// ============================================
// WEBHOOK FOR REAL-TIME FRAUD DETECTION
// ============================================

/**
 * Monitor transactions in real-time for fraud patterns
 */
export const monitorTransactions = functions.firestore
  .document('audit_logs/{logId}')
  .onCreate(async (snap, context) => {
    const transaction = snap.data();
    
    // Check for velocity pattern (rapid successive transactions)
    const last5Minutes = new Date(Date.now() - 5 * 60 * 1000);
    
    const recentTransactions = await db.collection('audit_logs')
      .where('senderId', '==', transaction.senderId)
      .where('timestamp', '>', last5Minutes.toISOString())
      .get();
    
    if (recentTransactions.size > 5) {
      // User has made more than 5 transactions in 5 minutes
      await db.collection('security_alerts').add({
        type: 'velocity_attack',
        userId: transaction.senderId,
        transactionCount: recentTransactions.size,
        timeframe: '5 minutes',
        timestamp: new Date(),
        status: 'new',
        severity: 'high'
      });
      
      // Optional: Temporarily freeze account for review
      await db.collection('users').doc(transaction.senderId).update({
        status: 'under_review',
        reviewReason: 'Suspicious transaction velocity'
      });
    }
    
    return null;
  });

// ============================================
// ADMIN FUNCTIONS
// ============================================

/**
 * Admin function to manually review flagged transactions
 */
export const reviewFlaggedTransaction = functions.https.onCall(
  async (data: {transactionId: string, action: 'approve'|'reject', reason?: string}, context: functions.https.CallableContext) => {
    
    // Verify admin role
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Not authenticated');
    }
    
    const adminUser = await auth.getUser(context.auth.uid);
    if (!adminUser.customClaims || adminUser.customClaims.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }
    
    const {transactionId, action, reason} = data;
    
    const flagRef = db.collection('flagged_transactions').doc(transactionId);
    const flagDoc = await flagRef.get();
    
    if (!flagDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Flagged transaction not found');
    }
    
    const flagData = flagDoc.data();
    
    if (flagData.status !== 'pending_review') {
      throw new functions.https.HttpsError('failed-precondition', 'Transaction already reviewed');
    }
    
    await flagRef.update({
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewedBy: context.auth.uid,
      reviewedAt: new Date(),
      reviewReason: reason || ''
    });
    
    if (action === 'approve') {
      // Process the approved transaction
      // (You would trigger the original transaction here)
    } else {
      // Notify user of rejection
      await db.collection('notifications').add({
        userId: flagData.senderId,
        type: 'transaction_rejected',
        title: 'Transaction Rejected',
        message: `Your transaction was rejected: ${reason || 'Security reasons'}`,
        timestamp: new Date(),
        read: false
      });
    }
    
    return {
      success: true,
      message: `Transaction ${action === 'approve' ? 'approved' : 'rejected'}`
    };
  }
);

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get user transaction statistics
 */
export const getUserStats = functions.https.onCall(
  async (data: {userId?: string}, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Not authenticated');
    }
    
    const targetUserId = data.userId || context.auth.uid;
    
    // Check permissions (users can only view their own stats unless admin)
    if (targetUserId !== context.auth.uid) {
      const user = await auth.getUser(context.auth.uid);
      if (!user.customClaims || user.customClaims.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Access denied');
      }
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    // Get today's transactions
    const todayTransactions = await db.collection('audit_logs')
      .where('senderId', '==', targetUserId)
      .where('timestamp', '>', today.toISOString())
      .get();
    
    // Get weekly transactions
    const weeklyTransactions = await db.collection('audit_logs')
      .where('senderId', '==', targetUserId)
      .where('timestamp', '>', weekAgo.toISOString())
      .get();
    
    const todayTotal = todayTransactions.docs.reduce((sum, doc) => sum + doc.data().amount, 0);
    const weeklyTotal = weeklyTransactions.docs.reduce((sum, doc) => sum + doc.data().amount, 0);
    
    return {
      dailyTransfers: todayTransactions.size,
      dailyAmount: todayTotal,
      weeklyTransfers: weeklyTransactions.size,
      weeklyAmount: weeklyTotal,
      remainingDailyLimit: BUSINESS_RULES.DAILY_TRANSFER_LIMIT - todayTransactions.size,
      remainingDailyAmount: BUSINESS_RULES.DAILY_TRANSFER_AMOUNT_LIMIT - todayTotal
    };
  }
);
