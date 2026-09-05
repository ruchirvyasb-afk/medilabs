import React from 'react';
import Header from './components/Header';
import './styles/globals.css';

const App: React.FC = () => {
    return (
        <div>
            <Header />
            <main>
                <h1>Welcome to My Fullstack App</h1>
                <p>This is a simple fullstack application using React and Node.js.</p>
            </main>
        </div>
    );
};

export default App;