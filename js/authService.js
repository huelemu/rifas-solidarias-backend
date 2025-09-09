// js/authService.js - Servicio completo de autenticación
class AuthService {
    constructor() {
        this.API_BASE_URL = 'http://localhost:3100';
    }

    // ========================
    // MÉTODOS DE AUTENTICACIÓN
    // ========================

    async login(email, password) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Guardar tokens y datos del usuario
                this.setTokens(data.data.tokens.access_token, data.data.tokens.refresh_token);
                this.setUserData(data.data.user);
                return { success: true, data: data.data };
            } else {
                return { success: false, error: data.message, status: response.status };
            }
        } catch (error) {
            console.error('Error en login:', error);
            return { success: false, error: 'Error de conexión con el servidor' };
        }
    }

    async register(userData) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (response.ok) {
                // Auto-login después del registro
                this.setTokens(data.data.tokens.access_token, data.data.tokens.refresh_token);
                this.setUserData(data.data.user);
                return { success: true, data: data.data };
            } else {
                return { success: false, error: data.message, status: response.status };
            }
        } catch (error) {
            console.error('Error en registro:', error);
            return { success: false, error: 'Error de conexión con el servidor' };
        }
    }

    async refreshToken() {
        try {
            const refreshToken = this.getRefreshToken();
            if (!refreshToken) {
                throw new Error('No hay refresh token');
            }

            const response = await fetch(`${this.API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refresh_token: refreshToken })
            });

            const data = await response.json();

            if (response.ok) {
                this.setAccessToken(data.data.access_token);
                return data.data.access_token;
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Error renovando token:', error);
            this.logout();
            throw error;
        }
    }

    async logout() {
        try {
            const accessToken = this.getAccessToken();
            const refreshToken = this.getRefreshToken();

            if (accessToken) {
                await fetch(`${this.API_BASE_URL}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({ refresh_token: refreshToken })
                });
            }
        } catch (error) {
            console.error('Error en logout:', error);
        } finally {
            // Limpiar datos locales siempre
            this.clearAuthData();
        }
    }

    async getProfile() {
        try {
            const response = await this.authenticatedRequest(`${this.API_BASE_URL}/auth/me`);
            return response;
        } catch (error) {
            console.error('Error obteniendo perfil:', error);
            throw error;
        }
    }

    // ========================
    // GESTIÓN DE TOKENS
    // ========================

    setTokens(accessToken, refreshToken) {
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
    }

    setAccessToken(token) {
        localStorage.setItem('access_token', token);
    }

    getAccessToken() {
        return localStorage.getItem('access_token');
    }

    getRefreshToken() {
        return localStorage.getItem('refresh_token');
    }

    setUserData(userData) {
        localStorage.setItem('user_data', JSON.stringify(userData));
    }

    getUserData() {
        const userData = localStorage.getItem('user_data');
        return userData ? JSON.parse(userData) : null;
    }

    clearAuthData() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_data');
    }

    // ========================
    // VERIFICACIONES
    // ========================

    isAuthenticated() {
        const token = this.getAccessToken();
        if (!token) return false;

        // Verificar si el token no está expirado
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const now = Date.now() / 1000;
            return payload.exp > now;
        } catch (error) {
            return false;
        }
    }

    getCurrentUser() {
        if (!this.isAuthenticated()) return null;
        return this.getUserData();
    }

    hasRole(role) {
        const user = this.getCurrentUser();
        return user && user.rol === role;
    }

    hasAnyRole(roles) {
        const user = this.getCurrentUser();
        return user && roles.includes(user.rol);
    }

    // ========================
    // REQUESTS AUTENTICADAS
    // ========================

    async authenticatedRequest(url, options = {}) {
        let token = this.getAccessToken();

        if (!token) {
            throw new Error('No hay token de acceso');
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    ...options.headers
                }
            });

            // Si el token expiró, intentar renovarlo
            if (response.status === 401) {
                const data = await response.json();
                if (data.code === 'TOKEN_EXPIRED') {
                    token = await this.refreshToken();
                    
                    // Reintentar la request con el nuevo token
                    const retryResponse = await fetch(url, {
                        ...options,
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            ...options.headers
                        }
                    });

                    if (retryResponse.ok) {
                        return await retryResponse.json();
                    } else {
                        throw new Error('Error en request autenticada');
                    }
                } else {
                    this.logout();
                    throw new Error('No autorizado');
                }
            }

            if (response.ok) {
                return await response.json();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error en request');
            }

        } catch (error) {
            console.error('Error en request autenticada:', error);
            throw error;
        }
    }

    // ========================
    // UTILIDADES
    // ========================

    redirectToLogin() {
        window.location.href = '/login.html';
    }

    redirectToDashboard() {
        const user = this.getCurrentUser();
        if (user) {
            // Redirigir según el rol del usuario
            switch (user.rol) {
                case 'admin_global':
                    window.location.href = '/admin/dashboard.html';
                    break;
                case 'admin_institucion':
                    window.location.href = '/institucion/dashboard.html';
                    break;
                case 'vendedor':
                    window.location.href = '/vendedor/dashboard.html';
                    break;
                case 'comprador':
                default:
                    window.location.href = '/dashboard.html';
                    break;
            }
        } else {
            this.redirectToLogin();
        }
    }

    // Verificar autenticación en páginas protegidas
    requireAuth() {
        if (!this.isAuthenticated()) {
            this.redirectToLogin();
            return false;
        }
        return true;
    }

    // Verificar rol específico
    requireRole(requiredRole) {
        if (!this.requireAuth()) return false;
        
        if (!this.hasRole(requiredRole)) {
            alert('No tienes permisos para acceder a esta página');
            this.redirectToDashboard();
            return false;
        }
        return true;
    }

    // Verificar cualquiera de los roles
    requireAnyRole(requiredRoles) {
        if (!this.requireAuth()) return false;
        
        if (!this.hasAnyRole(requiredRoles)) {
            alert('No tienes permisos para acceder a esta página');
            this.redirectToDashboard();
            return false;
        }
        return true;
    }
}

// Crear instancia global del servicio
const authService = new AuthService();

// Función global para verificar autenticación al cargar páginas
function checkAuthOnLoad() {
    // Solo verificar en páginas que no sean login o registro
    const publicPages = ['/login.html', '/register.html', '/index.html', '/'];
    const currentPage = window.location.pathname;
    
    if (!publicPages.some(page => currentPage.endsWith(page))) {
        authService.requireAuth();
    }
}

// Auto-verificar al cargar cualquier página
document.addEventListener('DOMContentLoaded', checkAuthOnLoad);