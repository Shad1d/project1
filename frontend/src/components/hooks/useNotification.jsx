import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import Notification from '../common/Notification.jsx';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
    const [notification, setNotification] = useState({
        show: false,
        type: 'success',
        title: '',
        message: ''
    });

    const timerRef = useRef(null);

    const hideNotification = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        setNotification(prev => ({
            ...prev,
            show: false
        }));
    }, []);

    const showNotification = useCallback((type, title, message) => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        setNotification({
            show: true,
            type,
            title,
            message
        });

        // Auto hide notification after 5 seconds
        timerRef.current = setTimeout(() => {
            hideNotification();
        }, 5000);
    }, [hideNotification]);

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, []);

    const showSuccess = useCallback((title, message) => {
        showNotification('success', title, message);
    }, [showNotification]);

    const showError = useCallback((title, message) => {
        showNotification('error', title, message);
    }, [showNotification]);

    const showWarning = useCallback((title, message) => {
        showNotification('warning', title, message);
    }, [showNotification]);

    const showInfo = useCallback((title, message) => {
        showNotification('info', title, message);
    }, [showNotification]);

    const value = {
        notification,
        showNotification,
        hideNotification,
        showSuccess,
        showError,
        showWarning,
        showInfo
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
            <Notification
                show={notification.show}
                type={notification.type}
                title={notification.title}
                message={notification.message}
                onClose={hideNotification}
            />
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);

    // Fallback local state implementation if used outside NotificationProvider
    const [localNotification, setLocalNotification] = useState({
        show: false,
        type: 'success',
        title: '',
        message: ''
    });
    const localTimerRef = useRef(null);

    const localHide = useCallback(() => {
        if (localTimerRef.current) {
            clearTimeout(localTimerRef.current);
            localTimerRef.current = null;
        }
        setLocalNotification(prev => ({ ...prev, show: false }));
    }, []);

    const localShow = useCallback((type, title, message) => {
        if (localTimerRef.current) {
            clearTimeout(localTimerRef.current);
        }
        setLocalNotification({ show: true, type, title, message });
        localTimerRef.current = setTimeout(() => {
            localHide();
        }, 5000);
    }, [localHide]);

    if (context) {
        return context;
    }

    return {
        notification: localNotification,
        showNotification: localShow,
        hideNotification: localHide,
        showSuccess: (title, message) => localShow('success', title, message),
        showError: (title, message) => localShow('error', title, message),
        showWarning: (title, message) => localShow('warning', title, message),
        showInfo: (title, message) => localShow('info', title, message)
    };
};

export default useNotification;
