import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  type RouterHistory,
} from "@tanstack/react-router";
import { Box, Button, Typography } from "@mui/material";
import Layout from "./components/Layout";
import Category from "./pages/Category";
import Collection from "./pages/Collection";
import Detail from "./pages/Detail";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Mine from "./pages/Mine";
import Person from "./pages/Person";
import Rank from "./pages/Rank";
import Requests from "./pages/Requests";
import SearchPage from "./pages/Search";
import Watch from "./pages/Watch";
import { alova } from "./api/client";
import type { DetailResp, HomeData } from "./api/types";
import { loadWithSSR } from "./ssrData";

const rootRoute = createRootRoute({ component: Layout });

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Home,
  // 首页正文 SSR：服务端取 /home（含 banners + 各分类 sections），渲染出带影片的 HTML。
  // key 必须用路由 pathname "/"（entry-server 按 m.pathname 脱水），否则客户端找不到 SSR 快照
  // 会二次请求 /home，拿到与服务端渲染时不一致的数据 → 水合报错(React #418)。
  loader: () => loadWithSSR<HomeData>("/", async () => alova.Get<HomeData>("/home")),
});
const categoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/category",
  component: Category,
  validateSearch: (s: Record<string, unknown>): { kind?: number; sort?: string } => ({
    kind: s.kind != null ? Number(s.kind) : undefined,
    sort: typeof s.sort === "string" ? s.sort : undefined,
  }),
});
const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/search",
  component: SearchPage,
});
const mineRoute = createRoute({ getParentRoute: () => rootRoute, path: "/mine", component: Mine });
const rankRoute = createRoute({ getParentRoute: () => rootRoute, path: "/rank", component: Rank });
const requestsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/requests",
  component: Requests,
});
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: "/login", component: Login });
const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/title/$id",
  component: Detail,
  // 正文内容 SSR：服务端先取详情，渲染出带剧情/演职员/选集的 HTML；客户端首屏复用注入数据
  loader: ({ params }) =>
    loadWithSSR<DetailResp>(`/title/${params.id}`, async () =>
      alova.Get<DetailResp>(`/titles/${params.id}`),
    ),
});
const watchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/watch/$id",
  component: Watch,
  validateSearch: (s: Record<string, unknown>): { line?: number; ep?: number } => ({
    line: s.line != null ? Number(s.line) : undefined,
    ep: s.ep != null ? Number(s.ep) : undefined,
  }),
});
const personRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/person/$name",
  component: Person,
});
const collectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/collection/$key",
  component: Collection,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  categoryRoute,
  searchRoute,
  mineRoute,
  rankRoute,
  requestsRoute,
  loginRoute,
  detailRoute,
  watchRoute,
  personRoute,
  collectionRoute,
]);

// loader 失败（如详情 API 404/超时）的兜底页：可重试，避免卡白屏
function RouteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Box sx={{ py: 8, px: 2, textAlign: "center" }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        出错了
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        页面加载失败，请稍后重试
      </Typography>
      <Button variant="contained" onClick={reset}>
        重试
      </Button>
    </Box>
  );
}

function RouteNotFound() {
  return (
    <Box sx={{ py: 8, px: 2, textAlign: "center" }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        页面不存在
      </Typography>
      <Button variant="contained" component={Link} to="/" sx={{ mt: 1 }}>
        回首页
      </Button>
    </Box>
  );
}

// SSR 需要每次请求一个全新 router（带该请求的 history）；客户端用单例。
export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: RouteNotFound,
    ...(history ? { history } : {}),
  });
}

export const router = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
