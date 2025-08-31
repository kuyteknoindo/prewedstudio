import React, { useState } from 'react';

const UserLogin: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('User logging in with:', { email, password });
        // Placeholder for login logic
        alert('User login functionality is a placeholder.');
    };

    return (
        <form onSubmit={handleLogin} style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
            <h2>User Login</h2>
            <div style={{ marginBottom: '10px' }}>
                <label htmlFor="user-email" style={{ display: 'block', marginBottom: '5px' }}>Email</label>
                <input
                    id="user-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                />
            </div>
            <div style={{ marginBottom: '10px' }}>
                <label htmlFor="user-password" style={{ display: 'block', marginBottom: '5px' }}>Password</label>
                <input
                    id="user-password"
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

export default UserLogin;
