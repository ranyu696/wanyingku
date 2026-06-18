import { Skeleton, TableCell, TableRow } from "@mui/material";

// 列表加载骨架：在 TableBody 里渲染 rows×cols 个占位单元
export default function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <TableCell key={c}>
              <Skeleton animation="wave" height={20} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
