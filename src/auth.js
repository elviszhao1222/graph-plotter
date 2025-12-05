// Auth module with API backend support and localStorage fallback
import { authAPI, setAuthToken, getAuthToken } from './api.js';

const CURRENT_USER_KEY = 'gp_current_user';
let currentUser = null;
let useAPI = true; // Try API first, fallback to localStorage

// Fallback: localStorage-based auth (for demo/offline mode)
const USERS_KEY = 'gp_users';

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

function setCurrentUser(user) {
	currentUser = user;
	if (user) {
		localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
	} else {
		localStorage.removeItem(CURRENT_USER_KEY);
	}
	_notifyAuthListeners();
}

export function getCurrentUser() {
	if (currentUser) return currentUser;
	try {
		const stored = localStorage.getItem(CURRENT_USER_KEY);
		if (stored) {
			currentUser = JSON.parse(stored);
			return currentUser;
		}
	} catch (_) {}
	return null;
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
	
	// Try API first
	if (useAPI) {
		try {
			const data = await authAPI.register(email, password);
			setCurrentUser(data.user);
			return data.user;
		} catch (error) {
			if (error.message.includes('connect')) {
				useAPI = false; // Fallback to localStorage
			} else {
				throw error;
			}
		}
	}
	
	// Fallback: localStorage
	const users = readUsers();
	if (users.find(u => u.email === email)) {
		throw new Error('An account with this email already exists.');
	}
	const passwordHash = await hashPassword(password);
	users.push({ email, passwordHash, createdAt: Date.now() });
	writeUsers(users);
	setCurrentUser({ email });
	return { email };
}

export async function login(email, password) {
	email = (email || '').trim().toLowerCase();
	if (!email || !password) throw new Error('Email and password are required.');
	
	// Try API first
	if (useAPI) {
		try {
			const data = await authAPI.login(email, password);
			setCurrentUser(data.user);
			return data.user;
		} catch (error) {
			if (error.message.includes('connect')) {
				useAPI = false; // Fallback to localStorage
			} else {
				throw error;
			}
		}
	}
	
	// Fallback: localStorage
	const users = readUsers();
	const user = users.find(u => u.email === email);
	if (!user) throw new Error('No account found for this email.');
	const passwordHash = await hashPassword(password);
	if (user.passwordHash !== passwordHash) throw new Error('Incorrect password.');
	setCurrentUser({ email });
	return { email };
}

export function logout() {
	if (useAPI) {
		authAPI.logout();
	}
	setCurrentUser(null);
}

// Initialize: check if we have a token
(async () => {
	if (getAuthToken()) {
		try {
			const data = await authAPI.getCurrentUser();
			setCurrentUser(data.user);
			useAPI = true;
		} catch (_) {
			useAPI = false;
		}
	}
})();

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


