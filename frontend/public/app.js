// Firebase Configuration - REPLACE WITH YOUR ACTUAL VALUES
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const gameScreen = document.getElementById('game-screen');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');
const userName = document.getElementById('user-name');
const coinCount = document.getElementById('coin-count');
const playButtons = document.querySelectorAll('.play-btn');
const gameResult = document.getElementById('game-result');
const resultTitle = document.getElementById('result-title');
const resultMessage = document.getElementById('result-message');
const playAgainBtn = document.getElementById('play-again');
const authMessage = document.getElementById('auth-message');

// Game configurations
const games = {
    spin_wheel: {
        name: "Lucky Spin",
        cost: 10,
        description: "Spin the wheel for random multipliers!"
    },
    coin_flip: {
        name: "Coin Flip", 
        cost: 5,
        description: "Heads or tails? 50/50 chance!"
    },
    dice_roll: {
        name: "Dice Roll",
        cost: 8, 
        description: "Roll dice for multiplier wins!"
    }
};

// Auth state listener
auth.onAuthStateChanged(async (user) => {
    if (user) {
        await loadUserData(user);
        showScreen(gameScreen);
    } else {
        showScreen(authScreen);
    }
});

// Event Listeners
loginBtn.addEventListener('click', handleLogin);
registerBtn.addEventListener('click', handleRegister);
logoutBtn.addEventListener('click', handleLogout);
playAgainBtn.addEventListener('click', () => {
    gameResult.classList.add('hidden');
});

playButtons.forEach(btn => {
    btn.addEventListener('click', handleGamePlay);
});

// Auth Functions
async function handleLogin() {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    if (!email || !password) {
        showAuthMessage('Please enter both email and password', 'error');
        return;
    }
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        showAuthMessage('Login successful!', 'success');
    } catch (error) {
        showAuthMessage('Login failed: ' + error.message, 'error');
    }
}

async function handleRegister() {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    if (!email || !password) {
        showAuthMessage('Please enter both email and password', 'error');
        return;
    }
    
    if (password.length < 6) {
        showAuthMessage('Password must be at least 6 characters', 'error');
        return;
    }
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Create user document in Firestore
        await db.collection('users').doc(user.uid).set({
            userId: user.uid,
            email: email,
            displayName: email.split('@')[0],
            coins: 100, // Starting bonus
            role: 'user',
            status: 'active',
            registrationDate: firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Create welcome transaction
        await db.collection('transactions').add({
            userId: user.uid,
            type: 'credit',
            amount: 100,
            issuedBy: 'system',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'completed',
            description: 'Welcome bonus'
        });
        
        showAuthMessage('Registration successful! You received 100 welcome coins.', 'success');
    } catch (error) {
        showAuthMessage('Registration failed: ' + error.message, 'error');
    }
}

async function handleLogout() {
    try {
        await auth.signOut();
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// User Data Functions
async function loadUserData(user) {
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            userName.textContent = userData.displayName;
            coinCount.textContent = userData.coins;
            
            // Update last login
            await db.collection('users').doc(user.uid).update({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Game Functions
async function handleGamePlay(event) {
    const gameCard = event.target.closest('.game-card');
    const gameId = gameCard.dataset.game;
    const game = games[gameId];
    const user = auth.currentUser;
    
    if (!user) return;
    
    try {
        // Get current user data
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userData = userDoc.data();
        
        // Check if user has enough coins
        if (userData.coins < game.cost) {
            showGameResult('Insufficient Coins', `You need ${game.cost} coins to play ${game.name}. You have ${userData.coins} coins.`);
            return;
        }
        
        // Play the game
        const result = await playGame(gameId, user.uid, game.cost);
        
        if (result.success) {
            // Update local coin display
            coinCount.textContent = result.newBalance;
            
            // Show result
            if (result.coinsWon > 0) {
                showGameResult('You Won!', `Congratulations! You won ${result.coinsWon} coins playing ${game.name}!`);
            } else {
                showGameResult('Better Luck Next Time', `You didn't win this time. Try again!`);
            }
        }
        
    } catch (error) {
        showGameResult('Game Error', 'Something went wrong. Please try again.');
        console.error('Game error:', error);
    }
}

async function playGame(gameId, userId, cost) {
    // Simple game logic
    const winChance = 0.6; // 60% win rate
    const isWin = Math.random() < winChance;
    const coinsWon = isWin ? Math.floor(cost * (1 + Math.random() * 2)) : 0;
    
    // Start a batch write for atomic operations
    const batch = db.batch();
    
    const userRef = db.collection('users').doc(userId);
    const playRef = db.collection('plays').doc();
    const spendTxnRef = db.collection('transactions').doc();
    
    // Update user coins
    const userDoc = await userRef.get();
    const currentCoins = userDoc.data().coins;
    const newBalance = currentCoins - cost + coinsWon;
    
    batch.update(userRef, {
        coins: newBalance
    });
    
    // Record the play
    batch.set(playRef, {
        playId: playRef.id,
        userId: userId,
        gameId: gameId,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        coinsSpent: cost,
        coinsWon: coinsWon,
        result: isWin ? 'win' : 'lose'
    });
    
    // Record spend transaction
    batch.set(spendTxnRef, {
        transactionId: spendTxnRef.id,
        userId: userId,
        type: 'spend',
        amount: cost,
        issuedBy: 'system',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'completed',
        description: `Played ${games[gameId].name}`
    });
    
    // Record win transaction if applicable
    if (coinsWon > 0) {
        const winTxnRef = db.collection('transactions').doc();
        batch.set(winTxnRef, {
            transactionId: winTxnRef.id,
            userId: userId,
            type: 'win',
            amount: coinsWon,
            issuedBy: 'system',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'completed',
            description: `Won from ${games[gameId].name}`
        });
    }
    
    // Commit the batch
    await batch.commit();
    
    return {
        success: true,
        coinsWon: coinsWon,
        newBalance: newBalance
    };
}

// UI Functions
function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

function showAuthMessage(message, type) {
    authMessage.textContent = message;
    authMessage.className = `message ${type}`;
    authMessage.style.display = 'block';
    
    setTimeout(() => {
        authMessage.style.display = 'none';
    }, 5000);
}

function showGameResult(title, message) {
    resultTitle.textContent = title;
    resultMessage.textContent = message;
    gameResult.classList.remove('hidden');
}

// Initialize
console.log('X-Bet Games initialized');
