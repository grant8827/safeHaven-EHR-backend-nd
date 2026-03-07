import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { User, AuthState, UserRole } from '../types';
import { authService } from '../services/authService';
import { encryptionService } from '../services/encryptionService';
import { auditService } from '../services/auditService';

interface AuthContextType {
  state: AuthState;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  hasRole: (role: UserRole | UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth Action Types
type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'LOGIN_FAILURE' }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: Partial<User> }
  | { type: 'SET_LOADING'; payload: boolean };

// Initial State
const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
};

// Auth Reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        isLoading: true,
      };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'LOGIN_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'LOGOUT':
      return {
        ...initialState,
        isLoading: false,
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : null,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    default:
      return state;
  }
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize authentication on app start
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('theracare_token');
        const userStr = localStorage.getItem('user');
        
        if (token && userStr) {
          // Decrypt token and get stored user
          const decryptedToken = encryptionService.decrypt(token);
          const user = JSON.parse(userStr);
          
          // Set auth token for API requests
          const { apiClient } = await import('../services/apiClient');
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${decryptedToken}`;
          
          dispatch({
            type: 'LOGIN_SUCCESS',
            payload: { user, token: decryptedToken },
          });
          
          // Log successful authentication
          auditService.log({
            action: 'AUTH_VALIDATE_SUCCESS',
            resource: 'authentication',
            resourceId: user.id,
          });
        } else {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        localStorage.removeItem('theracare_token');
        localStorage.removeItem('user');
        dispatch({ type: 'LOGIN_FAILURE' });
        
        // Log failed authentication
        auditService.log({
          action: 'AUTH_VALIDATE_FAILED',
          resource: 'authentication',
          resourceId: 'unknown',
        });
      }
    };

    initAuth();
  }, []);

  // Login function
  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      dispatch({ type: 'LOGIN_START' });

      const response = await authService.login(username, password);
      
      if (response.user && response.access) {
        const { user, access: token } = response;
        
        // Encrypt and store token
        const encryptedToken = encryptionService.encrypt(token);
        localStorage.setItem('theracare_token', encryptedToken);
        localStorage.setItem('user', JSON.stringify(user));
        
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { user, token },
        });

        // Log successful login
        auditService.log({
          action: 'LOGIN_SUCCESS',
          resource: 'authentication',
          resourceId: user.id,
        });

        return true;
      } else {
        dispatch({ type: 'LOGIN_FAILURE' });
        
        // Log failed login attempt
        auditService.log({
          action: 'LOGIN_FAILED',
          resource: 'authentication',
          resourceId: username,
        });
        
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      dispatch({ type: 'LOGIN_FAILURE' });
      
      // Log login error
      auditService.log({
        action: 'LOGIN_ERROR',
        resource: 'authentication',
        resourceId: username,
      });
      
      return false;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      if (state.user) {
        // Log logout
        auditService.log({
          action: 'LOGOUT',
          resource: 'authentication',
          resourceId: state.user.id,
        });
      }

      // Call logout API
      await authService.logout();
      
      // Clear local storage
      localStorage.removeItem('theracare_token');
      localStorage.removeItem('user');
      
      // Update state
      dispatch({ type: 'LOGOUT' });
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if API call fails
      localStorage.removeItem('theracare_token');
      localStorage.removeItem('user');
      dispatch({ type: 'LOGOUT' });
    }
  };

  // Update user function
  const updateUser = (userData: Partial<User>) => {
    dispatch({ type: 'UPDATE_USER', payload: userData });
  };

  // Role checking function
  const hasRole = (role: UserRole | UserRole[]): boolean => {
    if (!state.user) return false;
    
    if (Array.isArray(role)) {
      return role.includes(state.user.role);
    }
    
    return state.user.role === role;
  };

  const value: AuthContextType = {
    state,
    login,
    logout,
    updateUser,
    hasRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};