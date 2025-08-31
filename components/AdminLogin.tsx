import React, { useState } from 'react';

const AdminLogin: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Admin logging in with:', { username, password });
        // Placeholder for login logic
        alert('Admin login functionality is a placeholder.');
    };

    return (
        <form onSubmit={handleLogin} style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
            <h2>Admin Login</h2>
            <div style={{ marginBottom: '10px' }}>
                <label htmlFor="admin-username" style={{ display: 'block', marginBottom: '5px' }}>Username</label>
                <input
                    id="admin-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                />
            </div>
            <div style={{ marginBottom: '10px' }}>
                <label htmlFor="admin-password" style={{ display: 'block', marginBottom: '5px' }}>Password</label>
                <input
                    id="admin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                />
            </div>
            <button type="submit" style={{ padding: '10px 15px' }}>Login</button>
        </form>
    );
};

export default AdminLogin;
