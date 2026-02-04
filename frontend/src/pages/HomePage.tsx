// src/pages/HomePage.tsx
import { useTranslation } from 'react-i18next';

/**
 * A simple and welcoming homepage component for the application.
 * It serves as the main landing page for all visitors.
 */
const HomePage: React.FC = () => {
    const { t } = useTranslation();
    return (
        <div className="text-center p-10">
            <h1 className="text-4xl font-bold mb-4">{t('home.welcome')}</h1>
            <p className="text-lg">{t('home.subtitle')}</p>
        </div>
    );
};

export default HomePage;
