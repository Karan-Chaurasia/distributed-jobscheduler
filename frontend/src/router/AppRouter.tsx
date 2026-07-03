import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "../components/Layout";
import ProtectedRoute from "../components/ProtectedRoute";
import LoginPage from "../features/auth/LoginPage";
import DashboardPage from "../features/dashboard/DashboardPage";
import ProjectsPage from "../features/projects/ProjectsPage";
import JobsPage from "../features/jobs/JobsPage";
import QueuesPage from "../features/queues/QueuesPage";
import WorkersPage from "../features/workers/WorkersPage";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/queues" element={<QueuesPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/workers" element={<WorkersPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
