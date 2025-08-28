import React, { useContext } from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider, AuthContext } from './services/auth';
import { NotificationProvider } from './contexts/NotificationContext';
import MainApp from './MainApp';
import LoginPage from './components/UserLogin';
import AdminDashboard from './components/AdminDashboard';
import './styles.css';

const AppRouter: React.FC = () => {
    const { user, isAdmin } = useContext(AuthContext);

    if (isAdmin) {
        return <AdminDashboard />;
    }

    if (user) {
        return <MainApp />;
    }

    return <LoginPage />;
};


const AppContainer: React.FC = () => {
    return (
        <AuthProvider>
            <NotificationProvider>
                <AppRouter />
            </NotificationProvider>
        </AuthProvider>
    );
};


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppContainer />
  </React.StrictMode>
);