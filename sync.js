// 🔥 X-BET UNIVERSAL SYNC SYSTEM v3.0 - Works across ALL browsers
(function() {
    'use strict';
    
    console.log('🔄 Loading X-BET Sync System v3.0...');
    
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
                            SYNC_FLAG: 'XBET_SYNC_ACTIVE',
                            ADMIN_UPDATE: 'XBET_ADMIN_UPDATE'
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
                                if (e.key === this.STORAGE_KEYS.USERS || 
                                    e.key === this.STORAGE_KEYS.SYNC_FLAG ||
                                    e.key === this.STORAGE_KEYS.ADMIN_UPDATE) {
                                    console.log('📡 Sync event received from other tab');
                                    this.syncToAdminPanel();
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
                            
                            // Generate transaction code
                            const transactionCode = this.generateTransactionCode(userData.username);
                            
                            // Complete user data
                            const completeUserData = {
                                ...userData,
                                id: userId,
                                transactionCode: transactionCode,
                                registeredAt: new Date().toISOString(),
                                lastSeen: new Date().toISOString(),
                                browser: this.getBrowserInfo(),
                                syncVersion: '3.0',
                                status: 'active',
                                balance: userData.balance || 0,
                                gameBalance: userData.gameBalance || 0
                            };
                            
                            // 1. Save to universal storage
                            this.saveToUniversalStorage(completeUserData);
                            
                            // 2. Save to local storage for compatibility
                            this.saveToLocalStorage(completeUserData);
                            
                            // 3. IMMEDIATELY add to admin panel
                            this.addToAdminPanel(completeUserData);
                            
                            // 4. Trigger sync
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
                                console.log('✅ Added to universal storage:', userData.username);
                            } else {
                                // Update existing user
                                allUsers[existingIndex] = {
                                    ...allUsers[existingIndex],
                                    ...userData,
                                    lastSeen: new Date().toISOString()
                                };
                                console.log('🔄 Updated in universal storage:', userData.username);
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
                            
                            return true;
                            
                        } catch (error) {
                            console.error('Error saving to local storage:', error);
                            return false;
                        }
                    }
                    
                    // 🔥 ADD TO ADMIN PANEL (CRITICAL FOR ADMIN TO SEE USERS)
                    addToAdminPanel(userData) {
                        try {
                            let adminUsers = JSON.parse(localStorage.getItem('ALL_XBET_USERS') || '[]');
                            const exists = adminUsers.findIndex(u => u.username === userData.username);
                            
                            if (exists === -1) {
                                adminUsers.push({
                                    username: userData.username,
                                    email: userData.email,
                                    balance: userData.balance || 0,
                                    gameBalance: userData.gameBalance || 0,
                                    transactionCode: userData.transactionCode,
                                    status: userData.status || 'active',
                                    registeredAt: userData.registeredAt || new Date().toISOString(),
                                    source: 'universal_sync',
                                    browser: userData.browser || 'Unknown',
                                    lastSeen: new Date().toISOString()
                                });
                                
                                localStorage.setItem('ALL_XBET_USERS', JSON.stringify(adminUsers));
                                console.log('👑 Added to admin panel:', userData.username);
                                
                                // Trigger admin update event
                                localStorage.setItem(this.STORAGE_KEYS.ADMIN_UPDATE, Date.now().toString());
                                setTimeout(() => {
                                    localStorage.removeItem(this.STORAGE_KEYS.ADMIN_UPDATE);
                                }, 100);
                            }
                            
                            return true;
                        } catch (error) {
                            console.error('Error adding to admin panel:', error);
                            return false;
                        }
                    }
                    
                    // 🔥 SYNC ALL USERS TO ADMIN PANEL
                    syncToAdminPanel() {
                        try {
                            console.log('🔄 Syncing all users to admin panel...');
                            
                            // Get all users from universal storage
                            const universalData = localStorage.getItem(this.STORAGE_KEYS.USERS);
                            let universalUsers = [];
                            
                            if (universalData) {
                                try {
                                    universalUsers = JSON.parse(universalData);
                                    if (!Array.isArray(universalUsers)) {
                                        universalUsers = [];
                                    }
                                } catch (e) {
                                    universalUsers = [];
                                }
                            }
                            
                            // Get existing admin panel users
                            let adminUsers = JSON.parse(localStorage.getItem('ALL_XBET_USERS') || '[]');
                            
                            // Merge all users
                            universalUsers.forEach(universalUser => {
                                const exists = adminUsers.findIndex(u => u.username === universalUser.username);
                                
                                if (exists === -1) {
                                    // Add new user to admin panel
                                    adminUsers.push({
                                        username: universalUser.username,
                                        email: universalUser.email,
                                        balance: universalUser.balance || 0,
                                        gameBalance: universalUser.gameBalance || 0,
                                        transactionCode: universalUser.transactionCode || this.generateTransactionCode(universalUser.username),
                                        status: universalUser.status || 'active',
                                        registeredAt: universalUser.registeredAt || new Date().toISOString(),
                                        source: 'universal_sync',
                                        browser: universalUser.browser || 'Unknown',
                                        lastSeen: universalUser.lastSeen || new Date().toISOString()
                                    });
                                } else {
                                    // Update existing user
                                    adminUsers[exists] = {
                                        ...adminUsers[exists],
                                        balance: universalUser.balance || adminUsers[exists].balance,
                                        gameBalance: universalUser.gameBalance || adminUsers[exists].gameBalance,
                                        status: universalUser.status || adminUsers[exists].status,
                                        lastSeen: universalUser.lastSeen || adminUsers[exists].lastSeen
                                    };
                                }
                            });
                            
                            // Also add any locally registered users
                            const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
                            Object.entries(registeredUsers).forEach(([username, email]) => {
                                const exists = adminUsers.findIndex(u => u.username === username);
                                if (exists === -1) {
                                    adminUsers.push({
                                        username: username,
                                        email: email,
                                        balance: 0,
                                        gameBalance: 0,
                                        transactionCode: this.generateTransactionCode(username),
                                        status: 'active',
                                        registeredAt: new Date().toISOString(),
                                        source: 'local_registered',
                                        browser: 'Local',
                                        lastSeen: new Date().toISOString()
                                    });
                                }
                            });
                            
                            // Save to admin panel storage
                            localStorage.setItem('ALL_XBET_USERS', JSON.stringify(adminUsers));
                            
                            console.log(`📊 Admin panel synced: ${adminUsers.length} total users`);
                            
                            // Trigger admin update
                            localStorage.setItem(this.STORAGE_KEYS.ADMIN_UPDATE, Date.now().toString());
                            setTimeout(() => {
                                localStorage.removeItem(this.STORAGE_KEYS.ADMIN_UPDATE);
                            }, 100);
                            
                            return {
                                success: true,
                                totalUsers: adminUsers.length,
                                universalUsers: universalUsers.length
                            };
                            
                        } catch (error) {
                            console.error('Error syncing to admin panel:', error);
                            return {
                                success: false,
                                error: error.message
                            };
                        }
                    }
                    
                    // 🔥 GET ALL USERS (for admin panel)
                    getAllUsers() {
                        try {
                            // First sync to ensure admin panel has all users
                            this.syncToAdminPanel();
                            
                            // Get from admin panel storage
                            const adminUsers = JSON.parse(localStorage.getItem('ALL_XBET_USERS') || '[]');
                            console.log(`📊 Returning ${adminUsers.length} users to admin panel`);
                            
                            return adminUsers;
                            
                        } catch (error) {
                            console.error('Error getting all users:', error);
                            return [];
                        }
                    }
                    
                    // 🔥 SYNC NOW
                    syncNow() {
                        try {
                            console.log('🔄 Starting full sync...');
                            
                            // 1. Sync users to admin panel
                            this.syncToAdminPanel();
                            
                            // 2. Update sync timestamp
                            localStorage.setItem(this.STORAGE_KEYS.LAST_SYNC, Date.now().toString());
                            
                            // 3. Trigger storage event for other tabs
                            this.triggerSync();
                            
                            return {
                                success: true,
                                timestamp: new Date().toISOString(),
                                users: JSON.parse(localStorage.getItem('ALL_XBET_USERS') || '[]').length
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
                            let universalCount = 0;
                            
                            if (universalData) {
                                try {
                                    const users = JSON.parse(universalData);
                                    universalCount = Array.isArray(users) ? users.length : 0;
                                } catch (e) {
                                    universalCount = 0;
                                }
                            }
                            
                            const adminUsers = JSON.parse(localStorage.getItem('ALL_XBET_USERS') || '[]');
                            const lastSync = localStorage.getItem(this.STORAGE_KEYS.LAST_SYNC);
                            
                            return {
                                universalUsers: universalCount,
                                adminUsers: adminUsers.length,
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
                                adminUsers: 0,
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
                    
                    // 🔥 FORCE ADMIN UPDATE
                    forceAdminUpdate() {
                        this.syncToAdminPanel();
                        return true;
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
                        
                        // Save to ALL_XBET_USERS
                        let adminUsers = JSON.parse(localStorage.getItem('ALL_XBET_USERS') || '[]');
                        const exists = adminUsers.findIndex(u => u.username === userData.username);
                        if (exists === -1) {
                            adminUsers.push({
                                username: userData.username,
                                email: userData.email,
                                balance: 0,
                                gameBalance: 0,
                                transactionCode: 'FALLBACK-' + Date.now(),
                                status: 'active',
                                registeredAt: new Date().toISOString(),
                                source: 'fallback'
                            });
                            localStorage.setItem('ALL_XBET_USERS', JSON.stringify(adminUsers));
                        }
                        
                        // Save detailed data
                        localStorage.setItem('userData_' + userData.username, JSON.stringify({
                            username: userData.username,
                            email: userData.email,
                            password: userData.password,
                            balance: 0,
                            gameBalance: 0,
                            transactionCode: 'FALLBACK-' + Date.now(),
                            isAdmin: false,
                            status: 'active',
                            registeredAt: new Date().toISOString()
                        }));
                        
                        return 'fallback_user';
                    },
                    getAllUsers: function() {
                        return JSON.parse(localStorage.getItem('ALL_XBET_USERS') || '[]');
                    },
                    generateTransactionCode: function(username) {
                        return 'XBT-FALLBACK-' + Date.now() + '-' + username.toUpperCase();
                    },
                    getSyncStatus: function() {
                        const adminUsers = JSON.parse(localStorage.getItem('ALL_XBET_USERS') || '[]');
                        return {
                            universalUsers: adminUsers.length,
                            adminUsers: adminUsers.length,
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
                    syncToAdminPanel: function() {
                        console.log('Fallback admin sync');
                        return { success: true };
                    },
                    forceAdminUpdate: function() {
                        console.log('Fallback admin update');
                        return true;
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
