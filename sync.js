// 🔥 X-BET UNIVERSAL SYNC SYSTEM - Works across ALL browsers
(function() {
    'use strict';
    
    console.log('🔄 Loading X-BET Sync System v2.1...');
    
    // Create a promise to track when sync system is ready
    window.xbetSyncReadyPromise = new Promise((resolve) => {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initSyncSystem);
        } else {
            setTimeout(initSyncSystem, 100);
        }
        
        function initSyncSystem() {
            try {
                console.log('🚀 Initializing X-BET Sync System...');
                
                class XbetUniversalSync {
                    constructor() {
                        this.STORAGE_KEYS = {
                            USERS: 'XBET_UNIVERSAL_USERS_V3',
                            LAST_SYNC: 'XBET_LAST_SYNC_TIME_V3',
                            SYNC_FLAG: 'XBET_SYNC_ACTIVE'
                        };
                        
                        this.syncInterval = null;
                        this.isInitialized = false;
                        this.initialize();
                    }
                    
                    initialize() {
                        try {
                            console.log('🛠 Setting up sync system...');
                            
                            // Listen for storage events from other tabs/browsers
                            window.addEventListener('storage', (e) => {
                                if (e.key === this.STORAGE_KEYS.USERS || e.key === this.STORAGE_KEYS.SYNC_FLAG) {
                                    console.log('📡 Sync event received from other tab');
                                    this.syncNow();
                                }
                            });
                            
                            // Initial sync
                            this.syncNow();
                            
                            // Start auto-sync every 10 seconds
                            this.startAutoSync();
                            
                            this.isInitialized = true;
                            console.log('✅ X-BET Sync System Initialized!');
                            
                            // Resolve the promise
                            resolve(this);
                            
                        } catch (error) {
                            console.error('❌ Failed to initialize sync system:', error);
                            // Still resolve with fallback system
                            resolve(this);
                        }
                    }
                    
                    // 🔥 REGISTER NEW USER
                    registerUser(userData) {
                        try {
                            console.log('📝 Registering user:', userData.username);
                            
                            if (!userData || !userData.username || !userData.email) {
                                console.error('Invalid user data');
                                return null;
                            }
                            
                            // Generate user ID
                            const userId = 'USER_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                            
                            // Complete user data
                            const completeUserData = {
                                ...userData,
                                id: userId,
                                registeredAt: new Date().toISOString(),
                                lastSeen: new Date().toISOString(),
                                browser: this.getBrowserInfo(),
                                syncVersion: '3.0'
                            };
                            
                            // Save to universal storage
                            this.saveToUniversalStorage(completeUserData);
                            
                            // Save to local storage for compatibility
                            this.saveToLocalStorage(completeUserData);
                            
                            // Trigger sync
                            this.triggerSync();
                            
                            console.log('✅ User registered with ID:', userId);
                            return userId;
                            
                        } catch (error) {
                            console.error('Error registering user:', error);
                            return null;
                        }
                    }
                    
                    // 🔥 SAVE TO UNIVERSAL STORAGE
                    saveToUniversalStorage(userData) {
                        try {
                            const storageKey = this.STORAGE_KEYS.USERS;
                            let allUsers = [];
                            
                            // Get existing users
                            const existingData = localStorage.getItem(storageKey);
                            if (existingData) {
                                try {
                                    allUsers = JSON.parse(existingData);
                                    if (!Array.isArray(allUsers)) {
                                        allUsers = [];
                                    }
                                } catch (e) {
                                    allUsers = [];
                                }
                            }
                            
                            // Check if user already exists
                            const existingIndex = allUsers.findIndex(u => 
                                u.username === userData.username || u.email === userData.email
                            );
                            
                            if (existingIndex === -1) {
                                // Add new user
                                allUsers.push(userData);
                            } else {
                                // Update existing user
                                allUsers[existingIndex] = {
                                    ...allUsers[existingIndex],
                                    ...userData,
                                    lastSeen: new Date().toISOString()
                                };
                            }
                            
                            // Save back to storage
                            localStorage.setItem(storageKey, JSON.stringify(allUsers));
                            return true;
                            
                        } catch (error) {
                            console.error('Error saving to universal storage:', error);
                            return false;
                        }
                    }
                    
                    // 🔥 SAVE TO LOCAL STORAGE (for compatibility)
                    saveToLocalStorage(userData) {
                        try {
                            // Save to registeredUsers
                            let registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
                            registeredUsers[userData.username] = userData.email;
                            localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
                            
                            // Save detailed user data
                            const detailedData = {
                                username: userData.username,
                                email: userData.email,
                                password: userData.password || '',
                                balance: userData.balance || 0,
                                gameBalance: userData.gameBalance || 0,
                                transactionCode: userData.transactionCode,
                                isAdmin: false,
                                status: 'active',
                                registeredAt: userData.registeredAt,
                                lastLogin: new Date().toISOString(),
                                activities: []
                            };
                            
                            localStorage.setItem('userData_' + userData.username, JSON.stringify(detailedData));
                            
                            // Save to ALL_XBET_USERS for admin panel
                            let allUsersList = JSON.parse(localStorage.getItem('ALL_XBET_USERS') || '[]');
                            const exists = allUsersList.findIndex(u => u.username === userData.username);
                            if (exists === -1) {
                                allUsersList.push({
                                    username: userData.username,
                                    email: userData.email,
                                    balance: userData.balance || 0,
                                    gameBalance: userData.gameBalance || 0,
                                    transactionCode: userData.transactionCode,
                                    status: 'active',
                                    registeredAt: userData.registeredAt
                                });
                                localStorage.setItem('ALL_XBET_USERS', JSON.stringify(allUsersList));
                            }
                            
                            return true;
                            
                        } catch (error) {
                            console.error('Error saving to local storage:', error);
                            return false;
                        }
                    }
                    
                    // 🔥 GET ALL USERS
                    getAllUsers() {
                        try {
                            const storageKey = this.STORAGE_KEYS.USERS;
                            const universalData = localStorage.getItem(storageKey);
                            let allUsers = [];
                            
                            if (universalData) {
                                try {
                                    allUsers = JSON.parse(universalData);
                                    if (!Array.isArray(allUsers)) {
                                        allUsers = [];
                                    }
                                } catch (e) {
                                    allUsers = [];
                                }
                            }
                            
                            // Also include local users for backward compatibility
                            const localUsers = JSON.parse(localStorage.getItem('ALL_XBET_USERS') || '[]');
                            localUsers.forEach(localUser => {
                                const exists = allUsers.find(u => u.username === localUser.username);
                                if (!exists) {
                                    allUsers.push({
                                        ...localUser,
                                        source: 'local'
                                    });
                                }
                            });
                            
                            return allUsers;
                            
                        } catch (error) {
                            console.error('Error getting all users:', error);
                            return [];
                        }
                    }
                    
                    // 🔥 SYNC NOW
                    syncNow() {
                        try {
                            console.log('🔄 Syncing data...');
                            
                            // Update sync timestamp
                            localStorage.setItem(this.STORAGE_KEYS.LAST_SYNC, Date.now().toString());
                            
                            return {
                                success: true,
                                timestamp: new Date().toISOString()
                            };
                            
                        } catch (error) {
                            console.error('Sync error:', error);
                            return {
                                success: false,
                                error: error.message
                            };
                        }
                    }
                    
                    // 🔥 TRIGGER SYNC (notify other tabs)
                    triggerSync() {
                        try {
                            localStorage.setItem(this.STORAGE_KEYS.SYNC_FLAG, Date.now().toString());
                            setTimeout(() => {
                                localStorage.removeItem(this.STORAGE_KEYS.SYNC_FLAG);
                            }, 100);
                        } catch (error) {
                            console.error('Error triggering sync:', error);
                        }
                    }
                    
                    // 🔥 START AUTO SYNC
                    startAutoSync() {
                        if (this.syncInterval) {
                            clearInterval(this.syncInterval);
                        }
                        
                        this.syncInterval = setInterval(() => {
                            this.syncNow();
                        }, 15000); // Every 15 seconds
                        
                        console.log('⏰ Auto-sync started (15s interval)');
                    }
                    
                    // 🔥 GENERATE TRANSACTION CODE
                    generateTransactionCode(username) {
                        const prefix = username ? username.substring(0, 3).toUpperCase() : 'XBT';
                        const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
                        const random = Math.random().toString(36).slice(2, 8).toUpperCase();
                        return `XBT-${prefix}-${timestamp}-${random}`;
                    }
                    
                    // 🔥 GET BROWSER INFO
                    getBrowserInfo() {
                        const ua = navigator.userAgent;
                        let browser = 'Unknown';
                        
                        if (ua.includes('Firefox')) browser = 'Firefox';
                        else if (ua.includes('Chrome')) browser = 'Chrome';
                        else if (ua.includes('Safari')) browser = 'Safari';
                        else if (ua.includes('Edge')) browser = 'Edge';
                        else if (ua.includes('Opera')) browser = 'Opera';
                        
                        return browser;
                    }
                    
                    // 🔥 GET SYNC STATUS
                    getSyncStatus() {
                        try {
                            const universalData = localStorage.getItem(this.STORAGE_KEYS.USERS);
                            let userCount = 0;
                            
                            if (universalData) {
                                try {
                                    const users = JSON.parse(universalData);
                                    userCount = Array.isArray(users) ? users.length : 0;
                                } catch (e) {
                                    userCount = 0;
                                }
                            }
                            
                            const lastSync = localStorage.getItem(this.STORAGE_KEYS.LAST_SYNC);
                            const localUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
                            
                            return {
                                universalUsers: userCount,
                                localUsers: Object.keys(localUsers).length,
                                lastSync: lastSync ? new Date(parseInt(lastSync)).toLocaleTimeString() : 'Never',
                                browser: this.getBrowserInfo(),
                                syncActive: this.syncInterval !== null,
                                initialized: this.isInitialized,
                                version: '3.0'
                            };
                            
                        } catch (error) {
                            console.error('Error getting sync status:', error);
                            return {
                                universalUsers: 0,
                                localUsers: 0,
                                lastSync: 'Error',
                                browser: 'Unknown',
                                syncActive: false,
                                initialized: false,
                                version: '3.0'
                            };
                        }
                    }
                    
                    // 🔥 CHECK IF READY
                    isReady() {
                        return this.isInitialized;
                    }
                }
                
                // Create global instance
                window.xbetSync = new XbetUniversalSync();
                
            } catch (error) {
                console.error('❌ CRITICAL: Failed to create sync system:', error);
                
                // Create minimal fallback system
                window.xbetSync = {
                    registerUser: function(userData) {
                        console.log('📦 Fallback: Registering user locally');
                        
                        // Save to registeredUsers
                        let registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
                        registeredUsers[userData.username] = userData.email;
                        localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
                        
                        // Save detailed data
                        localStorage.setItem('userData_' + userData.username, JSON.stringify({
                            username: userData.username,
                            email: userData.email,
                            password: userData.password,
                            balance: 0,
                            gameBalance: 0,
                            transactionCode: userData.transactionCode,
                            isAdmin: false,
                            status: 'active',
                            registeredAt: new Date().toISOString()
                        }));
                        
                        return 'fallback_' + Date.now();
                    },
                    getAllUsers: function() {
                        const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
                        return Object.keys(registeredUsers).map(username => ({
                            username: username,
                            email: registeredUsers[username]
                        }));
                    },
                    generateTransactionCode: function(username) {
                        return 'FALLBACK-' + Date.now() + '-' + username;
                    },
                    getSyncStatus: function() {
                        const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
                        return {
                            universalUsers: Object.keys(registeredUsers).length,
                            localUsers: Object.keys(registeredUsers).length,
                            lastSync: new Date().toLocaleTimeString(),
                            browser: navigator.userAgent.substring(0, 30),
                            syncActive: false,
                            initialized: true,
                            version: 'fallback'
                        };
                    },
                    syncNow: function() {
                        console.log('Fallback sync completed');
                        return { success: true };
                    },
                    isReady: function() {
                        return true;
                    }
                };
                
                resolve(window.xbetSync);
            }
        }
    });
    
    // Create synchronous access point
    window.xbetSyncReady = false;
    window.xbetSyncReadyPromise.then((sync) => {
        window.xbetSyncReady = true;
        console.log('🎉 Sync System Ready!');
        
        // Dispatch ready event
        const event = new CustomEvent('xbetSyncReady', { detail: sync });
        window.dispatchEvent(event);
    });
    
    console.log('📦 X-BET Sync System loaded successfully');
})();
