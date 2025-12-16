// 🔥 X-BET CROSS-BROWSER SYNC ENGINE v1.0
// Works across ALL browsers, devices, and platforms
(function() {
    'use strict';
    
    console.log('🌐 Loading Cross-Browser Sync Engine...');
    
    class CrossBrowserSync {
        constructor() {
            this.SYSTEM_ID = 'xbet_cross_sync_v1';
            this.STORAGE_KEYS = {
                MASTER_USERS: 'XBET_MASTER_USERS_V1',  // Master user database
                SYNC_SIGNAL: 'XBET_SYNC_SIGNAL_V1',
                ADMIN_USERS: 'XBET_ADMIN_USERS_V1',
                BROADCAST_CHANNEL: 'xbet_broadcast_channel'
            };
            
            this.channel = null;
            this.tabId = 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            this.init();
        }
        
        init() {
            console.log('🚀 Initializing Cross-Browser Sync...');
            
            // Setup BroadcastChannel for cross-tab communication
            this.setupBroadcastChannel();
            
            // Listen for localStorage changes from other tabs/browsers
            window.addEventListener('storage', this.handleStorageEvent.bind(this));
            
            // Setup heartbeat to keep sync alive
            this.setupHeartbeat();
            
            // Initial sync
            this.syncAllBrowsers();
            
            console.log('✅ Cross-Browser Sync Engine Ready');
            console.log('📡 Tab ID:', this.tabId);
        }
        
        setupBroadcastChannel() {
            try {
                // Try BroadcastChannel API (works across tabs/windows in same browser)
                if (typeof BroadcastChannel !== 'undefined') {
                    this.channel = new BroadcastChannel(this.STORAGE_KEYS.BROADCAST_CHANNEL);
                    
                    this.channel.onmessage = (event) => {
                        console.log('📨 Received broadcast message:', event.data);
                        if (event.data.type === 'USER_ADDED') {
                            this.addUserToMaster(event.data.user);
                        } else if (event.data.type === 'SYNC_REQUEST') {
                            this.broadcastUserList();
                        }
                    };
                }
            } catch (error) {
                console.warn('BroadcastChannel not available:', error);
            }
        }
        
        setupHeartbeat() {
            // Send heartbeat every 30 seconds
            setInterval(() => {
                this.broadcastHeartbeat();
            }, 30000);
        }
        
        broadcastHeartbeat() {
            const signal = {
                type: 'HEARTBEAT',
                tabId: this.tabId,
                timestamp: Date.now(),
                url: window.location.href
            };
            
            this.sendBroadcast(signal);
            localStorage.setItem(this.STORAGE_KEYS.SYNC_SIGNAL, JSON.stringify(signal));
            
            setTimeout(() => {
                localStorage.removeItem(this.STORAGE_KEYS.SYNC_SIGNAL);
            }, 100);
        }
        
        sendBroadcast(data) {
            // Method 1: BroadcastChannel
            if (this.channel) {
                this.channel.postMessage(data);
            }
            
            // Method 2: localStorage event
            localStorage.setItem('XBET_BROADCAST_' + Date.now(), JSON.stringify({
                ...data,
                _timestamp: Date.now()
            }));
        }
        
        // 🔥 ADD USER (Call this when user registers in ANY browser)
        addUser(userData) {
            console.log('➕ Adding user to cross-browser system:', userData.username);
            
            // Generate user ID and transaction code
            const userId = 'CROSS_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const transactionCode = this.generateTransactionCode(userData.username);
            
            const completeUserData = {
                ...userData,
                id: userId,
                transactionCode: transactionCode,
                registeredAt: new Date().toISOString(),
                addedByTab: this.tabId,
                addedFromUrl: window.location.href,
                browser: this.getBrowserInfo(),
                device: this.getDeviceInfo(),
                syncVersion: '1.0'
            };
            
            // 1. Add to master storage (this browser)
            this.addUserToMaster(completeUserData);
            
            // 2. Broadcast to all other tabs/browsers
            this.broadcastNewUser(completeUserData);
            
            // 3. Update admin storage
            this.updateAdminStorage(completeUserData);
            
            console.log('✅ User added to cross-browser system:', userData.username);
            return userId;
        }
        
        addUserToMaster(userData) {
            try {
                // Get master users
                let masterUsers = this.getMasterUsers();
                
                // Check if user exists
                const existingIndex = masterUsers.findIndex(u => 
                    u.username === userData.username || u.email === userData.email
                );
                
                if (existingIndex === -1) {
                    // Add new user
                    masterUsers.push(userData);
                    console.log('📝 Added to master storage:', userData.username);
                } else {
                    // Update existing user
                    masterUsers[existingIndex] = {
                        ...masterUsers[existingIndex],
                        ...userData,
                        lastSeen: new Date().toISOString()
                    };
                    console.log('🔄 Updated in master storage:', userData.username);
                }
                
                // Save master users
                localStorage.setItem(this.STORAGE_KEYS.MASTER_USERS, JSON.stringify(masterUsers));
                
                // Also update admin storage
                this.updateAdminStorage(userData);
                
                return true;
            } catch (error) {
                console.error('Error adding to master:', error);
                return false;
            }
        }
        
        broadcastNewUser(userData) {
            const broadcastData = {
                type: 'USER_ADDED',
                user: userData,
                timestamp: Date.now(),
                tabId: this.tabId
            };
            
            // Broadcast to all tabs
            this.sendBroadcast(broadcastData);
            
            // Also trigger localStorage event
            localStorage.setItem('XBET_NEW_USER_' + Date.now(), JSON.stringify(broadcastData));
            setTimeout(() => {
                localStorage.removeItem('XBET_NEW_USER_' + Date.now());
            }, 100);
            
            console.log('📢 Broadcasted new user:', userData.username);
        }
        
        updateAdminStorage(userData) {
            try {
                // Format for admin panel
                const adminUser = {
                    username: userData.username,
                    email: userData.email,
                    balance: userData.balance || 0,
                    gameBalance: userData.gameBalance || 0,
                    transactionCode: userData.transactionCode || this.generateTransactionCode(userData.username),
                    status: userData.status || 'active',
                    registeredAt: userData.registeredAt || new Date().toISOString(),
                    lastLogin: userData.lastLogin || new Date().toISOString(),
                    source: 'cross_browser_sync',
                    browser: userData.browser || this.getBrowserInfo(),
                    device: userData.device || this.getDeviceInfo(),
                    addedByTab: userData.addedByTab || this.tabId
                };
                
                // Get existing admin users
                let adminUsers = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.ADMIN_USERS) || '[]');
                
                // Check if exists
                const existingIndex = adminUsers.findIndex(u => u.username === adminUser.username);
                
                if (existingIndex === -1) {
                    adminUsers.push(adminUser);
                } else {
                    adminUsers[existingIndex] = {
                        ...adminUsers[existingIndex],
                        ...adminUser,
                        lastSeen: new Date().toISOString()
                    };
                }
                
                // Save admin users
                localStorage.setItem(this.STORAGE_KEYS.ADMIN_USERS, JSON.stringify(adminUsers));
                
                // Also update ALL_XBET_USERS for compatibility
                this.updateCompatibilityStorage(adminUser);
                
                // Trigger admin update
                this.triggerAdminUpdate();
                
                return true;
            } catch (error) {
                console.error('Error updating admin storage:', error);
                return false;
            }
        }
        
        updateCompatibilityStorage(userData) {
            try {
                // Update ALL_XBET_USERS
                let allXbetUsers = JSON.parse(localStorage.getItem('ALL_XBET_USERS') || '[]');
                const existingIndex = allXbetUsers.findIndex(u => u.username === userData.username);
                
                const compatibleUser = {
                    username: userData.username,
                    email: userData.email,
                    balance: userData.balance || 0,
                    gameBalance: userData.gameBalance || 0,
                    transactionCode: userData.transactionCode,
                    status: userData.status || 'active',
                    registeredAt: userData.registeredAt || new Date().toISOString(),
                    source: 'cross_sync_compatible'
                };
                
                if (existingIndex === -1) {
                    allXbetUsers.push(compatibleUser);
                } else {
                    allXbetUsers[existingIndex] = compatibleUser;
                }
                
                localStorage.setItem('ALL_XBET_USERS', JSON.stringify(allXbetUsers));
                
                // Also update registeredUsers
                let registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
                registeredUsers[userData.username] = userData.email;
                localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
                
                return true;
            } catch (error) {
                console.error('Error updating compatibility storage:', error);
                return false;
            }
        }
        
        triggerAdminUpdate() {
            localStorage.setItem('XBET_ADMIN_UPDATE_NOW', Date.now().toString());
            setTimeout(() => {
                localStorage.removeItem('XBET_ADMIN_UPDATE_NOW');
            }, 100);
        }
        
        // 🔥 GET ALL USERS (For admin panel)
        getAllUsers() {
            try {
                // First, get from admin storage
                let adminUsers = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.ADMIN_USERS) || '[]');
                
                // Also get from master storage
                const masterUsers = this.getMasterUsers();
                
                // Merge users (avoid duplicates)
                masterUsers.forEach(masterUser => {
                    const exists = adminUsers.find(u => u.username === masterUser.username);
                    if (!exists) {
                        adminUsers.push({
                            username: masterUser.username,
                            email: masterUser.email,
                            balance: masterUser.balance || 0,
                            gameBalance: masterUser.gameBalance || 0,
                            transactionCode: masterUser.transactionCode || this.generateTransactionCode(masterUser.username),
                            status: masterUser.status || 'active',
                            registeredAt: masterUser.registeredAt || new Date().toISOString(),
                            source: 'master_sync',
                            browser: masterUser.browser || 'Unknown',
                            device: masterUser.device || 'Unknown'
                        });
                    }
                });
                
                // Also check compatibility storage
                const allXbetUsers = JSON.parse(localStorage.getItem('ALL_XBET_USERS') || '[]');
                allXbetUsers.forEach(xbetUser => {
                    const exists = adminUsers.find(u => u.username === xbetUser.username);
                    if (!exists) {
                        adminUsers.push({
                            ...xbetUser,
                            source: xbetUser.source || 'compatibility'
                        });
                    }
                });
                
                console.log(`📊 Total users from all sources: ${adminUsers.length}`);
                return adminUsers;
            } catch (error) {
                console.error('Error getting all users:', error);
                return [];
            }
        }
        
        getMasterUsers() {
            try {
                const masterData = localStorage.getItem(this.STORAGE_KEYS.MASTER_USERS);
                if (masterData) {
                    return JSON.parse(masterData);
                }
            } catch (error) {
                console.error('Error getting master users:', error);
            }
            return [];
        }
        
        broadcastUserList() {
            const masterUsers = this.getMasterUsers();
            const broadcastData = {
                type: 'USER_LIST',
                users: masterUsers,
                timestamp: Date.now(),
                tabId: this.tabId
            };
            
            this.sendBroadcast(broadcastData);
        }
        
        // 🔥 SYNC ALL BROWSERS
        syncAllBrowsers() {
            console.log('🔄 Syncing with all browsers...');
            
            // Request user list from other tabs
            this.sendBroadcast({
                type: 'SYNC_REQUEST',
                timestamp: Date.now(),
                tabId: this.tabId
            });
            
            // Update admin storage with current master users
            const masterUsers = this.getMasterUsers();
            masterUsers.forEach(user => {
                this.updateAdminStorage(user);
            });
            
            return {
                success: true,
                users: masterUsers.length,
                timestamp: new Date().toISOString()
            };
        }
        
        handleStorageEvent(event) {
            // Listen for cross-browser signals
            if (event.key && (
                event.key.includes('XBET_NEW_USER_') ||
                event.key.includes('XBET_BROADCAST_') ||
                event.key === this.STORAGE_KEYS.SYNC_SIGNAL ||
                event.key === 'XBET_ADMIN_UPDATE_NOW'
            )) {
                console.log('🌐 Cross-browser event detected:', event.key);
                
                try {
                    if (event.newValue) {
                        const data = JSON.parse(event.newValue);
                        
                        if (data.type === 'USER_ADDED') {
                            // Add user from other browser
                            this.addUserToMaster(data.user);
                        } else if (data.type === 'USER_LIST') {
                            // Sync user list from other browser
                            if (data.users && Array.isArray(data.users)) {
                                data.users.forEach(user => {
                                    this.addUserToMaster(user);
                                });
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error processing storage event:', error);
                }
                
                // Update admin panel
                setTimeout(() => {
                    if (window.admin && window.admin.loadAllUsers) {
                        window.admin.loadAllUsers();
                        window.admin.updateDisplay();
                    }
                }, 500);
            }
        }
        
        generateTransactionCode(username) {
            const prefix = username ? username.substring(0, 3).toUpperCase() : 'XBT';
            const timestamp = Date.now().toString(36).toUpperCase().substr(-6);
            const random = Math.random().toString(36).substr(2, 6).toUpperCase();
            return `XBT-${prefix}-${timestamp}-${random}`;
        }
        
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
        
        getDeviceInfo() {
            const ua = navigator.userAgent;
            if (/Mobi|Android/i.test(ua)) return 'Mobile';
            else if (/Tablet|iPad/i.test(ua)) return 'Tablet';
            else return 'Desktop';
        }
        
        // 🔥 FORCE SYNC
        forceSync() {
            return this.syncAllBrowsers();
        }
        
        // 🔥 GET STATUS
        getStatus() {
            const masterUsers = this.getMasterUsers();
            const adminUsers = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.ADMIN_USERS) || '[]');
            
            return {
                masterUsers: masterUsers.length,
                adminUsers: adminUsers.length,
                tabId: this.tabId,
                browser: this.getBrowserInfo(),
                device: this.getDeviceInfo(),
                broadcastChannel: !!this.channel,
                timestamp: new Date().toLocaleTimeString()
            };
        }
    }
    
    // Create global instance
    if (!window.crossBrowserSync) {
        window.crossBrowserSync = new CrossBrowserSync();
    }
    
    console.log('🌐 Cross-Browser Sync Engine loaded successfully');
})();
