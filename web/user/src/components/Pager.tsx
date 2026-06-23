"use client";
import { Pagination, Stack } from "@mui/material";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// 通用分页：翻页改 URL ?page=，由服务端重新取数渲染。
export default function Pager({ count, page }: { count: number; page: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (count <= 1) {
    return null;
  }
  const onChange = (_: unknown, p: number) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("page", String(p));
    router.push(`${pathname}?${sp.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <Stack sx={{ mt: 3, alignItems: "center" }}>
      <Pagination
        count={count}
        page={page}
        onChange={onChange}
        color="primary"
        shape="rounded"
        siblingCount={1}
        boundaryCount={1}
      />
    </Stack>
  );
}
