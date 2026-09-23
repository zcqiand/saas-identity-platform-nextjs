#!/usr/bin/env python3
"""canonicalize-schema.py — schema.ts 表块顺序 canonical 化（总账 5.98）。

drizzle-kit pull 输出的表块顺序随库目录布局漂移：同一库内逐次确定（2026-09-23 双拉
字节一致实测），但跨库/重建后翻面（saas_dev 与 saas_test 两种序，内容 multiset 全等；
当日 eea5fae 即错库 pull 把 saas_test 序提交进 HEAD 的实证）。schema.ts 是 DB-First
镜像产物（仅作 drift 比对，不参与 db:push，ADR-0025），块序无语义。

修法 = 5.91 opclass 剥离同族根治：按导出标识符字典序统一输出，使镜像与「哪个库、
何时重建」无关；错库 pull 不再产生伪漂移（真实 DDL diff 仍照常暴露）。

前提（由 pull-schema.sh 的 prettier 管线保证，本脚本不重复校验）：
- 无顶层注释；顶层只有 import 段 + 若干 `export const X = ...` 块，块间以空行分隔。
- import 段跨库稳定（2026-09-23 实测两库逐字节一致），故原样保留不排序。

用法：python scripts/canonicalize-schema.py [IN] [OUT]   # 缺省 stdin → stdout
"""

import re
import sys

_BLOCK_HEAD = re.compile(r"^export const (\w+)", re.MULTILINE)


def canonicalize(text: str) -> str:
    heads = list(_BLOCK_HEAD.finditer(text))
    if not heads:
        return text
    imports = text[: heads[0].start()].rstrip("\n")
    blocks = []
    for i, m in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else len(text)
        blocks.append((m.group(1), text[m.start() : end].rstrip("\n")))
    blocks.sort(key=lambda b: b[0])
    return imports + "\n\n" + "\n\n".join(b for _, b in blocks) + "\n"


def main() -> int:
    src = open(sys.argv[1], encoding="utf-8") if len(sys.argv) > 1 else sys.stdin
    text = src.read()
    out = canonicalize(text)
    if len(sys.argv) > 2:
        with open(sys.argv[2], "w", encoding="utf-8", newline="") as f:
            f.write(out)
    else:
        sys.stdout.write(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
