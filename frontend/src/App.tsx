// src/pages/App.tsx
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import OrganizationRoute from './routes/OrganizationRoute';
import ManageProgramsPage from './pages/ManageProgramsPage';
import CreateProgramPage from './pages/CreateProgramPage';
import HomePage from './pages/HomePage';
import EditProgramPage from './pages/EditProgramPage';
import ProgramDetailPage from './pages/ProgramDetailPage';
import ReportSubmitPage from './pages/ReportSubmitPage';
import ManageReportsPage from './pages/ManageReportsPage';
import ReportDetailPage from './pages/ReportDetailPage';
import BugBountyListPage from './pages/BugBountyListPage';
import MyReportsPage from './pages/MyReportsPage';
import ProfilePage from './pages/ProfilePage';

function App() {
    return (
        <>
            <Navbar />
            <Toaster position="bottom-right" />
            <div className="fixed-container bg-gray-50" style={{ height: 'calc(100vh - 4rem)', overflow: 'auto' }}>
                <main className="h-full">
                    <Routes>
                        <Route path="/" element={<HomePage />} />

                        <Route path="/programs" element={<BugBountyListPage />} />

                        <Route path="/my-reports" element={<MyReportsPage />} />

                        <Route path="/profile" element={<ProfilePage />} />

                        <Route path="/login" element={<LoginPage />} />

                        <Route path="/programs/:orgSlug/:progSlug" element={<ProgramDetailPage />} />

                        <Route path="/programs/:orgSlug/:progSlug/submit-report" element={<ReportSubmitPage />} />

                        <Route element={<OrganizationRoute />}>
                            <Route path="/manage-programs" element={<ManageProgramsPage />} />
                            <Route path="/create-program" element={<CreateProgramPage />} />
                            <Route path="/edit-program/:orgSlug/:progSlug" element={<EditProgramPage />} />
                            <Route path="/programs/:orgSlug/:progSlug/reports" element={<ManageReportsPage />} />
                            <Route path="/reports/:reportId" element={<ReportDetailPage />} />
                        </Route>
                    </Routes>
                </main>
            </div>
        </>
    );
}

export default App;
