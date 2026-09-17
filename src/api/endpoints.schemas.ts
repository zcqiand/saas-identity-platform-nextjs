// Barrel file: re-exports orval-generated schemas.
//
// orval v7 with `mode: "tags-split"` writes every type/interface/const to a
// single title.schemas.ts at the target root. Consumers import from
// `@/api/endpoints.schemas` for the legacy single-file import surface.
//
// 2026-09-17 Phase C5（用户裁定：类型只用生成物）：手写 legacy shim 层已全删——
// 11 个 msw 时代旧形状 interface（Menu/Role/User/CreateXxxRequest/...）与
// LoginRequest 的「非契约 data 包装」override 均无消费方，页面侧早已直用
// Sys 系生成类型。本文件从今以后只做纯 re-export，禁止再添加任何手写类型；
// 契约缺口走 shared tsp → orval 重生，不在此发明。
export type * from "./endpoints/title.schemas";
