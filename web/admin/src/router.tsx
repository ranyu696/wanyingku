import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Requests from "./pages/Requests";
import Review from "./pages/Review";
import SourceHealth from "./pages/SourceHealth";
import SourceItems from "./pages/SourceItems";
import Sources from "./pages/Sources";
import Titles from "./pages/Titles";
import Users from "./pages/Users";

const rootRoute = createRootRoute({ component: Layout });
const dashRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: Dashboard });
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: "/login", component: Login });
const sourcesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sources",
  component: Sources,
});
const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/review",
  component: Review,
});
const requestsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/requests",
  component: Requests,
});
const titlesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/titles", component: Titles });
const itemsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/items",
  component: SourceItems,
});
const usersRoute = createRoute({ getParentRoute: () => rootRoute, path: "/users", component: Users });
const healthRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/source-health",
  component: SourceHealth,
});

const routeTree = rootRoute.addChildren([
  dashRoute,
  loginRoute,
  sourcesRoute,
  reviewRoute,
  requestsRoute,
  titlesRoute,
  itemsRoute,
  usersRoute,
  healthRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
