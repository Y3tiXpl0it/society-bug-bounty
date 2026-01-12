// src/pages/HomePage.tsx
import React from 'react';

/**
 * A simple and welcoming homepage component for the application.
 * It serves as the main landing page for all visitors.
 */
const HomePage: React.FC = () => {
    return (
        <div className="text-center p-10">
            <h1 className="text-4xl font-bold mb-4">Welcome!</h1>
            <p className="text-lg">Explore the available bug bounty programs.</p>
        </div>
    );
};

export default HomePage;
