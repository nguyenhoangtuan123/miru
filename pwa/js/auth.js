/**
 * Authentication utilities for frontend
 * Handles auth state checking, logout, and user info
 */

/**
 * Check if user is authenticated
 * @returns {Promise<Object|null>} User object if authenticated, null otherwise
 */
async function checkAuth() {
    try {
        const response = await fetch('/auth/me', {
            credentials: 'include'  // Include cookies
        });

        if (response.ok) {
            const user = await response.json();
            return user;
        }

        return null;
    } catch (error) {
        console.error('Auth check failed:', error);
        return null;
    }
}

/**
 * Logout current user
 * Clears auth cookie and redirects to login
 */
async function logout() {
    try {
        await fetch('/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });

        // Redirect to login page
        window.location.href = '/login';
    } catch (error) {
        console.error('Logout failed:', error);
        // Still redirect even if request fails
        window.location.href = '/login';
    }
}

/**
 * Require authentication for current page
 * Redirects to login if not authenticated
 * @returns {Promise<Object>} User object if authenticated
 */
async function requireAuth() {
    const user = await checkAuth();

    if (!user) {
        // Not authenticated, redirect to login
        window.location.href = '/login';
        throw new Error('Not authenticated');
    }

    return user;
}

/**
 * Display user info in UI
 * @param {Object} user - User object from auth
 */
function displayUserInfo(user) {
    // Update user name if element exists
    const userNameEl = document.getElementById('userName');
    if (userNameEl && user.name) {
        userNameEl.textContent = user.name;
    }

    // Update user email if element exists
    const userEmailEl = document.getElementById('userEmail');
    if (userEmailEl && user.email) {
        userEmailEl.textContent = user.email;
    }

    // Update user picture if element exists
    const userPictureEl = document.getElementById('userPicture');
    if (userPictureEl && user.picture) {
        userPictureEl.src = user.picture;
    }
}

// Export functions for use in other scripts
window.checkAuth = checkAuth;
window.logout = logout;
window.requireAuth = requireAuth;
window.displayUserInfo = displayUserInfo;
