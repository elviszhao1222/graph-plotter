// Simple localStorage-based auth (email + password hash)
// NOT for production use. For demos only.

const USERS_KEY = 'gp_users';
const CURRENT_USER_KEY = 'gp_current_user';

function readUsers() {
	try {
		return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
	} catch (_) {
		return [];
	}
}

function writeUsers(users) {
	localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function setCurrentUser(email) {
	if (email) localStorage.setItem(CURRENT_USER_KEY, email);
	else localStorage.removeItem(CURRENT_USER_KEY);
	_notifyAuthListeners();
}

export function getCurrentUser() {
	const email = localStorage.getItem(CURRENT_USER_KEY);
	if (!email) return null;
	return { email };
}

async function hashPassword(password) {
	const enc = new TextEncoder();
	const data = enc.encode(password);
	const digest = await crypto.subtle.digest('SHA-256', data);
	const bytes = new Uint8Array(digest);
	return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function createAccount(email, password) {
	email = (email || '').trim().toLowerCase();
	if (!email || !password) throw new Error('Email and password are required.');
	const users = readUsers();
	if (users.find(u => u.email === email)) {
		throw new Error('An account with this email already exists.');
	}
	const passwordHash = await hashPassword(password);
	users.push({ email, passwordHash, createdAt: Date.now() });
	writeUsers(users);
	setCurrentUser(email);
	return { email };
}

export async function login(email, password) {
	email = (email || '').trim().toLowerCase();
	if (!email || !password) throw new Error('Email and password are required.');
	const users = readUsers();
	const user = users.find(u => u.email === email);
	if (!user) throw new Error('No account found for this email.');
	const passwordHash = await hashPassword(password);
	if (user.passwordHash !== passwordHash) throw new Error('Incorrect password.');
	setCurrentUser(email);
	return { email };
}

export function logout() {
	setCurrentUser(null);
}

// Auth state listeners
const listeners = new Set();
function _notifyAuthListeners() {
	const user = getCurrentUser();
	listeners.forEach(cb => {
		try { cb(user); } catch (_) {}
	});
}

export function onAuthStateChanged(callback) {
	listeners.add(callback);
	// Fire immediately with current state
	try { callback(getCurrentUser()); } catch (_) {}
	return () => listeners.delete(callback);
}


