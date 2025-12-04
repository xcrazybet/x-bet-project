// /auth-check.js
// Authentication and user state management for all pages

document.addEventListener('DOMContentLoaded', function() {
    // Wait for Firebase
    setTimeout(initializeAuth, 1000);
});

async function initializeAuth() {
    if (!window.firebaseAuth) {
        console.error('Firebase Auth not loaded');
        return;
    }
    
    // Monitor auth state
    firebaseAuth.onAuthStateChanged(async (user) => {
        const currentPage = getCurrentPage();
        
        // Public pages
        const publicPages = ['index.html', 'login.html', 'signup.html', 'admin-login.html', 'contact.html', 'aboutus.html'];
        const requiresAuth = !publicPages.includes(currentPage);
        
        // If user exists
        if (user) {
            console.log('👤 User logged in:', user.email);
            
            // Check if user is admin
            const isAdmin = await checkIfAdmin(user.uid);
            
            // Handle page access
            if (currentPage === 'admin-login.html' && isAdmin) {
                window.location.href = 'admin.html';
            } else if (currentPage === 'admin.html' && !isAdmin) {
                window.location.href = 'dashboard.html';
            } else if ((currentPage === 'login.html' || currentPage === 'signup.html') && !isAdmin) {
                window.location.href = 'dashboard.html';
            }
            
            // Update UI for logged in user
            updateUserUI(user, isAdmin);
            
        } else {
            // No user logged in
            console.log('👤 No user logged in');
            
            // Redirect if page requires auth
            if (requiresAuth && currentPage !== 'admin-login.html') {
                window.location.href = 'login.html';
            }
            
            updateUIForGuest();
        }
    });
}

function getCurrentPage() {
    const path = window.location.pathname;
    return path.substring(path.lastIndexOf('/') + 1);
}

async function checkIfAdmin(userId) {
    try {
        const adminDoc = await firebaseDb.collection('admins').doc(userId).get();
        return adminDoc.exists;
    } catch (error) {
        console.error('Error checking admin:', error);
        return false;
    }
}

function updateUserUI(user, isAdmin = false) {
    // Update navigation
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const userMenu = document.getElementById('userMenu');
    const adminLink = document.getElementById('adminLink');
    
    if (loginBtn) loginBtn.style.display = 'none';
    if (signupBtn) signupBtn.style.display = 'none';
    if (userMenu) userMenu.style.display = 'flex';
    if (adminLink) adminLink.style.display = isAdmin ? 'block' : 'none';
    
    // Update user info
    updateUserInfo(user);
    
    // Update balance every 10 seconds
    if (!isAdmin) {
        updateUserBalance(user.uid);
        setInterval(() => updateUserBalance(user.uid), 10000);
    }
}

function updateUIForGuest() {
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const userMenu = document.getElementById('userMenu');
    
    if (loginBtn) loginBtn.style.display = 'block';
    if (signupBtn) signupBtn.style.display = 'block';
    if (userMenu) userMenu.style.display = 'none';
}

async function updateUserInfo(user) {
    // Get user data from Firestore
    try {
        const userDoc = await firebaseDb.collection('users').doc(user.uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            
            // Update user name in UI
            const userNameElements = document.querySelectorAll('.user-name, .username-display');
            userNameElements.forEach(el => {
                el.textContent = userData.username || user.email.split('@')[0];
            });
            
            // Update user email
            const userEmailElements = document.querySelectorAll('.user-email');
            userEmailElements.forEach(el => {
                el.textContent = user.email;
            });
        }
    } catch (error) {
        console.error('Error updating user info:', error);
    }
}

async function updateUserBalance(userId) {
    try {
        const userDoc = await firebaseDb.collection('users').doc(userId).get();
        
        if (userDoc.exists) {
            const balance = userDoc.data().balance || 0;
            
            // Update balance in all balance elements
            const balanceElements = document.querySelectorAll('.user-balance, .balance-display, #userBalance');
            balanceElements.forEach(el => {
                el.textContent = `$${balance.toFixed(2)}`;
            });
            
            return balance;
        }
        return 0;
    } catch (error) {
        console.error('Error updating balance:', error);
        return 0;
    }
}

// Logout function
function logoutUser() {
    if (confirm('Are you sure you want to logout?')) {
        firebaseAuth.signOut()
            .then(() => {
                window.location.href = 'index.html';
            })
            .catch(error => {
                alert('Logout failed: ' + error.message);
            });
    }
}

// Make functions globally available
window.logoutUser = logoutUser;
window.updateUserBalance = updateUserBalance;
