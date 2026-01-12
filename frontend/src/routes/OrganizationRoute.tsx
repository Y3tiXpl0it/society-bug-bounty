// src/routes/OrganizationRoute.tsx
import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

/**
 * A protected route component for React Router.
 * It only allows access to child routes if the authenticated user is a member
 * of at least one organization.
 */
const OrganizationRoute: React.FC = () => {
    const { user, isLoading } = useAuth();

    // While the authentication status is being checked, render nothing to prevent
    // a flicker or a premature redirect. A loading spinner could also be shown here.
    if (isLoading) {
        return null;
    }

    // Determine if the user is a member of an organization.
    const isOrgMember = !!(
        user?.organizations && user.organizations.length > 0
    );

    // If the user is an organization member, render the nested child routes (the Outlet).
    // Otherwise, redirect them to the homepage.
    return isOrgMember ? <Outlet /> : <Navigate to="/" />;
};

export default OrganizationRoute;
